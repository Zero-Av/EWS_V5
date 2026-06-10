// lib/api.ts — EWS v3
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

// ── Auth ─────────────────────────────────────────────────────────────────────
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

// ── LLM ─────────────────────────────────────────────────────────────────────
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

// ── Dashboard ────────────────────────────────────────────────────────────────
export async function getDashboard() {
  const res = await fetch(`${BASE}/dashboard`, { headers: authHeaders() })
  return handleResponse<{ model_metadata: any; versions: any[]; has_model: boolean }>(res)
}

export async function getAnalyticsDashboard() {
  const res = await fetch(`${BASE}/analytics/dashboard`, { headers: authHeaders() })
  return handleResponse<any>(res)
}

export async function getTrends(months = 6) {
  const res = await fetch(`${BASE}/analytics/trends?months=${months}`, { headers: authHeaders() })
  return handleResponse<{ months: number; data: any[] }>(res)
}

export async function getDriftMetrics(limit = 30) {
  const res = await fetch(`${BASE}/analytics/drift?limit=${limit}`, { headers: authHeaders() })
  return handleResponse<{ drift_metrics: any[] }>(res)
}

export async function downloadExcelReport() {
  const res = await fetch(`${BASE}/analytics/report/excel`, { headers: authHeaders() })
  if (!res.ok) throw new Error("Failed to download report")
  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "EWS_Intelligence_Report.xlsx"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

export async function getAlerts(params?: { employee_id?: string; acknowledged?: boolean; limit?: number }) {
  const q = new URLSearchParams()
  if (params?.employee_id)             q.set("employee_id", params.employee_id)
  if (params?.acknowledged !== undefined) q.set("acknowledged", String(params.acknowledged))
  if (params?.limit)                   q.set("limit", String(params.limit))
  const res = await fetch(`${BASE}/analytics/alerts?${q}`, { headers: authHeaders() })
  return handleResponse<{ alerts: any[] }>(res)
}

export async function acknowledgeAlert(alertId: number) {
  const res = await fetch(`${BASE}/analytics/alerts/${alertId}/acknowledge`, {
    method: "PATCH", headers: authHeaders(),
  })
  return handleResponse<{ status: string }>(res)
}

// ── Phase 2: Imports ──────────────────────────────────────────────────────────
export async function importEmployees(file: File) {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${BASE}/employees/import`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{ status: string; message: string }>(res)
}

export async function ingestSurveys(file: File) {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${BASE}/surveys/ingest`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{ status: string; message: string }>(res)
}

export async function getSurveySummary() {
  const res = await fetch(`${BASE}/surveys/summarize`, { headers: authHeaders() })
  return handleResponse<{ summary: string }>(res)
}

// ── Admin: Notifications & Scheduler ──────────────────────────────────────────
export async function getNotificationStatus() {
  const res = await fetch(`${BASE}/admin/notification-status`, { headers: authHeaders() })
  return handleResponse<any>(res)
}

export async function getSchedulerStatus() {
  const res = await fetch(`${BASE}/admin/scheduler/status`, { headers: authHeaders() })
  return handleResponse<any>(res)
}

export async function triggerSnapshot() {
  const res = await fetch(`${BASE}/admin/scheduler/trigger`, {
    method: "POST", headers: authHeaders(),
  })
  return handleResponse<any>(res)
}

// ── Snapshots ────────────────────────────────────────────────────────────────
export async function saveSnapshot(file: File, snapshotDate = "") {
  const fd = new FormData()
  fd.append("file", file)
  if (snapshotDate) fd.append("snapshot_date", snapshotDate)
  const res = await fetch(`${BASE}/snapshots`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<any>(res)
}

// ── Employees ────────────────────────────────────────────────────────────────
export async function getEmployeeHistory(employeeId: string, months = 12) {
  const res = await fetch(`${BASE}/employees/${employeeId}/history?months=${months}`, { headers: authHeaders() })
  return handleResponse<{ employee_id: string; snapshots: any[] }>(res)
}

export async function getEmployeeIssues(employeeId: string, thresholdMonths = 3) {
  const res = await fetch(`${BASE}/employees/${employeeId}/issues?threshold_months=${thresholdMonths}`, { headers: authHeaders() })
  return handleResponse<{ employee_id: string; persistent_issues: any[] }>(res)
}

// ── Predict + Recommend ──────────────────────────────────────────────────────
export interface TopFactor {
  factor:           string
  label:            string
  contribution_pct: number
  direction:        string
  value?:           number
}

export interface PredictionResult {
  employee_id:        string
  prediction:         "GREEN" | "AMBER" | "RED"
  risk_score:         number
  risk_zone:          string
  attrition_prob:     number
  probabilities:      { GREEN: number; AMBER: number; RED: number }
  similar_employees:  any[]
  comment:            string
  metrics:            Record<string, number | null>
  top_factors:        TopFactor[]
  recommendation?:    {
    priority:  string
    timeline:  string
    reasoning: string
    actions:   string[]
  }
}

export async function predict(file: File, topK = 5) {
  const fd = new FormData()
  fd.append("file",  file)
  fd.append("top_k", String(topK))
  const res = await fetch(`${BASE}/predict`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{ count: number; results: PredictionResult[] }>(res)
}

export async function recommend(file: File, topK = 5) {
  const fd = new FormData()
  fd.append("file",  file)
  fd.append("top_k", String(topK))
  const res = await fetch(`${BASE}/recommend`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{
    job_id: string
    total_at_risk: number
    total_employees: number
    llm_used: boolean
    message: string
  }>(res)
}

export async function getRecommendProgress(jobId: string) {
  const res = await fetch(`${BASE}/recommend/progress/${jobId}`, { headers: authHeaders() })
  return handleResponse<{
    job_id:           string
    done:             number
    total:            number
    current_employee: string | null
    complete:         boolean
    results:          PredictionResult[] | null
    llm_used:         boolean
    error:            string | null
  }>(res)
}

// ── Interventions ─────────────────────────────────────────────────────────────
export async function listInterventions(params?: { employee_id?: string; status?: string; assigned_to?: string }) {
  const q = new URLSearchParams()
  if (params?.employee_id) q.set("employee_id", params.employee_id)
  if (params?.status)      q.set("status", params.status)
  if (params?.assigned_to) q.set("assigned_to", params.assigned_to)
  const res = await fetch(`${BASE}/interventions?${q}`, { headers: authHeaders() })
  return handleResponse<{ interventions: any[] }>(res)
}

export async function checkSLAs() {
  const res = await fetch(`${BASE}/interventions/check-slas`, {
    method: "POST", headers: authHeaders()
  })
  return handleResponse<{ status: string; escalated_count: number; message: string }>(res)
}

export async function createIntervention(body: {
  employee_id: string; assigned_to: string; priority: string;
  timeline: string; reasoning: string; actions: string[]; due_date?: string
}) {
  const res = await fetch(`${BASE}/interventions`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return handleResponse<{ status: string; intervention_id: number }>(res)
}

export async function updateInterventionStatus(id: number, status: string, note = "") {
  const res = await fetch(`${BASE}/interventions/${id}/status`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  })
  return handleResponse<{ status: string }>(res)
}

export async function addInterventionNote(id: number, note: string) {
  const res = await fetch(`${BASE}/interventions/${id}/note`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  })
  return handleResponse<{ status: string }>(res)
}

export async function recordFollowUp(id: number, body: {
  metrics_before: any; metrics_after: any; risk_before: number; risk_after: number
}) {
  const res = await fetch(`${BASE}/interventions/${id}/followup`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return handleResponse<any>(res)
}

// ── Train ────────────────────────────────────────────────────────────────────
// trainModel moved below with model_type support

export async function evaluateModel(file: File) {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${BASE}/evaluate`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{ status: string; results: any }>(res)
}

export async function retrainModel(file: File, optuna_trials = 20) {
  const fd = new FormData()
  fd.append("file",          file)
  fd.append("optuna_trials", String(optuna_trials))
  const res = await fetch(`${BASE}/retrain`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{ status: string; results: any }>(res)
}

export async function listBackups() {
  const res = await fetch(`${BASE}/retrain/backups`, { headers: authHeaders() })
  return handleResponse<{ backups: string[] }>(res)
}

export async function rollback(backup_name: string) {
  const fd = new FormData()
  fd.append("backup_name", backup_name)
  const res = await fetch(`${BASE}/retrain/rollback`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{ status: string }>(res)
}

export interface UserRecord { username: string; full_name: string; role: string }

export async function listUsers() {
  const res = await fetch(`${BASE}/users`, { headers: authHeaders() })
  return handleResponse<UserRecord[]>(res)
}

export async function addUser(body: { username: string; password: string; full_name: string; role: string }) {
  const res = await fetch(`${BASE}/users`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return handleResponse<{ status: string }>(res)
}

export async function deleteUser(username: string) {
  const res = await fetch(`${BASE}/users/${username}`, {
    method: "DELETE", headers: authHeaders(),
  })
  return handleResponse<{ status: string }>(res)
}

// ── Multi-model training ──────────────────────────────────────────────────────
// ── Ensemble training ─────────────────────────────────────────────────────────
export async function trainModel(file: File, optuna_trials = 20, _model_type = "ensemble") {
  // model_type param kept for call-site compat but always sends ensemble
  const fd = new FormData()
  fd.append("file",          file)
  fd.append("optuna_trials", String(optuna_trials))
  const res = await fetch(`${BASE}/train`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{ status: string; results: any }>(res)
}

export async function trainCompareModels(file: File, optuna_trials = 10) {
  // Uses the /train endpoint directly
  const fd = new FormData()
  fd.append("file",          file)
  fd.append("optuna_trials", String(optuna_trials))
  const res = await fetch(`${BASE}/train`, {
    method: "POST", headers: authHeaders(), body: fd,
  })
  return handleResponse<{ status: string; results: any }>(res)
}

export async function getAvailableModels() {
  const res = await fetch(`${BASE}/models/available`, { headers: authHeaders() })
  return handleResponse<{
    ensemble:    { trained: boolean; label: string }
    members:     { model_type: string; label: string; trained: boolean; shap_active: boolean }[]
    shap_member: string | null
    active:      string
  }>(res)
}

export async function switchModel(model_type: string) {
  // Changes which ensemble member backs the SHAP explainer
  const res = await fetch(`${BASE}/models/switch`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ model_type }),
  })
  return handleResponse<{ status: string; shap_member: string; note: string }>(res)
}

// ── Employee update ───────────────────────────────────────────────────────────
export async function updateEmployee(
  employeeId: string,
  updates: Record<string, number>,
  snapshotDate?: string,
) {
  const res = await fetch(`${BASE}/employees/${employeeId}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ updates, snapshot_date: snapshotDate }),
  })
  return handleResponse<{
    status: string
    employee_id: string
    snapshot: Record<string, any>
    alerts_fired: number
    alerts: any[]
  }>(res)
}
