/**
 * lib/api/employees.ts
 * Frontend paths:  /employees  |  /workforce  |  /trends
 * Backend routes:  GET  /employees/{id}/sentiment
 *                  POST /employees/{id}/recommendations
 */

import { BASE, authHeaders, handleResponse } from "./_core"
import type { Recommendation } from "./interventions"

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeSentiment {
  employee_id:        string
  survey_count:       number
  history:            any[]
  topic_breakdown:    Record<string, number>
  current_sentiment:  number
  sentiment_velocity: number
  avg_sentiment:      number
}

/** Values in the HRBP assessment form — all metrics 1-10, score 0-100. */
export interface EmployeeProfileData {
  happiness_score?:    number | null
  excitement_level?:   number | null
  stress_level?:       number | null
  workload_level?:     number | null
  work_life_balance?:  number | null
  manager_support?:    number | null
  job_satisfaction?:   number | null
  productivity?:       number | null
  team_collaboration?: number | null
  career_growth?:      number | null
  absenteeism?:        number | null
  score?:              number | null
  comments?:           string | null
  hrbp_risk_zone?:     "RED" | "AMBER" | "GREEN" | null
}

export interface EmployeeProfile extends EmployeeProfileData {
  employee_id?: string
  updated_by?:  string
  updated_at?:  string
}

export interface ManualClassifyResult {
  employee_id:   string
  risk_zone:     "RED" | "AMBER" | "GREEN"
  risk_score:    number
  probabilities: Record<string, number>
  top_factors:   { feature: string; shap_value: number; actual_value: number }[]
  source:        string
}

// ── Functions ────────────────────────────────────────────────────────────────

export async function getEmployeeSentiment(
  employeeId: string,
): Promise<EmployeeSentiment> {
  const res = await fetch(
    `${BASE}/employees/${encodeURIComponent(employeeId)}/sentiment`,
    { headers: authHeaders() },
  )
  return handleResponse<EmployeeSentiment>(res)
}

export async function generateEmployeeRecommendation(
  employeeId:      string,
  assignToManager = true,
): Promise<
  { status: string; intervention_id: number; employee_id: string; assigned_to: string | null } &
  Recommendation
> {
  const res = await fetch(
    `${BASE}/employees/${encodeURIComponent(employeeId)}/recommendations` +
    `?assign_to_manager=${assignToManager}`,
    { method: "POST", headers: authHeaders() },
  )
  return handleResponse<
    { status: string; intervention_id: number; employee_id: string; assigned_to: string | null } &
    Recommendation
  >(res)
}

export async function getEmployeeProfile(
  employeeId: string,
): Promise<EmployeeProfile> {
  const res = await fetch(
    `${BASE}/employees/${encodeURIComponent(employeeId)}/profile`,
    { headers: authHeaders() },
  )
  return handleResponse<EmployeeProfile>(res)
}

export async function saveEmployeeProfile(
  employeeId: string,
  data: EmployeeProfileData,
): Promise<{ status: string; employee_id: string }> {
  const res = await fetch(
    `${BASE}/employees/${encodeURIComponent(employeeId)}/profile`,
    {
      method:  "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    },
  )
  return handleResponse<{ status: string; employee_id: string }>(res)
}

export async function classifyEmployeeManual(
  employeeId: string,
  data: EmployeeProfileData,
): Promise<ManualClassifyResult> {
  const res = await fetch(
    `${BASE}/employees/${encodeURIComponent(employeeId)}/classify-manual`,
    {
      method:  "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    },
  )
  return handleResponse<ManualClassifyResult>(res)
}
