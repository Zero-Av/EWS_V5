# EWS v3 — AI-Powered Employee Retention & Workforce Intelligence Platform

Full-stack upgrade from v2. Adds attrition explainability, intervention tracking, trend analysis, persistent issue detection, an early-warning alert system, automated scheduled snapshots, HRIS integration, MLflow experiment tracking, and a full CI/CD pipeline — all without breaking the existing ML pipeline.

---

## What's New in v3 vs v2

| Feature | v2 | v3 |
|---|---|---|
| Attrition Probability | ❌ (risk score only) | ✅ Separate ML-derived % |
| SHAP Explainability | ❌ | ✅ TreeExplainer, top-N factors |
| Historical Snapshots | ❌ | ✅ PostgreSQL, per-employee per-date |
| Trend Analysis | ❌ | ✅ Monthly charts, metric trajectories |
| Persistent Issue Detection | ❌ | ✅ Longest-standing problems |
| Early Warning Alerts | ❌ | ✅ 7 rule-based triggers |
| Intervention Tracking | ❌ | ✅ Full CRUD + status workflow |
| Before/After Follow-up | ❌ | ✅ Effectiveness scoring |
| Analytics Dashboard | Basic | ✅ KPI cards, 5 chart types |
| Save-to-History from Predict | ❌ | ✅ One-click snapshot |
| Save Recommendation as Intervention | ❌ | ✅ One-click from predict page |
| Automated Nightly Snapshots | ❌ | ✅ APScheduler, opt-in via env |
| HRIS Integration | ❌ | ✅ Mock connector (Workday/BambooHR) |
| MLflow Experiment Tracking | ❌ | ✅ Opt-in Docker profile |
| Model Drift Monitoring | ❌ | ✅ `/analytics/drift` endpoint |
| Survey Ingestion | ❌ | ✅ `/surveys/ingest` + summarize |
| Excel Report Export | ❌ | ✅ `/analytics/report/excel` |
| CI/CD Pipeline | ❌ | ✅ GitHub Actions (pytest + ruff + tsc) |
| SLA Enforcement | ❌ | ✅ Auto-flag overdue interventions |
| RBAC | Basic | ✅ 4 roles: admin, hrbp, manager, exec |

---

## Risk Score vs Attrition Probability — Clarification

These are **two distinct signals** that complement each other:

```
Risk Score (0–100)
  └── Rule-based: weighted sum of RISK_WEIGHTS × metric values
  └── Interpretable, deterministic, always available
  └── Used for: zone classification (GREEN/AMBER/RED), trend tracking

Attrition Probability (0–100%)
  └── ML-based: XGBoost RED-class predict_proba × 100
  └── Accounts for text embeddings + metric interactions
  └── Used for: final risk ranking, follow-up effectiveness comparison
```

The Risk Score is your **operational dashboard metric**. The Attrition Probability is the **model's opinion** after seeing all features including employee comments.

---

## Architecture

