/**
 * lib/api/surveys.ts
 * Frontend paths:  /train  (upload step)  |  /insights
 * Backend routes:  POST /surveys/upload  |  POST /surveys/summarize
 */

import { BASE, authHeaders, handleResponse } from "./_core"

// ── Types ────────────────────────────────────────────────────────────────────

export interface SurveyUploadResult {
  status:           string
  surveys_ingested: number
  sentiment_summary: {
    avg_score: number
    negative:  number
    neutral:   number
    positive:  number
  }
  topics_analyzed: boolean
}

// ── Functions ────────────────────────────────────────────────────────────────

export async function uploadSurveys(
  file:      File,
  runTopics = true,
): Promise<SurveyUploadResult> {
  const fd = new FormData()
  fd.append("file",       file)
  fd.append("run_topics", String(runTopics))
  const res = await fetch(`${BASE}/surveys/upload`, {
    method:  "POST",
    headers: authHeaders(),
    body:    fd,
  })
  return handleResponse<SurveyUploadResult>(res)
}

export async function getSurveySummary(): Promise<{
  summary:       string
  comment_count?: number
}> {
  const res = await fetch(`${BASE}/surveys/summarize`, {
    method:  "POST",
    headers: authHeaders(),
  })
  return handleResponse<{ summary: string; comment_count?: number }>(res)
}
