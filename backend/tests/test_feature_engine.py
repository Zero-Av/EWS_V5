"""
tests/test_feature_engine.py
Unit tests for the feature engineering module.
"""

import pandas as pd
from modules.feature_engine import (
    compute_sentiment_trend,
    compute_sentiment_velocity,
    build_features_for_employee,
    build_features_batch,
)


def test_compute_sentiment_trend():
    # Linear upward trend
    assert compute_sentiment_trend([0.1, 0.2, 0.3, 0.4]) > 0.0
    # Linear downward trend
    assert compute_sentiment_trend([0.4, 0.3, 0.2, 0.1]) < 0.0
    # Flat trend
    assert compute_sentiment_trend([0.2, 0.2, 0.2]) == 0.0
    # Insufficient data
    assert compute_sentiment_trend([0.5]) == 0.0
    assert compute_sentiment_trend([]) == 0.0


def test_compute_sentiment_velocity():
    # Default lookback=2
    # Latest - previous = 0.5 - 0.1 = 0.4
    assert compute_sentiment_velocity([0.1, 0.5]) == 0.4
    assert compute_sentiment_velocity([0.5, 0.1]) == -0.4
    # Insufficient data
    assert compute_sentiment_velocity([0.5], lookback=2) == 0.0
    assert compute_sentiment_velocity([], lookback=2) == 0.0


def test_build_features_for_employee():
    # Empty data
    empty_df = pd.DataFrame()
    assert build_features_for_employee(empty_df, "EMP001") == {"employee_id": "EMP001", "_has_data": False}

    # Valid data
    data = [
        {
            "employee_id": "EMP001",
            "survey_date": "2026-01-01",
            "sentiment_score": 0.2,
            "score": 7.0,
            "happiness_score": 6.0,
            "department": "Engineering",
            "topics_json": '{"manager relationship": 0.8}'
        },
        {
            "employee_id": "EMP001",
            "survey_date": "2026-02-01",
            "sentiment_score": 0.4,
            "score": 9.0,
            "happiness_score": 8.0,
            "department": "Engineering",
            "topics_json": '{"manager relationship": 0.9}'
        }
    ]
    df = pd.DataFrame(data)
    features = build_features_for_employee(df, "EMP001")

    assert features["employee_id"] == "EMP001"
    assert features["_has_data"] is True
    assert features["avg_sentiment"] == 0.3
    assert features["min_sentiment"] == 0.2
    assert features["max_sentiment"] == 0.4
    assert features["sentiment_trend"] > 0
    assert features["sentiment_velocity"] == 0.2
    assert features["survey_count"] == 2
    assert features["latest_enps"] == 9.0
    assert features["avg_enps"] == 8.0
    assert features["happiness_score"] == 8.0
    assert features["department"] == "Engineering"
    assert "topic_manager_relationship" in features


def test_build_features_batch():
    data = [
        {"employee_id": "EMP001", "survey_date": "2026-01-01", "sentiment_score": 0.2, "score": 8.0},
        {"employee_id": "EMP002", "survey_date": "2026-01-01", "sentiment_score": -0.5, "score": 4.0}
    ]
    df = pd.DataFrame(data)
    batch_df = build_features_batch(df)

    assert len(batch_df) == 2
    assert set(batch_df["employee_id"].tolist()) == {"EMP001", "EMP002"}
    assert batch_df.loc[batch_df["employee_id"] == "EMP001", "avg_sentiment"].values[0] == 0.2
    assert batch_df.loc[batch_df["employee_id"] == "EMP002", "avg_sentiment"].values[0] == -0.5
