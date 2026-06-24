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

from modules.database import (
    db_create_alert,
    db_create_intervention,
    db_get_employee_manager,
    db_get_employee_surveys,
    db_get_employee_profile,
    db_upsert_employee_profile,
    db_save_classifications,          
    db_get_employee_latest_zone,      
    db_cancel_open_interventions,     
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
    Full RAG pipeline classification using existing survey history +
    the newly entered comment and metric values.

    Pipeline:
      1. Load the employee's existing survey history from the DB
      2. Run sentiment model on the new comment
      3. Run zero-shot topic detector on the new comment
      4. Append the new row to the history DataFrame
      5. Pass the complete time series through build_features_for_employee()
         so sentiment_trend, sentiment_velocity, topic_* all reflect
         the full picture including the new update
      6. Classify with RAGClassifier.predict_one()
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

    # ── Step 1: Load existing survey history ─────────────────────────────────
    existing_surveys = db_get_employee_surveys(employee_id)
    history_df = pd.DataFrame(existing_surveys) if existing_surveys else pd.DataFrame()

    # ── Step 2: Sentiment on the new comment ─────────────────────────────────
    comment = body.comments or ""
    if comment.strip():
        sentiment_results = analyze_batch([comment])
        sentiment_score = sentiment_results[0]["score"]
        sentiment_label = sentiment_results[0]["label"]
    else:
        # No comment — inherit the last known sentiment if available,
        # otherwise neutral. This keeps trend/velocity meaningful.
        if not history_df.empty and "sentiment_score" in history_df.columns:
            last = history_df["sentiment_score"].dropna()
            sentiment_score = float(last.iloc[-1]) if len(last) else 0.0
        else:
            sentiment_score = 0.0
        sentiment_label = "neutral"

    # ── Step 3: Topic detection on the new comment ───────────────────────────
    topics_json = "{}"
    if comment.strip():
        try:
            topic_results = detect_topics_batch([comment])
            topics_json = json.dumps(topic_results[0]) if topic_results else "{}"
        except Exception as e:
            logger.warning(f"[ClassifyManual] Topic detection skipped: {e}")

    # ── Step 4: Build the new row and append to history ──────────────────────
    new_row = {
        "employee_id":      employee_id,
        "survey_date":      str(date.today()),
        "comments":         comment,
        "sentiment_score":  sentiment_score,
        "sentiment_label":  sentiment_label,
        "topics_json":      topics_json,
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

    new_row_df = pd.DataFrame([new_row])

    # Concatenate history + new row, sorted chronologically so trend/velocity
    # are computed in the correct direction (oldest → newest)
    combined_df = (
        pd.concat([history_df, new_row_df], ignore_index=True)
        .sort_values("survey_date")
        .reset_index(drop=True)
    )

    # ── Step 5: Engineer features ─────────────────────────────────────────────
    # Use the full history ONLY for trend/velocity features (direction of change).
    # Then override every point-in-time metric with the form values the HRBP
    # just entered — these represent the current state and must drive the result,
    # not be diluted by historical averages.
    features = build_features_for_employee(combined_df, employee_id)

    # Point-in-time overrides: form values take precedence over historical means
    METRIC_FIELDS = [
        "happiness_score", "excitement_level", "stress_level",
        "workload_level", "work_life_balance", "manager_support",
        "job_satisfaction", "productivity", "team_collaboration",
        "career_growth", "absenteeism",
    ]
    for field in METRIC_FIELDS:
        val = getattr(body, field, None)
        if val is not None:
            features[field] = float(val)
        elif features.get(field) is None:
            # Field not in form and no history — use zone-neutral midpoint
            features[field] = 5.0

    if body.score is not None:
        features["score"]       = float(body.score)
        features["latest_enps"] = float(body.score)

    # Current sentiment from the new comment is the most important signal.
    # avg_sentiment is a weighted blend: 80% new, 20% historical trend.
    # This reflects "how the employee feels NOW" rather than a lifetime average.
    historical_avg = features.get("avg_sentiment", 0.0) or 0.0
    features["avg_sentiment"] = round(0.8 * sentiment_score + 0.2 * historical_avg, 4)
    features["min_sentiment"]  = min(
        features.get("min_sentiment", sentiment_score), sentiment_score
    )

    # Topic features from the NEW comment fully replace historical topic averages
    # because topic detection was run on the new comment text
    if comment.strip():
        try:
            import json as _json
            parsed_topics = _json.loads(topics_json) if topics_json != "{}" else {}
            for topic_label in [
                "manager_relationship", "career_growth", "workload_pressure",
                "company_culture", "compensation_and_benefits",
                "work_life_balance", "team_collaboration",
            ]:
                safe = topic_label.replace(" ", "_")
                key  = f"topic_{safe}"
                confidence = parsed_topics.get(topic_label, parsed_topics.get(safe, 0.0))
                if confidence > 0.3:
                    features[key] = round(float(sentiment_score) * float(confidence), 4)
        except Exception as e:
            logger.warning(f"[ClassifyManual] Topic override failed: {e}")

    # ── Step 6: Classify ──────────────────────────────────────────────────────
    try:
        result = clf.predict_one(features)
    except Exception as e:
        logger.error(f"[ClassifyManual] Failed for {employee_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Classification failed: {e}")

    new_zone     = result["risk_zone"]
    previous_zone = db_get_employee_latest_zone(employee_id)

    # ── Persist the new classification ───────────────────────────────────────
    db_save_classifications([{
        "employee_id": employee_id,
        "risk_zone":   new_zone,
        "risk_score":  result["risk_score"],
        "probabilities": result.get("probabilities", {}),
        "top_factors":   result.get("top_factors", []),
    }])

    # ── If the zone changed, cancel all open interventions ───────────────────
    zone_changed           = previous_zone is not None and previous_zone != new_zone
    interventions_cancelled = 0
    if zone_changed:
        interventions_cancelled = db_cancel_open_interventions(employee_id)
        logger.info(
            f"[ClassifyManual] {employee_id} zone changed {previous_zone} → {new_zone}. "
            f"{interventions_cancelled} intervention(s) cancelled."
        )

    return {
        "employee_id":            employee_id,
        "risk_zone":              new_zone,
        "risk_score":             result["risk_score"],
        "probabilities":          result.get("probabilities", {}),
        "top_factors":            result.get("top_factors", []),
        "source":                 "manual_assessment",
        "sentiment_score":        round(sentiment_score, 4),
        "sentiment_label":        sentiment_label,
        "history_length":         len(combined_df),
        "previous_zone":          previous_zone,
        "zone_changed":           zone_changed,
        "interventions_cancelled": interventions_cancelled,
    }