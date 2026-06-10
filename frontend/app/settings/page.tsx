"use client"
import { useState, useEffect } from "react"
import AppShell from "@/components/AppShell"
import { connectLLM, getLLMStatus, importEmployees, ingestSurveys, getNotificationStatus, getSchedulerStatus, triggerSnapshot, checkSLAs } from "@/lib/api"
import FileDropzone from "@/components/FileDropzone"
import {
  Settings, Cpu, Database, Zap, Shield, Server,
  CheckCircle, AlertTriangle, Loader2, Info, Bell, Clock, Play,
} from "lucide-react"

const SYSTEM_INFO = [
  ["Classifier",        "XGBoost + Optuna HPO"],
  ["Embedding Model",   "all-MiniLM-L6-v2 (384d)"],
  ["Vector Store",      "FAISS (IndexFlatIP cosine)"],
  ["Database",          "SQLite WAL (snapshots, interventions, alerts)"],
  ["LLM Providers",     "Anthropic Claude · Ollama (local)"],
  ["Auth",              "JWT HS256 · 8-hour tokens"],
  ["API Framework",     "FastAPI + Uvicorn"],
  ["Frontend",          "Next.js 14 · Tailwind CSS · Recharts"],
  ["Explainability",    "SHAP TreeExplainer + rule-based fallback"],
]

const LLM_PROVIDERS = [
  { value: "auto",      label: "Auto (Ollama → Anthropic)" },
  { value: "ollama",    label: "Ollama (local — qwen2.5:3b)" },
  { value: "anthropic", label: "Anthropic (claude-sonnet-4)" },
]

const ALERT_RULES = [
  { name: "Risk Spike",              trigger: "Risk score increases ≥ 15 pts",     severity: "critical" },
  { name: "Entered RED Zone",        trigger: "Risk score crosses 65 threshold",    severity: "critical" },
  { name: "Satisfaction Drop",       trigger: "Job satisfaction drops ≥ 2 points",  severity: "high"     },
  { name: "Stress Spike",            trigger: "Stress level increases ≥ 2 points",  severity: "high"     },
  { name: "Absenteeism Spike",       trigger: "Absenteeism increases ≥ 3 days",     severity: "high"     },
  { name: "Work-Life Balance Drop",  trigger: "WLB drops ≥ 2 points",              severity: "medium"   },
  { name: "Manager Support Drop",    trigger: "Manager support drops ≥ 2 points",  severity: "medium"   },
]

const SEV_COLOR: Record<string, string> = {
  critical: "#f87171", high: "#fbbf24", medium: "#60a5fa",
}

const EFFECTIVENESS_RULES = [
  { range: "≥ 25% risk reduction", label: "High",     color: "#4ade80" },
  { range: "≥ 10% risk reduction", label: "Medium",   color: "#fbbf24" },
  { range: "≥  0% risk reduction", label: "Low",      color: "#60a5fa" },
  { range: " < 0% risk reduction", label: "Negative", color: "#f87171" },
]

