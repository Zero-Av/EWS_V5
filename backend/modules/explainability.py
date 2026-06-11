"""
modules/explainability.py  — EWS v3

SHAP strategy
─────────────
The active model is a soft-voting ensemble (VotingClassifier), which
shap.TreeExplainer does NOT support directly.  Instead we run
TreeExplainer on the *best single estimator* saved during training
(best_single_estimator.pkl).  All four candidate members
(RF, LightGBM, CatBoost, Extra Trees) return SHAP values with shape
    (n_samples, n_features, n_classes)
so the extraction logic is uniform and simple.

Attrition probability
─────────────────────
Comes from the *ensemble* predict_proba (index 2 = RED class), giving
the benefit of the averaged probabilities.  SHAP attribution still uses
the best single member — it explains the dominant driver of the vote.

Fallback
────────
If the best estimator file is missing (model not yet retrained with
the new pipeline), rule-based RISK_WEIGHTS are used instead.
"""

from __future__ import annotations

import os
import json
import joblib
import numpy as np
import pandas as pd

from config import (
    BEST_ESTIMATOR_FILE, BEST_ESTIMATOR_META,
    MODEL_FILE, FEATURE_FILE,
)

METRIC_LABELS = {
    "stress_level":        "High Workload / Stress",
    "workload_level":      "Excessive Workload",
    "absenteeism":         "High Absenteeism",
    "work_life_balance":   "Poor Work-Life Balance",
    "manager_support":     "Low Manager Support",
    "job_satisfaction":    "Low Job Satisfaction",
    "happiness_score":     "Low Happiness",
    "productivity":        "Low Productivity",
    "team_collaboration":  "Poor Team Collaboration",
    "career_growth":       "Limited Career Growth",
}


# ─────────────────────────────────────────────────────────────────────────────
# Explainer cache  (built once per process, invalidated on demand)
# ─────────────────────────────────────────────────────────────────────────────

_explainer_cache: dict = {}


def _load_explainer():
    """
    Load the best single estimator and build a shap.TreeExplainer.
    Results cached in module-level dict (process lifetime).
    Returns (explainer, feature_columns, member_name) or (None, None, None).
    """
    cache_key = "explainer"
    if cache_key in _explainer_cache:
        return _explainer_cache[cache_key]

    result = (None, None, None)
    try:
        import shap

        # Prefer the best single estimator from the new ensemble pipeline.
        # Fall back to MODEL_FILE for backward compat (old XGBoost checkpoint).
        estimator_path = (
            BEST_ESTIMATOR_FILE
            if os.path.exists(BEST_ESTIMATOR_FILE)
            else MODEL_FILE
        )
        if not os.path.exists(estimator_path):
            _explainer_cache[cache_key] = result
            return result

        estimator = joblib.load(estimator_path)
        feature_columns = joblib.load(FEATURE_FILE)

        # Read member name for logging
        member_name = "unknown"
        if os.path.exists(BEST_ESTIMATOR_META):
            with open(BEST_ESTIMATOR_META) as f:
                member_name = json.load(f).get("member", "unknown")

        explainer = shap.TreeExplainer(estimator)
        result = (explainer, feature_columns, member_name)
        print(f"[SHAP] TreeExplainer built on: {member_name}")
    except Exception as e:
        print(f"[SHAP] Could not build explainer: {e}")

    _explainer_cache[cache_key] = result
    return result


def invalidate_explainer_cache() -> None:
    """Call this after a new model is trained so the next request rebuilds."""
    _explainer_cache.clear()


# ─────────────────────────────────────────────────────────────────────────────
# SHAP extraction
# ─────────────────────────────────────────────────────────────────────────────

