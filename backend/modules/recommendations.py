"""
modules/recommendations.py — EWS v5

Generates personalized, actionable recommendations / interventions for an
employee using the LLM (via modules.llm.get_llm), based on:
  - their aggregated feature vector (sentiment trend, velocity, topic scores, etc.)
  - their latest RAG classification (risk_zone, risk_score, top_factors / SHAP)
  - their recent survey comments (PII-redacted)

If no LLM is available, falls back to a deterministic rule-based
recommendation generator so the feature always returns something useful.

Public API:
  generate_recommendation(employee_id, features, classification, recent_comments)
      → dict: {
            "reasoning": str,
            "priority": "low" | "medium" | "high" | "critical",
            "timeline": str,
            "actions": list[dict],   # [{ "title": ..., "owner": ..., "description": ... }, ...]
            "source": "llm" | "rule_based",
        }
"""

from __future__ import annotations

import json
import sys
from typing import Optional

from langchain_core.messages import HumanMessage

from modules.llm import get_llm, redact_pii


PRIORITY_BY_ZONE = {
    "RED": "critical",
    "AMBER": "high",
    "GREEN": "low",
}

TIMELINE_BY_ZONE = {
    "RED": "Within 48 hours",
    "AMBER": "Within 2 weeks",
    "GREEN": "Next development cycle",
}


# ─────────────────────────────────────────────────────────────────────────────
# Rule-based fallback
# ─────────────────────────────────────────────────────────────────────────────
def _rule_based_actions(features: dict, top_factors: list) -> list[dict]:
    """Generate a small set of targeted actions from feature thresholds and concern categories."""
    actions: list[dict] = []

    def add(title, owner, description):
        actions.append({"title": title, "owner": owner, "description": description})

    sentiment_trend = features.get("sentiment_trend", 0) or 0
    sentiment_velocity = features.get("sentiment_velocity", 0) or 0
    avg_sentiment = features.get("avg_sentiment", 0) or 0
    primary_concern = features.get("primary_concern")
    secondary_reason = features.get("secondary_reason")
    previous_rag = features.get("previous_rag")

    if sentiment_velocity < -0.15 or sentiment_trend < -0.05:
        add(
            "Schedule an immediate 1:1 check-in",
            "Manager",
            "Sentiment has dropped sharply or trended downward recently. "
            "A timely, supportive conversation can surface concerns before they escalate.",
        )

    # ── Concern-category-driven rules ────────────────────────────────────────
    if primary_concern in ("RO", "Team"):
        add(
            "Facilitate manager/team relationship review",
            "HR Partner",
            f"Primary concern is '{primary_concern}'. Schedule a mediated conversation "
            "between the employee and their reporting officer to address relationship issues.",
        )

    if primary_concern in ("Work Life Balance", "Work Content"):
        add(
            "Discuss flexible working arrangements",
            "HR Partner",
            f"Primary concern is '{primary_concern}'. Explore flexible hours, "
            "remote work options, workload redistribution, or time-off planning.",
        )

    if primary_concern == "Compensation" or secondary_reason == "Compensation":
        add(
            "Initiate a compensation review",
            "HR Partner",
            "Compensation has been flagged as a concern. Review market benchmarks "
            "and internal parity, and discuss potential adjustments or non-monetary benefits.",
        )

    if primary_concern in ("Career Progression", "Promotion"):
        add(
            "Create a career development plan",
            "Manager",
            f"Primary concern is '{primary_concern}'. Discuss growth paths, "
            "stretch assignments, promotion timelines, or mentorship opportunities.",
        )

    if primary_concern == "Performance":
        add(
            "Provide performance support and coaching",
            "Manager",
            "Performance is flagged as a concern. Set clear expectations, provide "
            "constructive feedback, and establish measurable improvement goals.",
        )

    if primary_concern == "Health & Wellness":
        add(
            "Connect with wellness resources",
            "HR Partner",
            "Health and wellness is the primary concern. Offer employee assistance "
            "program (EAP) access, wellness activities, or medical support resources.",
        )

    if primary_concern in ("Policies", "Iris Culture"):
        add(
            "Address policy or culture concerns",
            "HR Partner",
            f"Primary concern is '{primary_concern}'. Schedule a confidential discussion "
            "to understand specific grievances and explore resolution options.",
        )

    if primary_concern == "Offboarding":
        add(
            "Conduct immediate retention discussion",
            "Manager",
            "Employee has flagged 'Offboarding' as primary concern — potential flight risk. "
            "Urgent retention conversation recommended within 48 hours.",
        )

    # ── RAG escalation detection ─────────────────────────────────────────────
    if previous_rag and previous_rag.upper() == "GREEN":
        add(
            "Investigate recent escalation from GREEN",
            "HR Partner",
            "Employee was previously GREEN — something has changed recently. "
            "Investigate what triggered the escalation via a confidential conversation.",
        )

    if avg_sentiment < -0.2:
        add(
            "Initiate a confidential pulse-check survey",
            "HR Partner",
            "Overall sentiment is consistently negative. A confidential "
            "follow-up survey can help identify specific pain points.",
        )

    # Use top SHAP factors to add a generic, explainable action if list still short
    if len(actions) < 2 and top_factors:
        top_feature = top_factors[0].get("feature", "key factors")
        add(
            "Investigate top contributing risk factor",
            "HR Partner",
            f"The model flagged '{top_feature}' as the leading risk driver for this "
            "employee. Review related survey responses and discuss with the employee's manager.",
        )

    if not actions:
        add(
            "Continue regular check-ins",
            "Manager",
            "No major risk signals detected. Maintain regular 1:1 cadence "
            "and monitor sentiment trends for changes.",
        )

    return actions[:5]


