"""
modules/database.py
SQLite-backed persistent store for:
  - Employee snapshots (for trend tracking)
  - Intervention / recommendation tracking
  - Manager actions
  - Alerts

Uses sqlite3 directly (no ORM dependency) for zero-overhead startup.
Thread-safe: each call gets its own connection.
"""

import json
from datetime import datetime, timezone

from modules.db_adapter import _connect


def init_db() -> None:
    """Create all tables if they don't exist."""
    conn = _connect()
    cur = conn.cursor()

    # ── Employee snapshots (one row per employee per snapshot date) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS employee_snapshots (
            id              SERIAL PRIMARY KEY,
            employee_id     TEXT NOT NULL,
            snapshot_date   TEXT NOT NULL,        -- ISO date YYYY-MM-DD
            risk_score      REAL,
            risk_zone       TEXT,
            attrition_prob  REAL,                 -- 0.0-1.0 (RED prob from model)
            stress_level    REAL,
            workload_level  REAL,
            absenteeism     REAL,
            work_life_balance REAL,
            manager_support REAL,
            job_satisfaction  REAL,
            happiness_score   REAL,
            productivity      REAL,
            team_collaboration REAL,
            career_growth     REAL,
            top_factors       TEXT,               -- JSON list of {factor, contribution}
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── Interventions (one per recommendation batch for employee) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS interventions (
            id              SERIAL PRIMARY KEY,
            employee_id     TEXT NOT NULL,
            created_by      TEXT NOT NULL,        -- username
            assigned_to     TEXT,                 -- manager username
            status          TEXT DEFAULT 'Pending',
            priority        TEXT,
            timeline        TEXT,
            reasoning       TEXT,
            actions         TEXT,                 -- JSON list of strings
            notes           TEXT,
            due_date        TEXT,
            completed_at    TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── Manager action log (multiple per intervention) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS manager_actions (
            id              SERIAL PRIMARY KEY,
            intervention_id INTEGER NOT NULL REFERENCES interventions(id),
            actor           TEXT NOT NULL,
            action_type     TEXT NOT NULL,        -- 'status_change','comment','evidence'
            old_value       TEXT,
            new_value       TEXT,
            note            TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── Follow-up measurements (before/after intervention) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS follow_ups (
            id              SERIAL PRIMARY KEY,
            intervention_id INTEGER NOT NULL REFERENCES interventions(id),
            employee_id     TEXT NOT NULL,
            snapshot_before TEXT,               -- JSON of metrics before
            snapshot_after  TEXT,               -- JSON of metrics after
            risk_before     REAL,
            risk_after      REAL,
            improvement_pct REAL,               -- (risk_before - risk_after)/risk_before * 100
            effectiveness   TEXT,               -- 'High','Medium','Low','Negative'
            measured_at     TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── Alerts ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id              SERIAL PRIMARY KEY,
            employee_id     TEXT NOT NULL,
            alert_type      TEXT NOT NULL,      -- 'risk_spike','satisfaction_drop', etc.
            severity        TEXT NOT NULL,      -- 'critical','high','medium'
            message         TEXT NOT NULL,
            old_value       REAL,
            new_value       REAL,
            threshold       REAL,
            acknowledged    INTEGER DEFAULT 0,
            acknowledged_by TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── Users (persistent, bcrypt-hashed passwords) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              SERIAL PRIMARY KEY,
            username        TEXT NOT NULL UNIQUE,
            full_name       TEXT NOT NULL,
            role            TEXT NOT NULL DEFAULT 'manager',
            hashed_password TEXT NOT NULL,
            is_active       INTEGER DEFAULT 1,
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── Audit log (general-purpose) ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id              SERIAL PRIMARY KEY,
            actor           TEXT NOT NULL,
            action          TEXT NOT NULL,
            resource_type   TEXT,
            resource_id     TEXT,
            details         TEXT,
            ip_address      TEXT,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # ── Employees ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS employees (
            employee_id      TEXT PRIMARY KEY,
            name             TEXT NOT NULL,
            department       TEXT NOT NULL,
            manager_username TEXT NOT NULL
        )
    """)

    # ── Surveys ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS surveys (
            id               SERIAL PRIMARY KEY,
            employee_id      TEXT NOT NULL,
            survey_date      TEXT NOT NULL,
            survey_type      TEXT NOT NULL,
            score            INTEGER NOT NULL,
            feedback_text    TEXT,
            sentiment_score  REAL,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            FOREIGN KEY(employee_id) REFERENCES employees(employee_id)
        )
    """)
    
    # Attempt to add sentiment_score if table exists from before.
    # Use a savepoint so that a duplicate-column error rolls back only this
    # statement and does not abort the surrounding transaction (psycopg2 with
    # autocommit=False would otherwise poison every subsequent cur.execute()).
    cur.execute("SAVEPOINT add_sentiment_score")
    try:
        cur.execute("ALTER TABLE surveys ADD COLUMN sentiment_score REAL")
        cur.execute("RELEASE SAVEPOINT add_sentiment_score")
    except Exception:
        cur.execute("ROLLBACK TO SAVEPOINT add_sentiment_score")

    # ── Model Drift Metrics ──
    cur.execute("""
        CREATE TABLE IF NOT EXISTS model_drift_metrics (
            id               SERIAL PRIMARY KEY,
            snapshot_date    TEXT NOT NULL,
            mean_risk_score  REAL NOT NULL,
            pct_green        REAL NOT NULL,
            pct_amber        REAL NOT NULL,
            pct_red          REAL NOT NULL,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    conn.commit()

    # Seed default users if users table is empty
    cur.execute("SELECT COUNT(*) FROM users")
    existing = cur.fetchone()[0]
    if existing == 0:
        _seed_default_users(conn)

    conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Snapshot helpers
# ─────────────────────────────────────────────────────────────────────────────

def save_snapshots(predictions: list[dict], snapshot_date: str | None = None) -> int:
    """
    Persist a list of prediction results as employee snapshots.
    Returns number of rows inserted.
    """
    if not snapshot_date:
        snapshot_date = datetime.now(timezone.utc).date().isoformat()

    conn = _connect()
    cur = conn.cursor()
    count = 0
    for p in predictions:
        top_factors = p.get("top_factors", [])
        cur.execute("""
            INSERT INTO employee_snapshots
              (employee_id, snapshot_date, risk_score, risk_zone, attrition_prob,
               stress_level, workload_level, absenteeism, work_life_balance,
               manager_support, job_satisfaction, happiness_score, productivity,
               team_collaboration, career_growth, top_factors)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            str(p.get("employee_id", "")),
            snapshot_date,
            float(p.get("risk_score", 0)),
            str(p.get("risk_zone", p.get("prediction", ""))),
            float(p.get("probabilities", {}).get("RED", 0)),
            _metric(p, "stress_level"),
            _metric(p, "workload_level"),
            _metric(p, "absenteeism"),
            _metric(p, "work_life_balance"),
            _metric(p, "manager_support"),
            _metric(p, "job_satisfaction"),
            _metric(p, "happiness_score"),
            _metric(p, "productivity"),
            _metric(p, "team_collaboration"),
            _metric(p, "career_growth"),
            json.dumps(top_factors),
        ))
        count += 1
    conn.commit()
    conn.close()
    
    # Record drift metrics automatically when snapshots are saved
    db_record_drift_metrics(predictions, snapshot_date)
    
    return count

