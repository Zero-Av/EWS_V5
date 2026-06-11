"""
modules/prediction.py  — EWS v3

The active model is the soft-voting ensemble (VotingClassifier).
predict_proba comes from the ensemble; SHAP comes from the best single
member via explainability.py (no change to this module's interface).

Feature construction now keeps DataFrames throughout to avoid the
LightGBM feature-name UserWarning.
"""

from __future__ import annotations

import os
import json
import joblib
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore", category=UserWarning)

from sentence_transformers import SentenceTransformer
from modules.faiss_store   import EmployeeFAISSStore
from modules.training      import (
    get_active_model_type, get_model_file,
    FeatureBuilder,
)
from modules.explainability import enrich_predictions_with_factors
from config import (
    MODEL_FILE, SCALER_FILE, FEATURE_FILE, NUMERIC_FILE,
    EMBED_META_FILE, RISK_INV,
)

METRIC_COLS = [
    "stress_level", "workload_level", "absenteeism", "work_life_balance",
    "manager_support", "job_satisfaction", "happiness_score",
    "productivity", "team_collaboration", "career_growth",
]


class EmployeePredictor:

    def __init__(self):
        self.model           = None
        self.model_type      = "ensemble"
        self.scaler          = None
        self.feature_columns = None
        self.numeric_columns = None
        self.embedder        = None
        self.faiss_store     = EmployeeFAISSStore()
        self._load_artifacts()

    # ── Artifact loading ──────────────────────────────────────────────────────

    def _load_artifacts(self) -> None:
        active_type = get_active_model_type()
        active_file = get_model_file(active_type)
        model_path  = active_file if os.path.exists(active_file) else MODEL_FILE

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                "No trained model found. Go to 'Model Training' and train first."
            )

        self.model           = joblib.load(model_path)
        self.model_type      = active_type
        self.scaler          = joblib.load(SCALER_FILE)
        self.feature_columns = joblib.load(FEATURE_FILE)
        self.numeric_columns = joblib.load(NUMERIC_FILE)

        with open(EMBED_META_FILE) as f:
            embed_meta = json.load(f)

        self.embedder    = SentenceTransformer(embed_meta["model"])
        self.fb          = FeatureBuilder(self.embedder)
        self.faiss_store.load()

    # ── Schema validation ─────────────────────────────────────────────────────

    def _validate_schema(self, df: pd.DataFrame) -> None:
        required = set(self.numeric_columns) | {"employee_id", "comments"}
        missing  = required - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns in uploaded file: {missing}")

    # ── Feature construction — returns DataFrame (keeps feature names) ─────────

    def _build_features(self, df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray]:
        self._validate_schema(df)
        X, embeddings = self.fb.transform(
            df,
            self.scaler,
            self.numeric_columns,
            self.feature_columns,
        )
        return X, embeddings

    # ── Predict ───────────────────────────────────────────────────────────────

    def predict(
        self,
        df: pd.DataFrame,
        top_k: int = 5,
        explain: bool = True,
    ) -> list[dict]:
        df = df.reset_index(drop=True)
        X, embeddings = self._build_features(df)

        # Ensemble predict — X is a DataFrame, avoids LightGBM feature warnings
        predictions   = self.model.predict(X)
        probabilities = self.model.predict_proba(X)

        results  = []
        raw_rows = []

        for i, (_, row) in enumerate(df.iterrows()):
            pred_label = RISK_INV[int(predictions[i])]
            attrition_prob = round(float(probabilities[i][2]) * 100, 1)
            risk_score = attrition_prob
            similar    = self.faiss_store.search(embeddings[i], top_k=top_k)

            metrics = {}
            for col in METRIC_COLS:
                if col in row.index:
                    v = row[col]
                    metrics[col] = float(v) if pd.notna(v) else None

            raw_rows.append({**metrics, **dict(row)})

            results.append({
                "employee_id":       str(row["employee_id"]),
                "prediction":        pred_label,
                "risk_score":        risk_score,
                "risk_zone":         pred_label,
                "attrition_prob":    attrition_prob,
                "probabilities": {
                    "GREEN": round(float(probabilities[i][0]), 4),
                    "AMBER": round(float(probabilities[i][1]), 4),
                    "RED":   round(float(probabilities[i][2]), 4),
                },
                "similar_employees": similar,
                "comment":           str(row.get("comments", "")),
                "metrics":           metrics,
                "top_factors":       [],
            })

        if explain:
            enrich_predictions_with_factors(
                results,
                feature_matrix  = X.values,     # numpy for SHAP
                feature_columns = list(self.feature_columns),
                raw_rows        = raw_rows,
            )

        return results

    def predict_one(self, employee_dict: dict, top_k: int = 5) -> dict:
        df = pd.DataFrame([employee_dict])
        return self.predict(df, top_k)[0]
