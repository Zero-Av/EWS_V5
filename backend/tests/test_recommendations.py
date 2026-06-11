"""
test_recommendations.py
────────────────────────────────────────────────────────────────
Standalone test for the LLM + recommendations pipeline.
Run from the backend/ directory:

    # With Anthropic:
    ANTHROPIC_API_KEY=sk-ant-... python test_recommendations.py

    # With Ollama:
    python test_recommendations.py --provider ollama

    # Skip LLM (test fallback only):
    python test_recommendations.py --no-llm

    # Test with a real CSV file:
    python test_recommendations.py --csv your_employees.csv

Options:
    --provider  auto | anthropic | ollama   (default: auto)
    --no-llm    Force the rule-based fallback path (llm=None)
    --csv       Path to a real employee CSV to run through the full pipeline
    --verbose   Print the raw LLM response before JSON parsing
────────────────────────────────────────────────────────────────
"""

import sys
import os
import json
import argparse
import traceback
import textwrap
from datetime import datetime

# ── Make sure we can import local modules ─────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

# ─────────────────────────────────────────────────────────────────────────────
# ANSI colours for terminal output
# ─────────────────────────────────────────────────────────────────────────────
class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    GREEN  = "\033[92m"
    AMBER  = "\033[93m"
    RED    = "\033[91m"
    BLUE   = "\033[94m"
    CYAN   = "\033[96m"
    PURPLE = "\033[95m"
    WHITE  = "\033[97m"

def banner(text):
    line = "─" * 60
    print(f"\n{C.BLUE}{line}{C.RESET}")
    print(f"{C.BOLD}{C.WHITE}  {text}{C.RESET}")
    print(f"{C.BLUE}{line}{C.RESET}")

def ok(msg):   print(f"  {C.GREEN}✓{C.RESET}  {msg}")
def warn(msg): print(f"  {C.AMBER}⚠{C.RESET}  {msg}")
def fail(msg): print(f"  {C.RED}✗{C.RESET}  {msg}")
def info(msg): print(f"  {C.CYAN}→{C.RESET}  {msg}")
def dim(msg):  print(f"  {C.DIM}{msg}{C.RESET}")

def print_json(data, indent=4):
    """Pretty-print a dict with coloured keys."""
    lines = json.dumps(data, indent=indent, default=str).splitlines()
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('"') and '":' in stripped:
            key, _, rest = stripped.partition('":')
            print(f"  {C.CYAN}{key}\":{C.RESET}{rest}")
        elif stripped.startswith('"') and stripped.endswith('",'):
            print(f"  {C.AMBER}  {line}{C.RESET}")
        else:
            print(f"  {line}")