def db_record_drift_metrics(predictions: list[dict], snapshot_date: str) -> None:
    if not predictions:
        return
        
    total = len(predictions)
    mean_risk_score = sum(float(p.get("risk_score", 0)) for p in predictions) / total
    
    green_count = sum(1 for p in predictions if str(p.get("risk_zone", p.get("prediction", ""))) == "GREEN")
    amber_count = sum(1 for p in predictions if str(p.get("risk_zone", p.get("prediction", ""))) == "AMBER")
    red_count = sum(1 for p in predictions if str(p.get("risk_zone", p.get("prediction", ""))) == "RED")
    
    pct_green = (green_count / total) * 100
    pct_amber = (amber_count / total) * 100
    pct_red = (red_count / total) * 100
    
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO model_drift_metrics 
        (snapshot_date, mean_risk_score, pct_green, pct_amber, pct_red)
        VALUES (%s, %s, %s, %s, %s)
    """, (snapshot_date, mean_risk_score, pct_green, pct_amber, pct_red))
    conn.commit()
    conn.close()

def db_get_drift_metrics(limit: int = 30) -> list[dict]:
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT snapshot_date, mean_risk_score, pct_green, pct_amber, pct_red 
        FROM model_drift_metrics 
        ORDER BY snapshot_date DESC 
        LIMIT %s
    """, (limit,))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows][::-1]  # Return chronologically


def _metric(p: dict, key: str) -> float | None:
    v = p.get(key) or (p.get("metrics", {}) or {}).get(key)
    return float(v) if v is not None else None


