/**
 * lib/api/interventions.ts
 * Frontend paths:  /interventions  |  /actions
 * Backend routes:  POST   /interventions/generate
 *                  GET    /interventions
 *                  GET    /interventions/{id}
 *                  PATCH  /interventions/{id}
 *                  DELETE /interventions/{id}
 */

import { BASE, authHeaders, handleResponse } from "./_core"

// ── Types ────────────────────────────────────────────────────────────────────

export interface RecommendationAction {
  title:       string
  owner:       string
  description: string
}

export interface Recommendation {
  reasoning: string
  priority:  "low" | "medium" | "high" | "critical"
  timeline:  string
  actions:   RecommendationAction[]
  source:    "llm" | "rule_based"
}

export interface Intervention extends Recommendation {
  id:           number
  employee_id:  string
  created_by:   string
  assigned_to:  string | null
  status:       string
  notes?:       string | null
  due_date?:    string | null
  created_at:   string
  updated_at?:  string
  completed_at?: string | null
}

export interface BulkRecommendationBody {
  employee_ids?:      string[]
  zones?:             string[]
  assign_to_manager?: boolean
}

export interface BulkRecommendationResult {
  status:        string
  generated:     number
  failed:        { employee_id: string; error: string }[]
  alerts_created: number
  results: ({
    intervention_id: number
    employee_id:     string
    assigned_to:     string | null
  } & Recommendation)[]
}

// ── Functions ────────────────────────────────────────────────────────────────

export async function generateBulkRecommendations(
  body: BulkRecommendationBody = {},
): Promise<BulkRecommendationResult> {
  const res = await fetch(`${BASE}/interventions/generate`, {
    method:  "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
  return handleResponse<BulkRecommendationResult>(res)
}

export async function listInterventions(params?: {
  employee_id?: string
  status?:      string
  mine?:        boolean
  limit?:       number
}): Promise<{ interventions: Intervention[] }> {
  const q = new URLSearchParams()
  if (params?.employee_id) q.set("employee_id", params.employee_id)
  if (params?.status)      q.set("status",      params.status)
  if (params?.mine)        q.set("mine",         "true")
  if (params?.limit)       q.set("limit",         String(params.limit))
  const res = await fetch(`${BASE}/interventions?${q}`, { headers: authHeaders() })
  return handleResponse<{ interventions: Intervention[] }>(res)
}

export async function getIntervention(id: number): Promise<Intervention> {
  const res = await fetch(`${BASE}/interventions/${id}`, { headers: authHeaders() })
  return handleResponse<Intervention>(res)
}

export async function updateIntervention(
  id:   number,
  body: {
    status?:      string
    notes?:       string
    assigned_to?: string
    priority?:    string
    due_date?:    string
  },
): Promise<{ status: string; intervention_id: number }> {
  const res = await fetch(`${BASE}/interventions/${id}`, {
    method:  "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
  return handleResponse<{ status: string; intervention_id: number }>(res)
}

export async function deleteIntervention(id: number): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/interventions/${id}`, {
    method:  "DELETE",
    headers: authHeaders(),
  })
  return handleResponse<{ status: string }>(res)
}
