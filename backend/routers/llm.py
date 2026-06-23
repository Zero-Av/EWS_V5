"""
routers/llm.py

Routes:
  POST /llm/connect      — connect to an LLM provider (ollama / anthropic / auto)
  GET  /llm/status       — check whether an LLM is currently connected
  POST /assistant/ask    — free-form workforce Q&A grounded in live data
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from modules.database import (  # patched as "routers.llm.*" in tests
    db_write_audit_log,
    get_dashboard_kpis,
    db_get_zone_trend,
    db_get_latest_classifications,
    db_get_alerts,
    db_get_department_aggregates,
)
from modules.llm import get_llm, answer_workforce_question  # patched via "modules.llm.*"
from routers.deps import AssistantAskRequest, LLMConnectRequest, LLMState, require_any

router = APIRouter(tags=["llm"])


@router.post("/llm/connect")
async def connect_llm(body: LLMConnectRequest, _: dict = Depends(require_any)):
    try:
        llm = get_llm(body.provider)
        LLMState.instance = llm
        if llm:
            return {"status": "connected", "provider": body.provider}
        return {"status": "unavailable", "provider": body.provider}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/llm/status")
async def llm_status(_: dict = Depends(require_any)):
    return {"connected": LLMState.instance is not None}


@router.post("/assistant/ask")
async def assistant_ask(body: AssistantAskRequest, user: dict = Depends(require_any)):
    """
    Takes the manager/HRBP's free-form question, assembles a real data
    snapshot (dashboard KPIs, current risk-zone trend, top at-risk
    employees, open alerts, department rollups), and passes BOTH the
    question and that snapshot to the connected LLM.
    """
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    try:
        kpis                = get_dashboard_kpis()
        kpis["zone_trend"]  = db_get_zone_trend()
        classifications     = db_get_latest_classifications()
        alerts              = db_get_alerts(limit=15, acknowledged=False)
        teams               = db_get_department_aggregates()
    except Exception as e:
        logger.error(f"[Assistant] Failed to build context: {e}")
        raise HTTPException(status_code=500, detail=f"Could not load workforce data: {e}")

    red   = sorted(
        [c for c in classifications if c["risk_zone"] == "RED"],
        key=lambda c: c.get("risk_score") or 0,
        reverse=True,
    )
    amber = [c for c in classifications if c["risk_zone"] == "AMBER"]

    context = {
        "dashboard_kpis": kpis,
        "top_critical_red_employees": [
            {
                "employee_id": c["employee_id"],
                "risk_score":  c.get("risk_score"),
                "top_factors": (c.get("top_factors") or [])[:3],
            }
            for c in red[:10]
        ],
        "amber_employee_ids": [c["employee_id"] for c in amber][:15],
        "open_alerts": [
            {"employee_id": a["employee_id"], "severity": a["severity"], "message": a["message"]}
            for a in alerts
        ],
        "departments": teams,
    }

    answer = answer_workforce_question(body.message, context)
    db_write_audit_log(user["username"], "assistant_ask", "assistant")
    return {"answer": answer}
