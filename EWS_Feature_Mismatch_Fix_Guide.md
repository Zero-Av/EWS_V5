# EWS Feature Mismatch — Diagnosis & Fix Guide

> **Problem:** The EWS v5/v6.3 model trains on a set of features that do not match the actual concern categories recorded in your company's data. This guide explains exactly what is wrong, where to fix it, and how.

---

## 1. The Mismatch at a Glance

| Layer | What exists NOW (wrong) | What it SHOULD be |
|---|---|---|
| **Topic Labels** (`config.py → TOPIC_LABELS`) | 7 generic NLP labels | 16 company-specific concern categories |
| **Numeric Features** (`config.py → KNOWN_NUMERIC_FEATURES`) | `happiness_score`, `stress_level`, `workload_level`, etc. | None of these — your data uses `Primary Concern`, `Secondary Reason` (categorical) |
| **Categorical Features** (`config.py → KNOWN_CATEGORICAL_FEATURES`) | `department`, `manager_id`, `employment_type`, `tenure_bucket` | `Primary RO`, `Project`, `Designation`, `Location region`, `Current RAG`, `Previous RAG` |
| **Target / Label Column** (`REQUIRED_TRAIN_COLS`) | `risk_label` | `Current RAG` (Green / Amber / Red) |

---

## 2. Your Actual Data Fields (from `Sample_-_EWS.xlsx`)

These are the real columns in your Excel data:

```
Employee ID, Employee Name, Date of joining, Project,
Employee Status, Primary RO, Project Manager,
Total Experience, Tenure (years), Designation, Skill,
Rating 2025-2026, RAG Status by HRBP, HRBP Connect Month,
Previous RAG, Previous Concern, Current RAG,
Primary Concern, Secondary Reason, Ageing,
Location region (NCR/Pune/Chennai/Non Iris), comments
```

### Your 16 Concern Categories (from `list` sheet)

These are the valid values for `Primary Concern` and `Secondary Reason`:

```
1.  Team
2.  RO
3.  Work Content
4.  Work Life Balance
5.  Health & Wellness
6.  Reward and Recognition
7.  Promotion
8.  Iris Culture
9.  Performance
10. Compensation
11. Policies
12. Training
13. Offboarding
14. Career Progression
15. Relocation
16. Others
```

---

## 3. What the Model Currently Uses (and Why It's Wrong)

### 3.1 Wrong Topic Labels — `config.py`

**Current (incorrect):**
```python
TOPIC_LABELS = [
    "manager relationship",
    "career growth",
    "workload pressure",
    "company culture",
    "compensation and benefits",
    "work life balance",
    "team collaboration",
]
```

These are 7 generic NLP topics used for zero-shot classification. They do **not** match your 16 concern categories. This means:
- The `topic_detector.py` module tags comments with labels like `"workload pressure"` that never appear in your actual data.
- The `feature_engine.py` then generates feature columns like `topic_workload_pressure`, `topic_manager_relationship` — none of which correspond to concerns your HRBPs actually track.
- The model learns to predict RAG status using these phantom features.

### 3.2 Wrong Numeric Features — `config.py`

**Current (incorrect):**
```python
KNOWN_NUMERIC_FEATURES = [
    "score",            # eNPS score — not in your data
    "happiness_score",  # not in your data
    "excitement_level", # not in your data
    "stress_level",     # not in your data
    "workload_level",   # not in your data
    "work_life_balance",# not in your data
    "manager_support",  # not in your data
    "job_satisfaction", # not in your data
    "productivity",     # not in your data
    "team_collaboration",# not in your data
    "career_growth",    # not in your data
    "absenteeism",      # not in your data
]
```

None of these columns exist in your Excel. They will all fill as `0` (via the NaN fill in `classifier.py`), making them useless noise.

### 3.3 Wrong Categorical Features — `config.py`

**Current (incorrect):**
```python
KNOWN_CATEGORICAL_FEATURES = [
    "department",       # not in your data
    "manager_id",       # not in your data
    "employment_type",  # not in your data
    "tenure_bucket",    # not in your data
]
```

Your data has `Primary RO`, `Designation`, `Location region`, `Employee Status`, `Project` — none of which are in this list, so they are never fed to the model.

---

## 4. The Fix — What to Change

### 4.1 Fix `config.py` — Core Changes

#### Step 1: Replace `TOPIC_LABELS` with your 16 concern categories

```python
# config.py — REPLACE the TOPIC_LABELS block

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
```

#### Step 2: Replace `KNOWN_NUMERIC_FEATURES` with your actual numeric columns

```python
# config.py — REPLACE the KNOWN_NUMERIC_FEATURES block

KNOWN_NUMERIC_FEATURES = [
    "Total Experience",      # float — years of experience
    "Tenure (years)",        # float — tenure at company
    "Rating 2025-2026",      # numeric rating if available
    "Ageing",                # numeric ageing flag (if encoded)
]
```

#### Step 3: Replace `KNOWN_CATEGORICAL_FEATURES` with your actual categorical columns

