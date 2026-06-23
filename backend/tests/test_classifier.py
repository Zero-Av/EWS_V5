"""
tests/test_classifier.py
Unit tests for the RAG classifier and SHAP factor decomposition.
"""

import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock
import pytest
from modules.classifier import RAGClassifier


@pytest.fixture
def synthetic_features():
    # We need at least 15 rows to satisfy stratify and train/test split.
    # The columns must match config.py KNOWN_NUMERIC_FEATURES + KNOWN_CATEGORICAL_FEATURES
    np.random.seed(42)
    rows = []
    classes = ["GREEN", "AMBER", "RED"]
    for i in range(20):
        c = classes[i % 3]
        rows.append({
            "employee_id": f"EMP{i:03d}",
            "avg_sentiment": 0.8 if c == "GREEN" else (0.1 if c == "AMBER" else -0.7),
            "min_sentiment": 0.7 if c == "GREEN" else (0.0 if c == "AMBER" else -0.9),
            "max_sentiment": 0.9 if c == "GREEN" else (0.2 if c == "AMBER" else -0.5),
            "sentiment_trend": 0.1 if c == "GREEN" else (0.0 if c == "AMBER" else -0.2),
            "sentiment_velocity": 0.05 if c == "GREEN" else (0.0 if c == "AMBER" else -0.3),
            "survey_count": 5,
            "latest_enps": 9.0 if c == "GREEN" else (6.0 if c == "AMBER" else 3.0),
            "avg_enps": 8.5 if c == "GREEN" else (5.5 if c == "AMBER" else 2.5),
            "happiness_score": 8.0 if c == "GREEN" else (5.0 if c == "AMBER" else 2.0),
            "excitement_level": 7.0 if c == "GREEN" else (5.0 if c == "AMBER" else 3.0),
            "stress_level": 2.0 if c == "GREEN" else (5.0 if c == "AMBER" else 8.0),
            "workload_level": 3.0 if c == "GREEN" else (5.0 if c == "AMBER" else 8.0),
            "work_life_balance": 8.0 if c == "GREEN" else (5.0 if c == "AMBER" else 2.0),
            "manager_support": 9.0 if c == "GREEN" else (6.0 if c == "AMBER" else 3.0),
            "job_satisfaction": 8.0 if c == "GREEN" else (5.0 if c == "AMBER" else 2.0),
            "productivity": 8.0 if c == "GREEN" else (6.0 if c == "AMBER" else 4.0),
            "team_collaboration": 8.0 if c == "GREEN" else (6.0 if c == "AMBER" else 4.0),
            "career_growth": 7.0 if c == "GREEN" else (5.0 if c == "AMBER" else 2.0),
            "absenteeism": 1.0 if c == "GREEN" else (3.0 if c == "AMBER" else 10.0),
            "department": "Engineering" if i % 2 == 0 else "Sales",
            "risk_label": c
        })
    return pd.DataFrame(rows)


@patch("modules.classifier.joblib.dump")
@patch("modules.classifier.open")
def test_train_and_predict(mock_open, mock_dump, synthetic_features):
    clf = RAGClassifier()
    
    # Train
    metadata = clf.train(synthetic_features)
    assert metadata["accuracy"] >= 0.0
    assert "trained_at" in metadata
    assert metadata["samples"] == 20
    assert len(metadata["feature_columns"]) > 0

    # Predict
    # Make sure we don't call load() from disk since model is loaded in memory
    with patch.object(clf, "load", return_value=True):
        preds = clf.predict(synthetic_features)
        assert len(preds) == 20
        for p in preds:
            assert p["risk_zone"] in ["GREEN", "AMBER", "RED"]
            assert "probabilities" in p
            assert "GREEN" in p["probabilities"]
            assert "AMBER" in p["probabilities"]
            assert "RED" in p["probabilities"]
            assert p["risk_score"] == round(p["probabilities"]["RED"] * 100, 1)

        # Predict one
        single = clf.predict_one(synthetic_features.iloc[0].to_dict())
        assert single["risk_zone"] in ["GREEN", "AMBER", "RED"]
        assert single["employee_id"] == "EMP000"


@patch("modules.classifier.joblib.load")
@patch("modules.classifier.os.path.exists", return_value=True)
def test_load(mock_exists, mock_load):
    clf = RAGClassifier()
    mock_load.side_effect = [
        MagicMock(),  # model
        MagicMock(),  # scaler
        ["feature1", "feature2"]  # feature_columns
    ]
    
    success = clf.load()
    assert success is True
    assert clf.feature_columns == ["feature1", "feature2"]