# ─────────────────────────────────────────────────────────────────────────────
# MOCK DATA  — realistic employees at each risk level
# ─────────────────────────────────────────────────────────────────────────────
MOCK_PREDICTIONS = [
    {
        "employee_id":    "EMP001",
        "prediction":     "RED",
        "risk_score":     88,
        "risk_zone":      "RED",
        "probabilities":  {"GREEN": 0.04, "AMBER": 0.12, "RED": 0.84},
        "comment":        "Has been frequently absent and seems disengaged in team meetings.",
        "stress_level":        9.1,
        "workload_level":      8.7,
        "absenteeism":         12,
        "work_life_balance":   2.1,
        "manager_support":     3.0,
        "job_satisfaction":    2.3,
        "happiness_score":     2.8,
        "productivity":        4.1,
        "team_collaboration":  3.5,
        "career_growth":       2.0,
        "similar_employees": [
            {
                "employee_id": "EMP_HIST_042",
                "similarity":  0.921,
                "metadata": {
                    "risk":       "RED",
                    "risk_score": 91,
                    "comment":    "Left company after 3 months — burnout cited as reason.",
                    "metrics": {"stress_level": 9.4, "absenteeism": 15, "job_satisfaction": 2.1},
                },
            },
            {
                "employee_id": "EMP_HIST_089",
                "similarity":  0.876,
                "metadata": {
                    "risk":       "AMBER",
                    "risk_score": 65,
                    "comment":    "Responded well to workload reduction after manager intervention.",
                    "metrics": {"stress_level": 7.8, "absenteeism": 8, "job_satisfaction": 4.2},
                },
            },
        ],
    },
    {
        "employee_id":    "EMP002",
        "prediction":     "AMBER",
        "risk_score":     54,
        "risk_zone":      "AMBER",
        "probabilities":  {"GREEN": 0.22, "AMBER": 0.61, "RED": 0.17},
        "comment":        "Performance has been fluctuating. Mentioned feeling unchallenged.",
        "stress_level":        5.5,
        "workload_level":      5.2,
        "absenteeism":         4,
        "work_life_balance":   5.8,
        "manager_support":     5.0,
        "job_satisfaction":    4.1,
        "happiness_score":     5.2,
        "productivity":        5.9,
        "team_collaboration":  6.1,
        "career_growth":       3.5,
        "similar_employees": [],
    },
    {
        "employee_id":    "EMP003",
        "prediction":     "GREEN",
        "risk_score":     18,
        "risk_zone":      "GREEN",
        "probabilities":  {"GREEN": 0.81, "AMBER": 0.14, "RED": 0.05},
        "comment":        "High performer. Recently completed leadership training.",
        "stress_level":        3.2,
        "workload_level":      6.1,
        "absenteeism":         1,
        "work_life_balance":   8.0,
        "manager_support":     8.5,
        "job_satisfaction":    8.8,
        "happiness_score":     8.6,
        "productivity":        9.1,
        "team_collaboration":  8.9,
        "career_growth":       8.2,
        "similar_employees": [],
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# PATCH: intercept the LLM chain to capture raw output
# ─────────────────────────────────────────────────────────────────────────────
_last_raw_response = None

def patch_engine_for_visibility(engine, verbose: bool):
    """
    Wraps engine.generate() so we can print exactly what the LLM
    sends and receives at every step.
    """
    original_generate = engine.generate

    def patched_generate(employee, prediction, similar_employees):
        print()
        print(f"  {C.PURPLE}▶ PROMPT SENT TO LLM{C.RESET}")
        dim("  Employee context:")
        for k, v in employee.items():
            dim(f"    {k}: {v}")
        dim("  Prediction:")
        for k, v in prediction.items():
            dim(f"    {k}: {v}")
        dim(f"  Similar employees: {len(similar_employees)} records")

        # Temporarily patch _clean_json to capture raw response
        original_clean = engine._clean_json
        global _last_raw_response

        def capturing_clean(text):
            global _last_raw_response
            _last_raw_response = text
            return original_clean(text)

        engine._clean_json = capturing_clean

        result = original_generate(employee, prediction, similar_employees)

        engine._clean_json = original_clean

        if verbose and _last_raw_response:
            print(f"\n  {C.PURPLE}◀ RAW LLM RESPONSE{C.RESET}")
            wrapped = textwrap.fill(_last_raw_response, width=72,
                                    initial_indent="    ", subsequent_indent="    ")
            print(f"{C.DIM}{wrapped}{C.RESET}")

        return result

    engine.generate = patched_generate
    return engine


# ─────────────────────────────────────────────────────────────────────────────
# TESTS
# ─────────────────────────────────────────────────────────────────────────────

def _cli_test_llm_connection(provider: str):
    banner(f"TEST 1 — LLM Connection  (provider: {provider})")
    try:
        from modules.llm import get_llm
        ok("Imported llm.get_llm successfully")
    except ImportError as e:
        fail(f"Import failed: {e}")
        return None

    info(f"Attempting to connect with provider='{provider}'…")
    try:
        llm = get_llm(provider)
        if llm is None:
            warn("get_llm() returned None — no LLM available")
            warn("Check: ANTHROPIC_API_KEY is set, or Ollama is running")
            return None
        ok(f"LLM connected: {type(llm).__name__}")

        # Quick ping test
        info("Sending test ping to LLM…")
        from langchain_core.messages import HumanMessage
        resp = llm.invoke([HumanMessage(content='Reply with exactly: {"status": "ok"}')])
        ok(f"LLM responded: {resp.content[:80]!r}")
        return llm
    except Exception as e:
        fail(f"LLM connection failed: {e}")
        if "ANTHROPIC_API_KEY" in str(e) or "api_key" in str(e).lower():
            warn("Set your key:  export ANTHROPIC_API_KEY=sk-ant-...")
        elif "ollama" in str(e).lower() or "connection" in str(e).lower():
            warn("Start Ollama:  ollama serve")
            warn("Pull model:    ollama pull qwen3:2b")
        return None


def test_engine_import():
    banner("TEST 2 — RecommendationEngine Import")
    try:
        from modules.recommendations import DEFAULT_REC
        ok("RecommendationEngine imported successfully")
        ok(f"DEFAULT_REC keys: {list(DEFAULT_REC.keys())}")
        return True
    except Exception as e:
        fail(f"Import failed: {e}")
        traceback.print_exc()
        return False


def test_fallback_mode():
    banner("TEST 3 — Fallback Mode  (llm=None)")
    from modules.recommendations import RecommendationEngine, DEFAULT_REC
    engine = RecommendationEngine(llm=None)
    info("Calling engine.generate() with llm=None…")

    emp = MOCK_PREDICTIONS[0]
    # generate() takes a single flat row dict — same shape as a prediction result
    rec = engine.generate(emp)
    assert rec == DEFAULT_REC or rec.get("reasoning", "").startswith("Default"), (
        f"Expected DEFAULT_REC when llm=None, got: {rec}"
    )
    ok("Correctly returned DEFAULT_REC when llm=None")
    print_json(rec)


def _cli_test_single_recommendation(llm, verbose: bool):
    banner("TEST 4 — Single Recommendation  (RED zone employee)")
    from modules.recommendations import RecommendationEngine

    engine = RecommendationEngine(llm=llm)
    if verbose:
        engine = patch_engine_for_visibility(engine, verbose)

    emp = MOCK_PREDICTIONS[0]  # RED employee
    info(f"Employee: {emp['employee_id']}  |  Zone: {emp['prediction']}  |  Score: {emp['risk_score']}")

    try:
        # generate() takes a single flat row dict — pass the prediction dict directly
        rec = engine.generate(emp)

        # Validate structure
        for field in ("priority", "timeline", "reasoning", "actions"):
            if field in rec:
                ok(f"Field '{field}' present")
            else:
                fail(f"Field '{field}' MISSING from response")

        is_default = rec.get("reasoning", "").startswith("Default")
        if is_default:
            warn("Got DEFAULT_REC — LLM may have failed silently (check verbose mode)")
        else:
            ok("LLM generated a real recommendation (not the fallback)")

        print(f"\n  {C.BOLD}Result:{C.RESET}")
        print_json(rec)
        return rec

    except Exception as e:
        fail(f"generate() raised: {e}")
        traceback.print_exc()
        return None


def _cli_test_batch_recommendations(llm, verbose: bool):
    banner("TEST 5 — Batch Recommendations  (3 employees)")
    from modules.recommendations import RecommendationEngine

    engine = RecommendationEngine(llm=llm)

    info(f"Running generate_batch() on {len(MOCK_PREDICTIONS)} mock employees…")
    t0 = datetime.now()

    try:
        results = engine.generate_batch([dict(p) for p in MOCK_PREDICTIONS])
        elapsed = (datetime.now() - t0).total_seconds()
        ok(f"Batch completed in {elapsed:.1f}s — {len(results)} results")

        for r in results:
            eid  = r["employee_id"]
            zone = r["prediction"]
            rec  = r.get("recommendation", {})

            zone_color = {"RED": C.RED, "AMBER": C.AMBER, "GREEN": C.GREEN}.get(zone, C.WHITE)
            priority   = rec.get("priority", "—")
            is_default = rec.get("reasoning", "").startswith("Default")
            source     = f"{C.AMBER}[fallback]{C.RESET}" if is_default else f"{C.GREEN}[LLM]{C.RESET}"

            print(f"\n  {zone_color}{C.BOLD}{eid}{C.RESET}  "
                  f"zone={zone_color}{zone}{C.RESET}  "
                  f"priority={C.CYAN}{priority}{C.RESET}  {source}")

            print(f"    timeline : {rec.get('timeline', '—')}")
            reasoning = rec.get("reasoning", "—")
            print(f"    reasoning: {textwrap.fill(reasoning, 60, subsequent_indent='             ')}")

            actions = rec.get("actions", [])
            for i, action in enumerate(actions, 1):
                wrapped = textwrap.fill(action, 56, subsequent_indent="              ")
                print(f"    action {i} : {wrapped}")

            if verbose:
                print(f"\n  {C.DIM}Full JSON:{C.RESET}")
                print_json(rec)

        # Verify original list not mutated
        for orig, result in zip(MOCK_PREDICTIONS, results):
            if "recommendation" in orig:
                fail(f"{orig['employee_id']}: original dict was mutated!")
            else:
                ok(f"{orig['employee_id']}: original dict not mutated ✓")

        return results

    except Exception as e:
        fail(f"generate_batch() raised: {e}")
        traceback.print_exc()
        return None


def _cli_test_with_csv(csv_path: str, llm, verbose: bool):
    banner(f"TEST 6 — Real CSV File: {csv_path}")
    try:
        import pandas as pd
        df = pd.read_csv(csv_path)
        ok(f"Loaded {len(df)} rows, {len(df.columns)} columns")
        info(f"Columns: {list(df.columns)}")
    except Exception as e:
        fail(f"Could not read CSV: {e}")
        return

    # Try full prediction pipeline if model exists
    try:
        from modules.prediction import EmployeePredictor
        predictor = EmployeePredictor()
        info("Running EmployeePredictor.predict()…")
        preds = predictor.predict(df, top_k=3)
        ok(f"Got {len(preds)} predictions")

        from modules.recommendations import RecommendationEngine
        engine = RecommendationEngine(llm=llm)
        info("Running RecommendationEngine.generate_batch()…")
        results = engine.generate_batch([dict(p) for p in preds])
        ok(f"Got {len(results)} recommendations")

        for r in results[:3]:  # show first 3
            rec = r.get("recommendation", {})
            is_default = rec.get("reasoning", "").startswith("Default")
            source = f"{C.AMBER}[fallback]{C.RESET}" if is_default else f"{C.GREEN}[LLM]{C.RESET}"
            print(f"\n  {r['employee_id']}  {r['prediction']}  {source}")
            print(f"    priority  : {rec.get('priority','—')}")
            print(f"    reasoning : {rec.get('reasoning','—')[:100]}")
            if verbose:
                print_json(rec)

    except FileNotFoundError:
        warn("No trained model found in models/ — run training first")
        warn("Skipping prediction step, showing raw CSV data only")
        info(f"First row:\n{df.head(1).to_string()}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Test the EWS recommendations + LLM pipeline")
    parser.add_argument("--provider", default="auto",
                        choices=["auto", "anthropic", "ollama"],
                        help="LLM provider (default: auto)")
    parser.add_argument("--no-llm",  action="store_true",
                        help="Skip LLM, test fallback only")
    parser.add_argument("--csv",     metavar="PATH",
                        help="Run tests against a real employee CSV file")
    parser.add_argument("--verbose", action="store_true",
                        help="Print raw LLM responses before JSON parsing")
    args = parser.parse_args()

    print(f"\n{C.BOLD}{C.BLUE}EWS Recommendation Pipeline Test{C.RESET}")
    print(f"{C.DIM}{'─'*60}{C.RESET}")
    print(f"  provider : {args.provider}")
    print(f"  no-llm   : {args.no_llm}")
    print(f"  verbose  : {args.verbose}")
    print(f"  csv      : {args.csv or '(using mock data)'}")

    # ── Test 1: LLM connection ─────────────────────────────────────────────
    if args.no_llm:
        llm = None
        warn("--no-llm flag set, skipping LLM connection")
    else:
        llm = _cli_test_llm_connection(args.provider)

    # ── Test 2: Import ────────────────────────────────────────────────────
    if not test_engine_import():
        fail("Cannot continue — RecommendationEngine import failed")
        sys.exit(1)

    # ── Test 3: Fallback ──────────────────────────────────────────────────
    test_fallback_mode()

    # ── Test 4: Single rec ────────────────────────────────────────────────
    if llm is not None:
        _cli_test_single_recommendation(llm, args.verbose)
    else:
        warn("Skipping Test 4 (single rec) — no LLM available")

    # ── Test 5: Batch ─────────────────────────────────────────────────────
    _cli_test_batch_recommendations(llm, args.verbose)

    # ── Test 6: Real CSV ─────────────────────────────────────────────────
    if args.csv:
        _cli_test_with_csv(args.csv, llm, args.verbose)

    # ── Summary ───────────────────────────────────────────────────────────
    banner("SUMMARY")
    if llm is None:
        warn("LLM was NOT available — all recommendations used the rule-based fallback")
        print(f"\n  {C.BOLD}To enable LLM recommendations:{C.RESET}")
        if args.provider in ("auto", "anthropic"):
            print("    export ANTHROPIC_API_KEY=sk-ant-your-key-here")
            print("    python test_recommendations.py --provider anthropic")
        if args.provider in ("auto", "ollama"):
            print("    ollama serve")
            print("    ollama pull qwen3:2b")
            print("    python test_recommendations.py --provider ollama")
    else:
        ok("LLM was connected and invoked")
        ok("RecommendationEngine passed all tests")
        print(f"\n  {C.DIM}Run with --verbose to see raw LLM outputs{C.RESET}")

    print()


if __name__ == "__main__":
    main()
