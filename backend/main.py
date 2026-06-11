"""
main.py — EWS v5 FastAPI Backend
Sentiment-Driven RAG Classification Pipeline

Routes:
  POST /surveys/upload        — ingest survey CSV, run sentiment + topic analysis
  POST /classify              — run RAG classification on all employees
  POST /train                 — train RAG classifier on labelled data
  GET  /employees/{id}/sentiment — sentiment history + topic breakdown
  GET  /analytics/dashboard   — executive KPI dashboard
  GET  /analytics/alerts      — alert feed
  PATCH /analytics/alerts/{id}/acknowledge
  POST /llm/connect           — connect to LLM
  POST /surveys/summarize     — LLM thematic summary of survey comments
  + auth routes
  + user management
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
    UploadFile, File, Form, Query, Request,
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

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("EWS_SECRET_KEY", secrets.token_hex(32))
ALGORITHM  = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 8

# ─────────────────────────────────────────────────────────────────────────────
# APP & RATE LIMITING
# ─────────────────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app = FastAPI(title="EWS API", version="5.0.0")
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

# Logging
logger.add("logs/ews.log", rotation="20 MB", retention="14 days", level="INFO",
           format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")

# Initialize
logger.info("Initializing database...")
init_db()
logger.info("Database initialized.")
init_scheduler()


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} → {response.status_code} ({process_time:.3f}s)")
    return response


@app.get("/health", tags=["system"])
async def health_check():
    try:
        from modules.database import _connect
        conn = _connect()
        conn.cursor().execute("SELECT 1")
        conn.close()
        return {"status": "up", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    full_name: str

class UserInfo(BaseModel):
    username: str
    full_name: str
    role: str

class LLMConnectRequest(BaseModel):
    provider: str = "auto"

class AddUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str


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
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def require_any(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return user


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
_llm_instance = None

def _df_from_upload(file: UploadFile) -> pd.DataFrame:
    content = file.file.read()
    return pd.read_csv(io.BytesIO(content))


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/auth/login", response_model=Token, tags=["auth"])
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = db_authenticate_user(form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_token({"sub": user["username"], "role": user["role"]})
    db_write_audit_log(user["username"], "login", "auth")
    return Token(access_token=token, token_type="bearer", role=user["role"], full_name=user["full_name"])

@app.get("/auth/me", response_model=UserInfo, tags=["auth"])
async def me(user: dict = Depends(get_current_user)):
    return UserInfo(**{k: user[k] for k in ("username", "full_name", "role")})


# ─────────────────────────────────────────────────────────────────────────────
# USER MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/users", tags=["admin"])
async def list_users(_: dict = Depends(require_admin)):
    return {"users": db_list_users()}

@app.post("/users", tags=["admin"])
async def add_user(body: AddUserRequest, _: dict = Depends(require_admin)):
    try:
        db_create_user(body.username, body.password, body.full_name, body.role)
        return {"status": "created", "username": body.username}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/users/{username}", tags=["admin"])
async def remove_user(username: str, _: dict = Depends(require_admin)):
    if not db_delete_user(username):
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "deleted"}


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
# SURVEY INGESTION — The core data pipeline
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/surveys/upload", tags=["surveys"])
async def upload_surveys(
    file: UploadFile = File(...),
    run_topics: bool = Form(True),
    _: dict = Depends(require_any),
):
    """
    Upload a survey CSV. For each row:
      1. Run pretrained sentiment model → score (-1 to +1)
      2. Optionally run topic detection → topic relevance scores
      3. Store everything in the database

    Required columns: employee_id, survey_date, comments
    Optional columns: score, happiness_score, stress_level, department, etc.
    """
    from modules.sentiment import analyze_batch
    from modules.database import db_insert_surveys

    try:
        df = _df_from_upload(file)

        # Validate required columns
        required = {"employee_id", "survey_date", "comments"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        comments = df["comments"].fillna("").astype(str).tolist()

        # Step 1: Sentiment analysis
        logger.info(f"[Surveys] Running sentiment on {len(comments)} responses…")
        sentiment_results = analyze_batch(comments)

        # Step 2: Topic detection (optional, slower)
        topics_results = [{}] * len(comments)
        if run_topics:
            try:
                from modules.topic_detector import detect_topics_batch
                logger.info(f"[Surveys] Running topic detection…")
                topics_results = detect_topics_batch(comments)
            except Exception as e:
                logger.warning(f"[Surveys] Topic detection failed, continuing without: {e}")

        # Step 3: Build rows for DB insertion
        rows = []
        for i, (_, row) in enumerate(df.iterrows()):
            db_row = {
                "employee_id": str(row["employee_id"]),
                "survey_date": str(row["survey_date"]),
                "comments": str(row.get("comments", "")),
                "sentiment_score": sentiment_results[i]["score"],
                "sentiment_label": sentiment_results[i]["label"],
                "topics": topics_results[i],
            }

            # Copy all optional numeric/categorical columns
            for col in df.columns:
                if col not in {"employee_id", "survey_date", "comments"}:
                    val = row.get(col)
                    if pd.notna(val):
                        db_row[col] = val

            rows.append(db_row)

        count = db_insert_surveys(rows)

        return {
            "status": "ok",
            "surveys_ingested": count,
            "sentiment_summary": {
                "avg_score": round(sum(r["score"] for r in sentiment_results) / max(len(sentiment_results), 1), 4),
                "negative": sum(1 for r in sentiment_results if r["label"] == "negative"),
                "neutral": sum(1 for r in sentiment_results if r["label"] == "neutral"),
                "positive": sum(1 for r in sentiment_results if r["label"] == "positive"),
            },
            "topics_analyzed": run_topics,
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[Surveys] Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/surveys/summarize", tags=["surveys"])
async def summarize_surveys(_: dict = Depends(require_any)):
    """Fetch recent negative survey comments and summarize themes via LLM."""
    from modules.database import db_get_all_surveys
    from modules.llm import summarize_feedback

    surveys = db_get_all_surveys()
    negative_comments = [
        s["comments"] for s in surveys
        if s.get("sentiment_score") is not None
        and s["sentiment_score"] < -0.2
        and s.get("comments")
    ]

    if not negative_comments:
        return {"summary": "No significant negative feedback found."}

    summary = summarize_feedback(negative_comments[-30:])  # last 30 negative
    return {"summary": summary, "comment_count": len(negative_comments)}


# ─────────────────────────────────────────────────────────────────────────────
# RAG CLASSIFICATION
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/classify", tags=["classification"])
async def classify_employees(_: dict = Depends(require_any)):
    """
    Run RAG classification on all employees using their aggregated features.
    Requires: surveys already ingested + model already trained.
    """
    from modules.database import db_get_all_surveys, db_save_classifications
    from modules.feature_engine import build_features_batch
    from modules.classifier import RAGClassifier

    try:
        surveys = db_get_all_surveys()
        if not surveys:
            raise ValueError("No survey data found. Upload surveys first.")

        surveys_df = pd.DataFrame(surveys)
        features_df = build_features_batch(surveys_df)

        if features_df.empty:
            raise ValueError("Could not build features. Check survey data.")

        clf = RAGClassifier()
        if not clf.load():
            raise FileNotFoundError("No trained model found. Train the classifier first.")

        results = clf.predict(features_df)
        saved = db_save_classifications(results)

        # Create alerts for RED employees
        from modules.database import db_create_alert
        alerts_created = 0
        for r in results:
            if r["risk_zone"] == "RED":
                db_create_alert(
                    r["employee_id"],
                    "high_risk_classification",
                    "critical",
                    f"Employee {r['employee_id']} classified as RED (risk score: {r['risk_score']})",
                )
                alerts_created += 1

        return {
            "status": "ok",
            "employees_classified": len(results),
            "saved": saved,
            "alerts_created": alerts_created,
            "distribution": {
                zone: sum(1 for r in results if r["risk_zone"] == zone)
                for zone in ["GREEN", "AMBER", "RED"]
            },
            "results": results,
        }
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[Classify] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/classifications", tags=["classification"])
async def get_classifications(_: dict = Depends(require_any)):
    """Get the latest RAG classification for each employee."""
    from modules.database import db_get_latest_classifications
    return {"classifications": db_get_latest_classifications()}


# ─────────────────────────────────────────────────────────────────────────────
# TRAINING
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/train", tags=["admin"])
async def train_classifier(
    file: UploadFile = File(...),
    _: dict = Depends(require_admin),
):
    """
    Train the RAG classifier on labelled survey data.

    CSV must contain: employee_id, comments, risk_label (GREEN/AMBER/RED)
    Plus any numeric/categorical features.

    The pipeline:
      1. Run sentiment on all comments
      2. Build aggregated features per employee
      3. Train LightGBM classifier
    """
    from modules.sentiment import analyze_batch
    from modules.feature_engine import build_features_batch
    from modules.classifier import RAGClassifier

    try:
        df = _df_from_upload(file)

        required = {"employee_id", "comments", "risk_label"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        if len(df) < 10:
            raise ValueError("Need at least 10 rows to train.")

        # Step 1: Sentiment
        comments = df["comments"].fillna("").astype(str).tolist()
        logger.info(f"[Train] Running sentiment on {len(comments)} rows…")
        sentiment_results = analyze_batch(comments)

        df["sentiment_score"] = [r["score"] for r in sentiment_results]
        df["sentiment_label"] = [r["label"] for r in sentiment_results]

        # Ensure survey_date exists for feature engine
        if "survey_date" not in df.columns:
            df["survey_date"] = datetime.now().strftime("%Y-%m-%d")

        # Step 2: Build features
        logger.info("[Train] Building features…")
        features_df = build_features_batch(df)

        # Attach risk labels back
        label_map = dict(zip(df["employee_id"].astype(str), df["risk_label"]))
        features_df["risk_label"] = features_df["employee_id"].map(label_map)
        features_df = features_df.dropna(subset=["risk_label"])

        # Step 3: Train
        logger.info("[Train] Training classifier…")
        clf = RAGClassifier()
        metadata = clf.train(features_df)

        logger.info(f"[Train] ✓ Accuracy: {metadata['accuracy']:.4f}")
        return {"status": "ok", "metadata": metadata}

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[Train] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# EMPLOYEE SENTIMENT
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/employees/{employee_id}/sentiment", tags=["employees"])
async def employee_sentiment(employee_id: str, _: dict = Depends(require_any)):
    """
    Get sentiment history and topic breakdown for a specific employee.
    """
    from modules.database import db_get_employee_surveys
    import json as _json

    surveys = db_get_employee_surveys(employee_id)
    if not surveys:
        raise HTTPException(status_code=404, detail="No survey data for this employee")

    history = []
    topic_totals = {}
    topic_counts = {}

    for s in surveys:
        entry = {
            "survey_date": s["survey_date"],
            "sentiment_score": s.get("sentiment_score"),
            "sentiment_label": s.get("sentiment_label"),
            "score": s.get("score"),
            "comments": s.get("comments", ""),
        }

        # Parse topic data
        try:
            topics = _json.loads(s["topics_json"]) if s.get("topics_json") else {}
        except (TypeError, _json.JSONDecodeError):
            topics = {}

        entry["topics"] = topics
        history.append(entry)

        # Aggregate topic sentiment
        sent = s.get("sentiment_score", 0) or 0
        for topic, confidence in topics.items():
            if topic not in topic_totals:
                topic_totals[topic] = 0.0
                topic_counts[topic] = 0
            topic_totals[topic] += sent * confidence
            topic_counts[topic] += 1

    # Compute topic breakdown
    topic_breakdown = {}
    for topic in topic_totals:
        if topic_counts[topic] > 0:
            topic_breakdown[topic] = round(topic_totals[topic] / topic_counts[topic], 4)

    # Compute velocity
    scores = [h["sentiment_score"] for h in history if h["sentiment_score"] is not None]
    velocity = round(scores[-1] - scores[-2], 4) if len(scores) >= 2 else 0.0

    return {
        "employee_id": employee_id,
        "survey_count": len(history),
        "history": history,
        "topic_breakdown": topic_breakdown,
        "current_sentiment": scores[-1] if scores else 0.0,
        "sentiment_velocity": velocity,
        "avg_sentiment": round(sum(scores) / max(len(scores), 1), 4),
    }


# ─────────────────────────────────────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/analytics/dashboard", tags=["analytics"])
async def analytics_dashboard(_: dict = Depends(require_any)):
    from modules.database import get_dashboard_kpis
    return get_dashboard_kpis()


# ─────────────────────────────────────────────────────────────────────────────
# ALERTS
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/analytics/alerts", tags=["analytics"])
async def get_alerts(
    acknowledged: Optional[bool] = Query(None),
    limit: int = Query(50),
    _: dict = Depends(require_any),
):
    from modules.database import db_get_alerts
    return {"alerts": db_get_alerts(limit=limit, acknowledged=acknowledged)}

@app.patch("/analytics/alerts/{alert_id}/acknowledge", tags=["analytics"])
async def acknowledge_alert(alert_id: int, user: dict = Depends(require_any)):
    from modules.database import db_acknowledge_alert
    if not db_acknowledge_alert(alert_id, user["username"]):
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "acknowledged"}


# ─────────────────────────────────────────────────────────────────────────────
# MODEL INFO
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/model/info", tags=["admin"])
async def model_info(_: dict = Depends(require_any)):
    """Get metadata about the trained classifier."""
    import json as _json
    meta_path = os.path.join("models", "metadata.json")
    if not os.path.exists(meta_path):
        return {"has_model": False}
    with open(meta_path) as f:
        return {"has_model": True, "metadata": _json.load(f)}
