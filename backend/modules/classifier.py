"""
modules/classifier.py — EWS v5

LightGBM-based RAG (Red/Amber/Green) classifier.
Trained on sentiment features + survey data.
Includes SHAP TreeExplainer for per-employee factor decomposition.

Public API:
  RAGClassifier.train(features_df, labels) → metadata dict
  RAGClassifier.predict(features_df)       → list of classification dicts
  RAGClassifier.predict_one(features)      → single classification dict
"""

from __future__ import annotations

import os
import json
import warnings
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Optional

from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from lightgbm import LGBMClassifier

from config import (
    MODEL_DIR, CLASSIFIER_FILE, SCALER_FILE, FEATURE_COLS_FILE,
    MODEL_META_FILE, VERSION_FILE,
    RISK_MAP, RISK_INV, RISK_LABELS,
    RANDOM_STATE, TEST_SIZE,
    KNOWN_CATEGORICAL_FEATURES,
)

warnings.filterwarnings("ignore", category=UserWarning)
os.makedirs(MODEL_DIR, exist_ok=True)


# ── Columns we never feed to the model ───────────────────────────────────────
DROP_COLS = {"employee_id", "_has_data", "risk_label"}


class RAGClassifier:
    """
    Trains and predicts RED/AMBER/GREEN risk zones from aggregated features.
    """

    def __init__(self):
        self.model: Optional[LGBMClassifier] = None
        self.scaler: Optional[StandardScaler] = None
        self.feature_columns: Optional[list[str]] = None
        self.label_encoders: dict[str, LabelEncoder] = {}

    # ── Loading ──────────────────────────────────────────────────────────────

    def load(self) -> bool:
        """Load saved model artifacts. Returns True on success."""
        if not os.path.exists(CLASSIFIER_FILE):
            return False
        self.model = joblib.load(CLASSIFIER_FILE)
        self.scaler = joblib.load(SCALER_FILE)
        self.feature_columns = joblib.load(FEATURE_COLS_FILE)
        return True

    # ── Feature preparation ──────────────────────────────────────────────────

    def _prepare_features(
        self, df: pd.DataFrame, fit: bool = False
    ) -> pd.DataFrame:
        """
        Prepare features for training or prediction:
          - Drop non-feature columns
          - Encode categoricals
          - Scale numerics
          - Handle missing values
        """
        df = df.copy()

        # Drop non-feature columns
        cols_to_drop = [c for c in DROP_COLS if c in df.columns]
        df = df.drop(columns=cols_to_drop, errors="ignore")

        # Encode categorical columns
        for col in KNOWN_CATEGORICAL_FEATURES:
            if col in df.columns:
                df[col] = df[col].fillna("unknown").astype(str)
                if fit:
                    le = LabelEncoder()
                    df[col] = le.fit_transform(df[col])
                    self.label_encoders[col] = le
                elif col in self.label_encoders:
                    le = self.label_encoders[col]
                    # Handle unseen labels gracefully
                    df[col] = df[col].apply(
                        lambda x: le.transform([x])[0] if x in le.classes_ else -1
                    )
                else:
                    df[col] = 0  # no encoder available

        # Fill NaN in numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        df[numeric_cols] = df[numeric_cols].fillna(0)

        # Drop any remaining non-numeric columns
        df = df.select_dtypes(include=[np.number])

        if fit:
            self.feature_columns = list(df.columns)
            self.scaler = StandardScaler()
            scaled = self.scaler.fit_transform(df)
        else:
            # Align columns with training
            for col in self.feature_columns:
                if col not in df.columns:
                    df[col] = 0
            df = df[self.feature_columns]
            scaled = self.scaler.transform(df)

        return pd.DataFrame(scaled, columns=self.feature_columns)

    # ── Training ─────────────────────────────────────────────────────────────

    def train(self, features_df: pd.DataFrame) -> dict:
        """
        Train the RAG classifier.

        Args:
            features_df: DataFrame with one row per employee.
                         Must contain a 'risk_label' column with values
                         'GREEN', 'AMBER', or 'RED'.

        Returns:
            Metadata dict with accuracy, feature importance, etc.
        """
        if "risk_label" not in features_df.columns:
            raise ValueError("features_df must contain 'risk_label' column")

        y = features_df["risk_label"].map(RISK_MAP).values
        X = self._prepare_features(features_df, fit=True)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=TEST_SIZE,
            random_state=RANDOM_STATE,
            stratify=y,
        )

        # Train LightGBM
        self.model = LGBMClassifier(
            n_estimators=300,
            max_depth=8,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=RANDOM_STATE,
            verbose=-1,
            n_jobs=-1,
        )
        self.model.fit(X_train, y_train)

        # Evaluate
        y_pred = self.model.predict(X_test)
        accuracy = float(accuracy_score(y_test, y_pred))
        report = classification_report(y_test, y_pred, target_names=RISK_LABELS, output_dict=True)

        # Feature importance
        importance = dict(zip(
            self.feature_columns,
            self.model.feature_importances_.tolist(),
        ))
        sorted_importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

        # Save artifacts
        joblib.dump(self.model, CLASSIFIER_FILE)
        joblib.dump(self.scaler, SCALER_FILE)
        joblib.dump(self.feature_columns, FEATURE_COLS_FILE)

        metadata = {
            "trained_at": datetime.now().isoformat(),
            "samples": int(len(features_df)),
            "features": len(self.feature_columns),
            "feature_columns": self.feature_columns,
            "accuracy": round(accuracy, 4),
            "classification_report": report,
            "top_features": dict(list(sorted_importance.items())[:15]),
        }

        with open(MODEL_META_FILE, "w") as f:
            json.dump(metadata, f, indent=2)

        # Append to version history
        versions = []
        if os.path.exists(VERSION_FILE):
            with open(VERSION_FILE) as f:
                try:
                    versions = json.load(f)
                except json.JSONDecodeError:
                    versions = []
        versions.append(metadata)
        with open(VERSION_FILE, "w") as f:
            json.dump(versions, f, indent=2)

        return metadata

    # ── Prediction ───────────────────────────────────────────────────────────

    def predict(self, features_df: pd.DataFrame) -> list[dict]:
        """
        Classify employees into RED/AMBER/GREEN.

        Args:
            features_df: DataFrame with one row per employee.
                         Must contain same features as training data.

        Returns:
            List of dicts with zone, probabilities, and top factors.
        """
        if self.model is None:
            if not self.load():
                raise FileNotFoundError("No trained model found. Train first.")

        employee_ids = features_df["employee_id"].tolist() if "employee_id" in features_df.columns else list(range(len(features_df)))
        X = self._prepare_features(features_df, fit=False)

        predictions = self.model.predict(X)
        probabilities = self.model.predict_proba(X)

        # SHAP explanation
        top_factors_list = self._explain(X)

        results = []
        for i in range(len(features_df)):
            zone = RISK_INV[int(predictions[i])]
            probs = {
                "GREEN": round(float(probabilities[i][0]), 4),
                "AMBER": round(float(probabilities[i][1]), 4),
                "RED": round(float(probabilities[i][2]), 4),
            }

            results.append({
                "employee_id": str(employee_ids[i]),
                "risk_zone": zone,
                "risk_score": round(float(probabilities[i][2]) * 100, 1),
                "probabilities": probs,
                "top_factors": top_factors_list[i] if top_factors_list else [],
            })

        return results

    def predict_one(self, features: dict) -> dict:
        """Classify a single employee."""
        df = pd.DataFrame([features])
        return self.predict(df)[0]

    # ── SHAP explanation ─────────────────────────────────────────────────────

    def _explain(self, X: pd.DataFrame, top_n: int = 5) -> list[list[dict]]:
        """
        Use SHAP TreeExplainer to get top-N contributing factors per employee.
        """
        try:
            import shap
            explainer = shap.TreeExplainer(self.model)
            shap_values = explainer.shap_values(X)

            # shap_values is a list of arrays (one per class)
            # We care about class 2 (RED) SHAP values — what drives risk up
            red_shap = shap_values[2] if isinstance(shap_values, list) else shap_values

            results = []
            for i in range(len(X)):
                row_shap = red_shap[i]
                factor_list = []
                for j in range(len(self.feature_columns)):
                    factor_list.append({
                        "feature": self.feature_columns[j],
                        "shap_value": round(float(row_shap[j]), 4),
                        "actual_value": round(float(X.iloc[i, j]), 4),
                    })
                # Sort by absolute SHAP value
                factor_list.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
                results.append(factor_list[:top_n])

            return results
        except Exception as e:
            print(f"[SHAP] Explanation failed: {e}")
            return [[] for _ in range(len(X))]
