"use client"
import { useEffect, useState, useCallback, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import AppShell  from "@/components/AppShell"
import RiskBadge from "@/components/ui/RiskBadge"
import { TableRowSkeleton } from "@/components/ui/Skeleton"
import { useToast } from "@/lib/toast-context"
import {
  getClassifications, getEmployeeSentiment, classifyEmployees,
} from "@/lib/api"
import {
  Search, Play, RefreshCw, X, AlertTriangle,
  TrendingDown, TrendingUp, Minus, ChevronRight,
  Calendar, MessageSquare, Brain, ShieldAlert, CheckCircle,
} from "lucide-react"
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts"

type Zone = "ALL" | "RED" | "AMBER" | "GREEN"

/* ─── Employee Detail Drawer ────────────────────────────────── */
function EmployeeDrawer({ emp, onClose }: { emp: any; onClose: () => void }) {
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    setLoading(true); setData(null); setError("")
    getEmployeeSentiment(emp.employee_id)
      .then(setData).catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [emp.employee_id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose])

  const topFactors: any[] = (() => {
    try { return JSON.parse(emp.top_factors ?? "[]") } catch { return [] }
  })()

  return (
    <>
      <div className="drawer-overlay animate-fade-in" onClick={onClose} aria-hidden="true" />
      <aside
        className="drawer"
        style={{ width: "min(640px, 92vw)" }}
        role="complementary"
        aria-label={`Employee profile for ${emp.employee_id}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0"
          style={{ background: "var(--surface2)" }}>
          <div>
            <span className="badge badge-blue text-[10px] uppercase tracking-wider mb-1">Employee Profile</span>
            <h2 className="text-lg font-extrabold text-text font-mono mt-0.5">{emp.employee_id}</h2>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge zone={emp.risk_zone} score={emp.risk_score} showScore />
            <button ref={closeRef} onClick={onClose} className="btn-icon ml-2" aria-label="Close employee profile">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-accent animate-spin mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold text-muted">Loading employee data…</p>
            </div>
          )}
          {error && (
            <div className="alert-critical" role="alert">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          {data && (
            <>
              {/* Stat strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Avg Sentiment", value: data.avg_sentiment > 0 ? `+${data.avg_sentiment}` : data.avg_sentiment, color: data.avg_sentiment >= 0 ? "var(--green)" : "var(--red)" },
                  { label: "Velocity",      value: data.sentiment_velocity > 0 ? `+${data.sentiment_velocity}` : data.sentiment_velocity, color: data.sentiment_velocity >= 0 ? "var(--green)" : "var(--red)" },
                  { label: "Survey Count",  value: data.survey_count, color: "var(--text)" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl p-3 text-center border border-border" style={{ background: "var(--surface2)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">{s.label}</p>
                    <p className="text-xl font-extrabold font-mono" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Sentiment chart */}
              {data.history?.length > 0 && (
                <div className="card">
                  <h3 className="section-title mb-3"><TrendingDown className="w-4 h-4 text-accent" />Sentiment Trajectory</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="survey_date" stroke="var(--subtle)" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--subtle)" fontSize={9} tickLine={false} axisLine={false} domain={[-1, 1]} />
                      <Tooltip contentStyle={{ borderRadius: "var(--r-lg)", border: "1px solid var(--border)", fontSize: 11, boxShadow: "var(--shadow-hover)" }} />
                      <Line type="monotone" dataKey="sentiment_score" stroke="var(--accent)" strokeWidth={2.5}
                        dot={{ r: 3, fill: "var(--accent)" }} activeDot={{ r: 5 }} name="Sentiment" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Topic breakdown */}
              {Object.keys(data.topic_breakdown ?? {}).length > 0 && (
                <div className="card">
                  <h3 className="section-title mb-3"><MessageSquare className="w-4 h-4 text-accent" />Topic Sentiment</h3>
                  <div className="space-y-2.5">
                    {Object.entries(data.topic_breakdown).map(([topic, val]: [string, any]) => {
                      const pct   = Math.round((val + 1) * 50)
                      const color = val < -0.1 ? "var(--red)" : val <= 0.1 ? "var(--amber)" : "var(--green)"
                      return (
                        <div key={topic}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold capitalize" style={{ color: "var(--text-2)" }}>{topic}</span>
                            <span className="text-xs font-bold font-mono" style={{ color }}>{val > 0 ? `+${val}` : val}</span>
                          </div>
                          <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
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

              {/* Survey history */}
              {data.history?.length > 0 && (
                <div>
                  <h3 className="section-title mb-3"><Calendar className="w-4 h-4 text-muted" />Survey History ({data.history.length})</h3>
                  <div className="space-y-2.5">
                    {data.history.map((h: any, i: number) => {
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
      </aside>
    </>
  )
}

/* ─── Inner list — uses useSearchParams, needs Suspense ──────── */
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
  const [selected, setSelected] = useState<any>(null)

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
    const matchSearch = r.employee_id.toLowerCase().includes(search.toLowerCase())
    return matchZone && matchSearch
  })

  const ZONES: { value: Zone; label: string }[] = [
    { value: "ALL",   label: "All" },
    { value: "RED",   label: "Critical" },
    { value: "AMBER", label: "Watch" },
    { value: "GREEN", label: "Stable" },
  ]

  const ZONE_COLORS: Record<string, string> = {
    GREEN: "#16A34A", AMBER: "#D97706", RED: "#DC2626",
  }

  return (
    <>
      <div className="page-container animate-fade-up">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Employee Risk Monitor</h1>
            <p className="page-subtitle">
              {rows.length} employees tracked · click any row for the full 360° profile
            </p>
          </div>
          <button onClick={runClassifier} disabled={classifying} className="btn-primary text-xs">
            {classifying
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Running…</>
              : <><Play className="w-3.5 h-3.5" />Run Classifier</>
            }
          </button>
        </div>

        {/* Filters */}
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
          <span className="text-xs text-muted ml-auto">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="overflow-x-auto">
            <table className="data-table" aria-label="Employee risk directory">
              <thead>
                <tr>
                  <th scope="col">Employee ID</th>
                  <th scope="col">Risk Zone</th>
                  <th scope="col" className="text-right">Risk Score</th>
                  <th scope="col" className="text-right">Last Classified</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                ) : filtered.length > 0 ? (
                  filtered.map(r => (
                    <tr
                      key={r.employee_id}
                      onClick={() => setSelected(r)}
                      className="cursor-pointer"
                      tabIndex={0}
                      onKeyDown={e => e.key === "Enter" && setSelected(r)}
                      aria-label={`${r.employee_id}, ${r.risk_zone} zone, ${r.risk_score}% risk`}
                    >
                      <td className="font-semibold font-mono">{r.employee_id}</td>
                      <td><RiskBadge zone={r.risk_zone} /></td>
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
                          onClick={e => { e.stopPropagation(); setSelected(r) }}
                          aria-label={`View profile for ${r.employee_id}`}
                        >
                          Profile <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted">
                        {zone !== "ALL" || search ? (
                          <>
                            <Search className="w-8 h-8 opacity-40" aria-hidden="true" />
                            <p className="font-semibold text-sm">No employees match your filters</p>
                            <button
                              onClick={() => { setSearch(""); setZone("ALL") }}
                              className="text-xs text-accent hover:underline flex items-center gap-1"
                            >
                              <X className="w-3 h-3" /> Clear filters
                            </button>
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-8 h-8 opacity-40" aria-hidden="true" />
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
              {zone !== "ALL" && (
                <button onClick={() => setZone("ALL")} className="flex items-center gap-1 text-accent hover:underline">
                  <X className="w-3 h-3" /> Clear zone filter
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {selected && <EmployeeDrawer emp={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PAGE EXPORT — wraps inner component in Suspense for useSearchParams
═══════════════════════════════════════════════════════════════ */
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
            <div className="bg-surface border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee ID</th><th>Risk Zone</th>
                    <th className="text-right">Risk Score</th>
                    <th className="text-right">Last Classified</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)}
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
