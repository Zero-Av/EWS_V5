# EWS v5 — AI-Powered Employee Retention & Workforce Early Warning System

EWS v5 is a state-of-the-art, enterprise-ready workforce intelligence platform. It analyzes employee survey feedback and eNPS scores using advanced NLP models, aggregates historic data into feature vectors, classifies attrition risk (RED/AMBER/GREEN) using a LightGBM ML model, and exposes explanations (SHAP) and themes to help managers take proactive action.

---

## Technical Stack & Architecture

```
                       ┌────────────────────────┐
                       │   Next.js Frontend     │
                       │   (Outfit / Jakarta)   │
                       └───────────┬────────────┘
                                   │
                                   ▼ [FastAPI REST REST]
                       ┌────────────────────────┐
                       │    FastAPI Backend     │
                       └────┬──────────────┬────┘
                            │              │
        [Database Snapshots]│              │[Transformers Pipeline]
                            ▼              ▼
                     ┌──────────┐    ┌──────────────────────────────────┐
                     │PostgreSQL│    │ - CardiffNLP RoBERTa Sentiment  │
                     │  Store   │    │ - Facebook BART Topic Classifier │
                     └──────────┘    └──────────────────────────────────┘
```

### 1. Frontend Client
- **Framework**: Next.js (App Router, React 18)
- **Styling**: Tailwind CSS + Custom CSS Variables (Premium Light Theme)
- **Visuals**: Recharts (Sentiment line plots, risk distribution bar charts) + Lucide Icons
- **Design Philosophy**: Outfit/Jakarta typography, micro-interactions, responsive side dossiers, and zero page-refresh state mapping.

### 2. Backend Service
- **Framework**: FastAPI (ASGI) + Uvicorn server
- **Database**: PostgreSQL with direct `psycopg2-binary` connection layer
- **Sentiment Model**: `cardiffnlp/twitter-roberta-base-sentiment-latest` (probabilities mapped to a continuous range between -1.0 and +1.0)
- **Topic Detector**: `facebook/bart-large-mnli` (zero-shot classification against 7 workplace topics)
- **Machine Learning**: LightGBM Classifier + SHAP TreeExplainer for per-employee factor attribution
- **Scheduler**: APScheduler background processes for clean retention and daily tasks

---

## Directory Structure

```
EWS_V5/
├── backend/
│   ├── main.py                  # FastAPI routing & application entrypoint
│   ├── config.py                # Global hyperparameters & model configurations
│   ├── requirements.txt         # Core backend python dependencies
│   ├── modules/
│   │   ├── database.py          # PostgreSQL schema initialization & query store
│   │   ├── sentiment.py         # CardiffNLP sentiment analyzer pipeline
│   │   ├── topic_detector.py    # Zero-shot topic classification model
│   │   ├── feature_engine.py    # Historical aggregations, trend/velocity calculations
│   │   ├── classifier.py        # LightGBM classifier training & SHAP explanation
│   │   ├── llm.py               # LLM wrappers for summarizing comments
│   │   └── scheduler.py         # Background daily task scheduler
│   └── tests/
│       ├── conftest.py          # Global pytest fixtures and database/HF mocks
│       ├── test_sentiment.py    # Sentiment engine unit tests
│       ├── test_topic_detector.py # Zero-shot classification tests
│       ├── test_feature_engine.py # Pure mathematical trend & velocity tests
│       ├── test_classifier.py   # LightGBM fit, predict & SHAP tests
│       ├── test_database.py     # SQL query structure and execution mocks
│       └── test_api.py          # FastAPI route integration client tests
├── frontend/
│   ├── app/
│   │   ├── globals.css          # Design tokens & color system
│   │   ├── layout.tsx           # Link headers & providers
│   │   ├── login/               # Authentication screen
│   │   └── dashboard/           # Consolidated master tab dashboard
│   ├── components/
│   │   ├── AppShell.tsx         # User session gatekeeper wrapper
│   │   └── Sidebar.tsx          # Tab switching sidebar
│   ├── lib/
│   │   └── api.ts               # EWS v5 endpoints client bindings
│   └── package.json             # Frontend script triggers
└── docker-compose.yml           # Local production build launcher
```

---

## Quickstart (Docker Compose)

The fastest way to launch the complete EWS environment (PostgreSQL + Backend + Frontend) is using Docker Compose:

1. **Clone the repository and navigate to the directory**:
   ```bash
   cd EWS_V5
   ```

2. **Configure Environment Variables**:
   Copy the `.env.example` file to `.env` and configure your keys (e.g. Anthropic API Keys):
   ```bash
   cp .env.example .env
   ```

3. **Start the containers**:
   ```bash
   docker compose up --build -d
   ```

4. **Access the Applications**:
   - **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
   - **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Local Installation

If you prefer to run the components directly on your system for development:

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL database running locally

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set environment variables (such as `DATABASE_URL` pointing to your local Postgres) and run the Uvicorn server:
   ```bash
   uvicorn main:app --reload
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Boot the Next.js development server:
   ```bash
   npm run dev
   ```

---

## Running the Test Suite

The test suite fully mocks PostgreSQL connections and Hugging Face pipelines, meaning you can execute them quickly and offline.

Run the tests from the `backend/` directory:
```bash
python -m pytest
```
All unit, database parameter mapping, and endpoint client routing integrations will run in under 5 seconds.
