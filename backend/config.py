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
RISK_ZONES = ["GREEN", "AMBER", "RED"]

# ── Sentiment model (HuggingFace) ────────────────────────────────────────────
SENTIMENT_MODEL = "cardiffnlp/twitter-roberta-base-sentiment-latest"

# ── Topic detection (zero-shot) ──────────────────────────────────────────────
# These are the 16 company-specific concern categories from the EWS data.
# The zero-shot classifier will tag comments against these labels.
TOPIC_MODEL = "facebook/bart-large-mnli"
TOPIC_LABELS = [
    "Team",
    "RO",
    "Work Content",
    "Work Life Balance",
    "Health & Wellness",
    "Reward and Recognition",
    "Promotion",
    "Iris Culture",
    "Performance",
    "Compensation",
    "Policies",
    "Training",
    "Offboarding",
    "Career Progression",
    "Relocation",
    "Others",
]

# ── Column mapping from Excel (Sample_-_EWS.xlsx) to internal names ──────────
# Applied at ingestion time to normalise the raw Excel column headers
# into clean snake_case for consistent use throughout the pipeline and DB.
COLUMN_RENAME_MAP = {
    "Employee ID":      "employee_id",
    "Employee Name":    "employee_name",
    "Date of joining":  "survey_date",      # proxy for survey date
    "Project":          "department",        # used as team/department grouping
    "Employee Status":  "employee_status",
    "Primary RO":       "manager_id",        # used for manager-scoped views
    "Project Manager":  "project_manager",
    "Total Experience": "total_experience",
    "Tenure (years)":   "tenure_years",
    "Designation":      "designation",
    "Skill":            "skill",
    "Rating 2025-2026": "rating",
    "RAG Status by HRBP": "rag_status_by_hrbp",
    "HRBP Connect Month": "hrbp_connect_month",
    "Previous RAG":     "previous_rag",
    "Previous Concern": "previous_concern",
    "Current RAG":      "risk_zone",         # training label (GREEN / AMBER / RED)
    "Primary Concern":  "primary_concern",
    "Secondary Reason": "secondary_reason",
    "Ageing":           "ageing",
    "Location region (NCR/Pune/Chennai/Non Iris)": "location_region",
    "comments":         "comments",          # keep as-is
}

# ── Required columns (after renaming) ────────────────────────────────────────
REQUIRED_SURVEY_COLS = {"employee_id", "comments"}
REQUIRED_TRAIN_COLS  = {"employee_id", "comments", "risk_zone"}

# ── Known numeric + categorical feature columns from the EWS Excel data ─────
# Names here are the INTERNAL (post-rename) snake_case names.
# The system dynamically discovers columns, but these are the "known" features.
KNOWN_NUMERIC_FEATURES = [
    "total_experience",       # float — years of total experience
    "tenure_years",           # float — tenure at company
    "rating",                 # numeric rating (if available)
    "ageing",                 # numeric ageing value
]

KNOWN_CATEGORICAL_FEATURES = [
    "department",             # mapped from "Project"
    "manager_id",             # mapped from "Primary RO"
    "employee_status",
    "designation",
    "skill",
    "location_region",
    "previous_rag",
    "previous_concern",
    "primary_concern",
    "secondary_reason",
    "hrbp_connect_month",
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
