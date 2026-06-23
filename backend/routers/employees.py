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
    db_get_employee_profile,
    db_upsert_employee_profile,
    db_write_audit_log,
)
from modules.recommendations import generate_recommendation
from routers._helpers import build_employee_payload
from modules.classifier import RAGClassifier
from modules.sentiment import analyze_batch
from modules.topic_detector import detect_topics_batch
from modules.feature_engine import build_features_for_employee
from routers.deps import EmployeeProfileRequest, LLMState, require_any, require_manager_or_above

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


# ── Employee profile (HRBP assessment form) ───────────────────────────────────

@router.get("/employees/{employee_id}/profile")
async def get_employee_profile(employee_id: str, _: dict = Depends(require_any)):
    """Return the saved HRBP profile for one employee, or an empty dict."""
    profile = db_get_employee_profile(employee_id)
    return profile or {}


@router.put("/employees/{employee_id}/profile")
async def save_employee_profile(
    employee_id: str,
    body: EmployeeProfileRequest,
    user: dict = Depends(require_manager_or_above),
):
    """
    Upsert the HRBP-filled assessment for an employee.

    Stores all metric fields, free-text comments, and the manually assigned
    risk zone (hrbp_risk_zone).  This record is separate from the AI
    classification — the two can be viewed side-by-side on the employee card.
    """
    db_upsert_employee_profile(
        employee_id=employee_id,
        data=body.model_dump(exclude_none=False),
        updated_by=user["username"],
    )
    db_write_audit_log(user["username"], "save_employee_profile", "employee", employee_id)
    return {"status": "saved", "employee_id": employee_id}


@router.post("/employees/{employee_id}/classify-manual")
async def classify_employee_manual(
    employee_id: str,
    body: EmployeeProfileRequest,
    _: dict = Depends(require_any),
):
    """
    Run the full RAG pipeline against a manually entered assessment.

    Pipeline:
      1. Run sentiment model on the comment → real sentiment_score
      2. Run zero-shot topic detector on the comment → real topics_json
      3. Build a single-row DataFrame and pass through build_features_for_employee()
         so every aggregated feature (avg_sentiment, topic_*, etc.) is computed
         from the actual comment, not zeroed defaults
      4. Run RAGClassifier.predict_one() → zone + score + SHAP top_factors
    """
    import json
    import pandas as pd
    from datetime import date

    clf = RAGClassifier()
    if not clf.load():
        raise HTTPException(
            status_code=422,
            detail="No trained model found — upload survey data and train the classifier first.",
        )

    # ── Step 1: Sentiment ────────────────────────────────────────────────────
    comment = body.comments or ""
    if comment.strip():
        sentiment_results = analyze_batch([comment])
        sentiment_score = sentiment_results[0]["score"]
        sentiment_label = sentiment_results[0]["label"]
    else:
        sentiment_score = 0.0
        sentiment_label = "neutral"

    # ── Step 2: Topic detection ──────────────────────────────────────────────
    topics_json = "{}"
    if comment.strip():
        try:
            topic_results = detect_topics_batch([comment])
            topics_json = json.dumps(topic_results[0]) if topic_results else "{}"
        except Exception as e:
            logger.warning(f"[ClassifyManual] Topic detection skipped: {e}")

    # ── Step 3: Build single-row DataFrame and engineer features ─────────────
    row = {
        "employee_id":      employee_id,
        "survey_date":      str(date.today()),
        "comments":         comment,
        "sentiment_score":  sentiment_score,
        "sentiment_label":  sentiment_label,
        "topics_json":      topics_json,
        # All form metric fields
        "score":              body.score,
        "happiness_score":    body.happiness_score,
        "excitement_level":   body.excitement_level,
        "stress_level":       body.stress_level,
        "workload_level":     body.workload_level,
        "work_life_balance":  body.work_life_balance,
        "manager_support":    body.manager_support,
        "job_satisfaction":   body.job_satisfaction,
        "productivity":       body.productivity,
        "team_collaboration": body.team_collaboration,
        "career_growth":      body.career_growth,
        "absenteeism":        body.absenteeism,
    }

    df = pd.DataFrame([row])
    features = build_features_for_employee(df, employee_id)

    # ── Step 4: Classify ─────────────────────────────────────────────────────
    try:
        result = clf.predict_one(features)
    except Exception as e:
        logger.error(f"[ClassifyManual] Failed for {employee_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {e}")

    return {
        "employee_id":   employee_id,
        "risk_zone":     result["risk_zone"],
        "risk_score":    result["risk_score"],
        "probabilities": result.get("probabilities", {}),
        "top_factors":   result.get("top_factors", []),
        "source":        "manual_assessment",
        "sentiment_score": round(sentiment_score, 4),
        "sentiment_label": sentiment_label,
    }
