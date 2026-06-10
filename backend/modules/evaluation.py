"""
modules/evaluation.py
 
Improvements vs original:
  - Added Plotly chart builders (confusion matrix heatmap,
    classification report bar chart, probability distribution)
  - Added per-employee prediction dataframe helper
  - Added risk score to evaluation results
"""
 
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
 
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, confusion_matrix, classification_report,
)
 
from modules.prediction import EmployeePredictor
from config import RISK_MAP, RISK_LABELS, ZONE_COLORS, PLOTLY_BG, PLOTLY_PAPER, PLOTLY_GRID, PLOTLY_TEXT
 
 
def _base_layout(**kw):
    return dict(
        paper_bgcolor=PLOTLY_PAPER,
        plot_bgcolor=PLOTLY_BG,
        font=dict(color=PLOTLY_TEXT, size=11),
        margin=dict(l=40, r=20, t=50, b=40),
        **kw,
    )
 
 
class ModelEvaluator:
 
    def __init__(self):
        self.predictor = EmployeePredictor()
 
    # ─────────────────────────────────────────────────────────────────
    # Validation
    # ─────────────────────────────────────────────────────────────────
 
    def validate_dataset(self, df: pd.DataFrame) -> None:
        if "risk" not in df.columns:
            raise ValueError("Evaluation dataset must contain a 'risk' column.")
 
    # ─────────────────────────────────────────────────────────────────
    # Evaluate
    # ─────────────────────────────────────────────────────────────────
 
    def evaluate(self, df: pd.DataFrame) -> dict:
        self.validate_dataset(df)
 
        prediction_results = self.predictor.predict(df)
 
        y_true = df["risk"].map(RISK_MAP).values
        y_pred = np.array([RISK_MAP[r["prediction"]] for r in prediction_results])
 
        accuracy  = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred, average="weighted", zero_division=0)
        recall    = recall_score(y_true, y_pred, average="weighted", zero_division=0)
        f1        = f1_score(y_true, y_pred, average="weighted", zero_division=0)
        matrix    = confusion_matrix(y_true, y_pred).tolist()
        report    = classification_report(
            y_true, y_pred,
            target_names=RISK_LABELS,
            output_dict=True,
            zero_division=0,
        )
 
        return {
            "accuracy":              float(accuracy),
            "precision":             float(precision),
            "recall":                float(recall),
            "f1":                    float(f1),
            "confusion_matrix":      matrix,
            "classification_report": report,
            "predictions":           prediction_results,
        }
 
    # ─────────────────────────────────────────────────────────────────
    # DataFrame helpers
    # ─────────────────────────────────────────────────────────────────
 
    def prediction_dataframe(self, eval_result: dict) -> pd.DataFrame:
        rows = []
        for p in eval_result["predictions"]:
            rows.append({
                "employee_id": p["employee_id"],
                "prediction":  p["prediction"],
                "risk_score":  p.get("risk_score", "—"),
                "p_green":     f"{p['probabilities']['GREEN']:.1%}",
                "p_amber":     f"{p['probabilities']['AMBER']:.1%}",
                "p_red":       f"{p['probabilities']['RED']:.1%}",
            })
        return pd.DataFrame(rows)
 
    def report_dataframe(self, eval_result: dict) -> pd.DataFrame:
        report = eval_result["classification_report"]
        rows = []
        for label in RISK_LABELS:
            rows.append({
                "Class":     label,
                "Precision": round(report[label]["precision"], 4),
                "Recall":    round(report[label]["recall"],    4),
                "F1":        round(report[label]["f1-score"],  4),
                "Support":   int(report[label]["support"]),
            })
        return pd.DataFrame(rows)
 
    # ─────────────────────────────────────────────────────────────────
    # Plotly Charts
    # ─────────────────────────────────────────────────────────────────
 
    def chart_confusion_matrix(self, eval_result: dict) -> go.Figure:
        matrix = eval_result["confusion_matrix"]
        fig = go.Figure(go.Heatmap(
            z=matrix,
            x=[f"Pred {l}" for l in RISK_LABELS],
            y=[f"Actual {l}" for l in RISK_LABELS],
            colorscale="Blues",
            text=[[str(v) for v in row] for row in matrix],
            texttemplate="%{text}",
            textfont=dict(size=14, color="white"),
            showscale=False,
        ))
        fig.update_layout(
            title="Confusion Matrix",
            xaxis=dict(side="bottom"),
            height=320,
            **_base_layout(),
        )
        return fig
 
    def chart_classification_report(self, eval_result: dict) -> go.Figure:
        report = eval_result["classification_report"]
        metrics = ["precision", "recall", "f1-score"]
        fig = go.Figure()
        for metric in metrics:
            fig.add_trace(go.Bar(
                name=metric.capitalize(),
                x=RISK_LABELS,
                y=[report[l][metric] for l in RISK_LABELS],
                marker_color=[ZONE_COLORS[l] for l in RISK_LABELS],
                opacity=0.8,
            ))
        fig.update_layout(
            barmode="group",
            title="Classification Report",
            yaxis=dict(range=[0, 1.05], tickformat=".0%",
                       gridcolor=PLOTLY_GRID, zeroline=False),
            xaxis=dict(gridcolor=PLOTLY_GRID),
            legend=dict(bgcolor=PLOTLY_PAPER),
            height=320,
            **_base_layout(),
        )
        return fig
 
    def chart_probability_distribution(self, eval_result: dict) -> go.Figure:
        preds = eval_result["predictions"]
        fig = go.Figure()
        for zone in RISK_LABELS:
            key = f"p_{zone.lower()}"
            vals = [p["probabilities"][zone] for p in preds]
            fig.add_trace(go.Box(
                y=vals,
                name=zone,
                marker_color=ZONE_COLORS[zone],
                boxmean=True,
            ))
        fig.update_layout(
            title="Prediction Probability Distribution",
            yaxis=dict(tickformat=".0%", gridcolor=PLOTLY_GRID, zeroline=False),
            height=320,
            **_base_layout(),
        )
        return fig
 
    def chart_risk_score_vs_zone(self, eval_result: dict) -> go.Figure:
        preds = eval_result["predictions"]
        zones  = [p["prediction"]                for p in preds]
        scores = [p.get("risk_score", 50)        for p in preds]
        eids   = [p["employee_id"]               for p in preds]
        colors = [ZONE_COLORS[z]                 for z in zones]
 
        fig = go.Figure(go.Bar(
            x=eids, y=scores,
            marker_color=colors,
            hovertemplate="<b>%{x}</b><br>Risk Score: %{y}<extra></extra>",
        ))
        fig.add_hline(y=65, line_dash="dash", line_color=ZONE_COLORS["RED"],
                      annotation_text="RED threshold")
        fig.add_hline(y=35, line_dash="dash", line_color=ZONE_COLORS["GREEN"],
                      annotation_text="AMBER threshold")
        fig.update_layout(
            title="Risk Score per Employee",
            yaxis=dict(range=[0, 105], gridcolor=PLOTLY_GRID, zeroline=False),
            xaxis=dict(gridcolor=PLOTLY_GRID),
            height=320,
            **_base_layout(),
        )
        return fig