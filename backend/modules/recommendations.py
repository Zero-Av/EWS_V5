"""
recommendations.py  —  EWS v3

Root-cause fix for "always returns default" with Ollama (qwen2.5:3b):

  PROBLEM 1 — Parallelism starves Ollama
    The previous code ran up to 5 threads simultaneously against Ollama.
    Ollama is single-threaded: it queues requests. Threads 2-5 sit waiting
    while thread 1 runs. With a 120s total timeout, the later threads time
    out before Ollama even starts them → silent fallback to DEFAULT_REC.

  FIX 1 — Sequential mode for Ollama, parallel only for API-based LLMs
    We detect whether the LLM is local (Ollama) and serialize calls if so.
    API LLMs (Anthropic) can still run in parallel — they don't bottleneck.

  PROBLEM 2 — bind(max_tokens=350) is ignored by ChatOllama
    ChatOllama does not support bind(max_tokens=...). The kwarg is silently
    dropped, so the model generates until its own limit, making each call
    slower than expected.

  FIX 2 — Remove bind(); pass num_predict at connection time in llm.py.
    num_predict is already set to 400 there; we don't touch it here.

  PROBLEM 3 — No per-call timeout; only connection-level timeout applies
    If Ollama is slow on a particular call, the thread just blocks.

  FIX 3 — Wrap each generate() call in a concurrent.futures.Future with
    an explicit per-call deadline. If exceeded, log and fall back — but
    never silently. Every fallback is printed to stderr.

  PROBLEM 4 — <think> tags not stripped before JSON parse (qwen2.5 emits them)
    Already handled by _clean_json — confirmed working.

  RESULT: With these fixes, every RED/AMBER employee gets a genuine LLM
  attempt. Only true failures (Ollama crashed, GPU OOM, etc.) fall back.
"""

import re
import sys
import json
import time
import concurrent.futures
from typing import Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# ── Default fallback (only used on genuine failure) ────────────────────────────
DEFAULT_REC = {
    "priority":  "MEDIUM",
    "timeline":  "2 weeks",
    "reasoning": "Default recommendation — LLM timed out or returned unparseable output.",
    "actions": [
        "Schedule 1-on-1 check-in with manager",
        "Conduct workload and wellbeing audit",
        "Review career development plan",
    ],
}

# ── Per-call timeout (seconds) ─────────────────────────────────────────────────
# qwen2.5:3b on CPU: ~60-180s per call depending on hardware.
# On GPU: ~15-40s. Set conservatively high so slow hardware still works.
PER_CALL_TIMEOUT = 300   # 5 minutes per employee — generous for slow CPUs

# ── Max parallel workers for API-based LLMs (Anthropic etc.) ──────────────────
API_MAX_WORKERS = 4

# ── Metric info ────────────────────────────────────────────────────────────────
METRIC_INFO = {
    "stress_level":       {"label": "Stress Level",      "direction": "high", "scale": "/10"},
    "workload_level":     {"label": "Workload",           "direction": "high", "scale": "/10"},
    "absenteeism":        {"label": "Absenteeism",        "direction": "high", "scale": " days"},
    "work_life_balance":  {"label": "Work-Life Balance",  "direction": "low",  "scale": "/10"},
    "manager_support":    {"label": "Manager Support",    "direction": "low",  "scale": "/10"},
    "job_satisfaction":   {"label": "Job Satisfaction",   "direction": "low",  "scale": "/10"},
    "happiness_score":    {"label": "Happiness",          "direction": "low",  "scale": "/10"},
    "productivity":       {"label": "Productivity",       "direction": "low",  "scale": "/10"},
    "team_collaboration": {"label": "Team Collab",        "direction": "low",  "scale": "/10"},
    "career_growth":      {"label": "Career Growth",      "direction": "low",  "scale": "/10"},
}

# ── Prompts ────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """\
You are an HR retention specialist. Return ONLY a valid JSON object — no markdown fences, \
no explanation, no text before or after the JSON.