def get_employee_history(employee_id: str, months: int = 12) -> list[dict]:
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM employee_snapshots
        WHERE employee_id = %s
        ORDER BY snapshot_date ASC
        LIMIT %s
    """, (str(employee_id), months * 10))
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_trend_summary(months: int = 6, manager_username: str = None) -> list[dict]:
    """Aggregate risk metrics grouped by month across all employees."""
    conn = _connect()
    
    join_clause = ""
    where_clause = ""
    params = [months]
    
    if manager_username:
        join_clause = "JOIN employees e ON s.employee_id = e.employee_id"
        where_clause = "WHERE e.manager_username = %s"
        params.insert(0, manager_username)
        
    query = f"""
        SELECT
            substr(s.snapshot_date,1,7)   AS month,
            COUNT(DISTINCT s.employee_id) AS employee_count,
            ROUND(AVG(s.risk_score),1)    AS avg_risk,
            SUM(CASE WHEN s.risk_zone='RED'   THEN 1 ELSE 0 END) AS red_count,
            SUM(CASE WHEN s.risk_zone='AMBER' THEN 1 ELSE 0 END) AS amber_count,
            SUM(CASE WHEN s.risk_zone='GREEN' THEN 1 ELSE 0 END) AS green_count,
            ROUND(AVG(s.stress_level),2)       AS avg_stress,
            ROUND(AVG(s.job_satisfaction),2)   AS avg_satisfaction,
            ROUND(AVG(s.work_life_balance),2)  AS avg_wlb,
            ROUND(AVG(s.manager_support),2)    AS avg_manager_support,
            ROUND(AVG(s.career_growth),2)      AS avg_career_growth
        FROM employee_snapshots s
        {join_clause}
        {where_clause}
        GROUP BY substr(s.snapshot_date,1,7)
        ORDER BY month DESC
        LIMIT %s
    """
    cur = conn.cursor()
    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]


def get_persistent_issues(employee_id: str, threshold_months: int = 3) -> list[dict]:
    """
    Detect issues that have persisted across >= threshold_months consecutive snapshots.
    Returns list of {issue, months_count, first_seen, last_seen}.
    """
    history = get_employee_history(employee_id, months=12)
    if not history:
        return []

    ISSUE_CHECKS = {
        "High Stress":        lambda r: (r.get("stress_level") or 0) >= 7,
        "High Workload":      lambda r: (r.get("workload_level") or 0) >= 7,
        "Low Satisfaction":   lambda r: (r.get("job_satisfaction") or 10) <= 4,
        "Poor Work-Life Balance": lambda r: (r.get("work_life_balance") or 10) <= 4,
        "Low Manager Support": lambda r: (r.get("manager_support") or 10) <= 4,
        "Low Career Growth":  lambda r: (r.get("career_growth") or 10) <= 4,
        "High Absenteeism":   lambda r: (r.get("absenteeism") or 0) >= 5,
        "Elevated Risk":      lambda r: (r.get("risk_score") or 0) >= 65,
    }

    results = []
    for issue_name, check_fn in ISSUE_CHECKS.items():
        months_with_issue = [r for r in history if check_fn(r)]
        if len(months_with_issue) >= threshold_months:
            results.append({
                "issue":       issue_name,
                "months_count": len(months_with_issue),
                "first_seen":  months_with_issue[0]["snapshot_date"],
                "last_seen":   months_with_issue[-1]["snapshot_date"],
            })

    results.sort(key=lambda x: x["months_count"], reverse=True)
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Intervention helpers
# ─────────────────────────────────────────────────────────────────────────────

VALID_STATUSES = {"Pending", "Approved", "In Progress", "Completed", "Rejected"}


def create_intervention(
    employee_id: str,
    created_by: str,
    assigned_to: str,
    priority: str,
    timeline: str,
    reasoning: str,
    actions: list[str],
    due_date: str | None = None,
) -> int:
    conn = _connect()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO interventions
          (employee_id, created_by, assigned_to, priority, timeline, reasoning, actions, due_date)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        str(employee_id), created_by, assigned_to,
        priority, timeline, reasoning,
        json.dumps(actions), due_date,
    ))
    conn.commit()
    # psycopg2: get the new row's ID
    cur.execute("SELECT lastval()")
    new_id = cur.fetchone()[0]
    conn.close()
    return new_id


def get_interventions(
    employee_id: str | None = None,
    status: str | None = None,
    assigned_to: str | None = None,
    manager_username: str | None = None,
    limit: int = 100,
) -> list[dict]:
    conn = _connect()
    clauses, params = [], []
    join_clause = ""
    
    if manager_username:
        join_clause = "JOIN employees e ON interventions.employee_id = e.employee_id"
        clauses.append("e.manager_username = %s")
        params.append(manager_username)
        
    if employee_id:
        clauses.append("interventions.employee_id = %s"); 
        params.append(str(employee_id))
    if status:
        clauses.append("interventions.status = %s"); 
        params.append(status)
    if assigned_to:
        clauses.append("interventions.assigned_to = %s"); 
        params.append(assigned_to)
        
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    _cur4 = conn.cursor()
    _cur4.execute(
        f"SELECT interventions.* FROM interventions {join_clause} {where} ORDER BY interventions.created_at DESC LIMIT %s",
        params + [limit]
    )
    rows = _cur4.fetchall()
    conn.close()
    data = [dict(r) for r in rows]
    for d in data:
        if d.get("actions"):
            try: 
                d["actions"] = json.loads(d["actions"])
            except Exception: 
                pass
    return data

def enforce_intervention_slas() -> int:
    """
    Checks for interventions that are Pending or In Progress and past their due_date.
    Updates their status to 'Escalated' and generates a Critical Alert.
    Returns the number of escalated interventions.
    """
    conn = _connect()
    
    # SQLite uses YYYY-MM-DD format for dates, so string comparison works
    now_date = datetime.now(timezone.utc).date().isoformat()
    
    # Find overdue interventions
    cur = conn.cursor()
    cur.execute("""
        SELECT id, employee_id, assigned_to, due_date
        FROM interventions
        WHERE status IN ('Pending', 'In Progress') 
          AND due_date IS NOT NULL 
          AND due_date < %s
    """, (now_date,))
    rows = cur.fetchall()
    
    if not rows:
        conn.close()
        return 0
        
    escalated_count = 0
    for r in rows:
        interv_id = r["id"]
        emp_id = r["employee_id"]
        manager = r["assigned_to"]
        
        # Update status
        cur.execute("UPDATE interventions SET status = 'Escalated', updated_at = NOW() WHERE id = %s", (interv_id,))
        
        # Insert action log
        cur.execute("""
            INSERT INTO manager_actions (intervention_id, actor, action_type, old_value, new_value, note)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (interv_id, "System", "status_change", "Overdue", "Escalated", "Automated SLA Escalation due to missed due date."))
        
        # Generate alert
        cur.execute("""
            INSERT INTO alerts (employee_id, alert_type, severity, message)
            VALUES (%s, %s, %s, %s)
        """, (emp_id, "intervention_overdue", "critical", f"Intervention #{interv_id} is overdue and has been Escalated."))
        
        escalated_count += 1
        
    conn.commit()
    conn.close()
    
    return escalated_count


def update_intervention_status(
    intervention_id: int,
    new_status: str,
    actor: str,
    note: str = "",
) -> bool:
    if new_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {new_status}. Must be one of {VALID_STATUSES}")
    conn = _connect()
    _cur = conn.cursor()
    _cur.execute("SELECT status FROM interventions WHERE id=%s", (intervention_id,))
    row = _cur.fetchone()
    if not row:
        conn.close(); return False
    old_status = row["status"]
    now = datetime.now(timezone.utc).isoformat()
    _cur.execute(
        "UPDATE interventions SET status=%s, updated_at=%s, completed_at=%s WHERE id=%s",
        (new_status, now, now if new_status == "Completed" else None, intervention_id)
    )
    _cur.execute("""
        INSERT INTO manager_actions (intervention_id, actor, action_type, old_value, new_value, note)
        VALUES (%s,%s,%s,%s,%s,%s)
    """, (intervention_id, actor, "status_change", old_status, new_status, note))
    conn.commit()
    conn.close()
    return True


def add_intervention_note(intervention_id: int, actor: str, note: str) -> bool:
    conn = _connect()
    _cur2 = conn.cursor()
    _cur2.execute("SELECT id FROM interventions WHERE id=%s", (intervention_id,))
    row = _cur2.fetchone()
    if not row:
        conn.close(); return False
    now = datetime.now(timezone.utc).isoformat()
    _cur2.execute("UPDATE interventions SET notes=%s, updated_at=%s WHERE id=%s", (note, now, intervention_id))
    _cur2.execute("""
        INSERT INTO manager_actions (intervention_id, actor, action_type, new_value)
        VALUES (%s,%s,%s,%s)
    """, (intervention_id, actor, "comment", note))
    conn.commit()
    conn.close()
    return True


