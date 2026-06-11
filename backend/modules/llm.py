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
