/**
 * lib/api/llm.ts
 * Frontend paths:  /settings  (LLM tab)  |  AI assistant widget (global)
 * Backend routes:  POST /llm/connect  |  GET /llm/status  |  POST /assistant/ask
 */

import { BASE, authHeaders, handleResponse } from "./_core"

// ── Functions ────────────────────────────────────────────────────────────────

export async function connectLLM(
  provider: string,
): Promise<{ status: string; provider: string }> {
  const res = await fetch(`${BASE}/llm/connect`, {
    method:  "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body:    JSON.stringify({ provider }),
  })
  return handleResponse<{ status: string; provider: string }>(res)
}

export async function getLLMStatus(): Promise<{ connected: boolean }> {
  const res = await fetch(`${BASE}/llm/status`, { headers: authHeaders() })
  return handleResponse<{ connected: boolean }>(res)
}

export async function askAssistant(
  message: string,
): Promise<{ answer: string }> {
  const res = await fetch(`${BASE}/assistant/ask`, {
    method:  "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body:    JSON.stringify({ message }),
  })
  return handleResponse<{ answer: string }>(res)
}
