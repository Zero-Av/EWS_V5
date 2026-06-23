"""
modules/llm.py — EWS v5

Simplified LLM integration.
Removed: _DirectAnthropicLLM fallback wrapper (tech debt).
Only supports: langchain-ollama and langchain-anthropic natively.

Public API:
  get_llm(provider)           → LangChain chat model or None
  redact_pii(text)            → PII-scrubbed text
  summarize_feedback(comments) → thematic summary string
"""

from __future__ import annotations

import os
import sys
import json
import re
from langchain_core.messages import HumanMessage
from config import OLLAMA_MODEL, ANTHROPIC_MODEL, LLM_TEMPERATURE


def get_llm(provider: str = "auto"):
    """
    Returns a LangChain chat model or None.

    provider:
        "auto"      → try Ollama first, fall back to Anthropic
        "ollama"    → local only
        "anthropic" → Claude only
    """

    # ── Ollama ────────────────────────────────────────────────────────────────
    if provider in ("auto", "ollama"):
        try:
            from langchain_ollama import ChatOllama
            llm = ChatOllama(
                model=OLLAMA_MODEL,
                temperature=LLM_TEMPERATURE,
                timeout=600,
                request_timeout=600,
                num_predict=500,
                keep_alive="30m",
            )

            # Connectivity test
            print(f"[LLM] Testing Ollama model: {OLLAMA_MODEL}…", file=sys.stderr)
            test_resp = llm.invoke([HumanMessage(content="Reply with the single word: ready")])
            print(f"[LLM] ✓ Connected to Ollama: {OLLAMA_MODEL}", file=sys.stderr)
            return llm

        except Exception as e:
            print(f"[LLM] Ollama unavailable: {e}", file=sys.stderr)
            if provider == "ollama":
                raise RuntimeError(f"Ollama unavailable: {e}") from e

    # ── Anthropic ─────────────────────────────────────────────────────────────
    if provider in ("auto", "anthropic"):
        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            if provider == "anthropic":
                raise ValueError("ANTHROPIC_API_KEY environment variable is not set.")
            print("[LLM] ANTHROPIC_API_KEY not set, no LLM available.", file=sys.stderr)
            return None

        try:
            from langchain_anthropic import ChatAnthropic
            llm = ChatAnthropic(
                model=ANTHROPIC_MODEL,
                anthropic_api_key=api_key,
                temperature=LLM_TEMPERATURE,
            )
            print(f"[LLM] ✓ Connected to Anthropic: {ANTHROPIC_MODEL}", file=sys.stderr)
            return llm
        except Exception as e:
            print(f"[LLM] Anthropic connection failed: {e}", file=sys.stderr)
            if provider == "anthropic":
                raise RuntimeError(f"Anthropic API error: {e}") from e

    return None


def redact_pii(text: str) -> str:
    """Scrub PII (emails, phone numbers, SSNs) for SOC2 compliance."""
    text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[EMAIL REDACTED]', text)
    text = re.sub(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', '[PHONE REDACTED]', text)
    text = re.sub(r'\d{3}-\d{2}-\d{4}', '[SSN REDACTED]', text)
    return text


def answer_workforce_question(question: str, context: dict) -> str:
    """
    Answer a free-form question from a manager/HRBP about the workforce,
    grounded ONLY in the real data snapshot passed in `context` (dashboard
    KPIs, current risk-zone counts, top at-risk employees, open alerts,
    department rollups, etc. — whatever the caller assembled from the
    actual database). The model is instructed not to invent figures that
    aren't present in the supplied context.
    """
    if not question or not question.strip():
        return "Please ask a specific question about the workforce data."

    llm = get_llm()
    if not llm:
        return ("LLM not connected. Go to Settings → Integrations to connect a provider, "
                "then ask again.")

    prompt = f"""
You are NEXUS, an AI workforce-intelligence assistant embedded in an Employee
Experience Management platform. You answer manager/HR questions using ONLY
the real, current data snapshot provided below — never invent employee
names, numbers, or events that are not present in this snapshot.

Current workforce data snapshot (JSON):
{json.dumps(context, indent=2, default=str)}

User question:
{question}

Instructions:
1. Answer the question directly and concisely (2-5 sentences, or a short
   list if comparing multiple items).
2. Ground every figure you cite in the snapshot above. If the snapshot
   doesn't contain the information needed to answer, say so plainly and
   suggest what action (e.g. "upload surveys", "run the classifier") would
   make that data available, rather than guessing.
3. Where relevant, end with a brief, concrete suggested next action.
4. Do not mention that you were given a "snapshot" or "context" — just
   answer naturally, as an analyst who has this data in front of them.
"""

    try:
        resp = llm.invoke([HumanMessage(content=prompt)])
        return resp.content if hasattr(resp, "content") else str(resp)
    except Exception as e:
        print(f"[LLM] Assistant Q&A failed: {e}", file=sys.stderr)
        return "I hit an error reaching the LLM. Please try again or check Settings → Integrations."


def summarize_feedback(comments: list[str]) -> str:
    """
    Takes a list of raw survey comments and uses the LLM to generate
    a thematic summary with actionable insights.
    """
    if not comments:
        return "No comments available to summarize."

    # Apply PII protection before sending to LLM
    clean_comments = [redact_pii(c) for c in comments]

    llm = get_llm()
    if not llm:
        return "LLM not available. Summarization disabled."

    prompt = f"""
    You are an expert HR analyst. I will provide you with a list of anonymized survey comments from employees.
    Your task is to summarize the key themes and concerns expressed in these comments.
    Keep the summary concise, professional, and actionable. Group similar complaints together.
    
    Comments:
    {json.dumps(clean_comments, indent=2)}
    
    Output format:
    A bulleted list of 2-4 key themes, with a brief explanation for each. Do not mention individual employee IDs.
    """

    try:
        resp = llm.invoke([HumanMessage(content=prompt)])
        return resp.content
    except Exception as e:
        print(f"[LLM] Summarization failed: {e}", file=sys.stderr)
        return "Failed to generate summary due to an LLM error."
