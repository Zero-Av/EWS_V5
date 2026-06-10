"""
modules/data_validation.py — EWS v3

Data quality validation for incoming employee datasets.
Runs before prediction / training to catch malformed data early.

Validates:
  - Required columns exist
  - Data types are correct
  - Value ranges are reasonable (e.g., 0–10 scales)
  - No duplicate employee_ids within a batch
  - Null percentage per column
  - Returns warnings (non-blocking) and errors (blocking)
"""

from __future__ import annotations
import pandas as pd
from dataclasses import dataclass, field

# ── Expected column schemas ──────────────────────────────────────────────────

# Columns that MUST exist for prediction
REQUIRED_PREDICT_COLS = {"employee_id"}

# Columns with expected 0–10 numeric range
SCALE_0_10_COLS = {
    "stress_level", "workload_level", "work_life_balance",
    "manager_support", "job_satisfaction", "happiness_score",
    "productivity", "team_collaboration", "career_growth",
}

# Columns with expected 0+ integer range
COUNT_COLS = {
    "absenteeism",
}

# All numeric columns we track
ALL_METRIC_COLS = SCALE_0_10_COLS | COUNT_COLS

# Columns required for TRAINING (prediction + risk label)
REQUIRED_TRAIN_COLS = REQUIRED_PREDICT_COLS | {"risk"}

# Valid risk labels
VALID_RISK_LABELS = {"GREEN", "AMBER", "RED", "green", "amber", "red"}


@dataclass
class ValidationResult:
    """Holds validation errors (blocking) and warnings (non-blocking)."""
    errors:   list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats:    dict = field(default_factory=dict)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def to_dict(self) -> dict:
        return {
            "valid":    self.is_valid,
            "errors":   self.errors,
            "warnings": self.warnings,
            "stats":    self.stats,
        }


def validate_prediction_data(df: pd.DataFrame) -> ValidationResult:
    """
    Validate a DataFrame for the prediction pipeline.
    Returns a ValidationResult with errors and warnings.
    """
    result = ValidationResult()

    if df is None or len(df) == 0:
        result.errors.append("Dataset is empty.")
        return result

    result.stats["total_rows"] = len(df)
    result.stats["total_columns"] = len(df.columns)

    # ── Required columns ─────────────────────────────────────────────────
    missing = REQUIRED_PREDICT_COLS - set(df.columns)
    if missing:
        result.errors.append(f"Missing required columns: {sorted(missing)}")

    # ── Duplicate employee_ids ────────────────────────────────────────────
    if "employee_id" in df.columns:
        dup_count = df["employee_id"].duplicated().sum()
        if dup_count > 0:
            dup_ids = df.loc[df["employee_id"].duplicated(keep=False), "employee_id"].unique()
            result.warnings.append(
                f"{dup_count} duplicate employee_id(s) found: "
                f"{list(dup_ids[:5])}{'...' if len(dup_ids) > 5 else ''}"
            )
            result.stats["duplicate_ids"] = int(dup_count)

    # ── Null check per metric column ─────────────────────────────────────
    present_metrics = ALL_METRIC_COLS & set(df.columns)
    null_report = {}
    for col in sorted(present_metrics):
        null_pct = df[col].isnull().mean() * 100
        if null_pct > 0:
            null_report[col] = round(null_pct, 1)
            if null_pct > 50:
                result.warnings.append(
                    f"Column '{col}' has {null_pct:.1f}% null values — "
                    f"predictions may be unreliable"
                )
    if null_report:
        result.stats["null_percentages"] = null_report

    # ── Value range checks (0–10 scale columns) ─────────────────────────
    for col in sorted(SCALE_0_10_COLS & set(df.columns)):
        series = df[col].dropna()
        if len(series) == 0:
            continue
        out_of_range = ((series < 0) | (series > 10)).sum()
        if out_of_range > 0:
            result.warnings.append(
                f"Column '{col}': {out_of_range} values outside expected 0–10 range "
                f"(min={series.min():.1f}, max={series.max():.1f})"
            )

    # ── Absenteeism range check (should be >= 0) ─────────────────────────
    if "absenteeism" in df.columns:
        neg = (df["absenteeism"].dropna() < 0).sum()
        if neg > 0:
            result.warnings.append(
                f"Column 'absenteeism': {neg} negative values found"
            )

    # ── Data type warnings ───────────────────────────────────────────────
    for col in sorted(present_metrics):
        if not pd.api.types.is_numeric_dtype(df[col]):
            result.errors.append(
                f"Column '{col}' has non-numeric dtype '{df[col].dtype}' "
                f"— expected numeric"
            )

    # ── Coverage stats ───────────────────────────────────────────────────
    result.stats["metric_columns_found"] = len(present_metrics)
    result.stats["metric_columns_expected"] = len(ALL_METRIC_COLS)
    missing_metrics = ALL_METRIC_COLS - set(df.columns)
    if missing_metrics:
        result.stats["missing_metric_columns"] = sorted(missing_metrics)
        if len(missing_metrics) > len(ALL_METRIC_COLS) // 2:
            result.warnings.append(
                f"Only {len(present_metrics)}/{len(ALL_METRIC_COLS)} expected "
                f"metric columns found — predictions will rely on available data"
            )

    return result


def validate_training_data(df: pd.DataFrame) -> ValidationResult:
    """
    Validate a DataFrame for the training pipeline.
    Includes all prediction checks plus training-specific checks.
    """
    result = validate_prediction_data(df)

    if df is None or len(df) == 0:
        return result

    # ── Required training columns ────────────────────────────────────────
    missing = REQUIRED_TRAIN_COLS - set(df.columns)
    if missing:
        result.errors.append(f"Training requires columns: {sorted(missing)}")

    # ── Risk label validation ────────────────────────────────────────────
    if "risk" in df.columns:
        invalid_labels = set(df["risk"].dropna().unique()) - VALID_RISK_LABELS
        if invalid_labels:
            result.errors.append(
                f"Invalid risk labels found: {sorted(invalid_labels)}. "
                f"Expected: GREEN, AMBER, RED"
            )

        # Class distribution
        dist = df["risk"].value_counts().to_dict()
        result.stats["risk_distribution"] = dist

        # Warn if severely imbalanced
        if dist:
            max_cls = max(dist.values())
            min_cls = min(dist.values())
            if max_cls > 10 * min_cls:
                result.warnings.append(
                    f"Severe class imbalance: {dist}. "
                    f"Consider oversampling or collecting more data."
                )

    # ── Minimum sample size ──────────────────────────────────────────────
    if len(df) < 30:
        result.warnings.append(
            f"Only {len(df)} samples — recommend at least 30 for "
            f"reasonable model performance"
        )

    return result
"""
Description: New data validation pipeline module that validates incoming CSVs
before prediction/training — checking for required columns, data types,
value ranges, duplicates, null percentages, and class balance.
"""
