"""
modules/feature_engine.py — EWS v5

Aggregates per-employee sentiment signals + survey data into a feature vector
suitable for the RAG classifier.

Computed features per employee:
  1. avg_sentiment        — rolling mean of sentiment scores (last N surveys)
  2. sentiment_trend      — linear regression slope (is it getting worse?)
  3. sentiment_velocity   — delta between last 2 surveys (sudden drop = high signal)
  4. min_sentiment        — worst single sentiment score
  5. survey_count         — number of surveys (fewer = potentially disengaged)
  6. topic_sentiment_*    — per-topic average sentiment score
  7. latest_enps          — most recent eNPS score
  8. avg_enps             — rolling mean of eNPS scores
  + all numeric survey features (happiness_score, stress_level, etc.)
  + encoded categorical features (department, etc.)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Optional
from config import (
    KNOWN_NUMERIC_FEATURES,
    KNOWN_CATEGORICAL_FEATURES,
    TOPIC_LABELS,
    SENTIMENT_WINDOW_MONTHS,
    VELOCITY_LOOKBACK,
)


def compute_sentiment_trend(scores: list[float]) -> float:
    """
    Compute the linear regression slope of sentiment scores over time.
    Negative slope = sentiment is declining = bad signal.
    
    Returns 0.0 if fewer than 2 data points.
    """
    if len(scores) < 2:
        return 0.0

    x = np.arange(len(scores), dtype=float)
    y = np.array(scores, dtype=float)

    # Simple least-squares slope: β = Σ((x-x̄)(y-ȳ)) / Σ((x-x̄)²)
    x_mean = x.mean()
    y_mean = y.mean()
    numerator = ((x - x_mean) * (y - y_mean)).sum()
    denominator = ((x - x_mean) ** 2).sum()

    if denominator == 0:
        return 0.0

    return round(float(numerator / denominator), 4)


def compute_sentiment_velocity(scores: list[float], lookback: int = 2) -> float:
    """
    Compute the change between the last N sentiment scores.
    A sudden drop (negative velocity) is a high-signal early warning.
    
    Returns the delta: latest - previous.
    """
    if len(scores) < lookback:
        return 0.0

    recent = scores[-lookback:]
    return round(recent[-1] - recent[0], 4)


def build_features_for_employee(
    surveys_df: pd.DataFrame,
    employee_id: str,
) -> dict:
    """
    Build a complete feature dict for a single employee from their survey history.

    Args:
        surveys_df: DataFrame with columns: employee_id, survey_date, 
                    sentiment_score, topics_json, + any numeric/categorical cols.
                    Must be pre-filtered to this employee and sorted by date ASC.
        employee_id: The employee ID.

    Returns:
        Feature dict ready for the classifier.
    """
    if surveys_df.empty:
        return {"employee_id": employee_id, "_has_data": False}

    features = {"employee_id": employee_id, "_has_data": True}

    # ── Sentiment aggregation ────────────────────────────────────────────────
    sentiment_scores = surveys_df["sentiment_score"].dropna().tolist()

    features["avg_sentiment"] = round(float(np.mean(sentiment_scores)), 4) if sentiment_scores else 0.0
    features["min_sentiment"] = round(float(np.min(sentiment_scores)), 4) if sentiment_scores else 0.0
    features["max_sentiment"] = round(float(np.max(sentiment_scores)), 4) if sentiment_scores else 0.0
    features["std_sentiment"] = round(float(np.std(sentiment_scores)), 4) if len(sentiment_scores) > 1 else 0.0
    features["sentiment_trend"] = compute_sentiment_trend(sentiment_scores)
    features["sentiment_velocity"] = compute_sentiment_velocity(sentiment_scores, VELOCITY_LOOKBACK)
    features["survey_count"] = len(surveys_df)

    # ── Per-topic sentiment ──────────────────────────────────────────────────
    # If topic data is available, compute per-topic avg sentiment
    if "topics_json" in surveys_df.columns:
        import json
        topic_sentiments = {t: [] for t in TOPIC_LABELS}

        for _, row in surveys_df.iterrows():
            try:
                topics = json.loads(row["topics_json"]) if isinstance(row["topics_json"], str) else (row["topics_json"] or {})
            except (json.JSONDecodeError, TypeError):
                topics = {}

            sent = row.get("sentiment_score", 0.0) or 0.0
            for topic, confidence in topics.items():
                if topic in topic_sentiments and confidence > 0.3:
                    # Weight the sentiment by topic confidence
                    topic_sentiments[topic].append(sent * confidence)

        for topic in TOPIC_LABELS:
            safe_name = topic.replace(" ", "_")
            vals = topic_sentiments[topic]
            features[f"topic_{safe_name}"] = round(float(np.mean(vals)), 4) if vals else 0.0

    # ── Latest eNPS score ────────────────────────────────────────────────────
    if "score" in surveys_df.columns:
        scores = surveys_df["score"].dropna()
        features["latest_enps"] = float(scores.iloc[-1]) if len(scores) > 0 else 5.0
        features["avg_enps"] = round(float(scores.mean()), 4) if len(scores) > 0 else 5.0

    # ── Numeric survey features (latest values) ─────────────────────────────
    latest_row = surveys_df.iloc[-1]
    for col in KNOWN_NUMERIC_FEATURES:
        if col in surveys_df.columns:
            val = latest_row.get(col)
            features[col] = float(val) if pd.notna(val) else None

    # ── Categorical features (latest values) ─────────────────────────────────
    for col in KNOWN_CATEGORICAL_FEATURES:
        if col in surveys_df.columns:
            features[col] = str(latest_row.get(col, "unknown"))

    return features


def build_features_batch(
    all_surveys_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Build feature DataFrames for ALL employees at once.

    Args:
        all_surveys_df: Full survey table with sentiment_score already computed.
                        Must contain employee_id and survey_date columns.

    Returns:
        DataFrame where each row = one employee's feature vector.
    """
    all_surveys_df = all_surveys_df.sort_values(["employee_id", "survey_date"])

    feature_rows = []
    for emp_id, group_df in all_surveys_df.groupby("employee_id"):
        features = build_features_for_employee(group_df, str(emp_id))
        feature_rows.append(features)

    if not feature_rows:
        return pd.DataFrame()

    features_df = pd.DataFrame(feature_rows)
    return features_df
