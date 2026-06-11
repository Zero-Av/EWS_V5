"""
modules/scheduler.py — EWS v5

Background scheduler for automated tasks:
  - Periodic re-classification of all employees
  - Data retention enforcement
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from loguru import logger

SCHEDULE_ENABLED = os.getenv("SNAPSHOT_SCHEDULE_ENABLED", "false").lower() == "true"
SCHEDULE_HOUR    = int(os.getenv("SNAPSHOT_SCHEDULE_HOUR", "2"))

_scheduler = None


def _run_scheduled_classification():
    """Run classification on all employees using latest survey data."""
    logger.info("[Scheduler] Starting scheduled classification…")

    try:
        from modules.database import db_get_all_surveys, db_save_classifications
        from modules.feature_engine import build_features_batch
        from modules.classifier import RAGClassifier
        import pandas as pd

        surveys = db_get_all_surveys()
        if not surveys:
            logger.info("[Scheduler] No survey data found. Skipping.")
            return

        surveys_df = pd.DataFrame(surveys)
        from modules.feature_engine import build_features_batch
        features_df = build_features_batch(surveys_df)

        if features_df.empty:
            logger.info("[Scheduler] No features built. Skipping.")
            return

        clf = RAGClassifier()
        if not clf.load():
            logger.warning("[Scheduler] No trained model found. Skipping classification.")
            return

        results = clf.predict(features_df)
        saved = db_save_classifications(results)

        logger.info(f"[Scheduler] Classification complete. {saved} employees classified.")

    except Exception as e:
        logger.error(f"[Scheduler] Error: {e}")


def init_scheduler():
    """Initialize and start the background scheduler if enabled."""
    global _scheduler

    if not SCHEDULE_ENABLED:
        logger.info("[Scheduler] Scheduled jobs DISABLED (set SNAPSHOT_SCHEDULE_ENABLED=true to enable)")
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        _scheduler = BackgroundScheduler()
        _scheduler.add_job(
            _run_scheduled_classification,
            "cron",
            hour=SCHEDULE_HOUR,
            minute=0,
            id="scheduled_classification",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info(f"[Scheduler] ✓ Started. Classification runs daily at {SCHEDULE_HOUR:02d}:00 UTC.")
    except Exception as e:
        logger.error(f"[Scheduler] Failed to start: {e}")
