// lib/api.ts — EWS v5 API client
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function token(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("ews_token")
}

function authHeaders(): Record<string, string> {
  const t = token()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || "Request failed")
  }
  return res.json()
}

// ── Auth ──
export interface TokenResponse {
  access_token: string
  token_type:   string
  role:         "admin" | "manager"
  full_name:    string
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams({ username, password })
  const res = await fetch(`${BASE}/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  return handleResponse<TokenResponse>(res)
}

export async function getMe() {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeaders() })
  return handleResponse<{ username: string; full_name: string; role: string }>(res)
}

// ── Users ──
export interface UserRecord {
  username: string
  full_name: string
  role: string
  is_active: boolean
}

export async function listUsers() {
  const res = await fetch(`${BASE}/users`, { headers: authHeaders() })
  return handleResponse<{ users: UserRecord[] }>(res)
}

export async function addUser(body: { username: string; password: string; full_name: string; role: string }) {
  const res = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return handleResponse<{ status: string; username: string }>(res)
}

export async function deleteUser(username: string) {
  const res = await fetch(`${BASE}/users/${username}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  return handleResponse<{ status: string }>(res)
}

// ── LLM ──
export async function connectLLM(provider: string) {
  const res = await fetch(`${BASE}/llm/connect`, {
    method:  "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body:    JSON.stringify({ provider }),
  })
  return handleResponse<{ status: string; provider: string }>(res)
}

export async function getLLMStatus() {
  const res = await fetch(`${BASE}/llm/status`, { headers: authHeaders() })
  return handleResponse<{ connected: boolean }>(res)
}

// ── Survey Ingestion & Summarization ──
export async function uploadSurveys(file: File, runTopics = true) {
  const fd = new FormData()
  fd.append("file", file)
  fd.append("run_topics", String(runTopics))
  const res = await fetch(`${BASE}/surveys/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  })
  return handleResponse<{
    status: string
    surveys_ingested: number
    sentiment_summary: { avg_score: number; negative: number; neutral: number; positive: number }
    topics_analyzed: boolean
  }>(res)
}

export async function getSurveySummary() {
  const res = await fetch(`${BASE}/surveys/summarize`, {
    method: "POST",
    headers: authHeaders(),
  })
  return handleResponse<{ summary: string; comment_count?: number }>(res)
}

// ── Classifications ──
export async function classifyEmployees() {
  const res = await fetch(`${BASE}/classify`, {
    method: "POST",
    headers: authHeaders(),
  })
  return handleResponse<{
    status: string
    employees_classified: number
    saved: number
    alerts_created: number
    distribution: { GREEN: number; AMBER: number; RED: number }
    results: any[]
  }>(res)
}

export async function getClassifications() {
  const res = await fetch(`${BASE}/classifications`, { headers: authHeaders() })
  return handleResponse<{ classifications: any[] }>(res)
}

// ── Training ──
export async function trainClassifier(file: File) {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${BASE}/train`, {
    method: "POST",
    headers: authHeaders(),
    body: fd,
  })
  return handleResponse<{
    status: string
    metadata: {
      trained_at: string
      samples: number
      features: number
      accuracy: number
      classification_report: any
      top_features: Record<string, number>
    }
  }>(res)
}

// ── Employee History & Sentiment ──
export async function getEmployeeSentiment(employeeId: string) {
  const res = await fetch(`${BASE}/employees/${employeeId}/sentiment`, { headers: authHeaders() })
  return handleResponse<{
    employee_id: string
    survey_count: number
    history: any[]
    topic_breakdown: Record<string, number>
    current_sentiment: number
    sentiment_velocity: number
    avg_sentiment: number
  }>(res)
}

// ── Dashboard KPIs ──
export async function getAnalyticsDashboard() {
  const res = await fetch(`${BASE}/analytics/dashboard`, { headers: authHeaders() })
  return handleResponse<{
    total_employees: number
    zone_distribution: Record<string, number>
    pct_red: number
    pct_amber: number
    pct_green: number
    avg_sentiment: number
    survey_coverage: number
  }>(res)
}

// ── Alerts ──
export async function getAlerts(params?: { acknowledged?: boolean; limit?: number }) {
  const q = new URLSearchParams()
  if (params?.acknowledged !== undefined) q.set("acknowledged", String(params.acknowledged ? 1 : 0))
  if (params?.limit) q.set("limit", String(params.limit))
  const res = await fetch(`${BASE}/analytics/alerts?${q}`, { headers: authHeaders() })
  return handleResponse<{ alerts: any[] }>(res)
}

export async function acknowledgeAlert(alertId: number) {
  const res = await fetch(`${BASE}/analytics/alerts/${alertId}/acknowledge`, {
    method: "PATCH",
    headers: authHeaders(),
  })
  return handleResponse<{ status: string }>(res)
}

// ── Model Info ──
export async function getModelInfo() {
  const res = await fetch(`${BASE}/model/info`, { headers: authHeaders() })
  return handleResponse<{
    has_model: boolean
    metadata?: {
      trained_at: string
      samples: number
      features: number
      accuracy: number
      top_features: Record<string, number>
    }
  }>(res)
}