```python
# config.py — REPLACE the KNOWN_CATEGORICAL_FEATURES block

KNOWN_CATEGORICAL_FEATURES = [
    "Primary RO",
    "Project",
    "Employee Status",
    "Designation",
    "Skill",
    "Location region (NCR/Pune/Chennai/Non Iris)",
    "Previous RAG",
    "Previous Concern",
    "Primary Concern",
    "Secondary Reason",
    "HRBP Connect Month",
]
```

#### Step 4: Fix the required column names for training data

```python
# config.py — REPLACE the REQUIRED_TRAIN_COLS block

REQUIRED_SURVEY_COLS = {"Employee ID", "comments"}
REQUIRED_TRAIN_COLS  = {"Employee ID", "comments", "Current RAG"}
```

---

### 4.2 Fix `feature_engine.py` — Topic Feature Column Names

The feature engine generates columns named `topic_<label>` with spaces replaced by underscores. With your new `TOPIC_LABELS`, these will auto-generate as:

```
topic_Team
topic_RO
topic_Work_Content
topic_Work_Life_Balance
topic_Health_&_Wellness
topic_Reward_and_Recognition
topic_Promotion
topic_Iris_Culture
topic_Performance
topic_Compensation
topic_Policies
topic_Training
topic_Offboarding
topic_Career_Progression
topic_Relocation
topic_Others
```

No code changes needed in `feature_engine.py` — it uses `topic.replace(" ", "_")` dynamically. The fix in `config.py` is sufficient.

---

### 4.3 Fix `routers/training.py` and Data Ingestion

When your data is loaded from Excel, the column names must be mapped to what the pipeline expects. Add a pre-processing step in your data ingestion router:

```python
# Add this mapping wherever you read the Excel / CSV into a DataFrame

COLUMN_RENAME_MAP = {
    "Employee ID":    "employee_id",
    "Current RAG":    "risk_zone",       # for training label
    "comments":       "comments",         # keep as-is if already named
    "Date of joining":"survey_date",      # use joining date as proxy if no survey date
}

df = df.rename(columns=COLUMN_RENAME_MAP)
```

> **Note:** `risk_zone` values in your data are `Green`, `Amber`, `Red` (mixed case). The `RISK_MAP` in `config.py` expects `GREEN`, `AMBER`, `RED` (upper case). Add this normalisation step:

```python
df["risk_zone"] = df["risk_zone"].str.upper().str.strip()
```

---

### 4.4 Fix `classifier.py` — DROP_COLS

Update the columns that should never be fed to the model:

```python
# classifier.py — REPLACE the DROP_COLS block

DROP_COLS = {
    "employee_id",
    "Employee Name",
    "Employee ID",
    "_has_data",
    "risk_zone",
    "Primary RO",        # if you decide to exclude PII/manager names
    "Project Manager",
}
```

Adjust this list based on what you consider PII vs. useful signal.

---

## 5. Summary of Files to Change

| File | What to Change |
|---|---|
| `backend/config.py` | `TOPIC_LABELS`, `KNOWN_NUMERIC_FEATURES`, `KNOWN_CATEGORICAL_FEATURES`, `REQUIRED_TRAIN_COLS` |
| Data ingestion router | Add column rename map + uppercase normalisation for `risk_zone` |
| `backend/modules/classifier.py` | Update `DROP_COLS` to match your actual column names |
| **No change needed** | `feature_engine.py`, `topic_detector.py`, `sentiment.py` — they are label-agnostic |

---

## 6. After Making the Fixes

1. **Delete old model artifacts** — stale `.pkl` files in `backend/models/` will cause column alignment errors since they were trained on the wrong features:
   ```bash
   rm backend/models/rag_classifier.pkl
   rm backend/models/scaler.pkl
   rm backend/models/feature_columns.pkl
   rm backend/models/metadata.json
   ```

2. **Re-ingest your Excel data** through the training pipeline using the corrected column mappings.

3. **Retrain the model** via the training endpoint — the model will now learn from the 16 actual concern categories and your real categorical features.

4. **Verify feature columns** — after training, check `backend/models/metadata.json` → `feature_columns` field. You should see columns like `topic_Team`, `topic_Compensation`, `Primary_Concern_encoded`, `Previous_RAG_encoded`, etc.

5. **Ensure class balance** — you need at least 1 employee labelled `GREEN`, `AMBER`, and `RED` in your training batch (the model requires all 3 zones). With 20 sample rows in the Excel, verify the distribution before training.

---

## 7. Quick Reference — Feature Column Mapping (Before vs. After)

| Feature Column in Model | Before (wrong) | After (correct) |
|---|---|---|
| Topic features | `topic_manager_relationship`, `topic_workload_pressure`, ... | `topic_Team`, `topic_RO`, `topic_Work_Content`, `topic_Compensation`, ... |
| Numeric features | `happiness_score`, `stress_level`, `workload_level` (all zeros) | `Total Experience`, `Tenure (years)`, `Rating 2025-2026` |
| Categorical features | `department`, `manager_id`, `tenure_bucket` (all unknown) | `Primary RO`, `Designation`, `Location region`, `Previous RAG`, `Primary Concern`, `Secondary Reason` |
| Training label | `risk_label` | `Current RAG` (uppercased → `risk_zone`) |

---

*Document generated from analysis of `EWS_V5-V_6.3` source code and `Sample_-_EWS.xlsx` data.*
