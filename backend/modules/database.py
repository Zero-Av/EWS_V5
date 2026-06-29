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

DB_URL = os.getenv("DATABASE_URL", "postgresql://ews_user:ews123@localhost:5432/ews")


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
            employee_name    TEXT,
            survey_date      DATE,
            comments         TEXT,
            sentiment_score  REAL,
            sentiment_label  TEXT,
            topics_json      TEXT,
            -- Numeric features (from EWS Excel)
            total_experience REAL,
            tenure_years     REAL,
            rating           REAL,
            ageing           REAL,
            -- Categorical features (from EWS Excel)
            department       TEXT,
            manager_id       TEXT,
            employee_status  TEXT,
            designation      TEXT,
            skill            TEXT,
            location_region  TEXT,
            previous_rag     TEXT,
            previous_concern TEXT,
            primary_concern  TEXT,
            secondary_reason TEXT,
            hrbp_connect_month TEXT,
            project_manager  TEXT,
            rag_status_by_hrbp TEXT,
            -- Overflow for any extra columns
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

    # ── Employee profiles (HRBP manually-filled assessments) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS employee_profiles (
            id                 SERIAL PRIMARY KEY,
            employee_id        TEXT NOT NULL UNIQUE,
            comments           TEXT,
            hrbp_risk_zone     TEXT,
            primary_concern    TEXT,
            secondary_reason   TEXT,
            previous_rag       TEXT,
            previous_concern   TEXT,
            designation        TEXT,
            location_region    TEXT,
            employee_status    TEXT,
            total_experience   REAL,
            tenure_years       REAL,
            rating             REAL,
            ageing             REAL,
            updated_by         TEXT,
            updated_at         TIMESTAMP DEFAULT NOW(),
            created_at         TIMESTAMP DEFAULT NOW()
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
            source          TEXT DEFAULT 'rule_based',
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
    # Check if the stored hash is a bcrypt hash
    if hashed.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            import bcrypt
            return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
        except Exception:
            pass
    # Fall back to SHA-256
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
                employee_id, employee_name, survey_date, comments,
                sentiment_score, sentiment_label, topics_json,
                total_experience, tenure_years, rating, ageing,
                department, manager_id, employee_status, designation,
                skill, location_region, previous_rag, previous_concern,
                primary_concern, secondary_reason, hrbp_connect_month,
                project_manager, rag_status_by_hrbp,
                extra_data
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s
            )
        """, (
            row.get("employee_id"),
            row.get("employee_name"),
            row.get("survey_date"),
            row.get("comments"),
            row.get("sentiment_score"),
            row.get("sentiment_label"),
            json.dumps(row.get("topics", {})) if row.get("topics") else None,
            row.get("total_experience"),
            row.get("tenure_years"),
            row.get("rating"),
            row.get("ageing"),
            row.get("department"),
            row.get("manager_id"),
            row.get("employee_status"),
            row.get("designation"),
            row.get("skill"),
            row.get("location_region"),
            row.get("previous_rag"),
            row.get("previous_concern"),
            row.get("primary_concern"),
            row.get("secondary_reason"),
            row.get("hrbp_connect_month"),
            row.get("project_manager"),
            row.get("rag_status_by_hrbp"),
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
    """Get the most recent classification for each employee, enriched with
    that employee's most recent department/manager from the survey CSV
    (so the frontend can show/filter by real team data instead of having
    no team association at all)."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT ON (c.employee_id)
            c.employee_id, c.risk_zone, c.risk_score, c.probabilities,
            c.top_factors, c.classified_at,
            s.department, s.manager_id,
            p.hrbp_risk_zone
        FROM classifications c
        LEFT JOIN LATERAL (
            SELECT department, manager_id
            FROM surveys
            WHERE surveys.employee_id = c.employee_id
            ORDER BY survey_date DESC
            LIMIT 1
        ) s ON true
        LEFT JOIN employee_profiles p ON p.employee_id = c.employee_id
        ORDER BY c.employee_id, c.classified_at DESC
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


# ── Employee profiles ────────────────────────────────────────────────────────

