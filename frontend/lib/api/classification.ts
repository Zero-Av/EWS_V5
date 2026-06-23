/**
 * lib/api/classification.ts
 * Frontend paths:  /predict  |  /evaluate  |  /workforce
 * Backend routes:  POST /classify  |  GET /classifications
 */

import { BASE, authHeaders, handleResponse } from "./_core"

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClassifyResult {
  status:                    string
  employees_classified:      number
  saved:                     number
  alerts_created:            number
  recommendations_generated: number
  distribution: { GREEN: number; AMBER: number; RED: number }
  results:       any[]
}

// ── Functions ────────────────────────────────────────────────────────────────

export async function classifyEmployees(
  generateRecommendations = false,
): Promise<ClassifyResult> {
  const q   = generateRecommendations ? "?generate_recommendations=true" : ""
  const res = await fetch(`${BASE}/classify${q}`, {
    method:  "POST",
    headers: authHeaders(),
  })
  return handleResponse<ClassifyResult>(res)
}

export async function getClassifications(employeeId?: string): Promise<{
  classifications: any[]
}> {
  const q   = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}` : ""
  const res = await fetch(`${BASE}/classifications${q}`, {
    headers: authHeaders(),
  })
  return handleResponse<{ classifications: any[] }>(res)
}
