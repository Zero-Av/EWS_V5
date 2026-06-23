"""
tests/test_sentiment.py
Unit tests for the sentiment analysis engine.
"""

from unittest.mock import patch
from modules.sentiment import _scores_to_continuous, analyze, analyze_batch


def test_scores_to_continuous():
    # positive label dominant
    scores = [
        {"label": "negative", "score": 0.1},
        {"label": "neutral", "score": 0.2},
        {"label": "positive", "score": 0.7}
    ]
    # score = P(positive) - P(negative) = 0.7 - 0.1 = 0.6
    assert _scores_to_continuous(scores) == 0.6

    # negative label dominant
    scores_neg = [
        {"label": "negative", "score": 0.8},
        {"label": "neutral", "score": 0.15},
        {"label": "positive", "score": 0.05}
    ]
    assert _scores_to_continuous(scores_neg) == -0.75


def test_analyze_empty():
    res = analyze("")
    assert res["score"] == 0.0
    assert res["label"] == "neutral"
    assert res["probabilities"]["neutral"] == 1.0


@patch("modules.sentiment._pipeline")
def test_analyze_valid(mock_pipe):
    mock_pipe.return_value = [
        [
            {"label": "negative", "score": 0.15},
            {"label": "neutral", "score": 0.05},
            {"label": "positive", "score": 0.8}
        ]
    ]
    res = analyze("I love EWS!")
    assert res["score"] == 0.65
    assert res["label"] == "positive"
    assert res["probabilities"]["positive"] == 0.8


@patch("modules.sentiment._pipeline")
def test_analyze_batch(mock_pipe):
    # Mock return list of lists for batch input
    mock_pipe.return_value = [
        [
            {"label": "negative", "score": 0.2},
            {"label": "neutral", "score": 0.1},
            {"label": "positive", "score": 0.7}
        ],
        [
            {"label": "negative", "score": 0.9},
            {"label": "neutral", "score": 0.1},
            {"label": "positive", "score": 0.0}
        ]
    ]
    texts = ["Excellent work!", "This is terrible", ""]
    results = analyze_batch(texts)
    
    assert len(results) == 3
    # First text
    assert results[0]["score"] == 0.5
    assert results[0]["label"] == "positive"
    
    # Second text
    assert results[1]["score"] == -0.9
    assert results[1]["label"] == "negative"
    
    # Third (empty) text
    assert results[2]["score"] == 0.0
    assert results[2]["label"] == "neutral"