```
EWS_v3/
├── backend/
│   ├── main.py                  # FastAPI — all routes (v3 adds 20+ new endpoints)
│   ├── config.py                # All constants
│   ├── requirements.txt         # + shap, apscheduler, mlflow
│   └── modules/
│       ├── prediction.py        # + attrition_prob, top_factors, metrics passthrough
│       ├── explainability.py    # NEW — SHAP TreeExplainer + rule-based fallback
│       ├── database.py          # UPGRADED — PostgreSQL: snapshots, interventions, alerts, audit
│       ├── db_adapter.py        # NEW — Database adapter for smooth psycopg2 integration
│       ├── scheduler.py         # NEW — APScheduler nightly snapshot automation
│       ├── hris.py              # NEW — Mock HRIS connector (Workday/BambooHR)
│       ├── notifications.py     # Alert notification dispatch
│       ├── recommendations.py   # Unchanged
│       ├── training.py          # Unchanged
│       ├── evaluation.py        # Unchanged
│       ├── retraining.py        # Unchanged
│       ├── faiss_store.py       # Unchanged
│       └── llm.py               # Unchanged
│
├── frontend/
│   ├── app/
│   │   ├── dashboard/page.tsx       # Upgraded — KPI strip + alert banner
│   │   ├── analytics/page.tsx       # NEW — Executive KPI dashboard + charts
│   │   ├── trends/page.tsx          # NEW — Employee history + persistent issues
│   │   ├── alerts/page.tsx          # NEW — Early warning alert feed
│   │   ├── interventions/page.tsx   # NEW — Manager action tracking
│   │   ├── predict/page.tsx         # Upgraded — 3-col: risk/SHAP/recommendation
│   │   ├── settings/page.tsx        # Upgraded — LLM + notification config
│   │   ├── train/page.tsx           # Unchanged
│   │   ├── evaluate/page.tsx        # Unchanged
│   │   ├── retrain/page.tsx         # Unchanged
│   │   ├── users/page.tsx           # Unchanged
│   │   └── login/page.tsx           # Unchanged
│   ├── components/
│   │   ├── Sidebar.tsx              # Upgraded — new nav items
│   │   ├── AppShell.tsx             # Unchanged
│   │   ├── FileDropzone.tsx         # Unchanged
│   │   └── RiskBadge.tsx            # Unchanged
│   └── lib/
│       ├── api.ts                   # Upgraded — 15+ new API functions
│       └── auth-context.tsx         # Unchanged
│
├── .github/workflows/ci.yml         # CI: pytest + ruff + TypeScript type-check
├── docker-compose.yml               # Full stack: postgres + backend + frontend + mlflow (opt-in)
├── Dockerfile.backend
├── Dockerfile.frontend
└── .env.example
```

---

## Quick Start

### Option A — Docker Compose (Recommended)

```bash
cp .env.example .env
# Edit .env: set EWS_SECRET_KEY, POSTGRES_PASSWORD, ANTHROPIC_API_KEY
docker compose up --build
```

Open http://localhost:3000 — default credentials: `admin` / `admin123`

To also start MLflow experiment tracking (optional):

```bash
docker compose --profile mlflow up --build
# MLflow UI at http://localhost:5001
```

### Option B — Local Development

**Backend**

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Set EWS_SECRET_KEY, DATABASE_URL, and ANTHROPIC_API_KEY in .env
uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Open http://localhost:3000

---

## Environment Variables

Copy `.env.example` to `.env` and fill in real values. Never commit the `.env` file.

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `EWS_SECRET_KEY` | Yes | JWT signing key — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Yes | Full connection URL, e.g. `postgresql://ews_user:pass@db:5432/ews` |
| `ALLOWED_ORIGINS` | Yes | Comma-separated CORS origins, e.g. `http://localhost:3000` |
| `ANTHROPIC_API_KEY` | Optional | Needed for AI recommendation narrative via Claude |
| `HRIS_API_KEY` | Optional | Webhook security key for `/hris/sync` — leave unset to disable |
| `MLFLOW_TRACKING_URI` | Optional | MLflow server URL, e.g. `http://mlflow:5001` |
| `SNAPSHOT_SCHEDULE_ENABLED` | Optional | Set `true` to enable nightly automated snapshots (default: `false`) |
| `SNAPSHOT_CRON_HOUR` | Optional | Hour to run the nightly snapshot job (default: `2`) |
| `SNAPSHOT_CRON_MINUTE` | Optional | Minute to run the nightly snapshot job (default: `0`) |

---

## Tech Stack

**Backend:** Python 3.11, FastAPI, PostgreSQL 15, XGBoost / LightGBM, SHAP, sentence-transformers, FAISS, LangChain (Anthropic + Ollama), APScheduler, MLflow, slowapi, loguru

**Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS

**Infrastructure:** Docker Compose, GitHub Actions CI

---

## RBAC — Roles

| Role | Access |
|---|---|
| `admin` | Full access: users, models, training, all analytics |
| `hrbp` | Predict, interventions, analytics, alerts — no user/model management |
| `manager` | Predict, view interventions, add notes — read-only analytics |
| `exec` | Analytics and dashboard read-only |