def get_intervention_actions(intervention_id: int) -> list[dict]:
    conn = _connect()
    _cur3 = conn.cursor()
    _cur3.execute(
        "SELECT * FROM manager_actions WHERE intervention_id=%s ORDER BY created_at ASC",
        (intervention_id,)
    )
    rows = _cur3.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Follow-up / effectiveness
# ─────────────────────────────────────────────────────────────────────────────

def record_follow_up(
    intervention_id: int,
    employee_id: str,
    metrics_before: dict,
    metrics_after: dict,
    risk_before: float,
    risk_after: float,
) -> dict:
    if risk_before > 0:
        improvement_pct = round((risk_before - risk_after) / risk_before * 100, 1)
    else:
        improvement_pct = 0.0

    if improvement_pct >= 25:
        effectiveness = "High"
    elif improvement_pct >= 10:
        effectiveness = "Medium"
    elif improvement_pct >= 0:
        effectiveness = "Low"
    else:
        effectiveness = "Negative"

    conn = _connect()
    _cfu = conn.cursor()
    _cfu.execute("""
        INSERT INTO follow_ups
          (intervention_id, employee_id, snapshot_before, snapshot_after,
           risk_before, risk_after, improvement_pct, effectiveness)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        intervention_id, str(employee_id),
        json.dumps(metrics_before), json.dumps(metrics_after),
        risk_before, risk_after, improvement_pct, effectiveness,
    ))
    conn.commit()
    conn.close()
    return {
        "risk_before": risk_before,
        "risk_after": risk_after,
        "improvement_pct": improvement_pct,
        "effectiveness": effectiveness,
    }


def get_follow_up(intervention_id: int) -> dict | None:
    conn = _connect()
    _cgf = conn.cursor()
    _cgf.execute(
        "SELECT * FROM follow_ups WHERE intervention_id=%s ORDER BY measured_at DESC LIMIT 1",
        (intervention_id,)
    )
    row = _cgf.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    for k in ("snapshot_before", "snapshot_after"):
        if d.get(k):
            try: d[k] = json.loads(d[k])
            except Exception: pass
    return d


# ─────────────────────────────────────────────────────────────────────────────
# Alert helpers
# ─────────────────────────────────────────────────────────────────────────────

ALERT_RULES = {
    "risk_spike":           {"threshold": 15.0,  "severity": "critical", "msg": "Risk score spiked by {delta:.0f} points ({old:.0f}→{new:.0f})"},
    "satisfaction_drop":    {"threshold": -2.0,  "severity": "high",     "msg": "Job satisfaction dropped by {delta:.1f} points ({old:.1f}→{new:.1f})"},
    "stress_spike":         {"threshold": 2.0,   "severity": "high",     "msg": "Stress level spiked by {delta:.1f} ({old:.1f}→{new:.1f})"},
    "absenteeism_spike":    {"threshold": 3.0,   "severity": "high",     "msg": "Absenteeism jumped by {delta:.0f} days ({old:.0f}→{new:.0f})"},
    "wlb_drop":             {"threshold": -2.0,  "severity": "medium",   "msg": "Work-life balance dropped by {delta:.1f} ({old:.1f}→{new:.1f})"},
    "manager_support_drop": {"threshold": -2.0,  "severity": "medium",   "msg": "Manager support dropped by {delta:.1f} ({old:.1f}→{new:.1f})"},
    "entered_red":          {"threshold": 65.0,  "severity": "critical", "msg": "Employee entered RED zone (risk={new:.0f})"},
}


def check_and_create_alerts(prev_snap: dict, curr_snap: dict) -> list[dict]:
    """Compare two snapshots and create alerts for threshold breaches."""
    new_alerts = []
    eid = curr_snap.get("employee_id", "")

    checks = [
        ("risk_spike",           "risk_score",      "risk_score"),
        ("satisfaction_drop",    "job_satisfaction", "job_satisfaction"),
        ("stress_spike",         "stress_level",    "stress_level"),
        ("absenteeism_spike",    "absenteeism",     "absenteeism"),
        ("wlb_drop",             "work_life_balance", "work_life_balance"),
        ("manager_support_drop", "manager_support", "manager_support"),
    ]

    conn = _connect()
    _cca = conn.cursor()
    for alert_type, prev_key, curr_key in checks:
        rule = ALERT_RULES[alert_type]
        old = prev_snap.get(prev_key)
        new = curr_snap.get(curr_key)
        if old is None or new is None:
            continue
        delta = new - old
        if abs(delta) >= abs(rule["threshold"]) and (
            (rule["threshold"] > 0 and delta >= rule["threshold"]) or
            (rule["threshold"] < 0 and delta <= rule["threshold"])
        ):
            msg = rule["msg"].format(delta=abs(delta), old=old, new=new)
            _cca.execute("""
                INSERT INTO alerts (employee_id, alert_type, severity, message, old_value, new_value, threshold)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
            """, (eid, alert_type, rule["severity"], msg, old, new, rule["threshold"]))
            new_alerts.append({"employee_id": eid, "type": alert_type, "severity": rule["severity"], "message": msg})

    # Red zone entry alert
    prev_zone = prev_snap.get("risk_zone", "")
    curr_zone = curr_snap.get("risk_zone", "")
    if prev_zone != "RED" and curr_zone == "RED":
        risk = curr_snap.get("risk_score", 0)
        msg = ALERT_RULES["entered_red"]["msg"].format(new=risk)
        _cca.execute("""
            INSERT INTO alerts (employee_id, alert_type, severity, message, new_value, threshold)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (eid, "entered_red", "critical", msg, risk, 65.0))
        new_alerts.append({"employee_id": eid, "type": "entered_red", "severity": "critical", "message": msg})

    conn.commit()
    conn.close()

    # Dispatch notifications for critical/high alerts
    try:
        from modules.notifications import send_alert_notification
        for alert in new_alerts:
            if alert.get("severity") in ("critical", "high"):
                send_alert_notification(alert)
    except Exception:
        pass  # notification failures must not break alert creation

    return new_alerts


