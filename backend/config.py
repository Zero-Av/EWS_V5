"""
config.py
Central configuration — all constants live here.
Import from this file instead of repeating strings across modules.
"""
import os

# ── Directories ───────────────────────────────────────────────────────────────
MODEL_DIR      = "models"
DATA_DIR       = "data"
VECTOR_DIR     = "vector_store"
BACKUP_DIR     = os.path.join(MODEL_DIR, "backups")

# ── Model files ───────────────────────────────────────────────────────────────
# Default/active model path (ensemble)
MODEL_FILE      = os.path.join(MODEL_DIR, "ensemble_model.pkl")
SCALER_FILE     = os.path.join(MODEL_DIR, "scaler.pkl")
FEATURE_FILE    = os.path.join(MODEL_DIR, "feature_columns.pkl")
NUMERIC_FILE    = os.path.join(MODEL_DIR, "numeric_columns.pkl")
MODEL_META_FILE = os.path.join(MODEL_DIR, "metadata.json")
EMBED_META_FILE = os.path.join(MODEL_DIR, "embedding_metadata.json")
VERSION_FILE    = os.path.join(MODEL_DIR, "versions.json")
MASTER_DATASET  = os.path.join(DATA_DIR,  "master_training_dataset.csv")

# ── FAISS files ───────────────────────────────────────────────────────────────
INDEX_FILE     = os.path.join(VECTOR_DIR, "employee_index.faiss")
ID_FILE        = os.path.join(VECTOR_DIR, "employee_ids.pkl")
META_FILE      = os.path.join(VECTOR_DIR, "employee_metadata.pkl")

# ── Label mappings ────────────────────────────────────────────────────────────
RISK_MAP    = {"GREEN": 0, "AMBER": 1, "RED": 2}
RISK_INV    = {0: "GREEN", 1: "AMBER", 2: "RED"}
RISK_LABELS = ["GREEN", "AMBER", "RED"]

# ── Required CSV columns ──────────────────────────────────────────────────────
REQUIRED_TRAIN_COLS   = {"employee_id", "comments", "risk"}
REQUIRED_PREDICT_COLS = {"employee_id", "comments"}

# ── Embedding model ───────────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIM   = 384



# ── Training hyperparameters ──────────────────────────────────────────────────
RANDOM_STATE = 42
CV_FOLDS     = 5      # cross-validation folds used inside Optuna
TEST_SIZE    = 0.2    # final hold-out split (never seen during Optuna)


# ── Ensemble model constants ──────────────────────────────────────────────────
# The active model is always the soft-voting ensemble of these four.
# BEST_ESTIMATOR_FILE stores whichever single member scored highest on the
# hold-out set — it is the model used by SHAP TreeExplainer.
ENSEMBLE_MEMBERS = ["random_forest", "lightgbm"]

ENSEMBLE_MEMBER_FILES = {
    "random_forest": os.path.join(MODEL_DIR, "member_rf.pkl"),
    "lightgbm":      os.path.join(MODEL_DIR, "member_lgbm.pkl"),
}
BEST_ESTIMATOR_FILE = os.path.join(MODEL_DIR, "best_single_estimator.pkl")
BEST_ESTIMATOR_META = os.path.join(MODEL_DIR, "best_single_estimator_meta.json")
ACTIVE_MODEL_FILE   = os.path.join(MODEL_DIR, "active_model.json")

# Legacy multi-model dict — kept so any existing import doesn't crash.
# The active model is now always the ensemble; this is only used by
# the /models/available endpoint for display purposes.
SUPPORTED_MODELS = ["ensemble"] + ENSEMBLE_MEMBERS
MODEL_FILES = {
    "ensemble":      MODEL_FILE,
    **ENSEMBLE_MEMBER_FILES,
}
MODEL_LABELS_CFG = {
    "ensemble":      "Voting Ensemble (LightGBM + RF)",
    "random_forest": "Random Forest",
    "lightgbm":      "LightGBM",
}

# ── LLM ───────────────────────────────────────────────────────────────────────
OLLAMA_MODEL    = "qwen2.5:3b"
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
LLM_TEMPERATURE = 0.2

# ── Zone colours (used by frontend API responses) ─────────────────────────────
ZONE_COLORS = {
    "GREEN": "#4ade80",
    "AMBER": "#fbbf24",
    "RED":   "#f87171",
}
# PLOTLY_BG / PLOTLY_PAPER / PLOTLY_GRID / PLOTLY_TEXT removed — frontend is
# Next.js; Python Plotly constants have no consumers in the active codebase.
PLOTLY_BG     = "#070d1a"
PLOTLY_PAPER  = "#0d1526"
PLOTLY_GRID   = "#1e2d45"
PLOTLY_TEXT   = "#cbd5e1"
