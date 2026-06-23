"""
routers/classification.py

Routes:
  POST /classify          — run RAG classification on all employees
  GET  /classifications   — retrieve latest classification per employee
"""

from __future__ import annotations

from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger

from modules.classifier import RAGClassifier                  # patched as "routers.classification.RAGClassifier"
from modules.database import (                                # patched as "routers.classification.*"
    db_create_alert,
    db_create_intervention,
    db_get_all_surveys,
    db_get_employee_manager,
    db_get_latest_classifications,
    db_save_classifications,
)
from modules.feature_engine import build_features_batch       # patched as "routers.classification.build_features_batch"
from modules.recommendations import generate_recommendation   # patched as "routers.classification.generate_recommendation"
from routers._helpers import build_employee_payload
from routers.deps import LLMState, require_any

router = APIRouter(tags=["classification"])


@router.post("/classify")
async def classify_employees(
    generate_recommendations: bool = Query(
        False,
        description=(
            "If true, also generate personalized LLM/rule-based recommendations "
            "for every RED/AMBER employee from this run."
        ),
    ),
    user: dict = Depends(require_any),
):
    """
    Run RAG classification on all employees using their aggregated features.
    Requires: surveys already ingested + model already trained.
    """
    try:
        surveys = db_get_all_surveys()
        if not surveys:
            raise ValueError("No survey data found. Upload surveys first.")

        surveys_df  = pd.DataFrame(surveys)
        features_df = build_features_batch(surveys_df)

        if features_df.empty:
            raise ValueError("Could not build features. Check survey data.")

        clf = RAGClassifier()
        if not clf.load():
            raise FileNotFoundError("No trained model found. Train the classifier first.")

        results = clf.predict(features_df)
        saved   = db_save_classifications(results)

        # Create alerts for RED employees
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

        recommendations_generated = 0
        if generate_recommendations:
            for r in results:
                if r["risk_zone"] not in ("RED", "AMBER"):
                    continue
                try:
                    emp_features, _, recent_comments = build_employee_payload(r["employee_id"])
                    rec = generate_recommendation(
                        employee_id=r["employee_id"],
                        features=emp_features,
                        classification=r,
                        recent_comments=recent_comments,
                        llm=LLMState.instance,
                    )
                    assigned_to = db_get_employee_manager(r["employee_id"])
                    db_create_intervention(
                        employee_id=r["employee_id"],
                        created_by=user["username"],
                        reasoning=rec["reasoning"],
                        actions=rec["actions"],
                        priority=rec["priority"],
                        timeline=rec["timeline"],
                        assigned_to=assigned_to,
                    )
                    recommendations_generated += 1
                except Exception as e:
                    logger.warning(
                        f"[Classify] Recommendation skipped for {r['employee_id']}: {e}"
                    )

        return {
            "status":                   "ok",
            "employees_classified":     len(results),
            "saved":                    saved,
            "alerts_created":           alerts_created,
            "recommendations_generated": recommendations_generated,
            "distribution": {
                zone: sum(1 for r in results if r["risk_zone"] == zone)
                for zone in ("GREEN", "AMBER", "RED")
            },
            "results": results,
        }

    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[Classify] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/classifications")
async def get_classifications(
    employee_id: Optional[str] = Query(None, description="Filter to a single employee"),
    _: dict = Depends(require_any),
):
    """Get the latest RAG classification for each employee (or one, if filtered)."""
    results = db_get_latest_classifications()
    if employee_id:
        results = [c for c in results if c["employee_id"] == employee_id]
    return {"classifications": results}