export default function SettingsPage() {
  const [provider,   setProvider]   = useState("auto")
  const [connecting, setConnecting] = useState(false)
  const [llmResult,  setLlmResult]  = useState<{ status: string; provider?: string } | null>(null)
  const [llmErr,     setLlmErr]     = useState("")

  const [empFile, setEmpFile] = useState<File | null>(null)
  const [empUploading, setEmpUploading] = useState(false)
  const [empMsg, setEmpMsg] = useState("")

  const [surveyFile, setSurveyFile] = useState<File | null>(null)
  const [surveyUploading, setSurveyUploading] = useState(false)
  const [surveyMsg, setSurveyMsg] = useState("")

  const [notifStatus, setNotifStatus] = useState<any>(null)
  const [schedStatus, setSchedStatus] = useState<any>(null)
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState("")

  const [checkingSlas, setCheckingSlas] = useState(false)
  const [slaMsg, setSlaMsg] = useState("")

  useEffect(() => {
    getNotificationStatus().then(setNotifStatus).catch(() => {})
    getSchedulerStatus().then(setSchedStatus).catch(() => {})
  }, [])

  async function handleConnect() {
    setConnecting(true); setLlmResult(null); setLlmErr("")
    try {
      const r = await connectLLM(provider)
      setLlmResult(r)
    } catch (e: any) {
      setLlmErr(e.message)
    } finally {
      setConnecting(false)
    }
  }

  async function handleImportEmployees() {
    if (!empFile) return
    setEmpUploading(true); setEmpMsg("")
    try {
      const res = await importEmployees(empFile)
      setEmpMsg(`✓ ${res.message}`)
      setEmpFile(null)
    } catch (e: any) {
      setEmpMsg(`✗ ${e.message}`)
    } finally {
      setEmpUploading(false)
    }
  }

  async function handleIngestSurveys() {
    if (!surveyFile) return
    setSurveyUploading(true); setSurveyMsg("")
    try {
      const res = await ingestSurveys(surveyFile)
      setSurveyMsg(`✓ ${res.message}`)
      setSurveyFile(null)
    } catch (e: any) {
      setSurveyMsg(`✗ ${e.message}`)
    } finally {
      setSurveyUploading(false)
    }
  }

  return (
    <AppShell requireAdmin>
      <div className="animate-fadeUp">
        <h1 className="font-mono text-2xl font-semibold text-text mb-1">Settings</h1>
        <p className="text-muted text-sm mb-8">System configuration, LLM connection, and reference documentation</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* LLM Configuration */}
          <div className="card">
            <p className="section-label">LLM Configuration</p>
            <p className="font-mono text-xs text-muted mb-4 leading-relaxed">
              Connect an LLM to generate personalised intervention recommendations.
              Ollama runs locally (no API key needed). Anthropic requires
              <code className="text-accent mx-1">ANTHROPIC_API_KEY</code> env var on the server.
            </p>
            <div className="space-y-3">
              <div>
                <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1.5 block">Provider</label>
                <select className="input" value={provider} onChange={e => setProvider(e.target.value)}>
                  {LLM_PROVIDERS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="bg-[#070d1a] border border-border rounded-lg p-4 space-y-2">
                <p className="font-mono text-[10px] text-muted uppercase tracking-wider">Ollama Setup</p>
                <div className="space-y-1">
                  {[
                    "1.  Install → https://ollama.com",
                    "2.  ollama serve",
                    "3.  ollama pull qwen2.5:3b",
                    "4.  Click Connect LLM below",
                  ].map((s, i) => (
                    <p key={i} className="font-mono text-xs text-muted">{s}</p>
                  ))}
                </div>
              </div>

              <button onClick={handleConnect} disabled={connecting} className="btn-primary w-full justify-center">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {connecting ? "Connecting & testing…" : "Connect LLM"}
              </button>

              {llmResult && (
                <div className={`flex items-center gap-2 font-mono text-sm px-4 py-3 rounded-lg border ${
                  llmResult.status === "connected"
                    ? "bg-green/10 border-green/30 text-green"
                    : "bg-amber/10 border-amber/30 text-amber"
                }`}>
                  {llmResult.status === "connected"
                    ? <CheckCircle className="w-4 h-4 shrink-0" />
                    : <AlertTriangle className="w-4 h-4 shrink-0" />
                  }
                  {llmResult.status === "connected"
                    ? `✓ Connected to ${llmResult.provider}`
                    : `Unavailable — using fallback recommendations`
                  }
                </div>
              )}
              {llmErr && (
                <div className="flex items-start gap-2 font-mono text-xs text-red bg-red/10 border border-red/30 px-4 py-3 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {llmErr}
                </div>
              )}
            </div>
          </div>

          {/* System Info */}
          <div className="card">
            <p className="section-label">System Architecture</p>
            <div className="space-y-2">
              {SYSTEM_INFO.map(([label, value]) => (
                <div key={label} className="flex items-start gap-3 py-1.5 border-b border-border/40 last:border-0">
                  <span className="font-mono text-[10px] text-muted uppercase tracking-wider w-36 shrink-0 pt-0.5">{label}</span>
                  <span className="font-mono text-xs text-text/80">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Imports */}
        <div className="card mb-6">
          <p className="section-label">Data Imports</p>
          <p className="font-mono text-xs text-muted mb-4">
            Upload CSV files to sync employee hierarchy or ingest survey feedback for eNPS tracking.
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#070d1a] border border-border p-4 rounded-lg">
              <p className="font-mono text-sm text-text font-bold mb-1">Employee Hierarchy Sync</p>
              <p className="font-mono text-xs text-muted mb-3">CSV must contain: <code className="text-accent">employee_id, name, department, manager_username</code></p>
              <FileDropzone onFileSelect={setEmpFile} selectedFile={empFile} />
              <button 
                onClick={handleImportEmployees} 
                disabled={!empFile || empUploading} 
                className="btn-primary w-full justify-center mt-3"
              >
                {empUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Import Employees
              </button>
              {empMsg && <p className={`mt-2 font-mono text-xs ${empMsg.startsWith('✓') ? 'text-green' : 'text-red'}`}>{empMsg}</p>}
            </div>

            <div className="bg-[#070d1a] border border-border p-4 rounded-lg">
              <p className="font-mono text-sm text-text font-bold mb-1">Survey Ingestion</p>
              <p className="font-mono text-xs text-muted mb-3">CSV must contain: <code className="text-accent">employee_id, survey_date, survey_type, score</code></p>
              <FileDropzone onFileSelect={setSurveyFile} selectedFile={surveyFile} />
              <button 
                onClick={handleIngestSurveys} 
                disabled={!surveyFile || surveyUploading} 
                className="btn-primary w-full justify-center mt-3"
              >
                {surveyUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Ingest Surveys
              </button>
              {surveyMsg && <p className={`mt-2 font-mono text-xs ${surveyMsg.startsWith('✓') ? 'text-green' : 'text-red'}`}>{surveyMsg}</p>}
            </div>
          </div>
        </div>

        {/* Notifications & Scheduler */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Notification Channels */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-accent" />
              <p className="section-label mb-0">Alert Notifications</p>
            </div>
            <p className="font-mono text-xs text-muted mb-4">
              Critical and high-severity alerts are dispatched to configured channels automatically.
            </p>
            {notifStatus ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-[#070d1a]">
                  <div className={`w-2 h-2 rounded-full ${notifStatus.email?.configured ? 'bg-green' : 'bg-muted'}`} />
                  <div>
                    <p className="font-mono text-xs text-text">Email (SMTP)</p>
                    <p className="font-mono text-[10px] text-muted">
                      {notifStatus.email?.configured
                        ? `${notifStatus.email.host} → ${notifStatus.email.recipients?.join(', ')}`
                        : 'Not configured (set SMTP_HOST, SMTP_FROM, ALERT_EMAIL_TO)'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-[#070d1a]">
                  <div className={`w-2 h-2 rounded-full ${notifStatus.webhook?.configured ? 'bg-green' : 'bg-muted'}`} />
                  <div>
                    <p className="font-mono text-xs text-text">Webhook (Slack/Teams)</p>
                    <p className="font-mono text-[10px] text-muted">
                      {notifStatus.webhook?.configured ? 'Configured ✓' : 'Not configured (set WEBHOOK_URL)'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="font-mono text-xs text-muted animate-pulse">Loading...</p>
            )}
          </div>

          {/* Scheduler */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-accent" />
              <p className="section-label mb-0">Snapshot Scheduler</p>
            </div>
            <p className="font-mono text-xs text-muted mb-4">
              Automatically re-run predictions on employee data at a set schedule.
            </p>
            {schedStatus ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-[#070d1a]">
                  <div className={`w-2 h-2 rounded-full ${schedStatus.enabled ? 'bg-green' : 'bg-muted'}`} />
                  <div className="flex-1">
                    <p className="font-mono text-xs text-text">
                      {schedStatus.enabled ? `Enabled — ${schedStatus.schedule}` : 'Disabled'}
                    </p>
                    {schedStatus.next_run && (
                      <p className="font-mono text-[10px] text-muted">Next run: {schedStatus.next_run}</p>
                    )}
                    {schedStatus.last_run && (
                      <p className="font-mono text-[10px] text-muted">Last run: {schedStatus.last_run}</p>
                    )}
                    {!schedStatus.enabled && (
                      <p className="font-mono text-[10px] text-muted">Set SNAPSHOT_SCHEDULE_ENABLED=true to enable</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setTriggering(true); setTriggerMsg('')
                    try {
                      const r = await triggerSnapshot()
                      setTriggerMsg(`✓ ${r.message || `Saved ${r.saved} snapshots, ${r.alerts_fired} alerts`}`)
                      getSchedulerStatus().then(setSchedStatus).catch(() => {})
                    } catch (e: any) {
                      setTriggerMsg(`✗ ${e.message}`)
                    } finally {
                      setTriggering(false)
                    }
                  }}
                  disabled={triggering || checkingSlas}
                  className="btn-primary w-full justify-center"
                >
                  {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run Snapshot Now
                </button>
                {triggerMsg && <p className={`font-mono text-xs ${triggerMsg.startsWith('✓') ? 'text-green' : 'text-red'}`}>{triggerMsg}</p>}

                <button
                  onClick={async () => {
                    setCheckingSlas(true); setSlaMsg('')
                    try {
                      const r = await checkSLAs()
                      setSlaMsg(`✓ ${r.message}`)
                    } catch (e: any) {
                      setSlaMsg(`✗ ${e.message}`)
                    } finally {
                      setCheckingSlas(false)
                    }
                  }}
                  disabled={triggering || checkingSlas}
                  className="btn-outline border-purple-500/30 text-purple-400 w-full justify-center hover:bg-purple-500/10"
                >
                  {checkingSlas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Enforce SLAs Now
                </button>
                {slaMsg && <p className={`font-mono text-xs ${slaMsg.startsWith('✓') ? 'text-green' : 'text-red'}`}>{slaMsg}</p>}
              </div>
            ) : (
              <p className="font-mono text-xs text-muted animate-pulse">Loading...</p>
            )}
          </div>
        </div>

        {/* Alert Rules Reference */}
        <div className="card mb-6">
          <p className="section-label">Early Warning Alert Rules</p>
          <p className="font-mono text-xs text-muted mb-4">
            Alerts are created automatically when consecutive snapshots for the same employee cross these thresholds.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALERT_RULES.map(rule => (
              <div key={rule.name} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-[#070d1a]">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: SEV_COLOR[rule.severity] }}
                />
                <div className="min-w-0">
                  <p className="font-mono text-xs text-text">{rule.name}</p>
                  <p className="font-mono text-[10px] text-muted">{rule.trigger}</p>
                </div>
                <span
                  className="ml-auto shrink-0 font-mono text-[10px] px-2 py-0.5 rounded border capitalize"
                  style={{
                    color:       SEV_COLOR[rule.severity],
                    borderColor: SEV_COLOR[rule.severity] + "40",
                    background:  SEV_COLOR[rule.severity] + "10",
                  }}
                >
                  {rule.severity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Effectiveness Scoring */}
        <div className="card mb-6">
          <p className="section-label">Intervention Effectiveness Scoring</p>
          <p className="font-mono text-xs text-muted mb-4">
            After completing an intervention, record the employee's before and after risk scores.
            The system calculates improvement percentage and assigns an effectiveness grade.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {EFFECTIVENESS_RULES.map(r => (
              <div
                key={r.label}
                className="px-4 py-3 rounded-xl border text-center"
                style={{ borderColor: r.color + "30", background: r.color + "08" }}
              >
                <p className="font-mono text-base font-bold mb-1" style={{ color: r.color }}>{r.label}</p>
                <p className="font-mono text-[10px] text-muted">{r.range}</p>
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] text-muted mt-3">
            Formula: Improvement % = (risk_before − risk_after) ÷ risk_before × 100
          </p>
        </div>

        {/* Risk Zone Reference */}
        <div className="card">
          <p className="section-label">Risk Zone Thresholds</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "GREEN",  range: "0–35",   color: "#4ade80", desc: "Low risk · no immediate action"    },
              { label: "AMBER",  range: "35–65",  color: "#fbbf24", desc: "Moderate risk · monitor closely"  },
              { label: "RED",    range: "65–100", color: "#f87171", desc: "High risk · intervene immediately" },
            ].map(z => (
              <div
                key={z.label}
                className="px-4 py-4 rounded-xl border text-center"
                style={{ borderColor: z.color + "30", background: z.color + "08" }}
              >
                <p className="font-mono text-lg font-bold mb-0.5" style={{ color: z.color }}>{z.label}</p>
                <p className="font-mono text-sm font-bold text-text mb-1">Score {z.range}</p>
                <p className="font-mono text-[10px] text-muted">{z.desc}</p>
              </div>
            ))}
          </div>
          <p className="font-mono text-[10px] text-muted mt-3">
            <Info className="w-3 h-3 inline mr-1" />
            Risk Score is rule-based (RISK_WEIGHTS × metrics). Attrition Probability is the XGBoost model's RED-class probability.
            Both are shown side-by-side in the Predict page.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
