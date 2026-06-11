"""
modules/topic_detector.py — EWS v5

Zero-shot topic classification using facebook/bart-large-mnli.
Tags each employee comment with topic relevance scores.

Topics: manager, career growth, workload, culture, compensation, work-life balance, team collaboration

This lets us compute per-topic sentiment:
  "Employee is positive overall, but very negative about workload"
"""

from __future__ import annotations

import sys
from config import TOPIC_MODEL, TOPIC_LABELS

# Lazy-loaded singleton
_classifier = None


def _get_classifier():
    """Lazy-load the zero-shot classification pipeline."""
    global _classifier
    if _classifier is not None:
        return _classifier

    try:
        from transformers import pipeline as hf_pipeline
        print(f"[Topics] Loading model: {TOPIC_MODEL}…", file=sys.stderr)
        _classifier = hf_pipeline(
            "zero-shot-classification",
            model=TOPIC_MODEL,
            device=-1,  # CPU; change to 0 for GPU
        )
        print(f"[Topics] ✓ Model loaded.", file=sys.stderr)
        return _classifier
    except Exception as e:
        print(f"[Topics] ✗ Failed to load model: {e}", file=sys.stderr)
        raise RuntimeError(f"Topic model failed to load: {e}") from e


def detect_topics(text: str, threshold: float = 0.25) -> dict[str, float]:
    """
    Classify a text against predefined topics.

    Args:
        text: The comment to classify.
        threshold: Minimum confidence to include a topic.

    Returns:
        Dict of topic → confidence score (0-1).
        Only topics above threshold are included.
        Example: {"workload pressure": 0.82, "manager relationship": 0.45}
    """
    if not text or not text.strip():
        return {}

    clf = _get_classifier()
    result = clf(text[:512], TOPIC_LABELS, multi_label=True)

    topics = {}
    for label, score in zip(result["labels"], result["scores"]):
        if score >= threshold:
            topics[label] = round(score, 4)

    return topics


def detect_topics_batch(texts: list[str], threshold: float = 0.25) -> list[dict[str, float]]:
    """
    Classify a batch of texts against predefined topics.

    Returns a list of dicts, one per text.
    Empty/null texts return empty dict.
    """
    if not texts:
        return []

    clf = _get_classifier()
    results_out = []

    for text in texts:
        if not text or not text.strip():
            results_out.append({})
            continue

        result = clf(text[:512], TOPIC_LABELS, multi_label=True)
        topics = {}
        for label, score in zip(result["labels"], result["scores"]):
            if score >= threshold:
                topics[label] = round(score, 4)
        results_out.append(topics)

    return results_out
