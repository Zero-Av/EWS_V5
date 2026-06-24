"""
routers/surveys.py

Routes:
  POST /surveys/upload     — ingest CSV/Excel: sentiment + topic analysis, store in DB
  POST /surveys/summarize  — LLM thematic summary of recent negative comments
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from loguru import logger

from config import COLUMN_RENAME_MAP, REQUIRED_SURVEY_COLS
from modules.database import db_get_all_surveys, db_insert_surveys  # patched as "routers.surveys.*" in tests
from modules.llm import summarize_feedback                           # patched as "routers.surveys.summarize_feedback"
from modules.sentiment import analyze_batch                          # patched as "routers.surveys.analyze_batch"
from routers.deps import _df_from_upload, require_any

router = APIRouter(tags=["surveys"])


@router.post("/surveys/upload")
async def upload_surveys(
    file: UploadFile = File(...),
    run_topics: bool = Form(True),
    _: dict = Depends(require_any),
):
    """
    Upload a survey CSV or Excel file.  For each row:
      1. Run pretrained sentiment model → score (-1 to +1)
      2. Optionally run topic detection → topic relevance scores
      3. Store everything in the database

    Required columns (after rename): employee_id, comments
    Optional columns: total_experience, tenure_years, designation, etc.
    """
    import pandas as pd

    try:
        df = _df_from_upload(file)

        # Apply column rename map (Excel column names → internal snake_case)
        df = df.rename(columns=COLUMN_RENAME_MAP)

        # Generate survey_date if not present
        if "survey_date" not in df.columns:
            df["survey_date"] = datetime.now().strftime("%Y-%m-%d")

        required = REQUIRED_SURVEY_COLS
        missing  = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        comments = df["comments"].fillna("").astype(str).tolist()

        # Step 1: Sentiment analysis
        logger.info(f"[Surveys] Running sentiment on {len(comments)} responses…")
        sentiment_results = analyze_batch(comments)

        # Step 2: Topic detection (optional, slower)
        topics_results = [{}] * len(comments)
        if run_topics:
            try:
                from modules.topic_detector import detect_topics_batch
                logger.info("[Surveys] Running topic detection…")
                topics_results = detect_topics_batch(comments)
            except Exception as e:
                logger.warning(f"[Surveys] Topic detection failed, continuing without: {e}")

        # Step 3: Build rows for DB insertion
        rows = []
        for i, (_, row) in enumerate(df.iterrows()):
            db_row = {
                "employee_id":    str(row["employee_id"]),
                "survey_date":    str(row["survey_date"]),
                "comments":       str(row.get("comments", "")),
                "sentiment_score": sentiment_results[i]["score"],
                "sentiment_label": sentiment_results[i]["label"],
                "topics":          topics_results[i],
            }
            for col in df.columns:
                if col not in {"employee_id", "survey_date", "comments"}:
                    val = row.get(col)
                    if pd.notna(val):
                        db_row[col] = val
            rows.append(db_row)

        count = db_insert_surveys(rows)

        return {
            "status":            "ok",
            "surveys_ingested":  count,
            "sentiment_summary": {
                "avg_score": round(
                    sum(r["score"] for r in sentiment_results) / max(len(sentiment_results), 1), 4
                ),
                "negative": sum(1 for r in sentiment_results if r["label"] == "negative"),
                "neutral":  sum(1 for r in sentiment_results if r["label"] == "neutral"),
                "positive": sum(1 for r in sentiment_results if r["label"] == "positive"),
            },
            "topics_analyzed": run_topics,
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error(f"[Surveys] Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/surveys/summarize")
async def summarize_surveys(_: dict = Depends(require_any)):
    """Fetch recent negative survey comments and summarize themes via LLM."""
    surveys = db_get_all_surveys()
    negative_comments = [
        s["comments"]
        for s in surveys
        if s.get("sentiment_score") is not None
        and s["sentiment_score"] < -0.2
        and s.get("comments")
    ]

    if not negative_comments:
        return {"summary": "No significant negative feedback found."}

    summary = summarize_feedback(negative_comments[-30:])
    return {"summary": summary, "comment_count": len(negative_comments)}
