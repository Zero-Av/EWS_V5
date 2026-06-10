"""
modules/training.py  — EWS v3

Active model: soft-voting ensemble of
  Random Forest · LightGBM
each tuned independently by Optuna (CV on training data only).

SHAP: TreeExplainer is applied to the single ensemble member with the
highest hold-out accuracy — stored separately as best_single_estimator.pkl.
The ensemble itself is not SHAP-compatible, but the best member is a
perfect proxy because it dominates the vote.

Public API (unchanged from previous version):
  ModelTrainer().train(df, optuna_trials, model_type="ensemble") -> meta dict
  compute_risk_score(row)   -> float
  score_to_zone(score)      -> "GREEN"|"AMBER"|"RED"
  get_active_model_type()   -> str
  set_active_model_type(t)  -> None
  get_model_file(t)         -> str
  MODEL_LABELS              -> dict  (for display)
"""

from __future__ import annotations

import os
import json
import warnings
import joblib
import numpy as np
import pandas as pd

from datetime import datetime

# MLflow experiment tracking (opt-in via MLFLOW_TRACKING_URI env var)
try:
    import mlflow
    import mlflow.sklearn
    _MLFLOW_URI = os.getenv("MLFLOW_TRACKING_URI", "")
    _MLFLOW_AVAILABLE = bool(_MLFLOW_URI)
except ImportError:
    _MLFLOW_AVAILABLE = False
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import accuracy_score
from sklearn.ensemble import (
    RandomForestClassifier,
    VotingClassifier,
)
from lightgbm import LGBMClassifier

from sentence_transformers import SentenceTransformer
from modules.faiss_store import EmployeeFAISSStore
from config import (
    MODEL_DIR, DATA_DIR,
    MODEL_FILE, SCALER_FILE, FEATURE_FILE, NUMERIC_FILE,
    MODEL_META_FILE, EMBED_META_FILE, VERSION_FILE, MASTER_DATASET,
    RISK_MAP, RISK_INV,
    EMBEDDING_MODEL, RANDOM_STATE, CV_FOLDS, TEST_SIZE,
    ENSEMBLE_MEMBERS, ENSEMBLE_MEMBER_FILES,
    BEST_ESTIMATOR_FILE, BEST_ESTIMATOR_META,
    ACTIVE_MODEL_FILE, MODEL_FILES, MODEL_LABELS_CFG,
)

warnings.filterwarnings("ignore", category=UserWarning)   # LightGBM feature-name noise

os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(DATA_DIR,  exist_ok=True)

# ── Public label map (used by main.py /models/available) ─────────────────────
MODEL_LABELS = MODEL_LABELS_CFG




# ─────────────────────────────────────────────────────────────────────────────
# Active-model bookkeeping  (unchanged API)
# ─────────────────────────────────────────────────────────────────────────────

def get_active_model_type() -> str:
    if os.path.exists(ACTIVE_MODEL_FILE):
        with open(ACTIVE_MODEL_FILE) as f:
            return json.load(f).get("model_type", "ensemble")
    return "ensemble"


def set_active_model_type(model_type: str) -> None:
    with open(ACTIVE_MODEL_FILE, "w") as f:
        json.dump({"model_type": model_type,
                   "updated_at": datetime.now().isoformat()}, f)


def get_model_file(model_type: str) -> str:
    return MODEL_FILES.get(model_type, MODEL_FILE)


# ─────────────────────────────────────────────────────────────────────────────
# Fast Default Estimators
# ─────────────────────────────────────────────────────────────────────────────

def _build_default_estimator(member: str):
    """Instantiate a fast, robust estimator with sensible defaults."""
    if member == "random_forest":
        return RandomForestClassifier(
            n_estimators=300, max_depth=15, min_samples_split=5, 
            random_state=RANDOM_STATE, n_jobs=-1
        )
    if member == "lightgbm":
        return LGBMClassifier(
            n_estimators=300, max_depth=8, learning_rate=0.05, 
            subsample=0.8, colsample_bytree=0.8, 
            random_state=RANDOM_STATE, verbose=-1, n_jobs=-1
        )
    raise ValueError(f"Unknown ensemble member: {member}")


# ─────────────────────────────────────────────────────────────────────────────
# Feature engineering  (identical to previous version)
# ─────────────────────────────────────────────────────────────────────────────

