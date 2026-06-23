"""
tests/test_topic_detector.py
Unit tests for the zero-shot topic detection module.
"""

from unittest.mock import patch
from modules.topic_detector import detect_topics, detect_topics_batch


def test_detect_topics_empty():
    assert detect_topics("") == {}
    assert detect_topics(None) == {}


@patch("modules.topic_detector._classifier")
def test_detect_topics(mock_clf):
    mock_clf.return_value = {
        "labels": ["manager relationship", "workload pressure", "career growth"],
        "scores": [0.85, 0.45, 0.15]
    }
    
    # Threshold = 0.25 (default)
    res = detect_topics("I have issues with my boss and workload.")
    assert "manager relationship" in res
    assert "workload pressure" in res
    assert "career growth" not in res
    assert res["manager relationship"] == 0.85

    # Test with custom threshold
    res_high = detect_topics("I have issues.", threshold=0.5)
    assert "manager relationship" in res_high
    assert "workload pressure" not in res_high


@patch("modules.topic_detector._classifier")
def test_detect_topics_batch(mock_clf):
    # detect_topics_batch is implemented sequentially calling clf
    mock_clf.side_effect = [
        {
            "labels": ["manager relationship", "workload pressure"],
            "scores": [0.9, 0.1]
        },
        {
            "labels": ["career growth", "company culture"],
            "scores": [0.8, 0.7]
        }
    ]
    
    texts = ["My manager is great", "I need career growth", ""]
    results = detect_topics_batch(texts)
    
    assert len(results) == 3
    assert results[0] == {"manager relationship": 0.9}
    assert results[1] == {"career growth": 0.8, "company culture": 0.7}
    assert results[2] == {}
