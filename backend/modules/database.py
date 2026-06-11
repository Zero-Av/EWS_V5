"""
modules/database.py — EWS v5

PostgreSQL-backed store for:
  - Survey responses (with per-row sentiment scores and topic tags)
  - Employee feature snapshots
  - RAG classifications
  - Users + auth
  - Audit log
  - Interventions + alerts

Uses psycopg2 directly for zero-overhead startup.
"""

import json
import os
import hashlib as _hl
from datetime import datetime, timezone
from typing import Optional

# ── Connection ───────────────────────────────────────────────────────────────

DB_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/ews")


def _connect():
    import psycopg2
    from psycopg2.extras import DictCursor
    conn = psycopg2.connect(DB_URL, cursor_factory=DictCursor)
    conn.autocommit = False
    return conn


# ── Schema initialization ────────────────────────────────────────────────────

def init_db() -> None:
    """Create all tables if they don't exist."""
    conn = _connect()
    cur = conn.cursor()

    # ── Survey responses (raw data + per-row sentiment) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS surveys (
            id               SERIAL PRIMARY KEY,
            employee_id      TEXT NOT NULL,
            survey_date      TEXT NOT NULL,
            comments         TEXT,
            sentiment_score  REAL,
            sentiment_label  TEXT,
            topics_json      TEXT,
            score            REAL,
            happiness_score  REAL,
            excitement_level REAL,
            stress_level     REAL,
            workload_level   REAL,
            work_life_balance REAL,
            manager_support  REAL,
            job_satisfaction REAL,
            productivity     REAL,
            team_collaboration REAL,
            career_growth    REAL,
            absenteeism      REAL,
            department       TEXT,
            manager_id       TEXT,
            employment_type  TEXT,
            tenure_bucket    TEXT,
            extra_data       TEXT,
            created_at       TIMESTAMP DEFAULT NOW()
        )
    """)

    # ── RAG classifications ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS classifications (
            id              SERIAL PRIMARY KEY,
            employee_id     TEXT NOT NULL,
            risk_zone       TEXT NOT NULL,
            risk_score      REAL,
            probabilities   TEXT,
            top_factors     TEXT,
            classified_at   TIMESTAMP DEFAULT NOW()
        )
    """)

    # ── Users ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              SERIAL PRIMARY KEY,
            username        TEXT NOT NULL UNIQUE,
            full_name       TEXT NOT NULL,
            role            TEXT NOT NULL DEFAULT 'manager',
            hashed_password TEXT NOT NULL,
            is_active       INTEGER DEFAULT 1,
            created_at      TIMESTAMP DEFAULT NOW(),
            updated_at      TIMESTAMP DEFAULT NOW()
        )
    """)

    # ── Audit log ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id              SERIAL PRIMARY KEY,
            actor           TEXT NOT NULL,
            action          TEXT NOT NULL,
            resource_type   TEXT,
            resource_id     TEXT,
            details         TEXT,
            ip_address      TEXT,
            created_at      TIMESTAMP DEFAULT NOW()
        )
    """)

    # ── Alerts ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id              SERIAL PRIMARY KEY,
            employee_id     TEXT NOT NULL,
            alert_type      TEXT NOT NULL,
            severity        TEXT NOT NULL,
            message         TEXT NOT NULL,
            old_value       REAL,
            new_value       REAL,
            acknowledged    INTEGER DEFAULT 0,
            acknowledged_by TEXT,
            created_at      TIMESTAMP DEFAULT NOW()
        )
    """)

    # ── Interventions ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS interventions (
            id              SERIAL PRIMARY KEY,
            employee_id     TEXT NOT NULL,
            created_by      TEXT NOT NULL,
            assigned_to     TEXT,
            status          TEXT DEFAULT 'Pending',
            priority        TEXT,
            timeline        TEXT,
            reasoning       TEXT,
            actions         TEXT,
            notes           TEXT,
            due_date        TEXT,
            completed_at    TEXT,
            created_at      TIMESTAMP DEFAULT NOW(),
            updated_at      TIMESTAMP DEFAULT NOW()
        )
    """)

    conn.commit()

    # Seed default users
    _seed_default_users(conn)
    conn.commit()
    conn.close()


