"""
routers/_helpers.py — Internal cross-router helpers.

NOT a FastAPI router — no routes are defined here.
"""

from __future__ import annotations

import pandas as pd

from modules.database import db_get_employee_surveys, db_get_latest_classifications
from modules.feature_engine import build_features_for_employee


def build_employee_payload(employee_id: str) -> tuple[dict, dict, list[str]]:
    """
    Assemble (features, classification, recent_comments) for one employee.

    Used as structured input to the recommendation generator in both the
    single-employee and bulk-intervention routes.

    Raises:
        ValueError: if no survey data exists for the employee.
    """
    surveys = db_get_employee_surveys(employee_id)
    if not surveys:
        raise ValueError(f"No survey data found for employee {employee_id}")

    surveys_df = pd.DataFrame(surveys).sort_values("survey_date")
    features   = build_features_for_employee(surveys_df, employee_id)

    classification = next(
        (c for c in db_get_latest_classifications() if c["employee_id"] == employee_id),
        {},
    )

    recent_comments = [
        s.get("comments", "") for s in surveys[-5:] if s.get("comments")
    ]

    return features, classification, recent_comments
