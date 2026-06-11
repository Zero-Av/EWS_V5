"""
main.py  —  EWS v3 FastAPI Backend
New in v3:
  - /analytics/dashboard     — executive KPI dashboard
  - /analytics/trends        — monthly workforce trend data
  - /analytics/alerts        — early warning alerts (GET, PATCH acknowledge)
  - /snapshots               — save prediction batch as historical snapshot
  - /interventions           — CRUD for recommendation tracking
  - /interventions/{id}/status — update manager action status
  - /interventions/{id}/note   — add manager note
  - /interventions/{id}/followup — record before/after metrics
  - /employees/{id}/history   — individual employee trend
  - /employees/{id}/issues    — persistent issue detection
"""

from __future__ import annotations

import io
import os
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import pandas as pd
from fastapi import (
    FastAPI, Depends, HTTPException, status,
    UploadFile, File, Form, Query, Request, Header
)
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
from modules.database import (
    init_db,
    db_get_user, db_authenticate_user, db_list_users,
    db_create_user, db_delete_user, db_write_audit_log,
)
from modules.scheduler import init_scheduler
import threading

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
SECRET_KEY  = os.getenv("EWS_SECRET_KEY", secrets.token_hex(32))
ALGORITHM   = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 8

# ─────────────────────────────────────────────────────────────────────────────
# APP & RATE LIMITING
# ─────────────────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app = FastAPI(title="EWS API", version="3.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Configure structured logging
# Single rolling log file — prevents a new file per restart (was ews_{time}.log)
logger.add(
    "logs/ews.log",
    rotation="20 MB",
    retention="14 days",
    level="INFO",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
)

# Initialize DB on startup

logger.info("Initializing database...")
init_db()
logger.info("Database initialized.")

# Initialize background scheduler (opt-in via SNAPSHOT_SCHEDULE_ENABLED env)

init_scheduler()

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(
        f"Method: {request.method} Path: {request.url.path} "
        f"Status: {response.status_code} Time: {process_time:.4f}s"
    )
    return response