def db_upsert_employee_profile(employee_id: str, data: dict, updated_by: str) -> None:
    """Insert or update an HRBP-filled profile for a single employee."""
    conn = _connect()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO employee_profiles (
            employee_id, comments, hrbp_risk_zone,
            primary_concern, secondary_reason, previous_rag, previous_concern,
            designation, location_region, employee_status,
            total_experience, tenure_years, rating, ageing,
            updated_by, updated_at
        ) VALUES (
            %(employee_id)s, %(comments)s, %(hrbp_risk_zone)s,
            %(primary_concern)s, %(secondary_reason)s, %(previous_rag)s, %(previous_concern)s,
            %(designation)s, %(location_region)s, %(employee_status)s,
            %(total_experience)s, %(tenure_years)s, %(rating)s, %(ageing)s,
            %(updated_by)s, NOW()
        )
        ON CONFLICT (employee_id) DO UPDATE SET
            comments           = EXCLUDED.comments,
            hrbp_risk_zone     = EXCLUDED.hrbp_risk_zone,
            primary_concern    = EXCLUDED.primary_concern,
            secondary_reason   = EXCLUDED.secondary_reason,
            previous_rag       = EXCLUDED.previous_rag,
            previous_concern   = EXCLUDED.previous_concern,
            designation        = EXCLUDED.designation,
            location_region    = EXCLUDED.location_region,
            employee_status    = EXCLUDED.employee_status,
            total_experience   = EXCLUDED.total_experience,
            tenure_years       = EXCLUDED.tenure_years,
            rating             = EXCLUDED.rating,
            ageing             = EXCLUDED.ageing,
            updated_by         = EXCLUDED.updated_by,
            updated_at         = NOW()
    """, {
        "employee_id":       employee_id,
        "comments":          data.get("comments"),
        "hrbp_risk_zone":    data.get("hrbp_risk_zone"),
        "primary_concern":   data.get("primary_concern"),
        "secondary_reason":  data.get("secondary_reason"),
        "previous_rag":      data.get("previous_rag"),
        "previous_concern":  data.get("previous_concern"),
        "designation":       data.get("designation"),
        "location_region":   data.get("location_region"),
        "employee_status":   data.get("employee_status"),
        "total_experience":  data.get("total_experience"),
        "tenure_years":      data.get("tenure_years"),
        "rating":            data.get("rating"),
        "ageing":            data.get("ageing"),
        "updated_by":        updated_by,
    })
    conn.commit()
    conn.close()


def db_get_employee_profile(employee_id: str) -> Optional[dict]:
    """Return the HRBP-filled profile for one employee, or None."""
    conn = _connect()
    cur  = conn.cursor()
    cur.execute(
        "SELECT * FROM employee_profiles WHERE employee_id = %s",
        (employee_id,),
    )
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


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
        "zone_changes": db_get_zone_changes(),
    }

# ── Zone-change detection ───────────────────────────────────────────────────────────────────
def db_get_zone_changes() -> dict:
    """
    Compare each employee's classification BEFORE the most recent survey upload
    vs their classification AFTER it (i.e. the classifier run that followed).
 
    Boundary = MAX(surveys.created_at) — the timestamp of the last survey row
    inserted. Classifications before that line = old state, classifications
    at or after = new state (produced by running the classifier on the fresh data).

    `improved`  = count of employees who moved from RED or AMBER -> GREEN.
    `escalated` = count of employees who moved from GREEN -> AMBER or RED.
    RED <-> AMBER transitions are tracked in `total` and `details` but are
    intentionally excluded from both `improved` and `escalated`, since neither
    endpoint of that transition is GREEN.

    Returns all-zeros when no classifier has been run yet after the latest
    survey upload, or when fewer than two upload+classify cycles exist.
    """
    conn = _connect()
    cur  = conn.cursor()
 
    # Find the upload time of the most recently ingested survey batch
    cur.execute("SELECT MAX(created_at) AS last_upload FROM surveys")
    row = cur.fetchone()
    if not row or not row["last_upload"]:
        conn.close()
        return {"total": 0, "escalated": 0, "improved": 0, "details": []}
 
    last_upload = row["last_upload"]
 
    cur.execute("""
        WITH current_clsf AS (
            -- Most recent classification per employee AFTER the latest survey upload
            SELECT DISTINCT ON (employee_id)
                employee_id, risk_zone AS curr_zone
            FROM classifications
            WHERE classified_at >= %(last_upload)s
            ORDER BY employee_id, classified_at DESC
        ),
        prev_clsf AS (
            -- Most recent classification per employee BEFORE the latest survey upload
            SELECT DISTINCT ON (employee_id)
                employee_id, risk_zone AS prev_zone
            FROM classifications
            WHERE classified_at < %(last_upload)s
            ORDER BY employee_id, classified_at DESC
        )
        SELECT
            prev_zone AS from_zone,
            curr_zone AS to_zone,
            COUNT(*)  AS cnt
        FROM current_clsf
        JOIN prev_clsf ON current_clsf.employee_id = prev_clsf.employee_id
        WHERE curr_zone != prev_zone
        GROUP BY from_zone, to_zone
    """, {"last_upload": last_upload})
 
    rows = cur.fetchall()
    conn.close()
 
    RISK_RANK = {"GREEN": 0, "AMBER": 1, "RED": 2}
    total     = 0
    escalated = 0   # GREEN -> AMBER or GREEN -> RED only
    improved  = 0   # RED or AMBER -> GREEN only
    details   = []
 
    for r in rows:
        from_zone = r["from_zone"]
        to_zone   = r["to_zone"]
        cnt       = int(r["cnt"])
        total    += cnt
        details.append({"from": from_zone, "to": to_zone, "count": cnt})

        if from_zone == "GREEN" and to_zone in ("AMBER", "RED"):
            escalated += cnt
        elif from_zone in ("AMBER", "RED") and to_zone == "GREEN":
            improved += cnt
        # RED <-> AMBER transitions are excluded from both buckets —
        # they don't involve GREEN, so neither metric applies to them.
        # They still count toward `total` and appear in `details`.
 
    details.sort(
        key=lambda d: (RISK_RANK.get(d["to"], 0) - RISK_RANK.get(d["from"], 0)),
        reverse=True,
    )
 
    return {
        "total":     total,
        "escalated": escalated,
        "improved":  improved,
        "details":   details,
    }

def db_get_employee_latest_zone(employee_id: str) -> str | None:
    """Return the most recent classified risk zone for one employee, or None."""
    conn = _connect()
    cur  = conn.cursor()
    cur.execute("""
        SELECT risk_zone FROM classifications
        WHERE employee_id = %s
        ORDER BY classified_at DESC
        LIMIT 1
    """, (employee_id,))
    row = cur.fetchone()
    conn.close()
    return row["risk_zone"] if row else None


def db_cancel_open_interventions(employee_id: str) -> int:
    """
    Mark all pending/in-progress interventions for an employee as Cancelled.
    Called when a re-classification produces a different zone so stale
    action plans are not acted on.
    Returns the number of interventions cancelled.
    """
    conn = _connect()
    cur  = conn.cursor()
    cur.execute("""
        UPDATE interventions
        SET    status     = 'Cancelled',
               updated_at = NOW()
        WHERE  employee_id = %s
          AND  status NOT IN ('Completed', 'Cancelled')
    """, (employee_id,))
    count = cur.rowcount
    conn.commit()
    conn.close()
    return count

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


# ── Employee directory helpers ──────────────────────────────────────────────

def db_get_employee_manager(employee_id: str) -> Optional[str]:
    """Return the most recently reported manager_id for an employee, if any."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT manager_id FROM surveys
        WHERE employee_id = %s AND manager_id IS NOT NULL
        ORDER BY survey_date DESC LIMIT 1
    """, (employee_id,))
    row = cur.fetchone()
    conn.close()
    return row["manager_id"] if row else None


def db_get_employees_for_manager(manager_id: str) -> list[str]:
    """Return the distinct employee_ids that report to a given manager_id."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT DISTINCT employee_id FROM surveys WHERE manager_id = %s
    """, (manager_id,))
    rows = cur.fetchall()
    conn.close()
    return [r["employee_id"] for r in rows]


# ── Interventions / recommendations ─────────────────────────────────────────

def db_create_intervention(
    employee_id: str,
    created_by: str,
    reasoning: str,
    actions: list,
    priority: str = "medium",
    timeline: str = None,
    assigned_to: str = None,
    status: str = "Pending",
    due_date: str = None,
) -> int:
    """Create a new intervention/recommendation record for an employee."""
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO interventions (
            employee_id, created_by, assigned_to, status, priority,
            timeline, reasoning, actions, due_date
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        employee_id, created_by, assigned_to, status, priority,
        timeline, reasoning, json.dumps(actions), due_date,
    ))
    new_id = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return new_id


def _deserialize_intervention(row: dict) -> dict:
    d = dict(row)
    try:
        d["actions"] = json.loads(d["actions"]) if d.get("actions") else []
    except (json.JSONDecodeError, TypeError):
        d["actions"] = []
    return d


def db_get_interventions(
    employee_id: str = None,
    assigned_to: str = None,
    manager_employee_ids: list = None,
    status: str = None,
    limit: int = 100,
) -> list:
    """List interventions, with optional filters.

    manager_employee_ids: if provided, restricts to interventions whose
    employee_id is in this list (used for manager-scoped views).
    """
    conn = _connect()
    cur = conn.cursor()
    query = "SELECT * FROM interventions WHERE 1=1"
    params: list = []

    if employee_id:
        query += " AND employee_id = %s"
        params.append(employee_id)
    if assigned_to:
        query += " AND assigned_to = %s"
        params.append(assigned_to)
    if status:
        query += " AND status = %s"
        params.append(status)
    if manager_employee_ids is not None:
        if not manager_employee_ids:
            conn.close()
            return []
        placeholders = ",".join(["%s"] * len(manager_employee_ids))
        query += f" AND employee_id IN ({placeholders})"
        params.extend(manager_employee_ids)

    query += " ORDER BY created_at DESC LIMIT %s"
    params.append(limit)

    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return [_deserialize_intervention(r) for r in rows]


def db_get_intervention(intervention_id: int):
    conn = _connect()
    cur = conn.cursor()
    cur.execute("SELECT * FROM interventions WHERE id = %s", (intervention_id,))
    row = cur.fetchone()
    conn.close()
    return _deserialize_intervention(row) if row else None


def db_update_intervention(
    intervention_id: int,
    status: str = None,
    notes: str = None,
    assigned_to: str = None,
    priority: str = None,
    due_date: str = None,
) -> bool:
    """Update mutable fields on an intervention. Sets completed_at when status -> Completed."""
    conn = _connect()
    cur = conn.cursor()

    fields = []
    params: list = []

    if status is not None:
        fields.append("status = %s")
        params.append(status)
        if status.lower() == "completed":
            fields.append("completed_at = %s")
            params.append(datetime.now(timezone.utc).isoformat())
    if notes is not None:
        fields.append("notes = %s")
        params.append(notes)
    if assigned_to is not None:
        fields.append("assigned_to = %s")
        params.append(assigned_to)
    if priority is not None:
        fields.append("priority = %s")
        params.append(priority)
    if due_date is not None:
        fields.append("due_date = %s")
        params.append(due_date)

    if not fields:
        conn.close()
        return False

    fields.append("updated_at = NOW()")
    query = f"UPDATE interventions SET {', '.join(fields)} WHERE id = %s"
    params.append(intervention_id)

    cur.execute(query, params)
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def db_delete_intervention(intervention_id: int) -> bool:
    conn = _connect()
    cur = conn.cursor()
    cur.execute("DELETE FROM interventions WHERE id = %s", (intervention_id,))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


# ── Zone trend (real history, derived from classifier run timestamps) ──────

def db_get_zone_trend() -> list[dict]:
    """
    Real risk-zone distribution over time, grouped by the calendar month of
    each employee's most recent SURVEY DATE (the survey_date column derived
    from your CSV's "Date of joining"/connect-date field) as of each
    classification run -- not by when the classifier was executed. Two
    classify runs done back-to-back after uploading two separate survey
    waves will still land in two different months if the underlying survey
    dates were different.
    """
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        WITH dated AS (
            SELECT
                c.employee_id,
                c.risk_zone,
                c.classified_at,
                ls.survey_date
            FROM classifications c
            JOIN LATERAL (
                SELECT MAX(sv.survey_date::date) AS survey_date
                FROM surveys sv
                WHERE sv.employee_id = c.employee_id
                  AND sv.survey_date::date <= c.classified_at::date
            ) ls ON ls.survey_date IS NOT NULL
        ),
        bucketed AS (
            SELECT
                to_char(survey_date, 'MM-YYYY') AS month,
                employee_id,
                risk_zone,
                ROW_NUMBER() OVER (
                    PARTITION BY employee_id, to_char(survey_date, 'MM-YYYY')
                    ORDER BY classified_at DESC
                ) AS rn
            FROM dated
        )
        SELECT month, risk_zone, COUNT(DISTINCT employee_id) AS cnt
        FROM bucketed
        WHERE rn = 1
        GROUP BY month, risk_zone
        ORDER BY month
    """)
    rows = cur.fetchall()
    conn.close()
 
    months: dict[str, dict] = {}
    for r in rows:
        bucket = months.setdefault(r["month"], {"month": r["month"], "GREEN": 0, "AMBER": 0, "RED": 0})
        bucket[r["risk_zone"]] = r["cnt"]
    return list(months.values())