def _normalize_top_factors(top_factors) -> list[dict]:
    """Ensure top_factors is a list of dicts, regardless of whether the
    caller passed it pre-parsed (e.g. from db_get_latest_classifications)
    or still JSON-encoded (e.g. raw classifier predict() output before
    persistence, or a caller that didn't deserialize it)."""
    if isinstance(top_factors, str):
        try:
            top_factors = json.loads(top_factors)
        except json.JSONDecodeError:
            return []
    if not isinstance(top_factors, list):
        return []
    return [f for f in top_factors if isinstance(f, dict) and "feature" in f]


def _rule_based_reasoning(employee_id: str, risk_zone: str, features: dict, top_factors: list) -> str:
    parts = [f"Employee {employee_id} is currently classified as {risk_zone}."]

    trend = features.get("sentiment_trend")
    velocity = features.get("sentiment_velocity")
    avg = features.get("avg_sentiment")

    if avg is not None:
        parts.append(f"Average sentiment is {avg:+.2f}.")
    if trend is not None and trend != 0:
        direction = "declining" if trend < 0 else "improving"
        parts.append(f"Sentiment trend is {direction} (slope {trend:+.3f}).")
    if velocity is not None and velocity != 0:
        direction = "dropped" if velocity < 0 else "increased"
        parts.append(f"Most recent sentiment {direction} by {abs(velocity):.2f} compared to the prior survey.")

    if top_factors:
        feature_names = ", ".join(f["feature"] for f in top_factors[:3])
        parts.append(f"Top contributing factors: {feature_names}.")

    return " ".join(parts)


def _rule_based_recommendation(employee_id: str, features: dict, classification: dict) -> dict:
    risk_zone = (classification or {}).get("risk_zone", "GREEN")
    top_factors = _normalize_top_factors((classification or {}).get("top_factors", []))

    return {
        "reasoning": _rule_based_reasoning(employee_id, risk_zone, features, top_factors),
        "priority": PRIORITY_BY_ZONE.get(risk_zone, "medium"),
        "timeline": TIMELINE_BY_ZONE.get(risk_zone, "Within 30 days"),
        "actions": _rule_based_actions(features, top_factors),
        "source": "rule_based",
    }


# ─────────────────────────────────────────────────────────────────────────────
# LLM-based generation
# ─────────────────────────────────────────────────────────────────────────────
def _build_llm_prompt(
    employee_id: str,
    features: dict,
    classification: dict,
    recent_comments: list,
) -> str:
    risk_zone = (classification or {}).get("risk_zone", "UNKNOWN")
    risk_score = (classification or {}).get("risk_score")
    top_factors = _normalize_top_factors((classification or {}).get("top_factors", []))

    # Trim features to a readable subset (drop internal/None values)
    clean_features = {
        k: v for k, v in (features or {}).items()
        if k not in ("employee_id", "_has_data") and v is not None
    }

    clean_comments = [redact_pii(c) for c in (recent_comments or []) if c and c.strip()]

    prompt = f"""
You are an expert HR analyst and people-operations advisor for an Employee
Experience Management platform. You will be given anonymized signals about
a single employee and must produce a personalized set of recommended
interventions for that employee's manager and HR partner.

Employee ID: {employee_id}
Current risk classification: {risk_zone} (risk score: {risk_score})
Top model-identified risk factors: {json.dumps(top_factors[:5], indent=2)}

Aggregated feature signals:
{json.dumps(clean_features, indent=2, default=str)}

Recent anonymized survey comments (most recent last):
{json.dumps(clean_comments[-5:], indent=2)}

Instructions:
1. Write a short (2-4 sentence) "reasoning" paragraph explaining WHY this
   employee may be at risk (or doing well), grounded in the data above.
   Do not invent facts not supported by the data.
2. Assign a "priority" of one of: "low", "medium", "high", "critical",
   appropriate to the risk zone and signals.
3. Suggest a "timeline" (e.g. "Within 48 hours", "Within 2 weeks", "Next quarter").
4. Produce 2-5 specific, personalized "actions". Each action must have:
   - "title": short imperative title
   - "owner": who should act ("Manager", "HR Partner", or "Leadership")
   - "description": 1-2 sentence concrete description tailored to this
     employee's specific signals (not generic advice).

Respond with ONLY a single valid JSON object (no markdown fences, no
preamble) matching this exact schema:
{{
  "reasoning": "string",
  "priority": "low|medium|high|critical",
  "timeline": "string",
  "actions": [
    {{"title": "string", "owner": "string", "description": "string"}}
  ]
}}
"""
    return prompt


