/**
 * lib/api/analytics.ts
 * Frontend paths:  /dashboard  |  /workforce  |  /insights  |  /alerts
 * Backend routes:  GET   /analytics/dashboard
 *                  GET   /analytics/teams
 *                  GET   /analytics/topics
 *                  GET   /analytics/alerts
 *                  PATCH /analytics/alerts/{id}/acknowledge
 */

import { BASE, authHeaders, handleResponse } from "./_core"

// ── Types ────────────────────────────────────────────────────────────────────

export interface TeamTopic {
  topic:      string
  sentiment:  number
  count:      number
}

export interface TeamRecord {
  department:     string
  headcount:      number
  health:         number | null
  red:            number
  amber:          number
  green:          number
  unclassified:   number
  avg_sentiment:  number | null
  enps:           number | null
  topics:         TeamTopic[]
  recommendations: string[]
}

// ── Functions ────────────────────────────────────────────────────────────────

export async function getAnalyticsDashboard(): Promise<Record<string, any>> {
  const res = await fetch(`${BASE}/analytics/dashboard`, { headers: authHeaders() })
  return handleResponse<Record<string, any>>(res)
}

export async function getTeams(): Promise<{ teams: TeamRecord[] }> {
  const res = await fetch(`${BASE}/analytics/teams`, { headers: authHeaders() })
  return handleResponse<{ teams: TeamRecord[] }>(res)
}

export async function getTopics(department?: string): Promise<{
  topics:         TeamTopic[]
  monthly_trend:  Record<string, string | number>[]
}> {
  const q   = department ? `?department=${encodeURIComponent(department)}` : ""
  const res = await fetch(`${BASE}/analytics/topics${q}`, { headers: authHeaders() })
  return handleResponse<{
    topics:         TeamTopic[]
    monthly_trend:  Record<string, string | number>[]
  }>(res)
}

export async function getAlerts(params?: {
  acknowledged?: boolean
  limit?:        number
}): Promise<{ alerts: any[] }> {
  const q = new URLSearchParams()
  if (params?.acknowledged !== undefined)
    q.set("acknowledged", String(params.acknowledged ? 1 : 0))
  if (params?.limit)
    q.set("limit", String(params.limit))
  const res = await fetch(`${BASE}/analytics/alerts?${q}`, { headers: authHeaders() })
  return handleResponse<{ alerts: any[] }>(res)
}

export async function acknowledgeAlert(
  alertId: number,
): Promise<{ status: string }> {
  const res = await fetch(`${BASE}/analytics/alerts/${alertId}/acknowledge`, {
    method:  "PATCH",
    headers: authHeaders(),
  })
  return handleResponse<{ status: string }>(res)
}