# ── Password hashing ─────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return _hl.sha256(plain.encode()).hexdigest()

def _verify_password(plain: str, hashed: str) -> bool:
    return _hl.sha256(plain.encode()).hexdigest() == hashed


def _seed_default_users(conn) -> None:
    """Insert default admin + manager on first run."""
    defaults = [
        ("admin", "Admin User", "admin", "admin123"),
        ("manager", "Manager User", "manager", "manager123"),
    ]
    cur = conn.cursor()
    for username, full_name, role, password in defaults:
        cur.execute(
            "SELECT id FROM users WHERE username = %s", (username,)
        )
        if cur.fetchone() is None:
            cur.execute(
                "INSERT INTO users (username, full_name, role, hashed_password) VALUES (%s, %s, %s, %s)",
                (username, full_name, role, _hash_password(password)),
            )
    conn.commit()


# ── User operations ──────────────────────────────────────────────────────────

def db_get_user(username: str) -> Optional[dict]:
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, full_name, role, hashed_password, is_active FROM users WHERE username = %s",
        (username,),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"], "username": row["username"], "full_name": row["full_name"],
        "role": row["role"], "hashed_password": row["hashed_password"], "is_active": bool(row["is_active"]),
    }


def db_authenticate_user(username: str, password: str) -> Optional[dict]:
    user = db_get_user(username)
    if not user or not user["is_active"]:
        return None
    if not _verify_password(password, user["hashed_password"]):
        return None
    return {k: v for k, v in user.items() if k != "hashed_password"}


def db_list_users() -> list[dict]:
    conn = _connect()
    cur = conn.cursor()
    cur.execute("SELECT username, full_name, role, is_active, created_at FROM users ORDER BY created_at")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def db_create_user(username: str, password: str, full_name: str, role: str) -> bool:
    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users (username, full_name, role, hashed_password) VALUES (%s, %s, %s, %s)",
            (username, full_name, role, _hash_password(password)),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def db_delete_user(username: str) -> bool:
    conn = _connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE username = %s", (username,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


# ── Audit log ────────────────────────────────────────────────────────────────

def db_write_audit_log(actor: str, action: str, resource_type: str = None,
                       resource_id: str = None, details: str = None) -> None:
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO audit_log (actor, action, resource_type, resource_id, details) VALUES (%s, %s, %s, %s, %s)",
        (actor, action, resource_type, resource_id, details),
    )
    conn.commit()
    conn.close()


# ── Survey operations ────────────────────────────────────────────────────────

def db_insert_surveys(rows: list[dict]) -> int:
    """
    Insert multiple survey rows. Each dict should contain at minimum:
      employee_id, survey_date, comments, sentiment_score, sentiment_label, topics_json
    Plus any optional numeric/categorical columns.
    """
    if not rows:
        return 0

    conn = _connect()
    cur = conn.cursor()
    count = 0

    for row in rows:
        cur.execute("""
            INSERT INTO surveys (
                employee_id, survey_date, comments,
                sentiment_score, sentiment_label, topics_json,
                score, happiness_score, excitement_level,
                stress_level, workload_level, work_life_balance,
                manager_support, job_satisfaction, productivity,
                team_collaboration, career_growth, absenteeism,
                department, manager_id, employment_type, tenure_bucket,
                extra_data
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
        """, (
            row.get("employee_id"),
            row.get("survey_date"),
            row.get("comments"),
            row.get("sentiment_score"),
            row.get("sentiment_label"),
            json.dumps(row.get("topics", {})) if row.get("topics") else None,
            row.get("score"),
            row.get("happiness_score"),
            row.get("excitement_level"),
            row.get("stress_level"),
            row.get("workload_level"),
            row.get("work_life_balance"),
            row.get("manager_support"),
            row.get("job_satisfaction"),
            row.get("productivity"),
            row.get("team_collaboration"),
            row.get("career_growth"),
            row.get("absenteeism"),
            row.get("department"),
            row.get("manager_id"),
            row.get("employment_type"),
            row.get("tenure_bucket"),
            json.dumps(row.get("extra_data")) if row.get("extra_data") else None,
        ))
        count += 1

    conn.commit()
    conn.close()
    return count