def _parse_llm_json(raw: str) -> Optional[dict]:
    """Best-effort extraction of a JSON object from an LLM response."""
    if not raw:
        return None
    text = raw.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fall back: try to find the first { ... last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return None
    return None


def _validate_recommendation(data: dict) -> Optional[dict]:
    if not isinstance(data, dict):
        return None

    reasoning = data.get("reasoning")
    priority = str(data.get("priority", "")).lower()
    timeline = data.get("timeline")
    actions = data.get("actions")

    if not reasoning or not isinstance(actions, list) or not actions:
        return None

    if priority not in ("low", "medium", "high", "critical"):
        priority = "medium"

    clean_actions = []
    for a in actions:
        if not isinstance(a, dict):
            continue
        title = a.get("title")
        owner = a.get("owner", "Manager")
        description = a.get("description", "")
        if title:
            clean_actions.append({"title": title, "owner": owner, "description": description})

    if not clean_actions:
        return None

    return {
        "reasoning": reasoning,
        "priority": priority,
        "timeline": timeline or "Within 2 weeks",
        "actions": clean_actions[:5],
        "source": "llm",
    }


def generate_recommendation(
    employee_id: str,
    features: dict,
    classification: dict = None,
    recent_comments: list = None,
    llm=None,
) -> dict:
    """
    Generate a personalized recommendation for one employee.

    Args:
        employee_id: employee identifier
        features: aggregated feature dict from feature_engine
        classification: latest RAG classification dict (risk_zone, risk_score, top_factors)
        recent_comments: list of recent raw survey comments for this employee
        llm: optional pre-connected LangChain chat model. If None, get_llm() is used.

    Returns:
        dict with reasoning, priority, timeline, actions, source
    """
    classification = classification or {}
    recent_comments = recent_comments or []

    llm = llm if llm is not None else get_llm()

    if llm is not None:
        try:
            prompt = _build_llm_prompt(employee_id, features, classification, recent_comments)
            resp = llm.invoke([HumanMessage(content=prompt)])
            content = resp.content if hasattr(resp, "content") else str(resp)
            parsed = _parse_llm_json(content)
            validated = _validate_recommendation(parsed) if parsed else None
            if validated:
                return validated
            print(f"[Recommendations] LLM output invalid for {employee_id}, falling back to rules.", file=sys.stderr)
        except Exception as e:
            print(f"[Recommendations] LLM generation failed for {employee_id}: {e}", file=sys.stderr)

    return _rule_based_recommendation(employee_id, features, classification)


# ─────────────────────────────────────────────────────────────────────────────
# Team-level recommendations — deterministic, derived from real dept stats
# ─────────────────────────────────────────────────────────────────────────────
def generate_team_recommendations(team_stats: dict) -> list[str]:
    """
    Build 1-3 short, actionable recommendations for a department/team from
    its real aggregated stats (as returned by db_get_department_aggregates),
    optionally enriched with a topic breakdown (topic -> avg_sentiment).

    This is intentionally rule-based (not LLM) so it stays fast, free, and
    fully deterministic for the Teams overview page — every recommendation
    is traceable back to a specific number in team_stats/topics.
    """
    recs: list[str] = []
    dept = team_stats.get("department", "This team")
    red = team_stats.get("red", 0) or 0
    amber = team_stats.get("amber", 0) or 0
    health = team_stats.get("health")
    avg_sentiment = team_stats.get("avg_sentiment")
    topics: list[dict] = team_stats.get("topics") or []

    if red > 0:
        recs.append(
            f"{red} employee{'s' if red != 1 else ''} in {dept} {'are' if red != 1 else 'is'} "
            f"in the critical (RED) zone — schedule manager 1:1s within 48 hours."
        )
    if amber > 0 and len(recs) < 3:
        recs.append(
            f"{amber} employee{'s' if amber != 1 else ''} in the watch (AMBER) zone — "
            f"proactive check-ins recommended within 2 weeks."
        )

    negative_topics = [t for t in topics if t.get("avg_sentiment", 0) < -0.15]
    negative_topics.sort(key=lambda t: t.get("avg_sentiment", 0))
    for t in negative_topics[:2]:
        if len(recs) >= 3:
            break
        recs.append(
            f"'{t['topic']}' is trending negative for {dept} "
            f"(avg sentiment {t['avg_sentiment']:+.2f} across {t['mentions']} mentions) — "
            f"investigate via targeted follow-up."
        )

    if not recs:
        if health is not None and health >= 80:
            recs.append(f"{dept} is healthy — no immediate interventions needed. Maintain current cadence.")
        elif avg_sentiment is not None:
            recs.append(f"No critical signals for {dept} right now (avg sentiment {avg_sentiment:+.2f}). Continue regular monitoring.")
        else:
            recs.append(f"Not enough classified survey data yet for {dept} to generate specific recommendations.")

    return recs[:3]
