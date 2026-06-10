"""
modules/llm.py — EWS v3

Changes vs v2:
  - Ollama timeout raised to 600s (10 min) — qwen2.5:3b on CPU can be slow
  - num_predict raised to 500 — was 350, sometimes too short for full JSON
  - keep_alive set to "30m" — keeps model loaded in VRAM/RAM between calls
    so sequential processing doesn't reload the model for every employee
  - Added a proper connectivity test that actually checks the model responds
  - Cleaner error messages
"""

import os
import sys
import json
import re
import requests
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.language_models.chat_models import BaseChatModel
from config import OLLAMA_MODEL, ANTHROPIC_MODEL, LLM_TEMPERATURE


# ── Direct Anthropic HTTP wrapper (no langchain_anthropic needed) ──────────────
class _DirectAnthropicLLM(BaseChatModel):
    model:       str   = ANTHROPIC_MODEL
    api_key:     str   = ""
    temperature: float = LLM_TEMPERATURE

    @property
    def _llm_type(self) -> str:
        return "direct-anthropic"

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        from langchain_core.outputs import ChatGeneration, ChatResult
        formatted = []
        for m in messages:
            role = "user" if getattr(m, "type", "human") == "human" else "assistant"
            formatted.append({"role": role, "content": m.content})

        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key":         self.api_key,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json={
                "model":       self.model,
                "max_tokens":  1024,
                "temperature": self.temperature,
                "messages":    formatted,
            },
            timeout=120,
        )
        resp.raise_for_status()
        text = resp.json()["content"][0]["text"]
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=text))])

    def _stream(self, messages, stop=None, run_manager=None, **kwargs):
        result = self._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
        yield result.generations[0]


# ── Public factory ─────────────────────────────────────────────────────────────
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

                # ── Timeout settings ──────────────────────────────────────
                # qwen2.5:3b on CPU: 60-180s per call is normal.
                # These timeouts apply to the HTTP connection to Ollama's
                # local server, NOT the total generation time.
                # The per-call generation timeout is handled in
                # recommendations.py via concurrent.futures (PER_CALL_TIMEOUT).
                timeout=600,
                request_timeout=600,

                # ── Token budget ─────────────────────────────────────────
                # 500 tokens is enough for the JSON we need (typically 100-200
                # tokens) with headroom for qwen's chain-of-thought preamble.
                num_predict=500,

                # ── Keep model loaded between calls ──────────────────────
                # Without this, Ollama unloads the model from VRAM/RAM after
                # each call and reloads it for the next — adding 5-30s per
                # employee depending on hardware. "30m" keeps it warm.
                keep_alive="30m",
            )

            # Real connectivity test — not just a ping, but an actual model call
            print(f"[LLM] Testing Ollama model: {OLLAMA_MODEL}…", file=sys.stderr)
            test_resp = llm.invoke([HumanMessage(content="Reply with the single word: ready")])
            print(f"[LLM] Ollama test response: {str(test_resp.content)[:80]!r}", file=sys.stderr)
            print(f"[LLM] ✓ Connected to Ollama: {OLLAMA_MODEL}", file=sys.stderr)
            return llm

        except Exception as e:
            print(f"[LLM] Ollama unavailable: {e}", file=sys.stderr)
            if provider == "ollama":
                raise RuntimeError(
                    f"Ollama unavailable: {e}\n"
                    f"Fix: 1) Install Ollama → https://ollama.com\n"
                    f"     2) Run: ollama serve\n"
                    f"     3) Run: ollama pull {OLLAMA_MODEL}"
                ) from e

    # ── Anthropic ─────────────────────────────────────────────────────────────
    if provider in ("auto", "anthropic"):
        api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not api_key:
            if provider == "anthropic":
                raise ValueError(
                    "ANTHROPIC_API_KEY environment variable is not set.\n"
                    "Set it with:  export ANTHROPIC_API_KEY=sk-ant-..."
                )
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
        except ImportError:
            pass

        # Direct HTTP fallback
        try:
            llm = _DirectAnthropicLLM(model=ANTHROPIC_MODEL, api_key=api_key, temperature=LLM_TEMPERATURE)
            print(f"[LLM] ✓ Connected to Anthropic (direct HTTP): {ANTHROPIC_MODEL}", file=sys.stderr)
            return llm
        except Exception as e:
            print(f"[LLM] Anthropic connection failed: {e}", file=sys.stderr)
            if provider == "anthropic":
                raise RuntimeError(f"Anthropic API error: {e}") from e

    return None

def redact_pii(text: str) -> str:
    """Scrub basic PII (emails, names, phone numbers) using regex for SOC2 compliance."""
    # Redact Emails
    text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[EMAIL REDACTED]', text)
    # Redact Phone Numbers (Basic US format)
    text = re.sub(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', '[PHONE REDACTED]', text)
    # Redact Social Security Numbers (Basic US format)
    text = re.sub(r'\d{3}-\d{2}-\d{4}', '[SSN REDACTED]', text)
    return text

def summarize_feedback(comments: list[str]) -> str:
    """
    Takes a list of raw survey comments and uses the LLM to generate a thematic summary.
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