def get_alerts(
    employee_id: str | None = None,
    acknowledged: bool | None = None,
    manager_username: str | None = None,
    limit: int = 50,
) -> list[dict]:
    conn = _connect()
    clauses, params = [], []
    join_clause = ""
    
    if manager_username:
        join_clause = "JOIN employees e ON alerts.employee_id = e.employee_id"
        clauses.append("e.manager_username = %s")
        params.append(manager_username)
        
    if employee_id:
        clauses.append("alerts.employee_id = %s"); params.append(str(employee_id))
    if acknowledged is not None:
        clauses.append("alerts.acknowledged = %s"); params.append(1 if acknowledged else 0)
        
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    _cur5 = conn.cursor()
    _cur5.execute(
        f"SELECT alerts.* FROM alerts {join_clause} {where} ORDER BY alerts.created_at DESC LIMIT %s",
        params + [limit]
    )
    rows = _cur5.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def acknowledge_alert(alert_id: int, acknowledged_by: str) -> bool:
    conn = _connect()
    _cur6 = conn.cursor()
    _cur6.execute(
        "UPDATE alerts SET acknowledged=1, acknowledged_by=%s WHERE id=%s",
        (acknowledged_by, alert_id)
    )
    conn.commit()
    conn.close()
    return _cur6.rowcount > 0


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard KPIs
# ─────────────────────────────────────────────────────────────────────────────

def db_get_manager_effectiveness(manager_username: str = None) -> float:
    """
    Calculates a 0-100 score based on 3 factors:
    1. Team eNPS (Weighted 40%)
    2. Average Team Attrition Probability (Inverted, Weighted 40%)
    3. Intervention Resolution Rate (Weighted 20%)
    """
    conn = _connect()
    
    # 1. Team eNPS
    enps_data = db_calculate_enps(manager_username)
    enps_score = enps_data["enps"]
    # Normalize eNPS (-100 to 100) -> (0 to 100)
    enps_norm = (enps_score + 100) / 2
    
    # 2. Average Team Attrition Probability
    where_manager = "WHERE employee_id IN (SELECT employee_id FROM employees WHERE manager_username = %s)" if manager_username else ""
    params = [manager_username] if manager_username else []
    
    _cur7 = conn.cursor()
    _cur7.execute(f"""
        WITH latest AS (
            SELECT employee_id, MAX(snapshot_date) AS max_date
            FROM employee_snapshots GROUP BY employee_id
        )
        SELECT AVG(s.attrition_prob) as avg_prob
        FROM employee_snapshots s
        JOIN latest l ON s.employee_id=l.employee_id AND s.snapshot_date=l.max_date
        {where_manager}
    """, params)
    avg_risk_row = _cur7.fetchone()
    
    avg_prob = avg_risk_row["avg_prob"] if avg_risk_row and avg_risk_row["avg_prob"] is not None else 0
    # Invert prob (0 to 1) -> (0 to 100)
    attrition_score = (1 - avg_prob) * 100
    
    # 3. Intervention Resolution Rate
    where_int_manager = "WHERE assigned_to = %s" if manager_username else ""
    int_params = [manager_username] if manager_username else []
    
    _cur7.execute(f"""
        SELECT 
            SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) as completed,
            COUNT(*) as total
        FROM interventions
        {where_int_manager}
    """, int_params)
    int_stats = _cur7.fetchone()
    
    total_int = int_stats["total"] if int_stats and int_stats["total"] else 0
    completed_int = int_stats["completed"] if int_stats and int_stats["completed"] else 0
    
    resolution_rate = (completed_int / total_int * 100) if total_int > 0 else 100 # Default to 100 if no interventions needed
    
    conn.close()
    
    # Calculate composite score
    effectiveness = (enps_norm * 0.40) + (attrition_score * 0.40) + (resolution_rate * 0.20)
    return round(effectiveness, 1)