# ── Department / team aggregates ────────────────────────────────────────────

def db_get_department_aggregates() -> list[dict]:
    """
    Real, CSV-derived department/team rollups.

    Departments and manager_id are whatever values were present in the
    uploaded survey CSV — no employee or manager names are invented here.
    Health score is a transparent formula (not a guess): each currently
    classified employee contributes GREEN=1.0, AMBER=0.5, RED=0.0 to the
    average, scaled to a 0-100 score. If no employees in a department have
    been classified yet, health falls back to a sentiment-based estimate
    (0-100 scale, midpoint = neutral).
    """
    conn = _connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT DISTINCT ON (employee_id) employee_id, department, manager_id
        FROM surveys
        ORDER BY employee_id, survey_date DESC
    """)
    emp_info = {r["employee_id"]: {"department": r["department"], "manager_id": r["manager_id"]}
                for r in cur.fetchall()}

    cur.execute("""
        SELECT DISTINCT ON (employee_id) employee_id, risk_zone, risk_score
        FROM classifications
        ORDER BY employee_id, classified_at DESC
    """)
    clsf_by_emp = {r["employee_id"]: {"risk_zone": r["risk_zone"], "risk_score": r["risk_score"]}
                   for r in cur.fetchall()}

    cur.execute("""
        SELECT employee_id, AVG(sentiment_score) AS avg_sentiment
        FROM surveys
        WHERE sentiment_score IS NOT NULL
        GROUP BY employee_id
    """)
    sentiment_by_emp = {r["employee_id"]: r["avg_sentiment"] for r in cur.fetchall()}

    conn.close()

    depts: dict[str, dict] = {}
    for emp_id, info in emp_info.items():
        dept_name = info["department"] or "Unassigned"
        d = depts.setdefault(dept_name, {
            "department": dept_name, "employee_ids": [], "manager_counts": {},
            "red": 0, "amber": 0, "green": 0, "unclassified": 0, "sentiments": [],
        })
        d["employee_ids"].append(emp_id)
        if info["manager_id"]:
            d["manager_counts"][info["manager_id"]] = d["manager_counts"].get(info["manager_id"], 0) + 1

        zone = clsf_by_emp.get(emp_id, {}).get("risk_zone")
        if zone == "RED":
            d["red"] += 1
        elif zone == "AMBER":
            d["amber"] += 1
        elif zone == "GREEN":
            d["green"] += 1
        else:
            d["unclassified"] += 1

        s = sentiment_by_emp.get(emp_id)
        if s is not None:
            d["sentiments"].append(s)

    results = []
    for dept_name, d in depts.items():
        headcount = len(d["employee_ids"])
        classified = d["red"] + d["amber"] + d["green"]
        avg_sentiment = round(sum(d["sentiments"]) / len(d["sentiments"]), 4) if d["sentiments"] else None

        if classified > 0:
            health = round(100 * (d["green"] * 1.0 + d["amber"] * 0.5) / classified)
        elif avg_sentiment is not None:
            health = round((avg_sentiment + 1) * 50)
        else:
            health = None

        top_manager = max(d["manager_counts"].items(), key=lambda kv: kv[1])[0] if d["manager_counts"] else None

        results.append({
            "department": dept_name,
            "manager_id": top_manager,
            "headcount": headcount,
            "health": health,
            "red": d["red"],
            "amber": d["amber"],
            "green": d["green"],
            "unclassified": d["unclassified"],
            "avg_sentiment": avg_sentiment,
            "enps": round(avg_sentiment * 100) if avg_sentiment is not None else None,
        })

    results.sort(key=lambda r: (r["health"] is None, r["health"] if r["health"] is not None else 0))
    return results


# ── Topic aggregates (org-wide or per-department) ──────────────────────────

def _aggregate_topic_rows(rows: list[dict]) -> dict[str, dict]:
    totals: dict[str, float] = {}
    counts: dict[str, int] = {}
    for r in rows:
        try:
            topics = json.loads(r["topics_json"]) if r.get("topics_json") else {}
        except (TypeError, json.JSONDecodeError):
            topics = {}
        sent = r.get("sentiment_score") or 0
        for topic, confidence in topics.items():
            totals[topic] = totals.get(topic, 0.0) + sent * confidence
            counts[topic] = counts.get(topic, 0) + 1
    return {
        t: {"mentions": counts[t], "avg_sentiment": round(totals[t] / counts[t], 4)}
        for t in counts
    }


def db_get_topic_aggregates(department: Optional[str] = None) -> dict:
    """
    Real topic-level analytics derived from the zero-shot topic tags stored
    on each survey row (topics_json), weighted by that row's sentiment score.

    Returns:
      {
        "topics": [{"topic", "mentions", "avg_sentiment", "sentiment_delta"}],
        "monthly_trend": [{"month": "YYYY-MM", "<topic>": avg_sentiment, ...}],
      }

    sentiment_delta compares the most recent half of dated survey rows
    against the earlier half (chronologically) — a real before/after split
    of the actual data, not a fabricated number.
    """
    conn = _connect()
    cur = conn.cursor()
    query = "SELECT survey_date, sentiment_score, topics_json FROM surveys WHERE topics_json IS NOT NULL"
    params: list = []
    if department:
        query += " AND department = %s"
        params.append(department)
    query += " ORDER BY survey_date"
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    if not rows:
        return {"topics": [], "monthly_trend": []}

    split = len(rows) // 2
    prior_rows = rows[:split]
    recent_rows = rows[split:] if split else rows

    recent_agg = _aggregate_topic_rows(recent_rows)
    prior_agg = _aggregate_topic_rows(prior_rows) if prior_rows else {}

    topics_out = []
    for topic, stats in recent_agg.items():
        prior = prior_agg.get(topic)
        delta = round(stats["avg_sentiment"] - prior["avg_sentiment"], 4) if prior else 0.0
        topics_out.append({
            "topic": topic,
            "mentions": stats["mentions"],
            "avg_sentiment": stats["avg_sentiment"],
            "sentiment_delta": delta,
        })
    topics_out.sort(key=lambda t: t["mentions"], reverse=True)

    monthly: dict[str, dict] = {}
    for r in rows:
        month = str(r["survey_date"])[:7]
        try:
            topics = json.loads(r["topics_json"]) if r.get("topics_json") else {}
        except (TypeError, json.JSONDecodeError):
            topics = {}
        sent = r.get("sentiment_score") or 0
        bucket = monthly.setdefault(month, {})
        for topic, confidence in topics.items():
            agg = bucket.setdefault(topic, {"total": 0.0, "count": 0})
            agg["total"] += sent * confidence
            agg["count"] += 1

    monthly_trend = []
    for month in sorted(monthly.keys()):
        entry: dict = {"month": month}
        for topic, agg in monthly[month].items():
            entry[topic] = round(agg["total"] / agg["count"], 4) if agg["count"] else 0.0
        monthly_trend.append(entry)

    return {"topics": topics_out, "monthly_trend": monthly_trend}