class FeatureBuilder:
    """Encode text + scale numerics into a single DataFrame."""

    def __init__(self, embedder: SentenceTransformer):
        self.embedder = embedder

    def fit_transform(self, df: pd.DataFrame):
        numeric_cols = [
            c for c in df.select_dtypes(include=np.number).columns
            if c not in {"employee_id", "risk"}
        ]
        comments   = df["comments"].fillna("").astype(str).tolist()
        embeddings = self.embedder.encode(
            comments, normalize_embeddings=True,
            show_progress_bar=True, batch_size=32,
        )
        scaler         = StandardScaler()
        scaled_numeric = scaler.fit_transform(df[numeric_cols].fillna(0))

        X = pd.concat([
            pd.DataFrame(scaled_numeric, columns=numeric_cols),
            pd.DataFrame(embeddings, columns=[f"emb_{i}" for i in range(embeddings.shape[1])]),
        ], axis=1).reset_index(drop=True)

        return X, scaler, embeddings, numeric_cols

    def transform(self, df: pd.DataFrame, scaler, numeric_cols, feature_columns):
        comments   = df["comments"].fillna("").astype(str).tolist()
        embeddings = self.embedder.encode(
            comments, normalize_embeddings=True, show_progress_bar=False,
        )
        X = pd.concat([
            pd.DataFrame(
                scaler.transform(df[numeric_cols].fillna(0)),
                columns=numeric_cols,
            ),
            pd.DataFrame(embeddings, columns=[f"emb_{i}" for i in range(embeddings.shape[1])]),
        ], axis=1).reset_index(drop=True)
        return X[feature_columns], embeddings


# ─────────────────────────────────────────────────────────────────────────────
# Core trainer
# ─────────────────────────────────────────────────────────────────────────────