def db_get_all_surveys() -> list[dict]:
    """Get all surveys, ordered by employee and date."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute("SELECT * FROM surveys ORDER BY employee_id, survey_date")
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def db_get_employee_surveys(employee_id: str) -> list[dict]:
    """Get all surveys for a specific employee."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM surveys WHERE employee_id = %s ORDER BY survey_date",
        (employee_id,),
    )
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Classification operations ────────────────────────────────────────────────

def db_save_classifications(results: list[dict]) -> int:
    """Save RAG classification results."""
    if not results:
        return 0

    conn = _connect()
    cur = conn.cursor()
    count = 0

    for r in results:
        cur.execute("""
            INSERT INTO classifications (employee_id, risk_zone, risk_score, probabilities, top_factors)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            r["employee_id"],
            r["risk_zone"],
            r.get("risk_score"),
            json.dumps(r.get("probabilities", {})),
            json.dumps(r.get("top_factors", [])),
        ))
        count += 1

    conn.commit()
    conn.close()
    return count


def db_get_latest_classifications() -> list[dict]:
    """Get the most recent classification for each employee."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT ON (employee_id) 
            employee_id, risk_zone, risk_score, probabilities, top_factors, classified_at
        FROM classifications
        ORDER BY employee_id, classified_at DESC
    """)
    rows = cur.fetchall()
    conn.close()

    results = []
    for r in rows:
        row_dict = dict(r)
        try:
            row_dict["probabilities"] = json.loads(row_dict["probabilities"]) if row_dict["probabilities"] else {}
            row_dict["top_factors"] = json.loads(row_dict["top_factors"]) if row_dict["top_factors"] else []
        except (json.JSONDecodeError, TypeError):
            pass
        results.append(row_dict)
    return results


# ── Dashboard KPIs ───────────────────────────────────────────────────────────

def get_dashboard_kpis() -> dict:
    """Compute dashboard KPIs from the latest classifications and surveys."""
    conn = _connect()
    cur = conn.cursor()

    # Zone distribution from latest classifications
    cur.execute("""
        SELECT risk_zone, COUNT(*) as cnt
        FROM (
            SELECT DISTINCT ON (employee_id) employee_id, risk_zone
            FROM classifications
            ORDER BY employee_id, classified_at DESC
        ) latest
        GROUP BY risk_zone
    """)
    zone_rows = cur.fetchall()
    zones = {r["risk_zone"]: r["cnt"] for r in zone_rows}
    total = sum(zones.values())

    # Average sentiment from recent surveys
    cur.execute("""
        SELECT AVG(sentiment_score) as avg_sentiment,
               COUNT(DISTINCT employee_id) as employee_count
        FROM surveys
    """)
    sentiment_row = cur.fetchone()

    conn.close()

    return {
        "total_employees": total,
        "zone_distribution": zones,
        "pct_red": round(zones.get("RED", 0) / max(total, 1) * 100, 1),
        "pct_amber": round(zones.get("AMBER", 0) / max(total, 1) * 100, 1),
        "pct_green": round(zones.get("GREEN", 0) / max(total, 1) * 100, 1),
        "avg_sentiment": round(float(sentiment_row["avg_sentiment"] or 0), 4),
        "survey_coverage": int(sentiment_row["employee_count"] or 0),
    }


# ── Alerts ───────────────────────────────────────────────────────────────────

def db_create_alert(employee_id: str, alert_type: str, severity: str,
                    message: str, old_value: float = None, new_value: float = None) -> int:
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO alerts (employee_id, alert_type, severity, message, old_value, new_value)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    """, (employee_id, alert_type, severity, message, old_value, new_value))
    alert_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return alert_id


def db_get_alerts(limit: int = 50, acknowledged: bool = None) -> list[dict]:
    conn = _connect()
    cur = conn.cursor()
    query = "SELECT * FROM alerts"
    params = []
    if acknowledged is not None:
        query += " WHERE acknowledged = %s"
        params.append(1 if acknowledged else 0)
    query += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def db_acknowledge_alert(alert_id: int, username: str) -> bool:
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        "UPDATE alerts SET acknowledged = 1, acknowledged_by = %s WHERE id = %s",
        (username, alert_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok
