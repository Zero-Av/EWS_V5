"""
config.py
Central configuration for EWS v5 — Sentiment-Driven RAG Classification Pipeline.
"""
import os

# ── Directories ───────────────────────────────────────────────────────────────
MODEL_DIR = "models"
DATA_DIR  = "data"
LOG_DIR   = "logs"

# ── Model artefact files ─────────────────────────────────────────────────────
CLASSIFIER_FILE    = os.path.join(MODEL_DIR, "rag_classifier.pkl")
SCALER_FILE        = os.path.join(MODEL_DIR, "scaler.pkl")
FEATURE_COLS_FILE  = os.path.join(MODEL_DIR, "feature_columns.pkl")
MODEL_META_FILE    = os.path.join(MODEL_DIR, "metadata.json")
VERSION_FILE       = os.path.join(MODEL_DIR, "versions.json")

# ── Label mappings ────────────────────────────────────────────────────────────
RISK_MAP    = {"GREEN": 0, "AMBER": 1, "RED": 2}
RISK_INV    = {0: "GREEN", 1: "AMBER", 2: "RED"}
RISK_LABELS = ["GREEN", "AMBER", "RED"]

# ── Sentiment model (HuggingFace) ────────────────────────────────────────────
SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"

# ── Topic detection (zero-shot) ──────────────────────────────────────────────
TOPIC_MODEL = "facebook/bart-large-mnli"
TOPIC_LABELS = [
    "manager relationship",
    "career growth",
    "workload pressure",
    "company culture",
    "compensation and benefits",
    "work life balance",
    "team collaboration",
]

# ── Required CSV columns ─────────────────────────────────────────────────────
REQUIRED_SURVEY_COLS = {"employee_id", "survey_date", "comments"}
REQUIRED_TRAIN_COLS  = {"employee_id", "comments", "risk_label"}

# ── Known numeric + categorical feature columns from surveys ─────────────────
# These are the columns beyond the required ones that we expect in survey CSVs.
# The system dynamically discovers columns, but these are the "known" features.
KNOWN_NUMERIC_FEATURES = [
    "score",               # eNPS score (0-10)
    "happiness_score",
    "excitement_level",
    "stress_level",
    "workload_level",
    "work_life_balance",
    "manager_support",
    "job_satisfaction",
    "productivity",
    "team_collaboration",
    "career_growth",
    "absenteeism",
]

KNOWN_CATEGORICAL_FEATURES = [
    "department",
    "manager_id",
    "employment_type",
    "tenure_bucket",
]

# ── Training hyperparameters ─────────────────────────────────────────────────
RANDOM_STATE = 42
TEST_SIZE    = 0.2

# ── LLM ──────────────────────────────────────────────────────────────────────
OLLAMA_MODEL    = "qwen2.5:3b"
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
LLM_TEMPERATURE = 0.2

# ── Sentiment aggregation defaults ───────────────────────────────────────────
SENTIMENT_WINDOW_MONTHS = 6    # rolling window for avg sentiment
VELOCITY_LOOKBACK       = 2    # number of most recent surveys for velocity calc
