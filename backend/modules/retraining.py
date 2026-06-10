"""
modules/retraining.py
 
Changes vs original:
  - Paths imported from config.py
  - merge_data() now deduplicates on employee_id:
    if the same employee exists in both datasets, the NEW record wins.
    (Original bug: concat() kept duplicates silently, bloating the
     training set and introducing inconsistent labels.)
  - validate_new_data() added before merging
  - get_versions() exposed for the Trends page
"""
 
import os
import json
import shutil
 
import pandas as pd
from datetime import datetime
 
from modules.training import ModelTrainer
from config import (
    MODEL_DIR, MASTER_DATASET, VERSION_FILE,
    BACKUP_DIR, REQUIRED_TRAIN_COLS,
)
 
os.makedirs(BACKUP_DIR, exist_ok=True)
 
 
class IncrementalTrainer:
 
    def __init__(self):
        self.trainer = ModelTrainer()
 
    # ─────────────────────────────────────────────────────────────────
    # Validation
    # ─────────────────────────────────────────────────────────────────
 
    def validate_new_data(self, df: pd.DataFrame) -> None:
        missing = REQUIRED_TRAIN_COLS - set(df.columns)
        if missing:
            raise ValueError(f"New dataset missing required columns: {missing}")
        if len(df) < 5:
            raise ValueError("New dataset must have at least 5 rows.")
 
    # ─────────────────────────────────────────────────────────────────
    # Load existing master dataset
    # ─────────────────────────────────────────────────────────────────
 
    def load_master_dataset(self) -> pd.DataFrame | None:
        if not os.path.exists(MASTER_DATASET):
            return None
        return pd.read_csv(MASTER_DATASET)
 
    # ─────────────────────────────────────────────────────────────────
    # Merge — deduplication fix
    # ─────────────────────────────────────────────────────────────────
 
    def merge_data(
        self,
        historical_df: pd.DataFrame | None,
        new_df: pd.DataFrame,
    ) -> pd.DataFrame:
        """
        Merge historical and new datasets.
 
        DEDUPLICATION (key fix vs original):
          If the same employee_id appears in both datasets,
          the new record takes priority. This prevents:
            - Duplicate rows inflating dataset size
            - Contradictory labels for the same employee
        """
        if historical_df is None:
            return new_df.copy()
 
        # Drop employees from history that appear in the new batch
        if "employee_id" in historical_df.columns and "employee_id" in new_df.columns:
            new_ids = set(new_df["employee_id"].astype(str))
            historical_df = historical_df[
                ~historical_df["employee_id"].astype(str).isin(new_ids)
            ]
 
        merged = pd.concat([historical_df, new_df], ignore_index=True)
        return merged
 
    # ─────────────────────────────────────────────────────────────────
    # Backup
    # ─────────────────────────────────────────────────────────────────
 
    def backup_current_model(self) -> str:
        timestamp   = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(BACKUP_DIR, timestamp)
        os.makedirs(backup_path, exist_ok=True)
 
        files_to_backup = [
            # Ensemble model (v3)
            "ensemble_model.pkl",
            # Individual ensemble members
            "member_rf.pkl",
            "member_lgbm.pkl",
            # SHAP explainer backing model
            "best_single_estimator.pkl",
            "best_single_estimator_meta.json",
            # Preprocessing artifacts
            "scaler.pkl",
            "feature_columns.pkl",
            "numeric_columns.pkl",
            # Metadata
            "metadata.json",
            "embedding_metadata.json",
            "active_model.json",
        ]
 
        for fname in files_to_backup:
            src = os.path.join(MODEL_DIR, fname)
            if os.path.exists(src):
                shutil.copy2(src, os.path.join(backup_path, fname))
 
        return backup_path
 
    # ─────────────────────────────────────────────────────────────────
    # Retrain
    # ─────────────────────────────────────────────────────────────────
 
    def retrain(self, new_df: pd.DataFrame, optuna_trials: int = 20) -> dict:
        self.validate_new_data(new_df)
 
        historical  = self.load_master_dataset()
        merged      = self.merge_data(historical, new_df)
        backup_path = self.backup_current_model()
 
        results = self.trainer.train(merged, optuna_trials)
 
        results["backup_path"]   = backup_path
        results["new_samples"]   = int(len(new_df))
        results["total_samples"] = int(len(merged))
 
        if historical is not None:
            results["historical_samples"] = int(len(historical))
            results["deduped_removed"]    = int(
                len(historical) + len(new_df) - len(merged)
            )
 
        return results
 
    # ─────────────────────────────────────────────────────────────────
    # Version history
    # ─────────────────────────────────────────────────────────────────
 
    def get_versions(self) -> list:
        if not os.path.exists(VERSION_FILE):
            return []
        with open(VERSION_FILE) as f:
            return json.load(f)
 
    # ─────────────────────────────────────────────────────────────────
    # Backup management
    # ─────────────────────────────────────────────────────────────────
 
    def list_backups(self) -> list:
        if not os.path.exists(BACKUP_DIR):
            return []
        return sorted(os.listdir(BACKUP_DIR), reverse=True)
 
    def rollback(self, backup_folder: str) -> bool:
        backup_path = os.path.join(BACKUP_DIR, backup_folder)
        if not os.path.exists(backup_path):
            raise ValueError(f"Backup '{backup_folder}' not found.")
 
        for fname in os.listdir(backup_path):
            shutil.copy2(
                os.path.join(backup_path, fname),
                os.path.join(MODEL_DIR, fname),
            )
        return True