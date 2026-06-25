"use client"
import { useEffect, useState, useCallback, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import AppShell  from "@/components/AppShell"
import RiskBadge from "@/components/ui/RiskBadge"
import { TableRowSkeleton } from "@/components/ui/Skeleton"
import { useToast } from "@/lib/toast-context"
import {
  getClassifications, classifyEmployees,
  getEmployeeSentiment, generateEmployeeRecommendation,
  getEmployeeProfile, saveEmployeeProfile, classifyEmployeeManual,
} from "@/lib/api"
import type { EmployeeProfileData, ManualClassifyResult } from "@/lib/api/employees"
import {
  Search, Play, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  TrendingDown, MessageSquare, Brain, ShieldAlert, Sparkles,
  CheckCircle, Save, Zap, Calendar,
} from "lucide-react"
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts"

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

type Zone = "ALL" | "RED" | "AMBER" | "GREEN"

const ZONE_COLORS: Record<string, string> = {
  GREEN: "#16A34A", AMBER: "#D97706", RED: "#DC2626",
}

const ZONE_BG: Record<string, string> = {
  GREEN: "var(--green-light)", AMBER: "var(--amber-light)", RED: "var(--red-light)",
}

const ZONE_BORDER: Record<string, string> = {
  GREEN: "#86EFAC", AMBER: "#FCD34D", RED: "#FCA5A5",
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC SLIDER — single field row with label + range + value bubble
// ─────────────────────────────────────────────────────────────────────────────
function MetricSlider({
  label, field, value, onChange, min = 1, max = 10, step = 1, invertColor = false,
}: {
  label: string; field: string; value: number | null | undefined
  onChange: (field: string, v: number) => void
  min?: number; max?: number; step?: number; invertColor?: boolean
}) {
  const v = value ?? 5
  const pct = ((v - min) / (max - min)) * 100
  // For stress/workload/absenteeism, HIGH value = RED; for others HIGH = GREEN
  const dangerPct = invertColor ? pct : 100 - pct
  const color = dangerPct > 66 ? "var(--red)" : dangerPct > 33 ? "var(--amber)" : "var(--green)"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </label>
        <span className="text-sm font-extrabold font-mono" style={{ color }}>{v}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={e => onChange(field, Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--border2) ${pct}%, var(--border2) 100%)`,
          accentColor: color,
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE ACCORDION ROW — inline expandable panel
// ─────────────────────────────────────────────────────────────────────────────
function EmployeeAccordionRow({
  emp, colSpan, onClose,
}: {
  emp: any; colSpan: number; onClose: () => void
}) {
  type Tab = "assessment" | "history"
  const [tab,          setTab]          = useState<Tab>("assessment")
  const [sentData,     setSentData]     = useState<any>(null)
  const [sentLoading,  setSentLoading]  = useState(false)
  const [sentError,    setSentError]    = useState("")
  const [saving,       setSaving]       = useState(false)
  const [classifying,  setClassifying]  = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [classResult,  setClassResult]  = useState<ManualClassifyResult | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const toast = useToast()

  // ── Form state ──────────────────────────────────────────────────────────────
  const DEFAULTS: EmployeeProfileData = {
    happiness_score: 5, excitement_level: 5, stress_level: 5,
    workload_level: 5, work_life_balance: 5, manager_support: 5,
    job_satisfaction: 5, productivity: 5, team_collaboration: 5,
    career_growth: 5, absenteeism: 5, score: 50,
    comments: "", hrbp_risk_zone: null,
  }
  const [form, setForm] = useState<EmployeeProfileData>(DEFAULTS)

  // ── Load saved profile on mount ─────────────────────────────────────────────
  useEffect(() => {
    getEmployeeProfile(emp.employee_id)
      .then(p => {
        if (p && Object.keys(p).length > 0) {
          setForm(prev => ({ ...prev, ...p }))
        }
        setProfileLoaded(true)
      })
      .catch(() => setProfileLoaded(true))
  }, [emp.employee_id])

  // ── Load sentiment history when history tab is opened ──────────────────────
  useEffect(() => {
    if (tab !== "history" || sentData) return
    setSentLoading(true)
    getEmployeeSentiment(emp.employee_id)
      .then(setSentData).catch(e => setSentError(e.message))
      .finally(() => setSentLoading(false))
  }, [tab, emp.employee_id, sentData])

  const setField = (field: string, val: any) =>
    setForm(prev => ({ ...prev, [field]: val }))

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      await saveEmployeeProfile(emp.employee_id, form)
      toast.success("Profile saved", `${emp.employee_id}'s assessment has been saved.`)
    } catch (e: any) {
      toast.error("Save failed", e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleClassify = async () => {
    setClassifying(true)
    setClassResult(null)
    try {
      const res = await classifyEmployeeManual(emp.employee_id, form)
      setClassResult(res)
    } catch (e: any) {
      toast.error("Classification failed", e.message)
    } finally {
      setClassifying(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const rec = await generateEmployeeRecommendation(emp.employee_id)
      toast.success(
        `Recommendation generated for ${emp.employee_id}`,
        `${rec.priority.toUpperCase()} priority — view in Action Center`,
      )
    } catch (e: any) {
      toast.error("Generation failed", e.message)
    } finally {
      setGenerating(false)
    }
  }

  const topFactors: any[] = Array.isArray(emp.top_factors) ? emp.top_factors : []

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div
          className="mx-2 mb-3 rounded-xl border overflow-hidden"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border2)",
            boxShadow: "var(--shadow-hover)",
          }}
        >
          {/* ── Accordion header ──────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b"
            style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div>
                <span className="badge badge-blue text-[10px] uppercase tracking-wider">Employee Details</span>
                <h3 className="text-sm font-extrabold font-mono mt-0.5">{emp.employee_id}</h3>
                {emp.department && <p className="text-[11px] text-muted">{emp.department}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RiskBadge zone={emp.risk_zone} score={emp.risk_score} showScore />
              <button onClick={onClose} className="btn-icon" aria-label="Collapse">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Tab switcher ──────────────────────────────────────────────── */}
          <div className="px-5 pt-4 pb-0">
            <div className="tab-group w-fit">
              {(["assessment", "history"] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`tab-item ${tab === t ? "active" : ""}`}
                >
                  {t === "assessment" ? "Assessment Form" : "Sentiment History"}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              TAB: ASSESSMENT FORM
          ═══════════════════════════════════════════════════════════════ */}
          {tab === "assessment" && (
            <div className="p-5 space-y-6">
              {!profileLoaded && (
                <div className="flex items-center gap-2 text-muted text-xs">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Loading saved profile…
                </div>
              )}

              {/* ── Metric sliders grid ───────────────────────────────── */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                  Current Metrics  <span className="font-normal normal-case">(1 = lowest · 10 = highest)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                  <MetricSlider label="Happiness"        field="happiness_score"    value={form.happiness_score}    onChange={setField} />
                  <MetricSlider label="Excitement"       field="excitement_level"   value={form.excitement_level}   onChange={setField} />
                  <MetricSlider label="Manager Support"  field="manager_support"    value={form.manager_support}    onChange={setField} />
                  <MetricSlider label="Job Satisfaction" field="job_satisfaction"   value={form.job_satisfaction}   onChange={setField} />
                  <MetricSlider label="Productivity"     field="productivity"       value={form.productivity}       onChange={setField} />
                  <MetricSlider label="Work-Life Balance" field="work_life_balance" value={form.work_life_balance}  onChange={setField} />
                  <MetricSlider label="Team Collaboration" field="team_collaboration" value={form.team_collaboration} onChange={setField} />
                  <MetricSlider label="Career Growth"    field="career_growth"      value={form.career_growth}      onChange={setField} />
                  {/* High = bad for these three */}
                  <MetricSlider label="Stress Level"    field="stress_level"       value={form.stress_level}       onChange={setField} invertColor />
                  <MetricSlider label="Workload Level"  field="workload_level"     value={form.workload_level}     onChange={setField} invertColor />
                  <MetricSlider label="Absenteeism"     field="absenteeism"        value={form.absenteeism}        onChange={setField} invertColor />
                  {/* eNPS 0-100 */}
                  <MetricSlider label="Overall Score (eNPS)" field="score"         value={form.score}              onChange={setField} min={0} max={100} step={1} />
                </div>
              </div>

              {/* ── Comments ─────────────────────────────────────────── */}
              <div>
                <label className="label">HRBP Notes / Comments</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Add qualitative observations about this employee's current situation…"
                  value={form.comments ?? ""}
                  onChange={e => setField("comments", e.target.value)}
                />
              </div>

              {/* ── Manual zone selector ─────────────────────────────── */}
              <div>
                <p className="label mb-2">Manually Assign Risk Zone  <span className="font-normal normal-case text-muted">(HRBP override)</span></p>
                <div className="flex gap-2 flex-wrap">
                  {(["GREEN", "AMBER", "RED"] as const).map(z => {
                    const active = form.hrbp_risk_zone === z
                    return (
                      <button
                        key={z}
                        onClick={() => setField("hrbp_risk_zone", active ? null : z)}
                        className="px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all duration-150"
                        style={{
                          background: active ? ZONE_BG[z] : "var(--surface2)",
                          borderColor: active ? ZONE_BORDER[z] : "var(--border)",
                          color: active ? ZONE_COLORS[z] : "var(--muted)",
                          transform: active ? "scale(1.04)" : "scale(1)",
                          boxShadow: active ? `0 0 0 3px ${ZONE_BORDER[z]}40` : "none",
                        }}
                      >
                        <span className="inline-block w-2 h-2 rounded-full mr-1.5"
                          style={{ background: active ? ZONE_COLORS[z] : "var(--subtle)" }} />
                        {z === "GREEN" ? "Stable" : z === "AMBER" ? "Watch" : "Critical"}
                      </button>
                    )
                  })}
                  {form.hrbp_risk_zone && (
                    <button
                      onClick={() => setField("hrbp_risk_zone", null)}
                      className="px-3 py-2 rounded-lg text-xs text-muted border border-dashed border-border hover:border-border2 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* ── Classification result ─────────────────────────────── */}
              {classResult && (
                <div
                  className="rounded-xl p-4 border flex items-start gap-3"
                  style={{
                    background: ZONE_BG[classResult.risk_zone],
                    borderColor: ZONE_BORDER[classResult.risk_zone],
                  }}
                >
                  <Brain className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ZONE_COLORS[classResult.risk_zone] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-extrabold" style={{ color: ZONE_COLORS[classResult.risk_zone] }}>
                        AI Prediction: {classResult.risk_zone} zone
                      </p>
                      <span className="text-xs font-bold font-mono" style={{ color: ZONE_COLORS[classResult.risk_zone] }}>
                        {classResult.risk_score}% risk
                      </span>
                    </div>
                    {classResult.top_factors.length > 0 && (
                      <div className="mt-2 space-y-1 font-mono text-xs">
                        {classResult.top_factors.slice(0, 3).map((f: any) => (
                          <div key={f.feature} className="flex items-center justify-between">
                            <span className="text-muted truncate max-w-[60%]">{f.feature}</span>
                            <span style={{ color: f.shap_value > 0 ? "var(--red)" : "var(--green)" }}>
                              {f.shap_value > 0 ? "↑ Risk" : "↓ Risk"} ({f.shap_value > 0 ? "+" : ""}{f.shap_value})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted mt-2 italic">
                      Based on entered metrics only — does not replace a full pipeline classification.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Action buttons ────────────────────────────────────── */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                <button
                  onClick={handleClassify}
                  disabled={classifying}
                  className="btn-primary btn-sm flex items-center gap-1.5"
                >
                  {classifying
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Classifying…</>
                    : <><Zap className="w-3.5 h-3.5" />Classify Employee</>
                  }
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-ghost btn-sm flex items-center gap-1.5"
                >
                  {saving
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Saving…</>
                    : <><Save className="w-3.5 h-3.5" />Save Profile</>
                  }
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="btn-violet btn-sm flex items-center gap-1.5 ml-auto"
                >
                  {generating
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Generating…</>
                    : <><Sparkles className="w-3.5 h-3.5" />Generate Recommendation</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAB: SENTIMENT HISTORY
          ═══════════════════════════════════════════════════════════════ */}
          {tab === "history" && (
            <div className="p-5 space-y-5">
              {sentLoading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                </div>
              )}
              {sentError && (
                <div className="alert-critical" role="alert">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />{sentError}
                </div>
              )}
              {sentData && (
                <>
                  {/* Stat strip */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Avg Sentiment", value: sentData.avg_sentiment > 0 ? `+${sentData.avg_sentiment}` : sentData.avg_sentiment, color: sentData.avg_sentiment >= 0 ? "var(--green)" : "var(--red)" },
                      { label: "Velocity",      value: sentData.sentiment_velocity > 0 ? `+${sentData.sentiment_velocity}` : sentData.sentiment_velocity, color: sentData.sentiment_velocity >= 0 ? "var(--green)" : "var(--red)" },
                      { label: "Survey Count",  value: sentData.survey_count, color: "var(--text)" },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-3 text-center border border-border" style={{ background: "var(--surface2)" }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">{s.label}</p>
                        <p className="text-xl font-extrabold font-mono" style={{ color: s.color }}>{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Chart */}
                  {sentData.history?.length > 0 && (
                    <div className="card">
                      <h3 className="section-title mb-3"><TrendingDown className="w-4 h-4 text-accent" />Sentiment Trajectory</h3>
                      <ResponsiveContainer width="100%" height={150}>
                        <LineChart data={sentData.history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="survey_date" stroke="var(--subtle)" fontSize={9} tickLine={false} axisLine={false} />
                          <YAxis stroke="var(--subtle)" fontSize={9} tickLine={false} axisLine={false} domain={[-1, 1]} />
                          <Tooltip contentStyle={{ borderRadius: "var(--r-lg)", border: "1px solid var(--border)", fontSize: 11 }} />
                          <Line type="monotone" dataKey="sentiment_score" stroke="var(--accent)" strokeWidth={2.5}
                            dot={{ r: 3, fill: "var(--accent)" }} activeDot={{ r: 5 }} name="Sentiment" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Topic breakdown */}
                  {Object.keys(sentData.topic_breakdown ?? {}).length > 0 && (
                    <div className="card">
                      <h3 className="section-title mb-3"><MessageSquare className="w-4 h-4 text-accent" />Topic Sentiment</h3>
                      <div className="space-y-2.5">
                        {Object.entries(sentData.topic_breakdown).map(([topic, val]: [string, any]) => {
                          const pct   = Math.round((val + 1) * 50)
                          const color = val < -0.1 ? "var(--red)" : val <= 0.1 ? "var(--amber)" : "var(--green)"
                          return (
                            <div key={topic}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold capitalize" style={{ color: "var(--text-2)" }}>{topic}</span>
                                <span className="text-xs font-bold font-mono" style={{ color }}>{val > 0 ? `+${val}` : val}</span>
                              </div>
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* SHAP factors */}
                  {topFactors.length > 0 && (
                    <div className="card" style={{ borderColor: "var(--accent-mid)", background: "var(--accent-light)" }}>
                      <h3 className="section-title mb-3"><Brain className="w-4 h-4 text-accent" />Top Risk Factors (SHAP)</h3>
                      <div className="space-y-2 font-mono text-xs">
                        {topFactors.map((f: any) => (
                          <div key={f.feature} className="flex items-center justify-between">
                            <span style={{ color: "var(--text-2)" }}>{f.feature}</span>
                            <span className="font-semibold" style={{ color: f.shap_value > 0 ? "var(--red)" : "var(--green)" }}>
                              {f.shap_value > 0 ? "↑ Risk" : "↓ Risk"} ({f.shap_value > 0 ? "+" : ""}{f.shap_value})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Survey history entries */}
                  {sentData.history?.length > 0 && (
                    <div>
                      <h3 className="section-title mb-3"><Calendar className="w-4 h-4 text-muted" />Survey History ({sentData.history.length})</h3>
                      <div className="space-y-2.5">
                        {sentData.history.map((h: any, i: number) => {
                          const lbl = h.sentiment_label ?? "neutral"
                          return (
                            <div key={i} className="rounded-xl p-3.5 border border-border" style={{ background: "var(--surface2)" }}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] text-muted font-mono">{h.survey_date}</span>
                                <span className={`badge text-[10px] ${lbl === "positive" ? "badge-green" : lbl === "negative" ? "badge-red" : "badge-amber"}`}>
                                  {lbl} ({h.sentiment_score ?? 0})
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                                {h.comments || "(No comments provided)"}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER LIST — uses useSearchParams, must be wrapped in Suspense
// ─────────────────────────────────────────────────────────────────────────────
function EmployeeListInner() {
  const searchParams = useSearchParams()
  const toast = useToast()

  const [rows,        setRows]        = useState<any[]>([])
  const [loading,     setLoading]     = useState(true)
  const [classifying, setClassifying] = useState(false)
  const [search,      setSearch]      = useState("")
  const [zone,        setZone]        = useState<Zone>(
    (searchParams.get("zone") as Zone) ?? "ALL"
  )
  const [dept,     setDept]     = useState<string>(searchParams.get("dept") ?? "")
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await getClassifications()
      setRows(res.classifications ?? [])
    } catch (err: any) {
      toast.error("Failed to load employees", err.message)
    }
  }, [toast])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const runClassifier = async () => {
    setClassifying(true)
    try {
      const res = await classifyEmployees()
      toast.success("Classification complete", `${res.employees_classified} employees · ${res.alerts_created} alerts`)
      await load()
    } catch (err: any) {
      toast.error("Classification failed", err.message)
    } finally {
      setClassifying(false)
    }
  }

  const filtered = rows.filter(r => {
    const matchZone   = zone === "ALL" || r.risk_zone === zone
    const matchDept   = !dept || r.department === dept
    const matchSearch = r.employee_id.toLowerCase().includes(search.toLowerCase())
    return matchZone && matchDept && matchSearch
  })

  const departments = Array.from(new Set(rows.map(r => r.department).filter(Boolean))) as string[]

  const ZONES: { value: Zone; label: string }[] = [
    { value: "ALL",   label: "All" },
    { value: "RED",   label: "Critical" },
    { value: "AMBER", label: "Watch" },
    { value: "GREEN", label: "Stable" },
  ]

  const toggleRow = (id: string) =>
    setExpanded(prev => (prev === id ? null : id))

  return (
    <div className="page-container animate-fade-up">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Employee Risk Monitor</h1>
          <p className="page-subtitle">
            {rows.length} employees tracked · click any row to open the assessment form
          </p>
        </div>
        <button onClick={runClassifier} disabled={classifying} className="btn-primary text-xs">
          {classifying
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Running…</>
            : <><Play className="w-3.5 h-3.5" />Run Classifier</>
          }
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="search-wrap w-full sm:w-72">
          <Search className="w-4 h-4" aria-hidden="true" />
          <input
            className="search-input"
            placeholder="Search by employee ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search employees"
          />
        </div>
        <div className="tab-group" role="group" aria-label="Filter by risk zone">
          {ZONES.map(z => (
            <button
              key={z.value}
              onClick={() => setZone(z.value)}
              className={`tab-item ${zone === z.value ? "active" : ""}`}
              aria-pressed={zone === z.value}
            >
              {z.label}
            </button>
          ))}
        </div>
        {departments.length > 0 && (
          <select
            value={dept}
            onChange={e => setDept(e.target.value)}
            className="search-input w-full sm:w-48"
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <span className="text-xs text-muted ml-auto">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto">
          <table className="data-table" aria-label="Employee risk directory">
            <thead>
              <tr>
                <th scope="col">Employee ID</th>
                <th scope="col">Department</th>
                <th scope="col">AI Zone</th>
                <th scope="col">HRBP Zone</th>
                <th scope="col" className="text-right">Risk Score</th>
                <th scope="col" className="text-right">Last Classified</th>
                <th scope="col" className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
              ) : filtered.length > 0 ? (
                filtered.flatMap(r => {
                  const isOpen = expanded === r.employee_id
                  return [
                    <tr
                      key={r.employee_id}
                      onClick={() => toggleRow(r.employee_id)}
                      className="cursor-pointer"
                      style={isOpen ? { background: "var(--surface2)" } : undefined}
                      tabIndex={0}
                      onKeyDown={e => e.key === "Enter" && toggleRow(r.employee_id)}
                      aria-expanded={isOpen}
                    >
                      <td className="font-semibold font-mono">{r.employee_id}</td>
                      <td className="text-xs text-muted">{r.department ?? "—"}</td>
                      <td><RiskBadge zone={r.risk_zone} /></td>
                      <td>
                        {r.hrbp_risk_zone ? (
                          <span
                            className="badge text-[10px]"
                            style={{
                              background: ZONE_BG[r.hrbp_risk_zone],
                              borderColor: ZONE_BORDER[r.hrbp_risk_zone],
                              color: ZONE_COLORS[r.hrbp_risk_zone],
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full inline-block mr-1"
                              style={{ background: ZONE_COLORS[r.hrbp_risk_zone] }} />
                            {r.hrbp_risk_zone === "GREEN" ? "Stable" : r.hrbp_risk_zone === "AMBER" ? "Watch" : "Critical"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted italic">Not set</span>
                        )}
                      </td>
                      <td className="text-right font-mono font-bold"
                        style={{ color: ZONE_COLORS[r.risk_zone] ?? "var(--muted)" }}>
                        {r.risk_score}%
                      </td>
                      <td className="text-right font-mono text-xs text-muted">
                        {r.classified_at ? new Date(r.classified_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="text-right">
                        <button
                          className="btn-ghost btn-sm flex items-center gap-1 ml-auto"
                          onClick={e => { e.stopPropagation(); toggleRow(r.employee_id) }}
                          aria-label={`${isOpen ? "Collapse" : "Expand"} details for ${r.employee_id}`}
                        >
                          {isOpen ? (
                            <><ChevronUp className="w-3 h-3" />Close</>
                          ) : (
                            <><ChevronDown className="w-3 h-3" />Details</>
                          )}
                        </button>
                      </td>
                    </tr>,
                    isOpen && (
                      <EmployeeAccordionRow
                        key={`${r.employee_id}-detail`}
                        emp={r}
                        colSpan={7}
                        onClose={() => setExpanded(null)}
                      />
                    ),
                  ].filter(Boolean)
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted">
                      {zone !== "ALL" || search || dept ? (
                        <>
                          <Search className="w-8 h-8 opacity-40" />
                          <p className="font-semibold text-sm">No employees match your filters</p>
                          <button
                            onClick={() => { setSearch(""); setZone("ALL"); setDept("") }}
                            className="text-xs text-accent hover:underline"
                          >
                            Clear filters
                          </button>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-8 h-8 opacity-40" />
                          <p className="font-semibold text-sm">No classifications yet</p>
                          <p className="text-xs">Run the classifier to populate this directory</p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-border text-xs text-muted flex items-center justify-between"
            style={{ background: "var(--surface2)" }}>
            <span>Showing {filtered.length} of {rows.length} employees</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT — wraps in Suspense for useSearchParams
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="page-container animate-fade-up">
            <div className="page-header">
              <div>
                <div className="skeleton h-7 w-64 rounded-lg mb-2" />
                <div className="skeleton h-4 w-48 rounded" />
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee ID</th><th>Department</th><th>AI Zone</th>
                    <th>HRBP Zone</th>
                    <th className="text-right">Risk Score</th>
                    <th className="text-right">Last Classified</th>
                    <th className="text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={7} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        }
      >
        <EmployeeListInner />
      </Suspense>
    </AppShell>
  )
}