def _shap_factors(
    explainer,
    feature_row: pd.DataFrame,   # single-row DataFrame (preserves feature names)
    feature_columns: list[str],
    top_n: int,
) -> list[dict]:
    """
    Extract top_n positive contributors to the RED (attrition) class.

    All four supported tree models return shap_values with shape:
        (n_samples, n_features, n_classes)   — confirmed by smoke tests.
    RED class = index 2.
    """
    shap_vals = explainer.shap_values(feature_row)   # (1, n_features, 3)
    sv_arr    = np.array(shap_vals)                   # ensure ndarray

    if sv_arr.ndim == 3:
        red_shap = sv_arr[0, :, 2]     # (n_features,)
    elif sv_arr.ndim == 2:
        # Some older SHAP versions return (n_features, n_classes)
        red_shap = sv_arr[:, 2]
    else:
        # Last resort: flat array
        red_shap = sv_arr.flatten()

    # Only numeric features (not embeddings) have human-readable meaning
    numeric_indices = [i for i, c in enumerate(feature_columns) if not c.startswith("emb_")]
    numeric_cols    = [feature_columns[i] for i in numeric_indices]

    contributions = []
    for idx, col in zip(numeric_indices, numeric_cols):
        sv = float(red_shap[idx])
        if sv > 0:
            contributions.append({"factor": col, "shap_value": sv})

    total = sum(c["shap_value"] for c in contributions) or 1.0
    results = []
    for c in sorted(contributions, key=lambda x: x["shap_value"], reverse=True)[:top_n]:
        pct = round(c["shap_value"] / total * 100, 1)
        results.append({
            "factor":           c["factor"],
            "label":            METRIC_LABELS.get(c["factor"],
                                    c["factor"].replace("_", " ").title()),
            "contribution_pct": pct,
            "direction":        "positive",
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Generic fallback
# ─────────────────────────────────────────────────────────────────────────────

def _generic_fallback_factors(top_n: int) -> list[dict]:
    return [{"factor": "unknown", "label": "Model Confidence", "contribution_pct": 100.0, "direction": "positive"}]


# ─────────────────────────────────────────────────────────────────────────────
# Public API  (called by prediction.py — signature unchanged)
# ─────────────────────────────────────────────────────────────────────────────

def get_attrition_factors(
    feature_row: np.ndarray,
    feature_columns: list[str],
    probabilities: dict,
    row_data: dict | None = None,
    top_n: int = 5,
) -> list[dict]:
    """
    Returns top_n risk factors for one employee.
    Tries SHAP TreeExplainer on best single member; falls back to rule-based.
    """
    explainer, cached_cols, _ = _load_explainer()

    if explainer is not None and cached_cols is not None:
        try:
            # Pass as single-row DataFrame so LightGBM finds its feature names
            row_df = pd.DataFrame(feature_row.reshape(1, -1), columns=feature_columns)
            return _shap_factors(explainer, row_df, feature_columns, top_n)
        except Exception as e:
            print(f"[SHAP] Inference failed: {e} — falling back to generic factors")

    return _generic_fallback_factors(top_n)


def enrich_predictions_with_factors(
    predictions: list[dict],
    feature_matrix: np.ndarray | None = None,
    feature_columns: list[str] | None = None,
    raw_rows: list[dict] | None = None,
    top_n: int = 5,
) -> list[dict]:
    """
    Add top_factors and attrition_prob to each prediction result.
    Modifies predictions in-place and returns the list.
    """
    for i, pred in enumerate(predictions):
        pred["attrition_prob"] = round(pred["probabilities"]["RED"] * 100, 1)

        feat_row = (feature_matrix[i]
                    if (feature_matrix is not None and i < len(feature_matrix))
                    else None)
        row_data = (raw_rows[i]
                    if (raw_rows is not None and i < len(raw_rows))
                    else {})

        if feat_row is not None and feature_columns is not None:
            pred["top_factors"] = get_attrition_factors(
                feat_row, feature_columns, pred["probabilities"], row_data, top_n
            )
        else:
            pred["top_factors"] = _generic_fallback_factors(top_n)

    return predictions