---

## API Endpoints

### Auth
```
POST   /auth/login                              Obtain JWT token
GET    /auth/me                                 Get current user info
```

### Predict & Recommend
```
POST   /predict                                 Run risk + attrition predictions
POST   /recommend                               Generate LLM interventions (async)
GET    /recommend/progress/{job_id}             Poll recommendation job status
```

### Analytics & Snapshots
```
POST   /snapshots                               Save prediction batch as historical snapshot
GET    /analytics/dashboard                     Executive KPI aggregates
GET    /analytics/trends?months=6               Monthly workforce trend data
GET    /analytics/alerts                        Fetch alerts (filter by ack/employee)
PATCH  /analytics/alerts/{id}/acknowledge       Acknowledge an alert
GET    /analytics/drift                         Model drift metrics
GET    /analytics/report/excel                  Download full analytics report as Excel
GET    /surveys/summarize                       Summarise ingested survey responses
```

### Employees
```
GET    /employees/{id}/history?months=12        Individual employee snapshot history
GET    /employees/{id}/issues?threshold=3       Persistent issue detection
PATCH  /employees/{id}                          Update employee metadata
```

### Interventions
```
GET    /interventions                           List all interventions (filterable)
POST   /interventions                           Create new intervention
GET    /interventions/{id}                      Single intervention + action log
PATCH  /interventions/{id}/status               Update status (with audit trail)
POST   /interventions/{id}/note                 Add manager note
POST   /interventions/{id}/followup             Record before/after comparison
GET    /interventions/{id}/followup             Get follow-up result
POST   /interventions/check-slas                Trigger SLA enforcement check
```

### Admin
```
GET    /dashboard                               Admin summary dashboard
POST   /train                                   Train a new model
POST   /evaluate                                Evaluate model on labelled data
POST   /retrain                                 Auto-retrain with Optuna HPO
GET    /retrain/backups                         List model backups
POST   /retrain/rollback                        Roll back to a prior model version
GET    /models/available                        List available model files
GET    /models/metadata                         Current model metadata
GET    /models/versions                         Model version history
POST   /models/switch                           Switch active model
GET    /users                                   List users
POST   /users                                   Create user
DELETE /users/{username}                        Delete user
POST   /employees/import                        Bulk import employees
POST   /surveys/ingest                          Ingest survey CSV
POST   /hris/sync                               Trigger HRIS data sync
```

### LLM & System
```
POST   /llm/connect                             Configure LLM provider
GET    /llm/status                              LLM connection status
GET    /admin/notification-status               Notification system status
GET    /admin/scheduler/status                  Scheduler last-run info
POST   /admin/scheduler/trigger                 Manually trigger a snapshot run
GET    /health                                  Health check
```

---

## Database Schema (PostgreSQL)

```sql
employee_snapshots     -- one row per employee per snapshot date
interventions          -- one per recommendation batch
manager_actions        -- audit log of every status/note change
follow_ups             -- before/after metrics comparison
alerts                 -- triggered automatically on metric changes
audit_log              -- SOC2 compliance audit trails
surveys                -- employee survey data
model_drift_metrics    -- drift tracking data
```

---

## Alert Rules

| Alert Type | Trigger | Severity |
|---|---|---|
| risk_spike | Risk score increases ≥ 15 pts | Critical |
| entered_red | Risk crosses 65 threshold | Critical |
| satisfaction_drop | Job satisfaction drops ≥ 2 | High |
| stress_spike | Stress increases ≥ 2 | High |
| absenteeism_spike | Absenteeism increases ≥ 3 days | High |
| wlb_drop | Work-life balance drops ≥ 2 | Medium |
| manager_support_drop | Manager support drops ≥ 2 | Medium |

---

## Intervention Status Workflow

```
Pending → Approved → In Progress → Completed
                  ↘              ↗
                   Rejected ────
```

Every status change is logged to `manager_actions` with actor + timestamp + optional note.

---

