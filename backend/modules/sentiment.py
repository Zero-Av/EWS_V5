"""
modules/sentiment.py — EWS v5

Pretrained sentiment analysis engine using HuggingFace transformers.
Model: cardiffnlp/twitter-roberta-base-sentiment-latest

Pipeline:
  Survey Text → Pretrained Model → Per-response sentiment score (-1 to +1)

The model outputs three classes: negative, neutral, positive.
We collapse them into a single continuous score:
  score = P(positive) - P(negative)   ∈ [-1, +1]
"""

from __future__ import annotations

import sys
from typing import Optional
from config import SENTIMENT_MODEL

# Lazy-loaded singleton — the model is ~500MB, load once.
_pipeline = None


def _get_pipeline():
    """Lazy-load the HuggingFace sentiment pipeline."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline

    try:
        from transformers import pipeline as hf_pipeline
        print(f"[Sentiment] Loading model: {SENTIMENT_MODEL}…", file=sys.stderr)
        _pipeline = hf_pipeline(
            "sentiment-analysis",
            model=SENTIMENT_MODEL,
            tokenizer=SENTIMENT_MODEL,
            top_k=None,           # return all class scores
            truncation=True,
            max_length=512,
        )
        print(f"[Sentiment] ✓ Model loaded.", file=sys.stderr)
        return _pipeline
    except Exception as e:
        print(f"[Sentiment] ✗ Failed to load model: {e}", file=sys.stderr)
        raise RuntimeError(f"Sentiment model failed to load: {e}") from e


def _scores_to_continuous(scores: list[dict]) -> float:
    """
    Convert the model's class probabilities into a single continuous score.

    The cardiffnlp model returns labels like:
      [{"label": "negative", "score": 0.1}, {"label": "neutral", "score": 0.3}, {"label": "positive", "score": 0.6}]

    We compute: P(positive) - P(negative) → range [-1, +1]
    """
    score_map = {s["label"].lower(): s["score"] for s in scores}
    pos = score_map.get("positive", 0.0)
    neg = score_map.get("negative", 0.0)
    return round(pos - neg, 4)


def analyze(text: str) -> dict:
    """
    Analyze a single text string.

    Returns:
        {
            "score": float,           # -1 to +1
            "label": str,             # "negative" | "neutral" | "positive"
            "probabilities": dict,    # {"negative": 0.1, "neutral": 0.3, "positive": 0.6}
        }
    """
    if not text or not text.strip():
        return {"score": 0.0, "label": "neutral", "probabilities": {"negative": 0.0, "neutral": 1.0, "positive": 0.0}}

    pipe = _get_pipeline()
    result = pipe(text[:512])[0]  # list of dicts with label + score

    score = _scores_to_continuous(result)

    # Determine dominant label
    best = max(result, key=lambda x: x["score"])
    label = best["label"].lower()

    probabilities = {s["label"].lower(): round(s["score"], 4) for s in result}

    return {
        "score": score,
        "label": label,
        "probabilities": probabilities,
    }


def analyze_batch(texts: list[str], batch_size: int = 32) -> list[dict]:
    """
    Analyze a batch of texts efficiently.

    Returns a list of dicts, one per text, same format as analyze().
    Empty/null texts get a neutral score.
    """
    if not texts:
        return []

    pipe = _get_pipeline()

    # Handle empty strings — mark their positions
    clean_texts = []
    index_map = []  # maps clean_texts index → original index
    results = [None] * len(texts)

    for i, text in enumerate(texts):
        if text and text.strip():
            clean_texts.append(text[:512])
            index_map.append(i)
        else:
            results[i] = {
                "score": 0.0,
                "label": "neutral",
                "probabilities": {"negative": 0.0, "neutral": 1.0, "positive": 0.0},
            }

    if clean_texts:
        # Batch inference
        raw_results = pipe(clean_texts, batch_size=batch_size)

        for j, raw in enumerate(raw_results):
            original_idx = index_map[j]
            score = _scores_to_continuous(raw)
            best = max(raw, key=lambda x: x["score"])
            label = best["label"].lower()
            probabilities = {s["label"].lower(): round(s["score"], 4) for s in raw}

            results[original_idx] = {
                "score": score,
                "label": label,
                "probabilities": probabilities,
            }

    return results
