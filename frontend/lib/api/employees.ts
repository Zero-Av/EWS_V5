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