def get_dashboard_kpis(manager_username: str = None) -> dict:
    conn = _connect()

    where_manager = ""
    params = []
    if manager_username:
        where_manager = "WHERE employee_id IN (SELECT employee_id FROM employees WHERE manager_username = %s)"
        params.append(manager_username)

    _cur8 = conn.cursor()
    # Latest snapshot stats
    _cur8.execute("""
        WITH latest AS (
            SELECT employee_id, MAX(snapshot_date) AS max_date
            FROM employee_snapshots GROUP BY employee_id
        )
        SELECT
            COUNT(*) AS total_employees,
            ROUND(AVG(s.risk_score),1) AS avg_risk,
            SUM(CASE WHEN s.risk_zone='RED'   THEN 1 ELSE 0 END) AS high_risk,
            SUM(CASE WHEN s.risk_zone='AMBER' THEN 1 ELSE 0 END) AS medium_risk,
            SUM(CASE WHEN s.risk_zone='GREEN' THEN 1 ELSE 0 END) AS low_risk
        FROM employee_snapshots s
        JOIN latest l ON s.employee_id=l.employee_id AND s.snapshot_date=l.max_date
    """)
    snap_stats = _cur8.fetchone()

    # Intervention stats
    _cur8.execute("""
        SELECT
            SUM(CASE WHEN status='Pending'    THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status='In Progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status='Completed'  THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status='Rejected'   THEN 1 ELSE 0 END) AS rejected,
            COUNT(*) AS total
        FROM interventions
    """)
    int_stats = _cur8.fetchone()

    # Effectiveness
    _cur8.execute("""
        SELECT
            COUNT(*) as total_followups,
            ROUND(AVG(improvement_pct),1) as avg_improvement,
            SUM(CASE WHEN effectiveness='High' THEN 1 ELSE 0 END) as high_eff,
            SUM(CASE WHEN effectiveness IN ('High','Medium') THEN 1 ELSE 0 END) as positive_eff
        FROM follow_ups
    """)
    eff_stats = _cur8.fetchone()

    # Unacknowledged alerts
    _cur8.execute("SELECT COUNT(*) FROM alerts WHERE acknowledged=0")
    alert_count = _cur8.fetchone()[0]

    conn.close()

    s = dict(snap_stats) if snap_stats else {}
    i = dict(int_stats)  if int_stats  else {}
    e = dict(eff_stats)  if eff_stats  else {}

    total_int = i.get("total", 0) or 1
    completed = i.get("completed", 0) or 0
    success_rate = round(completed / total_int * 100, 1) if total_int else 0

    enps_data = db_calculate_enps(manager_username)
    engagement_data = db_calculate_engagement_index(manager_username)
    manager_effectiveness = db_get_manager_effectiveness(manager_username)

    return {
        "total_employees":       s.get("total_employees", 0),
        "avg_attrition_risk":    s.get("avg_risk", 0),
        "high_risk_count":       s.get("high_risk", 0),
        "medium_risk_count":     s.get("medium_risk", 0),
        "low_risk_count":        s.get("low_risk", 0),
        "interventions_pending": i.get("pending", 0),
        "interventions_in_progress": i.get("in_progress", 0),
        "interventions_completed": completed,
        "intervention_success_rate": success_rate,
        "avg_improvement_pct":   e.get("avg_improvement", 0),
        "unacknowledged_alerts": alert_count,
        "enps":                  enps_data,
        "engagement":            engagement_data,
        "manager_effectiveness": manager_effectiveness,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Employee data update (manual / UI-driven)
# ─────────────────────────────────────────────────────────────────────────────

UPDATABLE_METRICS = {
    "stress_level", "workload_level", "absenteeism", "work_life_balance",
    "manager_support", "job_satisfaction", "happiness_score",
    "productivity", "team_collaboration", "career_growth",
    "risk_score", "risk_zone", "attrition_prob",
}


def update_employee_snapshot(
    employee_id: str,
    updates: dict,
    snapshot_date: str | None = None,
) -> dict:
    """
    Insert a new snapshot row for an employee with updated metric values.
    Pulls the most recent existing snapshot to carry forward unchanged fields,
    then inserts a new row — preserving history while reflecting the changes.

    Returns the new snapshot dict.
    """
    if not snapshot_date:
        snapshot_date = datetime.now(timezone.utc).date().isoformat()

    conn  = _connect()
    # Get latest snapshot to carry forward unchanged values
    _cur9 = conn.cursor()
    _cur9.execute(
        "SELECT * FROM employee_snapshots WHERE employee_id=%s ORDER BY snapshot_date DESC LIMIT 1",
        (str(employee_id),)
    )
    latest = _cur9.fetchone()

    base = dict(latest) if latest else {}

    # Merge updates (only allow known metric fields)
    safe_updates = {k: v for k, v in updates.items() if k in UPDATABLE_METRICS}
    merged = {**base, **safe_updates}

    # Recompute risk_zone from risk_score if score changed but zone wasn't supplied
    if "risk_score" in safe_updates and "risk_zone" not in safe_updates:
        rs = float(safe_updates["risk_score"])
        merged["risk_zone"] = "RED" if rs >= 65 else ("AMBER" if rs >= 35 else "GREEN")

    _cur9.execute("""
        INSERT INTO employee_snapshots
          (employee_id, snapshot_date, risk_score, risk_zone, attrition_prob,
           stress_level, workload_level, absenteeism, work_life_balance,
           manager_support, job_satisfaction, happiness_score, productivity,
           team_collaboration, career_growth, top_factors)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        str(employee_id),
        snapshot_date,
        merged.get("risk_score"),
        merged.get("risk_zone"),
        merged.get("attrition_prob"),
        merged.get("stress_level"),
        merged.get("workload_level"),
        merged.get("absenteeism"),
        merged.get("work_life_balance"),
        merged.get("manager_support"),
        merged.get("job_satisfaction"),
        merged.get("happiness_score"),
        merged.get("productivity"),
        merged.get("team_collaboration"),
        merged.get("career_growth"),
        merged.get("top_factors", "[]"),
    ))
    conn.commit()

    # Return fresh snapshot
    _cur9.execute(
        "SELECT * FROM employee_snapshots WHERE employee_id=%s ORDER BY id DESC LIMIT 1",
        (str(employee_id),)
    )
    new_row = _cur9.fetchone()
    conn.close()

    return dict(new_row) if new_row else {}


def create_alert_from_prediction(prediction: dict) -> list[dict]:
    """
    Create alerts immediately when a prediction classifies an employee.
    RED zone → 'entered_red' critical alert.
    Very high risk score → 'risk_spike' high alert.
    Returns list of created alert dicts.
    """
    created = []
    eid     = str(prediction.get("employee_id", ""))
    zone    = prediction.get("risk_zone", prediction.get("prediction", ""))
    score   = float(prediction.get("risk_score", 0))

    conn = _connect()
    _cafp = conn.cursor()

    # RED zone alert
    if zone == "RED":
        msg = f"Employee {eid} classified as RED ZONE — risk score {score:.1f}"
        _cafp.execute("""
            INSERT INTO alerts (employee_id, alert_type, severity, message, new_value, threshold)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (eid, "entered_red", "critical", msg, score, 65.0))
        created.append({"employee_id": eid, "type": "entered_red",
                        "severity": "critical", "message": msg})

    # AMBER zone alert
    elif zone == "AMBER":
        msg = f"Employee {eid} classified as AMBER ZONE — risk score {score:.1f}"
        _cafp.execute("""
            INSERT INTO alerts (employee_id, alert_type, severity, message, new_value, threshold)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (eid, "risk_spike", "high", msg, score, 35.0))
        created.append({"employee_id": eid, "type": "risk_spike",
                        "severity": "high", "message": msg})

    # Very high attrition probability
    attrition = float(prediction.get("attrition_prob", 0))
    if attrition >= 70 and zone != "RED":
        msg = f"Employee {eid} has high attrition probability: {attrition:.1f}%"
        _cafp.execute("""
            INSERT INTO alerts (employee_id, alert_type, severity, message, new_value, threshold)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (eid, "risk_spike", "high", msg, attrition, 70.0))
        created.append({"employee_id": eid, "type": "risk_spike",
                        "severity": "high", "message": msg})

    conn.commit()
    conn.close()

    # Dispatch notifications for critical/high alerts
    try:
        from modules.notifications import send_alert_notification
        for alert in created:
            if alert.get("severity") in ("critical", "high"):
                send_alert_notification(alert)
    except Exception:
        pass  # notification failures must not break alert creation

    return created


# ─────────────────────────────────────────────────────────────────────────
# User Management (bcrypt-backed, DB-persistent)
# ─────────────────────────────────────────────────────────────────────────

try:
    import bcrypt

    def _hash_password(plain: str) -> str:
        # Generate salt and hash the password
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(plain.encode('utf-8'), salt)
        return hashed.decode('utf-8')

    def _verify_password(plain: str, hashed: str) -> bool:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

except ImportError:
    # Fallback: if bcrypt is not installed, use a warning + basic hash
    import hashlib as _hl
    import sys as _sys
    print("[SECURITY] bcrypt not installed — using SHA-256 fallback "
          "(NOT recommended for production). Install: pip install bcrypt",
          file=_sys.stderr)

    def _hash_password(plain: str) -> str:  # type: ignore[misc]
        return _hl.sha256(plain.encode()).hexdigest()

    def _verify_password(plain: str, hashed: str) -> bool:  # type: ignore[misc]
        return _hl.sha256(plain.encode()).hexdigest() == hashed


def _seed_default_users(conn) -> None:
    """Insert default admin + manager on first run."""
    defaults = [
        ("admin",   "Admin User",   "admin",   "admin123"),
        ("manager", "Manager User", "manager", "manager123"),
    ]
    for username, full_name, role, password in defaults:
        conn.cursor().execute("""
            INSERT INTO users (username, full_name, role, hashed_password)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (username) DO NOTHING
        """, (username, full_name, role, _hash_password(password)))
    conn.commit()


def db_get_user(username: str) -> dict | None:
    """Fetch a user by username. Returns dict or None."""
    conn = _connect()
    _cur15 = conn.cursor()
    _cur15.execute(
        "SELECT id, username, full_name, role, hashed_password, is_active "
        "FROM users WHERE username = %s",
        (username,),
    )
    row = _cur15.fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row[0], "username": row[1], "full_name": row[2],
        "role": row[3], "hashed_password": row[4], "is_active": bool(row[5]),
    }