Output format (exactly):
{{
  "priority": "CRITICAL" or "HIGH" or "MEDIUM",
  "timeline": "48 hours" or "1 week" or "2 weeks",
  "reasoning": "2 sentences referencing the employee's specific metric values",
  "actions": ["specific action 1", "specific action 2", "specific action 3"]
}}

Rules:
- RED zone → priority CRITICAL, timeline 48 hours
- AMBER zone → priority HIGH, timeline 1-2 weeks
- Actions must be concrete and tailored to this employee's worst metrics
- Do NOT repeat the JSON schema — output only the filled-in object\
"""

HUMAN_PROMPT = """\
Employee ID: {employee_id}
Risk Zone: {risk_zone}
Risk Score: {risk_score}/100
Attrition Probability: {attrition_prob}%

Worst metrics:
{critical_metrics}

Manager's comment: "{comment}"

Produce the JSON intervention plan.\
"""


def _is_ollama(llm) -> bool:
    """Detect whether the LLM is a local Ollama instance."""
    t = type(llm).__name__.lower()
    return "ollama" in t or "direct" not in t and hasattr(llm, "model") and "llama" in str(getattr(llm, "model", "")).lower()


def _llm_type(llm) -> str:
    return type(llm).__name__


class RecommendationEngine:

    def __init__(self, llm):
        self.llm = llm
        self._chain = None
        if llm is not None:
            self._prompt = ChatPromptTemplate.from_messages([
                ("system", SYSTEM_PROMPT),
                ("human",  HUMAN_PROMPT),
            ])
            self._chain = self._prompt | llm | StrOutputParser()

    # ── JSON cleanup — handles qwen2.5 <think> tags and markdown fences ───────
    def _clean_json(self, text: str) -> Optional[dict]:
        try:
            # Strip chain-of-thought blocks (qwen3, deepseek, etc.)
            text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
            # Strip markdown fences
            text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
            # Extract outermost JSON object
            s = text.find("{")
            e = text.rfind("}") + 1
            if s == -1 or e <= 0:
                return None
            candidate = text[s:e]
            parsed = json.loads(candidate)
            # Validate required keys
            if all(k in parsed for k in ("priority", "timeline", "reasoning", "actions")):
                return parsed
            return None
        except Exception:
            return None

    # ── Rank metrics by how much they contribute to risk ──────────────────────
    def _rank_metrics(self, row: dict) -> list[dict]:
        scores = []
        for key, info in METRIC_INFO.items():
            val = row.get(key) or (row.get("metrics") or {}).get(key)
            if val is None:
                continue
            val = float(val)
            risk = val / 10.0 if info["direction"] == "high" else 1.0 - val / 10.0
            scores.append({
                "label":     info["label"],
                "value":     val,
                "scale":     info["scale"],
                "direction": info["direction"],
                "risk":      risk,
            })
        scores.sort(key=lambda x: x["risk"], reverse=True)
        return scores

    def _fmt_critical(self, ranked: list[dict]) -> str:
        lines = []
        for m in ranked[:4]:  # top 4 instead of 3 — more context for LLM
            bad = "too high" if m["direction"] == "high" else "too low"
            lines.append(f"  • {m['label']}: {m['value']}{m['scale']} ({bad})")
        return "\n".join(lines) if lines else "  No metric data available"

    def _build_vars(self, row: dict) -> dict:
        ranked = self._rank_metrics(row)
        zone   = row.get("prediction", row.get("risk_zone", "AMBER"))
        return {
            "employee_id":      row.get("employee_id", "UNKNOWN"),
            "risk_zone":        zone,
            "risk_score":       row.get("risk_score", "?"),
            "attrition_prob":   row.get("attrition_prob", "?"),
            "critical_metrics": self._fmt_critical(ranked),
            "comment":          str(row.get("comment", "No comment provided."))[:250],
        }

    # ── Core: call LLM for one employee, with per-call timeout via Future ─────
    def _call_llm(self, vars_dict: dict, employee_id: str) -> Optional[dict]:
        """
        Invokes the chain and waits up to PER_CALL_TIMEOUT seconds.
        Returns parsed dict on success, None on timeout/error.
        """
        def _invoke():
            return self._chain.invoke(vars_dict)

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(_invoke)
            try:
                raw = future.result(timeout=PER_CALL_TIMEOUT)
            except concurrent.futures.TimeoutError:
                print(
                    f"[TIMEOUT] {employee_id}: LLM did not respond within "
                    f"{PER_CALL_TIMEOUT}s — falling back to default.",
                    file=sys.stderr,
                )
                future.cancel()
                return None
            except Exception as exc:
                print(f"[ERROR] {employee_id}: LLM invocation failed — {exc}", file=sys.stderr)
                return None

        parsed = self._clean_json(raw)
        if parsed is None:
            print(
                f"[WARN] {employee_id}: LLM output not parseable — raw={raw[:300]!r}",
                file=sys.stderr,
            )
        return parsed

    # ── Generate one recommendation ───────────────────────────────────────────
    def generate(self, row: dict) -> dict:
        if self.llm is None or self._chain is None:
            print(
                f"[INFO] {row.get('employee_id')}: No LLM connected — using default.",
                file=sys.stderr,
            )
            return dict(DEFAULT_REC)

        vars_dict   = self._build_vars(row)
        employee_id = row.get("employee_id", "UNKNOWN")

        t0 = time.time()
        print(f"[LLM] {employee_id}: calling {_llm_type(self.llm)}…", file=sys.stderr)

        parsed = self._call_llm(vars_dict, employee_id)

        elapsed = time.time() - t0
        if parsed is not None:
            print(f"[LLM] {employee_id}: ✓ got response in {elapsed:.1f}s", file=sys.stderr)
            return parsed

        print(
            f"[LLM] {employee_id}: ✗ using default after {elapsed:.1f}s",
            file=sys.stderr,
        )
        return dict(DEFAULT_REC)

    # ── Batch generation ──────────────────────────────────────────────────────
    def generate_batch(self, prediction_results: list) -> list:
        """
        GREEN employees are skipped (no LLM call needed).

        For Ollama (local, single-threaded): calls are SEQUENTIAL.
          Reason: Ollama can only run one inference at a time. Parallel threads
          pile up in Ollama's queue and the later ones timeout waiting, causing
          silent fallbacks. Sequential is slower wall-clock but every employee
          actually gets a real LLM response.

        For API LLMs (Anthropic, OpenAI): calls run in PARALLEL (up to
          API_MAX_WORKERS) because the API scales horizontally.
        """
        outputs    = [None] * len(prediction_results)
        to_process = []

        for i, row in enumerate(prediction_results):
            zone = row.get("prediction", row.get("risk_zone", "GREEN"))
            if zone in ("RED", "AMBER"):
                to_process.append((i, row))
            else:
                out = dict(row)
                out["recommendation"] = None
                out["rec_skipped"]    = True
                outputs[i] = out

        if not to_process:
            return outputs

        total    = len(to_process)
        use_ollama = self.llm is not None and _is_ollama(self.llm)

        print(
            f"[LLM] Batch: {total} employees to process "
            f"({'sequential/Ollama' if use_ollama else f'parallel/{API_MAX_WORKERS} workers'})",
            file=sys.stderr,
        )

        if use_ollama:
            # ── Sequential — give Ollama breathing room ────────────────────
            for n, (idx, row) in enumerate(to_process, 1):
                print(
                    f"[LLM] Progress: {n}/{total} — {row.get('employee_id')}",
                    file=sys.stderr,
                )
                out = dict(row)
                out["recommendation"] = self.generate(row)
                out["rec_skipped"]    = False
                outputs[idx] = out

        else:
            # ── Parallel — safe for API-based LLMs ────────────────────────
            max_w = min(API_MAX_WORKERS, total)

            def _process(args):
                idx, row = args
                out = dict(row)
                out["recommendation"] = self.generate(row)
                out["rec_skipped"]    = False
                return idx, out

            with concurrent.futures.ThreadPoolExecutor(max_workers=max_w) as pool:
                for idx, result in pool.map(_process, to_process):
                    outputs[idx] = result

        return outputs