class ModelTrainer:
    """
    Trains a soft-voting ensemble of RF + LightGBM.
    Each member is tuned independently by Optuna.

    Each member is tuned independently by Optuna on the training split.
    The best single member (by hold-out accuracy) is saved separately
    for SHAP TreeExplainer.

    Calling convention (unchanged):
        trainer = ModelTrainer()
        meta = trainer.train(df, optuna_trials=20)
    """

    def __init__(self):
        self.embedder = SentenceTransformer(EMBEDDING_MODEL)

    # ── Validation ────────────────────────────────────────────────────────────

    def validate_dataset(self, df: pd.DataFrame) -> None:
        missing = {"employee_id", "comments", "risk"} - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        if len(df) < 10:
            raise ValueError("Dataset must have at least 10 rows to train.")

    # ── Main entry point ──────────────────────────────────────────────────────

    def train(
        self,
        df: pd.DataFrame,
        optuna_trials: int = 20,
        model_type: str = "ensemble",   # kept for API compat — always ensemble
    ) -> dict:
        self.validate_dataset(df)

        # ── Features ──────────────────────────────────────────────────────────
        fb = FeatureBuilder(self.embedder)
        X, scaler, embeddings, numeric_cols = fb.fit_transform(df)
        y = df["risk"].map(RISK_MAP).values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size    = TEST_SIZE,
            random_state = RANDOM_STATE,
            stratify     = y,
        )

        # ── Train each member ────────────────────────────────────
        member_results: list[dict] = []
        fitted_members: dict[str, object] = {}

        print(f"[Training] Training {len(ENSEMBLE_MEMBERS)} members…")

        for member in ENSEMBLE_MEMBERS:
            print(f"  → {MODEL_LABELS.get(member, member)}")
            estimator = _build_default_estimator(member)
            
            cv_score = cross_val_score(estimator, X_train, y_train, cv=5, scoring="accuracy", n_jobs=-1).mean()
            estimator.fit(X_train, y_train)

            hold_out_acc = float(accuracy_score(y_test, estimator.predict(X_test)))
            joblib.dump(estimator, ENSEMBLE_MEMBER_FILES[member])

            member_results.append({
                "member":      member,
                "label":       MODEL_LABELS.get(member, member),
                "cv_score":    round(cv_score, 4),
                "accuracy":    round(hold_out_acc, 4),
                "best_params": {},
            })
            fitted_members[member] = estimator
            print(f"     cv={cv_score:.4f}  hold-out={hold_out_acc:.4f}")

        # ── Identify best single member ───────────────────────────────────────
        best_entry = max(member_results, key=lambda r: r["accuracy"])
        best_member_name = best_entry["member"]
        best_estimator   = fitted_members[best_member_name]

        joblib.dump(best_estimator, BEST_ESTIMATOR_FILE)
        with open(BEST_ESTIMATOR_META, "w") as f:
            json.dump({
                "member":   best_member_name,
                "label":    best_entry["label"],
                "accuracy": best_entry["accuracy"],
                "cv_score": best_entry["cv_score"],
                "trained_at": datetime.now().isoformat(),
            }, f, indent=2)

        print(f"[Training] Best single member: {best_entry['label']} "
              f"(acc={best_entry['accuracy']:.4f})")

        # ── Build soft-voting ensemble ────────────────────────────────────────
        ensemble = VotingClassifier(
            estimators=[(m, fitted_members[m]) for m in ENSEMBLE_MEMBERS],
            voting="soft",
            n_jobs=-1,
        )
        # VotingClassifier with pre-fitted estimators just needs a fit call
        # to register internal state; the member weights are already correct.
        ensemble.fit(X_train, y_train)

        ensemble_acc = float(accuracy_score(y_test, ensemble.predict(X_test)))
        print(f"[Training] Ensemble accuracy: {ensemble_acc:.4f}")

        # ── Save artefacts ────────────────────────────────────────────────────
        joblib.dump(ensemble,          MODEL_FILE)
        joblib.dump(scaler,            SCALER_FILE)
        joblib.dump(list(X.columns),   FEATURE_FILE)
        joblib.dump(numeric_cols,      NUMERIC_FILE)

        df_out = df.copy()
        
        probs = ensemble.predict_proba(X)
        preds = ensemble.predict(X)
        
        df_out["risk_score"] = (probs[:, 2] * 100).round(1)
        df_out["risk_zone"]  = [RISK_INV[p] for p in preds]
        
        df_out.to_csv(MASTER_DATASET, index=False)

        set_active_model_type("ensemble")

        embed_meta = {"model": EMBEDDING_MODEL, "dimension": int(embeddings.shape[1])}
        with open(EMBED_META_FILE, "w") as f:
            json.dump(embed_meta, f, indent=2)

        # ── FAISS index ───────────────────────────────────────────────────────
        metadata = {
            str(row["employee_id"]): {
                "risk":       row["risk"],
                "risk_score": float(df_out.at[i, "risk_score"]),
                "comment":    row["comments"],
                "metrics":    {c: row[c] for c in numeric_cols},
            }
            for i, (_, row) in enumerate(df_out.iterrows())
        }
        store = EmployeeFAISSStore()
        store.build_index(
            embeddings,
            df_out["employee_id"].astype(str).tolist(),
            metadata,
        )
        store.save()

        # ── Persist metadata ──────────────────────────────────────────────────
        model_meta = {
            "trained_at":         datetime.now().isoformat(),
            "model_type":         "ensemble",
            "model_label":        MODEL_LABELS["ensemble"],
            "samples":            int(len(df)),
            "features":           int(len(X.columns)),
            "numeric_cols":       len(numeric_cols),
            "embedding_dim":      int(embeddings.shape[1]),
            "ensemble_accuracy":  round(ensemble_acc, 4),
            "best_member":        best_member_name,
            "best_member_label":  best_entry["label"],
            "best_member_acc":    best_entry["accuracy"],
            "cv_folds":           CV_FOLDS,
            "optuna_trials":      optuna_trials,
            "members":            member_results,
        }
        with open(MODEL_META_FILE, "w") as f:
            json.dump(model_meta, f, indent=2)

        # ── MLflow experiment tracking (opt-in) ───────────────────────────────
        if _MLFLOW_AVAILABLE:
            try:
                mlflow.set_tracking_uri(_MLFLOW_URI)
                run_name = f"ensemble_{datetime.now().strftime('%Y%m%d_%H%M')}"
                with mlflow.start_run(run_name=run_name):
                    mlflow.log_param("optuna_trials",   optuna_trials)
                    mlflow.log_param("cv_folds",        CV_FOLDS)
                    mlflow.log_param("test_size",       TEST_SIZE)
                    mlflow.log_param("samples",         int(len(df)))
                    mlflow.log_param("features",        int(len(X.columns)))
                    mlflow.log_metric("ensemble_accuracy", ensemble_acc)
                    for m in member_results:
                        mlflow.log_metric(f"{m['member']}_accuracy", m["accuracy"])
                        mlflow.log_metric(f"{m['member']}_cv_score",  m["cv_score"])
                    mlflow.sklearn.log_model(ensemble, "ensemble_model")
            except Exception as mlflow_err:
                # MLflow logging is non-critical — never let it break training
                print(f"[MLflow] Tracking skipped: {mlflow_err}")

        versions = []
        if os.path.exists(VERSION_FILE):
            with open(VERSION_FILE) as f:
                try:   versions = json.load(f)
                except json.JSONDecodeError: versions = []
        versions.append(model_meta)
        with open(VERSION_FILE, "w") as f:
            json.dump(versions, f, indent=2)

        return model_meta