def db_authenticate_user(username: str, password: str) -> dict | None:
    """Verify credentials. Returns user dict (without hash) or None."""
    user = db_get_user(username)
    if not user or not user["is_active"]:
        return None
    if not _verify_password(password, user["hashed_password"]):
        return None
    # Don't return the hash to callers
    return {k: v for k, v in user.items() if k != "hashed_password"}


def db_list_users() -> list[dict]:
    conn = _connect()
    _cur16 = conn.cursor()
    _cur16.execute(
        "SELECT username, full_name, role, is_active, created_at "
        "FROM users ORDER BY created_at"
    )
    rows = _cur16.fetchall()
    conn.close()
    return [
        {"username": r[0], "full_name": r[1], "role": r[2],
         "is_active": bool(r[3]), "created_at": r[4]}
        for r in rows
    ]


def db_create_user(username: str, password: str, full_name: str, role: str) -> bool:
    """Create a new user. Returns True on success, raises on duplicate."""
    conn = _connect()
    try:
        conn.cursor().execute(
            "INSERT INTO users (username, full_name, role, hashed_password) "
            "VALUES (%s, %s, %s, %s)",
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
    """Delete a user by username. Returns True if deleted, False if not found."""
    conn = _connect()
    _cur17 = conn.cursor()
    _cur17.execute("DELETE FROM users WHERE username = %s", (username,))
    conn.commit()
    conn.close()
    return _cur17.rowcount > 0


def db_update_user_password(username: str, new_password: str) -> bool:
    """Update a user's password. Returns True if updated."""
    conn = _connect()
    _cur18 = conn.cursor()
    _cur18.execute(
        "UPDATE users SET hashed_password = %s, updated_at = NOW() "
        "WHERE username = %s",
        (_hash_password(new_password), username),
    )
    conn.commit()
    conn.close()
    return _cur18.rowcount > 0


# ─────────────────────────────────────────────────────────────────────────
# Audit Logging
# ─────────────────────────────────────────────────────────────────────────

def db_write_audit_log(
    actor: str,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: str | None = None,
    ip_address: str | None = None,
) -> None:
    conn = _connect()
    conn.cursor().execute("""
        INSERT INTO audit_log (actor, action, resource_type, resource_id, details, ip_address)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (actor, action, resource_type, resource_id, details, ip_address))
    conn.commit()
    conn.close()


def db_get_audit_log(limit: int = 100) -> list[dict]:
    conn = _connect()
    _cur19 = conn.cursor()
    _cur19.execute(
        "SELECT actor, action, resource_type, resource_id, details, ip_address, created_at "
        "FROM audit_log ORDER BY created_at DESC LIMIT %s",
        (limit,),
    )
    rows = _cur19.fetchall()
    conn.close()
    return [
        {"actor": r[0], "action": r[1], "resource_type": r[2],
         "resource_id": r[3], "details": r[4], "ip_address": r[5], "created_at": r[6]}
        for r in rows
    ]


# ─────────────────────────────────────────────────────────────────────────
# Phase 2: Employees & Surveys
# ─────────────────────────────────────────────────────────────────────────

def db_upsert_employee(employee_id: str, name: str, department: str, manager_username: str) -> None:
    conn = _connect()
    conn.cursor().execute("""
        INSERT INTO employees (employee_id, name, department, manager_username)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT(employee_id) DO UPDATE SET
            name=excluded.name,
            department=excluded.department,
            manager_username=excluded.manager_username
    """, (employee_id, name, department, manager_username))
    conn.commit()
    conn.close()

def db_assign_mock_managers() -> None:
    """Finds all employee_ids in snapshots that aren't in the employees table, and mocks them."""
    conn = _connect()
    _cur10 = conn.cursor()
    _cur10.execute("SELECT DISTINCT employee_id FROM employee_snapshots WHERE employee_id NOT IN (SELECT employee_id FROM employees)")
    rows = _cur10.fetchall()
    
    # Assign 'manager' user as their manager for demo purposes
    for r in rows:
        eid = r[0]
        _cur10.execute("INSERT INTO employees (employee_id, name, department, manager_username) VALUES (%s, %s, %s, %s)",
                     (eid, f"Employee {eid}", "Engineering", "manager"))
    conn.commit()
    conn.close()

def db_insert_survey(employee_id: str, survey_date: str, survey_type: str, score: int, feedback_text: str = "", sentiment_score: float = None) -> None:
    conn = _connect()
    conn.cursor().execute("""
        INSERT INTO surveys (employee_id, survey_date, survey_type, score, feedback_text, sentiment_score)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (employee_id, survey_date, survey_type, score, feedback_text, sentiment_score))
    conn.commit()
    conn.close()

def db_get_negative_feedback(limit: int = 50) -> list[str]:
    """Fetches recent survey feedback text from passives and detractors (score <= 8)."""
    conn = _connect()
    _cur11 = conn.cursor()
    _cur11.execute("""
        SELECT feedback_text 
        FROM surveys 
        WHERE score <= 8 AND feedback_text IS NOT NULL AND feedback_text != ''
        ORDER BY survey_date DESC 
        LIMIT %s
    """, (limit,))
    rows = _cur11.fetchall()
    conn.close()
    return [r[0] for r in rows if r[0]]

def db_scrub_old_surveys(days: int = 365) -> int:
    """Scrub survey feedback text older than the specified days to comply with data retention policies."""
    conn = _connect()
    # In SQLite, date('now', '-X days') works.
    _cur12 = conn.cursor()
    _cur12.execute(
        "UPDATE surveys SET feedback_text = '[DELETED BY RETENTION POLICY]' "
        "WHERE survey_date < CURRENT_DATE - INTERVAL '%s days' AND feedback_text != '' AND feedback_text != '[DELETED BY RETENTION POLICY]'",
        (days,)
    )
    conn.commit()
    count = _cur12.rowcount
    conn.close()
    return count

def db_calculate_enps(manager_username: str = None) -> dict:
    """Calculates the overall or manager-specific eNPS based on the latest survey scores."""
    conn = _connect()
    
    query = """
        WITH latest_surveys AS (
            SELECT s.employee_id, s.score,
                   ROW_NUMBER() OVER(PARTITION BY s.employee_id ORDER BY s.survey_date DESC) as rn
            FROM surveys s
            JOIN employees e ON s.employee_id = e.employee_id
            WHERE s.survey_type = 'eNPS'
    """
    params = []
    if manager_username:
        query += " AND e.manager_username = %s "
        params.append(manager_username)
        
    query += ") SELECT score FROM latest_surveys WHERE rn = 1"
    
    _cur13 = conn.cursor()
    _cur13.execute(query, params)
    rows = _cur13.fetchall()
    conn.close()
    
    if not rows:
        return {"enps": 0, "promoters": 0, "passives": 0, "detractors": 0, "total": 0}
        
    total = len(rows)
    promoters = sum(1 for r in rows if r[0] >= 9)
    detractors = sum(1 for r in rows if r[0] <= 6)
    passives = total - promoters - detractors
    
    enps = int(((promoters / total) - (detractors / total)) * 100)
    
    return {
        "enps": enps,
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "total": total
    }


# ─────────────────────────────────────────────────────────────────────────────
# Engagement Index (weighted composite of experience metrics)
# ─────────────────────────────────────────────────────────────────────────────

# Weights must sum to 1.0
_ENGAGEMENT_WEIGHTS = {
    "job_satisfaction":   0.25,
    "happiness_score":    0.20,
    "work_life_balance":  0.20,
    "manager_support":    0.15,
    "career_growth":      0.15,
    "team_collaboration": 0.05,
}


def db_calculate_engagement_index(manager_username: str = None) -> dict:
    """
    Calculates the Engagement Index (0-100) from the latest employee snapshots.
    Each metric is on a 1-10 scale; the weighted average is multiplied by 10
    to produce a 0-100 score.
    """
    conn = _connect()

    # Build manager filter
    manager_filter = ""
    params: list = []
    if manager_username:
        manager_filter = "AND s.employee_id IN (SELECT employee_id FROM employees WHERE manager_username = %s)"
        params.append(manager_username)

    query = f"""
        WITH latest AS (
            SELECT employee_id, MAX(snapshot_date) AS max_date
            FROM employee_snapshots
            GROUP BY employee_id
        )
        SELECT
            ROUND(AVG(s.job_satisfaction), 2)   AS avg_job_satisfaction,
            ROUND(AVG(s.happiness_score), 2)    AS avg_happiness_score,
            ROUND(AVG(s.work_life_balance), 2)  AS avg_work_life_balance,
            ROUND(AVG(s.manager_support), 2)    AS avg_manager_support,
            ROUND(AVG(s.career_growth), 2)      AS avg_career_growth,
            ROUND(AVG(s.team_collaboration), 2) AS avg_team_collaboration,
            COUNT(*)                            AS total_employees
        FROM employee_snapshots s
        JOIN latest l ON s.employee_id = l.employee_id AND s.snapshot_date = l.max_date
        WHERE 1=1 {manager_filter}
    """

    _cur14 = conn.cursor()
    _cur14.execute(query, params)
    row = _cur14.fetchone()
    conn.close()

    if not row or row["total_employees"] == 0:
        return {"engagement_index": 0, "breakdown": {}, "total_employees": 0}

    breakdown = {}
    weighted_sum = 0.0
    for metric, weight in _ENGAGEMENT_WEIGHTS.items():
        avg_val = row[f"avg_{metric}"] or 0
        breakdown[metric] = round(avg_val, 2)
        weighted_sum += avg_val * weight

    engagement_index = round(weighted_sum * 10, 1)  # scale 1-10 → 0-100

    return {
        "engagement_index": engagement_index,
        "breakdown": breakdown,
        "total_employees": row["total_employees"],
    }