## Effectiveness Scoring

After an intervention is completed, HR uploads "after" metrics:

```
Improvement % = (risk_before - risk_after) / risk_before × 100

Effectiveness:
  ≥ 25% improvement → High
  ≥ 10% improvement → Medium
  ≥  0% improvement → Low
   < 0% improvement → Negative
```

---

## Automated Snapshots (Scheduler)

When `SNAPSHOT_SCHEDULE_ENABLED=true`, the backend will automatically:

1. Query all employees from the latest stored snapshot data
2. Rebuild a DataFrame from that data
3. Run predictions using `EmployeePredictor`
4. Save new snapshots and trigger alert checks

The job runs daily at `SNAPSHOT_CRON_HOUR:SNAPSHOT_CRON_MINUTE` (default: 02:00). Use `GET /admin/scheduler/status` to check the last run result, or `POST /admin/scheduler/trigger` to fire it manually.

---

## HRIS Integration

The `HRISConnector` module in `modules/hris.py` provides a mock integration with Workday/BambooHR. Call `POST /hris/sync` (secured with `HRIS_API_KEY`) to trigger a sync. The mock returns simulated employee create/update/terminate records. Replace the `sync_employees` method body with real API calls when connecting to a live HRIS.

---

## MLflow Experiment Tracking

MLflow is available as an opt-in Docker Compose profile. It tracks training runs, hyperparameter tuning (Optuna), and model evaluations.

```bash
docker compose --profile mlflow up
# MLflow UI: http://localhost:5001
```

Set `MLFLOW_TRACKING_URI=http://mlflow:5001` in `.env` to activate tracking from the backend.

---

## Recommended Workflow

1. **Train** — upload labelled CSV with `risk` column
2. **Predict** — upload new employee data → see Risk Score + Attrition Probability + SHAP factors
3. **Save to History** — click "Save to History" on the Predict page to persist snapshots
4. **Analytics** — view KPI dashboard, trend charts, risk distribution
5. **Trends** — look up individual employees, detect persistent issues (3+ months)
6. **Alerts** — monitor early warning feed, acknowledge resolved alerts
7. **AI Recommendations** — generate LLM interventions for RED/AMBER employees
8. **Save as Intervention** — click to push recommendation into Interventions tracker
9. **Interventions** — managers update status, add notes, record follow-up scores
10. **Repeat monthly** — re-upload data, save snapshots, watch trends improve

---

## CSV Format

```
employee_id, comments, stress_level, workload_level, absenteeism,
work_life_balance, manager_support, job_satisfaction, happiness_score,
productivity, team_collaboration, career_growth [, risk]
```

- All metric columns: scale 1–10
- `risk`: required only for train/evaluate (values: `GREEN`, `AMBER`, `RED`)
- `comments`: free-text manager notes (embedded via sentence-transformers)

---

## CI/CD

GitHub Actions runs on every push and pull request to `main`:

- **Backend tests** — `pytest` against a live PostgreSQL 15 service container
- **Linting** — `ruff` (E, F, W rules; E501/W503 ignored)
- **Frontend type-check** — `tsc --noEmit` on Node.js 20

---

## Production Checklist

- [x] Swap out SQLite for PostgreSQL container
- [x] Configure dynamic `ALLOWED_ORIGINS` CORS environment variables
- [x] Implement robust RBAC (`admin`, `hrbp`, `manager`, `exec`)
- [x] Set up API Rate Limiting (100 req/min) using `slowapi`
- [x] Setup SOC2 Audit Logging and automated PII redaction
- [x] Structured log rotation (20 MB rolling, 14-day retention)
- [x] GitHub Actions CI pipeline (tests + lint + type-check)
- [ ] Deploy behind an Nginx Reverse Proxy with TLS termination
- [ ] Connect HRIS integration (mock implemented) to real API (Workday/BambooHR)
- [ ] Configure real email/Slack notification credentials
- [ ] Set `SNAPSHOT_SCHEDULE_ENABLED=true` and verify nightly run via `/admin/scheduler/status`
