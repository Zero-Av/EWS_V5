"""
modules/scheduler.py
Background scheduler for automated snapshot generation.

Opt-in via environment variables:
  - SNAPSHOT_SCHEDULE_ENABLED=true   (default: false)
  - SNAPSHOT_CRON_HOUR=2             (default: 2 = run at 2 AM daily)
  - SNAPSHOT_CRON_MINUTE=0           (default: 0)

The scheduled job:
  1. Queries all employees from the latest snapshot data.
  2. Rebuilds a DataFrame from that data.
  3. Runs predictions using EmployeePredictor.
  4. Saves snapshots and triggers alert checks.
"""

import os
from datetime import datetime, timezone

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────

SCHEDULE_ENABLED = os.getenv("SNAPSHOT_SCHEDULE_ENABLED", "false").lower() in ("true", "1", "yes")
CRON_HOUR        = int(os.getenv("SNAPSHOT_CRON_HOUR", "2"))
CRON_MINUTE      = int(os.getenv("SNAPSHOT_CRON_MINUTE", "0"))

# Scheduler instance (lazily created)
_scheduler = None
_last_run_result = None
_last_run_time = None


def _run_scheduled_snapshot() -> dict:
    """Execute the snapshot job: re-predict on the latest employee data."""
    global _last_run_result, _last_run_time
    import pandas as pd

    logger.info("[Scheduler] Starting scheduled snapshot run...")

    try:
        from modules.database import _connect, save_snapshots, get_employee_history, check_and_create_alerts, enforce_intervention_slas, db_scrub_old_surveys

        conn = _connect()

        # Get the latest snapshot for each employee
        cur = conn.cursor()
        cur.execute("""
            WITH latest AS (
                SELECT employee_id, MAX(snapshot_date) AS max_date
                FROM employee_snapshots
                GROUP BY employee_id
            )
            SELECT s.*
            FROM employee_snapshots s
            JOIN latest l ON s.employee_id = l.employee_id AND s.snapshot_date = l.max_date
        """)
        rows = cur.fetchall()
        conn.close()

        if not rows:
            result = {"message": "No employee snapshot data found. Skipping.", "saved": 0, "alerts_fired": 0}
            _last_run_result = result
            _last_run_time = datetime.now(timezone.utc).isoformat()
            logger.info(f"[Scheduler] {result['message']}")
            return result

        # Build DataFrame from latest snapshots
        columns = rows[0].keys()
        data = [dict(r) for r in rows]
        df = pd.DataFrame(data)

        # Rename columns to match what the predictor expects
        # The predictor expects raw feature columns; snapshots store them directly
        feature_cols = [
            "employee_id", "stress_level", "workload_level", "absenteeism",
            "work_life_balance", "manager_support", "job_satisfaction",
            "happiness_score", "productivity", "team_collaboration", "career_growth",
        ]
        available = [c for c in feature_cols if c in df.columns]
        df_pred = df[available].copy()

        # EmployeePredictor._validate_schema() requires a 'comments' column for
        # sentence-transformer embeddings. Snapshots don't store raw comment text,
        # so inject an empty-string placeholder. The embedding for "" is a valid
        # zero-signal vector and does not bias predictions.
        if "comments" not in df_pred.columns:
            df_pred["comments"] = ""

        if len(df_pred) == 0 or "employee_id" not in df_pred.columns:
            result = {"message": "Insufficient data columns for prediction.", "saved": 0, "alerts_fired": 0}
            _last_run_result = result
            _last_run_time = datetime.now(timezone.utc).isoformat()
            return result

        # Run predictions
        from modules.prediction import EmployeePredictor
        predictor = EmployeePredictor()
        preds = predictor.predict(df_pred, top_k=3)

        # Save snapshots
        date_str = datetime.now(timezone.utc).date().isoformat()
        saved = save_snapshots(preds, snapshot_date=date_str)

        # Check alerts
        alerts_fired = []
        for pred in preds:
            eid = pred["employee_id"]
            history = get_employee_history(eid, months=3)
            if len(history) >= 2:
                prev = history[-2]
                curr = history[-1]
                fired = check_and_create_alerts(dict(prev), {**dict(curr), **pred})
                alerts_fired.extend(fired)

        # Enforce intervention SLAs
        escalated_count = enforce_intervention_slas()
        
        # Enforce data retention (scrub surveys older than 365 days)
        scrubbed_count = db_scrub_old_surveys(days=365)

        result = {
            "message": f"Scheduled snapshot complete. {saved} saved, {len(alerts_fired)} alerts fired. {escalated_count} SLAs escalated. {scrubbed_count} old surveys scrubbed.",
            "saved": saved,
            "alerts_fired": len(alerts_fired),
            "slas_escalated": escalated_count,
            "snapshot_date": date_str,
        }

        _last_run_result = result
        _last_run_time = datetime.now(timezone.utc).isoformat()
        logger.info(f"[Scheduler] {result['message']}")
        return result

    except Exception as e:
        error_result = {"message": f"Scheduler error: {str(e)}", "saved": 0, "alerts_fired": 0, "error": str(e)}
        _last_run_result = error_result
        _last_run_time = datetime.now(timezone.utc).isoformat()
        logger.error(f"[Scheduler] Error: {e}")
        return error_result


# ─────────────────────────────────────────────────────────────────────────────
# Scheduler lifecycle
# ─────────────────────────────────────────────────────────────────────────────

def init_scheduler():
    """Initialize and start the background scheduler if enabled."""
    global _scheduler

    if not SCHEDULE_ENABLED:
        logger.info("[Scheduler] Scheduled snapshots DISABLED (set SNAPSHOT_SCHEDULE_ENABLED=true to enable)")
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger

        _scheduler = BackgroundScheduler(daemon=True)
        _scheduler.add_job(
            _run_scheduled_snapshot,
            CronTrigger(hour=CRON_HOUR, minute=CRON_MINUTE),
            id="scheduled_snapshot",
            name="Daily Employee Snapshot",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info(f"[Scheduler] Started — daily snapshots at {CRON_HOUR:02d}:{CRON_MINUTE:02d}")
    except ImportError:
        logger.warning("[Scheduler] apscheduler not installed. Run: pip install apscheduler")
    except Exception as e:
        logger.error(f"[Scheduler] Failed to start: {e}")


def get_scheduler_status() -> dict:
    """Return current scheduler status for the admin API."""
    if not SCHEDULE_ENABLED:
        return {
            "enabled": False,
            "running": False,
            "schedule": None,
            "next_run": None,
            "last_run": _last_run_time,
            "last_result": _last_run_result,
        }

    next_run = None
    running = False
    if _scheduler is not None:
        running = _scheduler.running
        jobs = _scheduler.get_jobs()
        if jobs:
            next_run = str(jobs[0].next_run_time) if jobs[0].next_run_time else None

    return {
        "enabled": True,
        "running": running,
        "schedule": f"Daily at {CRON_HOUR:02d}:{CRON_MINUTE:02d} UTC",
        "next_run": next_run,
        "last_run": _last_run_time,
        "last_result": _last_run_result,
    }


def trigger_snapshot_now() -> dict:
    """Manually trigger a snapshot run (bypasses the scheduler)."""
    return _run_scheduled_snapshot()
