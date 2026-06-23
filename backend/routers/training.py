"""
routers/training.py

Routes:
  POST /train        — train the RAG classifier on labelled survey CSV (admin)
  GET  /model/info   — metadata about the currently trained classifier
"""

from __future__ import annotations

import json as _json
import os
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from loguru import logger

from modules.classifier import RAGClassifier           # patched as "routers.training.RAGClassifier"
from modules.feature_engine import build_features_batch  # patched as "routers.training.build_features_batch"
from modules.sentiment import analyze_batch            # patched as "routers.training.analyze_batch"
from routers.deps import _df_from_upload, require_admin, require_any

router = APIRouter(tags=["admin"])


@router.post("/train")
async def train_classifier(
    file: UploadFile = File(...),
    _: dict = Depends(require_admin),
):
    """
    Train the RAG classifier on labelled survey data.

    CSV must contain: employee_id, comments, risk_zone (GREEN/AMBER/RED)
    Plus any numeric/categorical features.

    Pipeline:
      1. Run sentiment on all comments
      2. Build aggregated features per employee
      3. Train LightGBM classifier
    """
    try:
        df = _df_from_upload(file)

        required = {"employee_id", "comments", "risk_zone"}
        missing  = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        if len(df) < 10:
            raise ValueError("Need at least 10 rows to train.")

        # Step 1: Sentiment
        comments = df["comments"].fillna("").astype(str).tolist()
        logger.info(f"[Train] Running sentiment on {len(comments)} rows…")
        sentiment_results = analyze_batch(comments)

        df["sentiment_score"] = [r["score"] for r in sentiment_results]
        df["sentiment_label"] = [r["label"] for r in sentiment_results]

        if "survey_date" not in df.columns:
            df["survey_date"] = datetime.now().strftime("%Y-%m-%d")

        # Step 2: Build features
        logger.info("[Train] Building features…")
        features_df = build_features_batch(df)

        label_map              = dict(zip(df["employee_id"].astype(str), df["risk_zone"]))
        features_df["risk_zone"] = features_df["employee_id"].map(label_map)
        features_df            = features_df.dropna(subset=["risk_zone"])

        # Step 3: Train
        logger.info("[Train] Training classifier…")
        clf      = RAGClassifier()
        metadata = clf.train(features_df)

        logger.info(f"[Train] ✓ Accuracy: {metadata['accuracy']:.4f}")
        return {"status": "ok", "metadata": metadata}

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[Train] Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model/info")
async def model_info(_: dict = Depends(require_any)):
    """Get metadata about the trained classifier."""
    meta_path = os.path.join("models", "metadata.json")
    if not os.path.exists(meta_path):
        return {"has_model": False}
    with open(meta_path) as f:
        return {"has_model": True, "metadata": _json.load(f)}