@app.get("/health", tags=["system"])
async def health_check():
    """Liveness and readiness probe for Kubernetes/Docker."""
    try:
        from modules.database import _connect
        conn = _connect()
        conn.cursor().execute("SELECT 1")
        conn.close()
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"
        logger.error(f"Health check failed: {db_status}")
        raise HTTPException(status_code=503, detail="Database connection failed")
        
    return {
        "status": "up",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ─────────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type:   str
    role:         str
    full_name:    str

class UserInfo(BaseModel):
    username:  str
    full_name: str
    role:      str

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if user["role"] not in self.allowed_roles:
            logger.warning(f"User {user['username']} with role {user['role']} attempted to access restricted endpoint.")
            raise HTTPException(status_code=403, detail="Operation not permitted")
        return user

class LLMConnectRequest(BaseModel):
    provider: str = "auto"

class AddUserRequest(BaseModel):
    username:  str
    password:  str
    full_name: str
    role:      str

class InterventionCreateRequest(BaseModel):
    employee_id: str
    assigned_to: str
    priority:    str
    timeline:    str
    reasoning:   str
    actions:     list[str]
    due_date:    Optional[str] = None

class InterventionStatusRequest(BaseModel):
    status: str
    note:   str = ""

class InterventionNoteRequest(BaseModel):
    note: str

class FollowUpRequest(BaseModel):
    metrics_before: dict
    metrics_after:  dict
    risk_before:    float
    risk_after:     float

class EmployeeUpdateRequest(BaseModel):
    """Update one or more metrics for an employee — saves a new snapshot."""
    updates:       dict                  # e.g. {"happiness_score": 8, "stress_level": 3}
    snapshot_date: Optional[str] = None  # ISO date; defaults to today

class SwitchModelRequest(BaseModel):
    model_type: str   # one of SUPPORTED_MODELS

# ─────────────────────────────────────────────────────────────────────────────
# AUTH HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub", "")
        if not username:
            raise cred_exc
    except JWTError:
        raise cred_exc
    user = db_get_user(username)
    if not user or not user.get("is_active", True):
        raise cred_exc
    return user

def require_admin(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    if user["role"] not in ["admin", "hrbp"]:
        raise HTTPException(status_code=403, detail="Admin or HRBP access required")
    return user

def require_any(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return user

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
_llm_instance = None

def _load_model_metadata():
    path = os.path.join("models", "metadata.json")
    if not os.path.exists(path):
        return None
    with open(path) as f: 
        return json.load(f)

def _load_versions():
    path = os.path.join("models", "versions.json")
    if not os.path.exists(path): 
        return []
    with open(path) as f: 
        return json.load(f)

def _df_from_upload(file: UploadFile) -> pd.DataFrame:
    content = file.file.read()
    return pd.read_csv(io.BytesIO(content))

# ─────────────────────────────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/auth/login", response_model=Token, tags=["auth"])
async def login(form: OAuth2PasswordRequestForm = Depends()):
    logger.info(f"Login attempt for user: {form.username}")
    user = db_authenticate_user(form.username, form.password)
    if not user:
        logger.warning(f"Failed login attempt for user: {form.username}")
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_token({"sub": user["username"], "role": user["role"]})
    db_write_audit_log(user["username"], "login", "auth")
    logger.info(f"Successful login for user: {form.username}")
    return Token(access_token=token, token_type="bearer", role=user["role"], full_name=user["full_name"])

@app.get("/auth/me", response_model=UserInfo, tags=["auth"])
async def me(user: dict = Depends(get_current_user)):
    return UserInfo(**{k: user[k] for k in ("username", "full_name", "role")})

# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD (v2 compat + v3 enriched)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/dashboard", tags=["admin"])
async def dashboard(_: dict = Depends(require_any)):
    metadata = _load_model_metadata()
    versions = _load_versions()
    return {
        "model_metadata": metadata,
        "versions":       versions,
        "has_model":      metadata is not None,
    }

# ─────────────────────────────────────────────────────────────────────────────
# LLM
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/llm/connect", tags=["llm"])
async def connect_llm(body: LLMConnectRequest, _: dict = Depends(require_any)):
    global _llm_instance
    from modules.llm import get_llm
    try:
        llm = get_llm(body.provider)
        _llm_instance = llm
        if llm:
            return {"status": "connected", "provider": body.provider}
        return {"status": "unavailable", "provider": body.provider}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/llm/status", tags=["llm"])
async def llm_status(_: dict = Depends(require_any)):
    return {"connected": _llm_instance is not None}

# ─────────────────────────────────────────────────────────────────────────────
# PREDICT + RECOMMEND (enriched with attrition_prob + top_factors)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/predict", tags=["predict"])
async def predict(
    file:  UploadFile = File(...),
    top_k: int        = Form(5),
    save_to_history: bool = Form(False),   # if True, auto-saves snapshot + fires alerts
    _: dict = Depends(require_any),
):
    from modules.prediction import EmployeePredictor
    from modules.database   import create_alert_from_prediction, save_snapshots
    from modules.data_validation import validate_prediction_data
    try:
        df        = _df_from_upload(file)
        
        # ── Validate incoming data ──
        validation = validate_prediction_data(df)
        if not validation.is_valid:
            raise ValueError(f"Data validation failed: {validation.errors}")
            
        predictor = EmployeePredictor()
        results   = predictor.predict(df, top_k=top_k)

        alerts_fired = []
        if save_to_history:
            # Save snapshot
            today = datetime.now(timezone.utc).date().isoformat()
            save_snapshots(results, snapshot_date=today)
            # Fire alerts for at-risk employees
            for pred in results:
                if pred.get("prediction") in ("RED", "AMBER"):
                    fired = create_alert_from_prediction(pred)
                    alerts_fired.extend(fired)
        else:
            # Always fire alerts for RED/AMBER regardless of snapshot
            for pred in results:
                if pred.get("prediction") in ("RED", "AMBER"):
                    fired = create_alert_from_prediction(pred)
                    alerts_fired.extend(fired)

        return {
            "count":         len(results),
            "results":       results,
            "alerts_fired":  len(alerts_fired),
            "model_type":    predictor.model_type,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Shared progress state for /recommend/progress ────────────────────────────

_rec_progress: dict = {}   # job_id → {done, total, current_employee, results}
_rec_lock = threading.Lock()


@app.post("/recommend", tags=["predict"])
async def recommend(
    file:  UploadFile = File(...),
    top_k: int        = Form(5),
    _: dict = Depends(require_any),
):
    """
    Runs predictions then calls the LLM sequentially for each RED/AMBER employee.
    Returns job_id immediately so the frontend can poll /recommend/progress/{job_id}.
    Final results are also returned in the progress endpoint once done=total.
    """
    from modules.prediction      import EmployeePredictor
    from modules.recommendations import RecommendationEngine
    from modules.data_validation import validate_prediction_data
    import uuid
    import threading

    try:
        df        = _df_from_upload(file)
        
        # ── Validate incoming data ──
        validation = validate_prediction_data(df)
        if not validation.is_valid:
            raise ValueError(f"Data validation failed: {validation.errors}")
            
        predictor = EmployeePredictor()
        preds     = predictor.predict(df, top_k=top_k)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    job_id   = str(uuid.uuid4())
    at_risk  = [p for p in preds if p.get("prediction") in ("RED", "AMBER")]
    total_at_risk = len(at_risk)

    with _rec_lock:
        _rec_progress[job_id] = {
            "done":             0,
            "total":            total_at_risk,
            "current_employee": None,
            "results":          None,   # filled when complete
            "llm_used":         _llm_instance is not None,
            "error":            None,
        }

    # ── Patch generate_batch to report progress ───────────────────────────────
    engine   = RecommendationEngine(_llm_instance)
    pred_list = [dict(p) for p in preds]

    def _run_with_progress():
        try:
            # Monkey-patch generate() to update progress after each call
            original_generate = engine.generate

            def _tracked_generate(row):
                eid = row.get("employee_id", "?")
                with _rec_lock:
                    _rec_progress[job_id]["current_employee"] = eid
                result = original_generate(row)
                with _rec_lock:
                    _rec_progress[job_id]["done"] += 1
                    _rec_progress[job_id]["current_employee"] = eid + " ✓"
                return result

            engine.generate = _tracked_generate
            results = engine.generate_batch(pred_list)

            with _rec_lock:
                _rec_progress[job_id]["results"] = results
                _rec_progress[job_id]["current_employee"] = "Complete"
        except Exception as exc:
            with _rec_lock:
                _rec_progress[job_id]["error"] = str(exc)

    thread = threading.Thread(target=_run_with_progress, daemon=True)
    thread.start()

    return {
        "job_id":         job_id,
        "total_at_risk":  total_at_risk,
        "total_employees": len(pred_list),
        "llm_used":       _llm_instance is not None,
        "message":        "Recommendation generation started. Poll /recommend/progress/{job_id}",
    }


@app.get("/recommend/progress/{job_id}", tags=["predict"])
async def recommend_progress(job_id: str, _: dict = Depends(require_any)):
    """
    Poll this endpoint to track recommendation generation progress.
    Returns results[] when done == total.
    """
    with _rec_lock:
        state = _rec_progress.get(job_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Job ID not found")
    return {
        "job_id":           job_id,
        "done":             state["done"],
        "total":            state["total"],
        "current_employee": state["current_employee"],
        "complete":         state["results"] is not None or state["error"] is not None,
        "results":          state["results"],
        "llm_used":         state["llm_used"],
        "error":            state["error"],
    }

# ─────────────────────────────────────────────────────────────────────────────
# SNAPSHOTS — save prediction batch to history
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/snapshots", tags=["analytics"])
async def save_snapshot(
    file:          UploadFile = File(...),
    snapshot_date: str        = Form(""),
    top_k:         int        = Form(3),
    user: dict = Depends(require_any),
):
    """Run predictions and persist as historical snapshot. Also triggers alert checks."""
    from modules.prediction import EmployeePredictor
    from modules.database   import save_snapshots, get_employee_history, check_and_create_alerts
    try:
        df        = _df_from_upload(file)
        predictor = EmployeePredictor()
        preds     = predictor.predict(df, top_k=top_k)

        date_str = snapshot_date.strip() or datetime.now(timezone.utc).date().isoformat()
        saved    = save_snapshots(preds, snapshot_date=date_str)

        # Check alerts by comparing with previous snapshot
        alerts_fired = []
        for pred in preds:
            eid     = pred["employee_id"]
            history = get_employee_history(eid, months=3)
            if len(history) >= 2:
                prev = history[-2]
                curr = history[-1]
                fired = check_and_create_alerts(dict(prev), {**dict(curr), **pred})
                alerts_fired.extend(fired)

        return {
            "saved":         saved,
            "snapshot_date": date_str,
            "alerts_fired":  len(alerts_fired),
            "alerts":        alerts_fired[:10],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS — Dashboard KPIs, Trends, Alerts
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/analytics/dashboard", tags=["analytics"])
async def analytics_dashboard(user: dict = Depends(require_any)):
    from modules.database import get_dashboard_kpis
    manager_username = user["username"] if user["role"] == "manager" else None
    return get_dashboard_kpis(manager_username=manager_username)

@app.get("/analytics/report/excel", tags=["analytics"])
async def export_excel_report(user: dict = Depends(require_any)):
    from modules.database import _connect, get_dashboard_kpis
    manager_username = user["username"] if user["role"] == "manager" else None
    
    # Get KPIs
    kpis = get_dashboard_kpis(manager_username=manager_username)
    
    conn = _connect()
    
    # Get High Risk Employees
    where_manager = "AND employee_id IN (SELECT employee_id FROM employees WHERE manager_username = ?)" if manager_username else ""
    params = [manager_username] if manager_username else []
    
    risk_query = f"""
        WITH latest AS (
            SELECT employee_id, MAX(snapshot_date) AS max_date
            FROM employee_snapshots GROUP BY employee_id
        )
        SELECT s.employee_id, s.risk_score, s.risk_zone, s.attrition_prob, s.snapshot_date
        FROM employee_snapshots s
        JOIN latest l ON s.employee_id=l.employee_id AND s.snapshot_date=l.max_date
        WHERE s.risk_zone IN ('RED', 'AMBER')
        {where_manager}
        ORDER BY s.risk_score DESC
    """
    risk_df = pd.read_sql_query(risk_query, conn, params=params)
    
    # Get recent survey comments
    comments_query = """
        SELECT s.employee_id, s.survey_date, s.score, s.feedback_text
        FROM surveys s
        WHERE s.feedback_text IS NOT NULL AND s.feedback_text != ''
        ORDER BY s.survey_date DESC
    """
    comments_df = pd.read_sql_query(comments_query, conn)
    
    conn.close()
    
    # Create Excel
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Sheet 1: KPIs
        kpi_df = pd.DataFrame([kpis])
        kpi_df.to_excel(writer, sheet_name="Dashboard KPIs", index=False)
        
        # Sheet 2: High Risk Roster
        risk_df.to_excel(writer, sheet_name="High Risk Employees", index=False)
        
        # Sheet 3: Survey Comments
        comments_df.to_excel(writer, sheet_name="Survey Feedback", index=False)
        
    output.seek(0)
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="EWS_Intelligence_Report.xlsx"'}
    )

@app.get("/analytics/trends", tags=["analytics"])
async def analytics_trends(
    months: int = Query(6, ge=1, le=24),
    user: dict = Depends(require_any),
):
    from modules.database import get_trend_summary
    manager_username = user["username"] if user["role"] == "manager" else None
    return {"months": months, "data": get_trend_summary(months=months, manager_username=manager_username)}

@app.get("/analytics/drift", tags=["analytics"])
async def analytics_drift(
    limit: int = Query(30, ge=1, le=365),
    user: dict = Depends(require_any),
):
    from modules.database import db_get_drift_metrics
    return {"drift_metrics": db_get_drift_metrics(limit=limit)}

@app.get("/analytics/alerts", tags=["analytics"])
async def get_alerts(
    employee_id: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(require_any),
):
    from modules.database import get_alerts as db_get_alerts
    manager_username = user["username"] if user["role"] == "manager" else None
    return {"alerts": db_get_alerts(employee_id=employee_id, acknowledged=acknowledged, manager_username=manager_username, limit=limit)}

@app.patch("/analytics/alerts/{alert_id}/acknowledge", tags=["analytics"])
async def acknowledge_alert(alert_id: int, user: dict = Depends(require_any)):
    from modules.database import acknowledge_alert as db_ack
    ok = db_ack(alert_id, user["username"])
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "acknowledged"}

# ─────────────────────────────────────────────────────────────────────────────
# EMPLOYEE — individual history + persistent issues
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/employees/{employee_id}/history", tags=["analytics"])
async def employee_history(
    employee_id: str,
    months: int = Query(12, ge=1, le=36),
    _: dict = Depends(require_any),
):
    from modules.database import get_employee_history
    data = get_employee_history(str(employee_id), months=months)
    return {"employee_id": employee_id, "snapshots": data}

@app.get("/employees/{employee_id}/issues", tags=["analytics"])
async def employee_issues(
    employee_id: str,
    threshold_months: int = Query(3, ge=2, le=12),
    _: dict = Depends(require_any),
):
    from modules.database import get_persistent_issues
    issues = get_persistent_issues(str(employee_id), threshold_months=threshold_months)
    return {"employee_id": employee_id, "persistent_issues": issues, "threshold_months": threshold_months}

@app.patch("/employees/{employee_id}", tags=["analytics"])
async def update_employee(
    employee_id: str,
    body: EmployeeUpdateRequest,
    _: dict = Depends(require_any),
):
    """
    Update one or more metrics for an employee.
    Inserts a new snapshot row so the change is reflected in Trend Analysis.
    Also re-fires alerts if risk thresholds are crossed.
    """
    from modules.database import update_employee_snapshot, check_and_create_alerts, get_employee_history
    try:
        new_snap = update_employee_snapshot(
            employee_id=str(employee_id),
            updates=body.updates,
            snapshot_date=body.snapshot_date,
        )

        # Check alerts vs previous snapshot
        history = get_employee_history(str(employee_id), months=3)
        alerts_fired = []
        if len(history) >= 2:
            prev = history[-2]
            fired = check_and_create_alerts(dict(prev), dict(new_snap))
            alerts_fired.extend(fired)

        return {
            "status":       "updated",
            "employee_id":  employee_id,
            "snapshot":     new_snap,
            "alerts_fired": len(alerts_fired),
            "alerts":       alerts_fired,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────────────────────────────────────
# INTERVENTIONS — full CRUD
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/interventions", tags=["interventions"])
async def list_interventions(
    employee_id: Optional[str] = Query(None),
    status:      Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    limit:       int            = Query(100),
    user: dict = Depends(require_any),
):
    from modules.database import get_interventions
    manager_username = user["username"] if user["role"] == "manager" else None
    return {"interventions": get_interventions(
        employee_id=employee_id, status=status, assigned_to=assigned_to, 
        manager_username=manager_username, limit=limit
    )}

@app.post("/interventions/check-slas", tags=["interventions"])
async def check_intervention_slas(_: dict = Depends(require_admin)):
    from modules.database import enforce_intervention_slas
    escalated_count = enforce_intervention_slas()
    return {"status": "ok", "escalated_count": escalated_count, "message": f"Escalated {escalated_count} overdue interventions."}

@app.post("/interventions", tags=["interventions"])
async def create_intervention(body: InterventionCreateRequest, user: dict = Depends(require_any)):
    from modules.database import create_intervention as db_create
    new_id = db_create(
        employee_id=body.employee_id,
        created_by=user["username"],
        assigned_to=body.assigned_to,
        priority=body.priority,
        timeline=body.timeline,
        reasoning=body.reasoning,
        actions=body.actions,
        due_date=body.due_date,
    )
    return {"status": "created", "intervention_id": new_id}

@app.get("/interventions/{intervention_id}", tags=["interventions"])
async def get_intervention(intervention_id: int, _: dict = Depends(require_any)):
    from modules.database import get_interventions, get_intervention_actions
    items = get_interventions()
    item = next((i for i in items if i["id"] == intervention_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Intervention not found")
    item["action_log"] = get_intervention_actions(intervention_id)
    return item

@app.patch("/interventions/{intervention_id}/status", tags=["interventions"])
async def update_status(
    intervention_id: int,
    body: InterventionStatusRequest,
    user: dict = Depends(require_any),
):
    from modules.database import update_intervention_status
    try:
        ok = update_intervention_status(intervention_id, body.status, user["username"], body.note)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return {"status": "updated", "new_status": body.status}

@app.post("/interventions/{intervention_id}/note", tags=["interventions"])
async def add_note(
    intervention_id: int,
    body: InterventionNoteRequest,
    user: dict = Depends(require_any),
):
    from modules.database import add_intervention_note
    ok = add_intervention_note(intervention_id, user["username"], body.note)
    if not ok:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return {"status": "noted"}

@app.post("/interventions/{intervention_id}/followup", tags=["interventions"])
async def record_followup(
    intervention_id: int,
    body: FollowUpRequest,
    _: dict = Depends(require_any),
):
    from modules.database import get_interventions, record_follow_up
    items = get_interventions()
    item = next((i for i in items if i["id"] == intervention_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Intervention not found")
    result = record_follow_up(
        intervention_id=intervention_id,
        employee_id=item["employee_id"],
        metrics_before=body.metrics_before,
        metrics_after=body.metrics_after,
        risk_before=body.risk_before,
        risk_after=body.risk_after,
    )
    return {"status": "recorded", **result}

@app.get("/interventions/{intervention_id}/followup", tags=["interventions"])
async def get_followup(intervention_id: int, _: dict = Depends(require_any)):
    from modules.database import get_follow_up
    fu = get_follow_up(intervention_id)
    if not fu:
        raise HTTPException(status_code=404, detail="No follow-up recorded yet")
    return fu

# ─────────────────────────────────────────────────────────────────────────────
# TRAIN / EVALUATE / RETRAIN (unchanged from v2)
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/train", tags=["admin"])
async def train(
    file:          UploadFile = File(...),
    optuna_trials: int        = Form(20),
    _: dict = Depends(require_admin),
):
    """
    Train the soft-voting ensemble (RF + LightGBM).
    Each member is tuned independently by Optuna.
    The best single member is saved for SHAP TreeExplainer.
    """
    from modules.training      import ModelTrainer
    from modules.explainability import invalidate_explainer_cache
    from modules.data_validation import validate_training_data
    try:
        df      = _df_from_upload(file)
        
        # ── Validate incoming data ──
        validation = validate_training_data(df)
        if not validation.is_valid:
            raise ValueError(f"Training data validation failed: {validation.errors}")
            
        trainer = ModelTrainer()
        results = trainer.train(df, optuna_trials=optuna_trials)
        invalidate_explainer_cache()   # force SHAP to reload new best estimator
        return {"status": "ok", "results": results}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/models/switch", tags=["admin"])
async def switch_model(body: SwitchModelRequest, _: dict = Depends(require_admin)):
    """
    Switch the SHAP explainer to a specific ensemble member.
    The voting ensemble always stays active for predictions;
    this only changes which member backs the SHAP explanations.
    """
    import shutil
    import json
    from modules.training      import MODEL_LABELS
    from modules.explainability import invalidate_explainer_cache
    from config import (
        ENSEMBLE_MEMBER_FILES, BEST_ESTIMATOR_FILE, BEST_ESTIMATOR_META,
        ENSEMBLE_MEMBERS,
    )
    if body.model_type not in ENSEMBLE_MEMBERS:
        raise HTTPException(
            status_code=422,
            detail=f"model_type must be one of {ENSEMBLE_MEMBERS}",
        )
    src = ENSEMBLE_MEMBER_FILES.get(body.model_type)
    if not src or not os.path.exists(src):
        raise HTTPException(
            status_code=404,
            detail=f"Member '{body.model_type}' has not been trained yet. Run /train first.",
        )
    shutil.copy(src, BEST_ESTIMATOR_FILE)
    with open(BEST_ESTIMATOR_META, "w") as f:
        json.dump({
            "member":   body.model_type,
            "label":    MODEL_LABELS.get(body.model_type, body.model_type),
            "manually_set": True,
        }, f, indent=2)
    invalidate_explainer_cache()
    return {
        "status":       "switched",
        "shap_member":  body.model_type,
        "note":         "Ensemble predictions unchanged. SHAP now uses this member.",
    }


@app.get("/models/available", tags=["admin"])
async def available_models(_: dict = Depends(require_any)):
    """Return ensemble status + per-member training state and SHAP assignment."""
    import json
    from config import (
        MODEL_FILE, ENSEMBLE_MEMBERS, ENSEMBLE_MEMBER_FILES,
        BEST_ESTIMATOR_META, MODEL_LABELS_CFG,
    )

    ensemble_trained = os.path.exists(MODEL_FILE)

    # Which member is currently backing SHAP?
    shap_member = None
    if os.path.exists(BEST_ESTIMATOR_META):
        with open(BEST_ESTIMATOR_META) as f:
            shap_member = json.load(f).get("member")

    members = []
    for m in ENSEMBLE_MEMBERS:
        members.append({
            "model_type": m,
            "label":      MODEL_LABELS_CFG.get(m, m),
            "trained":    os.path.exists(ENSEMBLE_MEMBER_FILES[m]),
            "shap_active": m == shap_member,
        })

    return {
        "ensemble": {
            "trained": ensemble_trained,
            "label":   MODEL_LABELS_CFG["ensemble"],
        },
        "members":      members,
        "shap_member":  shap_member,
        "active":       "ensemble",
    }

@app.post("/evaluate", tags=["admin"])
async def evaluate(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    from modules.evaluation import ModelEvaluator
    try:
        df        = _df_from_upload(file)
        evaluator = ModelEvaluator()
        results   = evaluator.evaluate(df)
        results.pop("predictions", None)
        return {"status": "ok", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/retrain", tags=["admin"])
async def retrain(
    file:          UploadFile = File(...),
    optuna_trials: int        = Form(20),
    _: dict = Depends(require_admin),
):
    from modules.retraining import IncrementalTrainer
    from modules.data_validation import validate_training_data
    try:
        df      = _df_from_upload(file)
        
        # ── Validate incoming data ──
        validation = validate_training_data(df)
        if not validation.is_valid:
            raise ValueError(f"Retraining data validation failed: {validation.errors}")
            
        trainer = IncrementalTrainer()
        results = trainer.retrain(df, optuna_trials=optuna_trials)
        return {"status": "ok", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/retrain/backups", tags=["admin"])
async def list_backups(_: dict = Depends(require_admin)):
    from modules.retraining import IncrementalTrainer
    return {"backups": IncrementalTrainer().list_backups()}

@app.post("/retrain/rollback", tags=["admin"])
async def rollback(backup_name: str = Form(...), _: dict = Depends(require_admin)):
    from modules.retraining import IncrementalTrainer
    try:
        IncrementalTrainer().rollback(backup_name)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────────────────────────────────────
# USER MANAGEMENT (DB-backed, bcrypt passwords)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/users", tags=["admin"])
async def list_users(_: dict = Depends(require_admin)):
    users = db_list_users()
    return [{"username": u["username"], "full_name": u["full_name"], "role": u["role"]} for u in users]

@app.post("/users", tags=["admin"])
async def add_user(body: AddUserRequest, admin: dict = Depends(require_admin)):
    ALLOWED_ROLES = {"admin", "manager", "hrbp"}
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=422,
            detail=f"Role must be one of: {sorted(ALLOWED_ROLES)}"
        )
    existing = db_get_user(body.username)
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")
    try:
        db_create_user(body.username, body.password, body.full_name, body.role)
        db_write_audit_log(admin["username"], "create_user", "user", body.username)
        return {"status": "created", "username": body.username}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/users/{username}", tags=["admin"])
async def delete_user(username: str, user: dict = Depends(require_admin)):
    if username == user["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    if not db_get_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    db_delete_user(username)
    db_write_audit_log(user["username"], "delete_user", "user", username)
    return {"status": "deleted"}

@app.get("/models/metadata", tags=["admin"])
async def model_metadata(_: dict = Depends(require_admin)):
    m = _load_model_metadata()
    if not m: 
        raise HTTPException(status_code=404, detail="No trained model found")
    return m

@app.get("/models/versions", tags=["admin"])
async def model_versions(_: dict = Depends(require_admin)):
    return {"versions": _load_versions()}

# ─────────────────────────────────────────────────────────────────────────────
# ADMIN: NOTIFICATIONS & SCHEDULER
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/admin/notification-status", tags=["admin"])
async def notification_status(_: dict = Depends(require_admin)):
    """Returns which notification channels (email, webhook) are configured."""
    from modules.notifications import get_notification_status
    return get_notification_status()

@app.get("/admin/scheduler/status", tags=["admin"])
async def scheduler_status(_: dict = Depends(require_admin)):
    """Returns the current scheduler status."""
    from modules.scheduler import get_scheduler_status
    return get_scheduler_status()

@app.post("/admin/scheduler/trigger", tags=["admin"])
async def scheduler_trigger(user: dict = Depends(require_admin)):
    """Manually trigger a scheduled snapshot run."""
    from modules.scheduler import trigger_snapshot_now
    try:
        result = trigger_snapshot_now()
        db_write_audit_log(user["username"], "manual_snapshot_trigger", "scheduler")
        return {"status": "ok", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2: EMPLOYEES & SURVEY INGESTION
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/employees/import", tags=["admin"])
async def import_employees(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    """Import employee hierarchy mapping from CSV (employee_id, name, department, manager_username)."""
    from modules.database import db_upsert_employee
    try:
        df = _df_from_upload(file)
        required_cols = {"employee_id", "name", "department", "manager_username"}
        if not required_cols.issubset(set(df.columns)):
            raise ValueError(f"CSV must contain columns: {required_cols}")
            
        count = 0
        for _, row in df.iterrows():
            db_upsert_employee(
                employee_id=str(row["employee_id"]),
                name=str(row["name"]),
                department=str(row["department"]),
                manager_username=str(row["manager_username"])
            )
            count += 1
            
        return {"status": "ok", "message": f"Successfully imported {count} employees."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/surveys/ingest", tags=["admin"])
async def ingest_surveys(file: UploadFile = File(...), _: dict = Depends(require_admin)):
    """Ingest survey scores (e.g., eNPS) from CSV (employee_id, survey_date, survey_type, score, feedback_text). Calculates sentiment on feedback."""
    from modules.database import db_insert_survey
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
    
    analyzer = SentimentIntensityAnalyzer()
    try:
        df = _df_from_upload(file)
        required_cols = {"employee_id", "survey_date", "survey_type", "score"}
        if not required_cols.issubset(set(df.columns)):
            raise ValueError(f"CSV must contain columns: {required_cols}")
            
        count = 0
        for _, row in df.iterrows():
            feedback = str(row.get("feedback_text", ""))
            feedback = feedback if feedback != "nan" else ""
            
            sentiment_score = None
            if feedback.strip():
                sentiment_score = analyzer.polarity_scores(feedback)["compound"]
                
            db_insert_survey(
                employee_id=str(row["employee_id"]),
                survey_date=str(row["survey_date"]),
                survey_type=str(row["survey_type"]),
                score=int(row["score"]),
                feedback_text=feedback,
                sentiment_score=sentiment_score
            )
            count += 1
            
        return {"status": "ok", "message": f"Successfully ingested {count} survey records."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/surveys/summarize", tags=["analytics"])
async def summarize_surveys(_: dict = Depends(require_any)):
    """Fetches recent negative/passive survey feedback and summarizes it into themes using LLM."""
    from modules.database import db_get_negative_feedback
    from modules.llm import summarize_feedback
    
    comments = db_get_negative_feedback(limit=30)
    if not comments:
        return {"summary": "Not enough recent feedback to summarize."}
        
    summary = summarize_feedback(comments)
    return {"summary": summary}

@app.post("/hris/sync", tags=["admin"])
async def sync_hris_data(provider: str = "workday", x_api_key: str = Header(None)):
    """HRIS integration — not yet implemented. Returns 501 until a real connector is built."""
    expected_key = os.getenv("HRIS_API_KEY")
    if not expected_key:
        raise HTTPException(status_code=503, detail="HRIS integration not configured")
    if not x_api_key or x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Invalid HRIS API Key")
    raise HTTPException(
        status_code=501,
        detail="HRIS integration is not yet implemented. This endpoint is a placeholder."
    )
