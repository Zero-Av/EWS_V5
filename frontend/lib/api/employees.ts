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

export type RagZone = "RED" | "AMBER" | "GREEN"

export type EmployeeStatus = "Active" | "On Leave" | "Notice Period"

export const PRIMARY_CONCERNS = [
  "Training", "Work Content", "Promotion", "Iris Culture", "RO",
  "Career Progression", "Others", "Work Life Balance",
  "Reward and Recognition", "Offboarding", "Health & Wellness",
  "Compensation", "Policies", "Performance", "Team",
] as const

export const SECONDARY_REASONS = [
  "Compensation", "Iris Culture", "Reward and Recognition",
  "Work Life Balance", "Promotion", "Career Progression",
  "Work Content", "Performance", "Team", "RO",
  "Health & Wellness", "Policies", "Others", "Training",
] as const

export const HRBP_CONNECT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  "Not Connected",
] as const

/** Values captured in the HRBP assessment form — aligned to the EWS data schema. */
export interface EmployeeProfileData {
  // Performance
  rating?:              number | null   // Rating 2025-2026 (scale 1.0–5.0)

  // Status & engagement
  employee_status?:     EmployeeStatus | string | null
  hrbp_connect_month?:  string | null   // Month abbreviation or "Not Connected"
  ageing?:              number | null   // Days in current RAG status

  // RAG classification
  hrbp_risk_zone?:      RagZone | null  // Current RAG status (HRBP-assigned)
  previous_rag?:        RagZone | null  // Prior RAG status

  // Concern tracking
  previous_concern?:    string | null
  primary_concern?:     string | null
  secondary_reason?:    string | null

  // Free-form notes
  score?:               number | null   // Engagement score 0–10
  comments?:            string | null
}

export interface EmployeeProfile extends EmployeeProfileData {
  employee_id?: string
  updated_by?:  string
  updated_at?:  string
}

export interface ManualClassifyResult {
  employee_id:              string
  risk_zone:                RagZone
  risk_score:               number
  probabilities:            Record<string, number>
  top_factors:              { feature: string; shap_value: number; actual_value: number }[]
  source:                   string
  sentiment_score:          number
  sentiment_label:          string
  history_length:           number
  previous_zone:            RagZone | null
  zone_changed:             boolean
  interventions_cancelled:  number
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
