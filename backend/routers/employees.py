"""
routers/employees.py

Routes:
  GET  /employees/{employee_id}/sentiment         — sentiment history + topic breakdown
  POST /employees/{employee_id}/recommendations   — generate & persist a personalised recommendation
"""

from __future__ import annotations

import json as _json

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from modules.database import (  # patched as "routers.employees.*" in tests
    db_create_alert,
    db_create_intervention,
    db_get_employee_manager,
    db_get_employee_surveys,
    db_write_audit_log,
)
from modules.recommendations import generate_recommendation
from routers._helpers import build_employee_payload
from routers.deps import LLMState, require_any, require_manager_or_above

router = APIRouter(tags=["employees"])


@router.get("/employees/{employee_id}/sentiment")
async def employee_sentiment(employee_id: str, _: dict = Depends(require_any)):
    """Get sentiment history and topic breakdown for a specific employee."""
    surveys = db_get_employee_surveys(employee_id)
    if not surveys:
        raise HTTPException(status_code=404, detail="No survey data for this employee")

    history       = []
    topic_totals  = {}
    topic_counts  = {}

    for s in surveys:
        entry = {
            "survey_date":     s["survey_date"],
            "sentiment_score": s.get("sentiment_score"),
            "sentiment_label": s.get("sentiment_label"),
            "score":           s.get("score"),
            "comments":        s.get("comments", ""),
        }

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

    topic_breakdown = {
        topic: round(topic_totals[topic] / topic_counts[topic], 4)
        for topic in topic_totals
        if topic_counts[topic] > 0
    }

    scores   = [h["sentiment_score"] for h in history if h["sentiment_score"] is not None]
    velocity = round(scores[-1] - scores[-2], 4) if len(scores) >= 2 else 0.0

    return {
        "employee_id":       employee_id,
        "survey_count":      len(history),
        "history":           history,
        "topic_breakdown":   topic_breakdown,
        "current_sentiment": scores[-1] if scores else 0.0,
        "sentiment_velocity": velocity,
        "avg_sentiment":     round(sum(scores) / max(len(scores), 1), 4),
    }


@router.post("/employees/{employee_id}/recommendations")
async def generate_employee_recommendation(
    employee_id: str,
    assign_to_manager: bool = Query(True),
    user: dict = Depends(require_manager_or_above),
):
    """
    Generate (and persist) a personalised, LLM-driven recommendation for a
    single employee.  Falls back to a rule-based generator if no LLM is
    connected.
    """
    try:
        features, classification, recent_comments = build_employee_payload(employee_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        rec = generate_recommendation(
            employee_id=employee_id,
            features=features,
            classification=classification,
            recent_comments=recent_comments,
            llm=LLMState.instance,
        )
    except Exception as e:
        logger.error(f"[Recommendations] Generation failed for {employee_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Recommendation generation failed: {e}")

    assigned_to = db_get_employee_manager(employee_id) if assign_to_manager else None

    intervention_id = db_create_intervention(
        employee_id=employee_id,
        created_by=user["username"],
        reasoning=rec["reasoning"],
        actions=rec["actions"],
        priority=rec["priority"],
        timeline=rec["timeline"],
        assigned_to=assigned_to,
    )

    if rec["priority"] in ("high", "critical"):
        db_create_alert(
            employee_id,
            "recommendation_generated",
            "critical" if rec["priority"] == "critical" else "warning",
            f"New {rec['priority']} priority recommendation generated for {employee_id}: "
            f"{rec['actions'][0]['title']}",
        )

    db_write_audit_log(
        user["username"], "generate_recommendation", "intervention", str(intervention_id)
    )

    return {
        "status":          "ok",
        "intervention_id": intervention_id,
        "employee_id":     employee_id,
        "assigned_to":     assigned_to,
        **rec,
    }
