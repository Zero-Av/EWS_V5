"use client"
import { useEffect, useState, useCallback } from "react"
import AppShell from "@/components/AppShell"
import KpiCard  from "@/components/ui/KpiCard"
import RiskBadge from "@/components/ui/RiskBadge"
import { KpiCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton"
import { useToast }  from "@/lib/toast-context"
import { useAlerts } from "@/lib/hooks/useAlerts"
import {
  getAnalyticsDashboard,
  getClassifications,
  getSurveySummary,
  classifyEmployees,
  getModelInfo,
  getTeams,
  type TeamRecord,
} from "@/lib/api"
import {
  Users, Smile, AlertTriangle, ArrowLeftRight,
  Brain, RefreshCw, Play, TrendingUp, ChevronRight,
  ShieldAlert, Building2, CheckCircle, Sparkles,
  BarChart2, Zap,
} from "lucide-react"
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts"
import Link from "next/link"

/* ── tiny helpers ───────────────────────────────────────────── */
function fmt(n: number | undefined | null, prefix = "", suffix = ""): string {
  if (n === undefined || n === null) return "—"
  return `${prefix}${n}${suffix}`
}

/* ── custom tooltip for recharts ───────────────────────────── */
function NexusTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="card-sm text-xs" style={{ boxShadow: "var(--shadow-hover)", minWidth: 120 }}>
      <p className="font-semibold text-text mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

/* ── zone colour map ────────────────────────────────────────── */
const ZONE_COLORS: Record<string, string> = {
  GREEN: "#16A34A", AMBER: "#D97706", RED: "#DC2626",
}

function healthColor(s: number) {
  return s >= 75 ? "#16A34A" : s >= 55 ? "#D97706" : "#DC2626"
}

/* ═══════════════════════════════════════════════════════════════
   EXECUTIVE DASHBOARD
═══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const toast = useToast()
  const { alerts, acknowledge, refresh: refreshAlerts } = useAlerts()

  const [kpis,   setKpis]   = useState<any>(null)
  const [clsf,   setClsf]   = useState<any[]>([])
  const [model,  setModel]  = useState<any>(null)
  const [teams,  setTeams]  = useState<TeamRecord[]>([])
  const [summary, setSummary] = useState("")
  const [loading, setLoading] = useState(true)
  const [classifying, setClassifying] = useState(false)
  const [summarizing, setSummarizing] = useState(false)

  /* ── data loading ──────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      const [k, c, m, t] = await Promise.all([
        getAnalyticsDashboard().catch(() => null),
        getClassifications().catch(() => ({ classifications: [] })),
        getModelInfo().catch(() => ({ has_model: false })),
        getTeams().catch(() => ({ teams: [] })),
      ])
      setKpis(k)
      setClsf(c.classifications ?? [])
      setModel(m)
      setTeams(t.teams ?? [])
    } catch (err: any) {
      toast.error("Failed to load dashboard", err.message)
    }
  }, [toast])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  /* ── run classifier ────────────────────────────────────────── */
  const runClassifier = async () => {
    setClassifying(true)
    try {
      const res = await classifyEmployees()
      toast.success(
        "Classification complete",
        `${res.employees_classified} employees classified · ${res.alerts_created} alerts created`
      )
      await load()
      await refreshAlerts()
    } catch (err: any) {
      toast.error("Classification failed", err.message)
    } finally {
      setClassifying(false)
    }
  }

  /* ── generate AI summary ────────────────────────────────────── */
  const generateSummary = async () => {
    setSummarizing(true)
    try {
      const res = await getSurveySummary()
      setSummary(res.summary)
    } catch {
      setSummary("Could not generate summary. Check your LLM connection in Settings → Integrations.")
    } finally {
      setSummarizing(false)
    }
  }

  /* ── derived values ─────────────────────────────────────────── */
  const redCount   = kpis?.zone_distribution?.RED   ?? 0
  const amberCount = kpis?.zone_distribution?.AMBER ?? 0
  const trendData  = (kpis?.zone_trend ?? []).map((p: any) => ({
    month: p.month, GREEN: p.GREEN, AMBER: p.AMBER, RED: p.RED,
  }))
  const topTeamsByHealth = [...teams]
    .filter(t => t.health != null)
    .sort((a, b) => (a.health as number) - (b.health as number))
    .slice(0, 5)

  /* ── RED employees (top 5 for dashboard) ─────────────── */
  const REDEmps = clsf
    .filter(c => c.risk_zone === "RED")
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5)

  /* ════════════════════════════════════════════════════════════ */
  return (
    <AppShell>
      <div className="page-container space-y-6 animate-fade-up">

        {/* ── Page header ──────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Executive Dashboard</h1>
            <p className="page-subtitle">
              Workforce intelligence · AI-powered risk monitoring and intervention recommendations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLoading(true); load().finally(() => setLoading(false)) }}
              className="btn-ghost text-xs"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            {model?.has_model && (
              <button
                onClick={runClassifier}
                disabled={classifying}
                className="btn-primary text-xs"
                aria-label="Run employee risk classifier"
              >
                {classifying
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Running…</>
                  : <><Play className="w-3.5 h-3.5" />Run Classifier</>
                }
              </button>
            )}
          </div>
        </div>

        {/* ── RED alert banner ──────────────────────────────
        {redCount > 0 && (
          <div className="alert-RED animate-fade-in" role="alert">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">
                {redCount} employee{redCount !== 1 ? "s" : ""} in the RED risk zone
              </span>
              <span className="font-normal ml-1">
                — immediate HRBP review recommended
              </span>
            </div>
            <Link
              href="/employees?zone=RED"
              className="flex items-center gap-1 text-xs font-bold whitespace-nowrap hover:underline"
              aria-label="View all RED employees"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )} */}

        {/* ── KPI row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
          ) : (
            <>
              <KpiCard
                label="Total Monitored"
                value={fmt(kpis?.total_employees)}
                icon={Users}
                iconColor="blue"
              />
              <KpiCard
                label="Avg Sentiment"
                value={kpis ? (kpis.avg_sentiment > 0 ? `+${kpis.avg_sentiment}` : String(kpis.avg_sentiment)) : "—"}
                icon={Smile}
                iconColor="green"
                valueColor={kpis?.avg_sentiment >= 0 ? "var(--green)" : "var(--red)"}
                sub="Scale: –1.0 to +1.0"
              />
              <KpiCard
                label="RED (RED)"
                value={fmt(redCount)}
                icon={AlertTriangle}
                iconColor="red"
                valueColor={redCount > 0 ? "var(--red)" : undefined}
                sub="Require immediate action"
              />
              <KpiCard
                label="Improved to Green"
                value={kpis?.zone_changes?.improved != null ? String(kpis.zone_changes.improved) : "—"}
                icon={TrendingUp}
                iconColor="green"
                valueColor={(kpis?.zone_changes?.improved ?? 0) > 0 ? "var(--green)" : undefined}
                sub="Moved from RED/AMBER to GREEN"
              />
              <KpiCard
                label="Fell from Green"
                value={kpis?.zone_changes?.escalated != null ? String(kpis.zone_changes.escalated) : "—"}
                icon={ArrowLeftRight}
                iconColor="red"
                valueColor={(kpis?.zone_changes?.escalated ?? 0) > 0 ? "var(--red)" : undefined}
                sub="Moved from GREEN to AMBER/RED"
              />
            </>
          )}
        </div>

        {/* ── Main row: trend chart + alerts ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Trend chart (2/3 width) */}
          <div className="card lg:col-span-2">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="section-title">
                  <BarChart2 className="w-4 h-4 text-accent" aria-hidden="true" />
                  Workforce Risk Distribution
                </h2>
                <p className="section-sub">Zone breakdown across all monitored employees</p>
              </div>
              {kpis && (
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5" style={{ color: "var(--green)" }}>
                    <span className="w-2 h-2 rounded-full bg-green" aria-hidden="true" />
                    GREEN {Math.round(kpis.pct_green ?? 0)}%
                  </span>
                  <span className="flex items-center gap-1.5" style={{ color: "var(--amber)" }}>
                    <span className="w-2 h-2 rounded-full bg-amber" aria-hidden="true" />
                    AMBER {Math.round(kpis.pct_amber ?? 0)}%
                  </span>
                  <span className="flex items-center gap-1.5" style={{ color: "var(--red)" }}>
                    <span className="w-2 h-2 rounded-full bg-red" aria-hidden="true" />
                    RED {Math.round(kpis.pct_red ?? 0)}%
                  </span>
                </div>
              )}
            </div>

            {trendData.length > 0 ? (
              <div
                className="chart-container"
                role="img"
                aria-label="Area chart showing GREEN, AMBER, and RED employee counts by classifier run"
              >
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#D97706" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#DC2626" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#DC2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--subtle)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<NexusTooltip />} />
                    <Area type="monotone" dataKey="GREEN"   stroke="#16A34A" strokeWidth={2} fill="url(#gGreen)" />
                    <Area type="monotone" dataKey="AMBER"    stroke="#D97706" strokeWidth={2} fill="url(#gAmber)" />
                    <Area type="monotone" dataKey="RED" stroke="#DC2626" strokeWidth={2} fill="url(#gRed)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-empty" style={{ height: 200 }} aria-label="No distribution data available">
                <div className="text-center">
                  <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
                  <p className="text-sm font-semibold mb-1">No distribution data</p>
                  <p className="text-xs">Upload surveys and run the classifier to see risk trends</p>
                </div>
              </div>
            )}

            {/* Zone breakdown bars */}
            {kpis && kpis.total_employees > 0 && (
              <div className="mt-5 space-y-2.5 pt-4 border-t border-border">
                {(["GREEN", "AMBER", "RED"] as const).map(zone => {
                  const count = kpis.zone_distribution?.[zone] ?? 0
                  const pct   = kpis.total_employees > 0
                    ? Math.round((count / kpis.total_employees) * 100)
                    : 0
                  const color = ZONE_COLORS[zone]
                  const label = zone === "GREEN" ? "GREEN" : zone === "AMBER" ? "AMBER" : "RED"
                  return (
                    <div key={zone} className="flex items-center gap-3">
                      <span className="text-xs font-semibold w-14 flex-shrink-0" style={{ color }}>
                        {label}
                      </span>
                      <div className="progress-track flex-1" aria-hidden="true">
                        <div
                          className="progress-fill"
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <span className="text-xs font-bold w-8 text-right font-mono" style={{ color }}>
                        {pct}%
                      </span>
                      <span className="text-xs text-muted w-8 text-right font-mono">{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Active alerts (1/3 width) */}
          <div className="card flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="section-title">
                  <AlertTriangle className="w-4 h-4 text-red" aria-hidden="true" />
                  RED Alerts
                </h2>
                <p className="section-sub">Requires HRBP review</p>
              </div>
              {alerts.length > 0 && (
                <span className="badge badge-red" aria-label={`${alerts.length} active alerts`}>
                  {alerts.length} active
                </span>
              )}
            </div>

            <div
              className="flex-1 space-y-3 overflow-y-auto"
              style={{ maxHeight: 320 }}
              role="list"
              aria-label="Active RED alerts"
            >
              {alerts.length > 0 ? (
                alerts.slice(0, 6).map(a => (
                  <div
                    key={a.id}
                    className="p-3 rounded-xl border border-red-200"
                    style={{ background: "var(--red-light)" }}
                    role="listitem"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="badge badge-red text-[10px] font-mono">{a.employee_id}</span>
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: "var(--red)" }}
                      >
                        RED
                      </span>
                    </div>
                    <p className="text-xs text-text-2 leading-relaxed mb-2">{a.message}</p>
                    <div className="flex items-center justify-between border-t border-red-200 pt-2">
                      <span className="text-[10px] text-muted font-mono">
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1.5">
                        <Link
                          href={`/employees/${a.employee_id}`}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md bg-white border border-border text-muted hover:text-text transition-colors"
                          aria-label={`View employee ${a.employee_id}`}
                        >
                          View
                        </Link>
                        <button
                          onClick={() => {
                            acknowledge(a.id)
                            toast.success("Alert acknowledged", `${a.employee_id} — alert dismissed`)
                          }}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md"
                          style={{ background: "var(--accent)", color: "#fff" }}
                          aria-label={`Acknowledge alert for ${a.employee_id}`}
                        >
                          Ack
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle
                    className="w-10 h-10 mb-3"
                    style={{ color: "var(--green)" }}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold text-text">All clear</p>
                  <p className="text-xs text-muted mt-1">No unacknowledged alerts</p>
                </div>
              )}
            </div>

            {alerts.length > 6 && (
              <Link
                href="/employees?zone=RED"
                className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                View all {alerts.length} alerts <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* ── Bottom row: AI summary + team health + actions ───── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* AI Executive Summary */}
          <div
            className="card"
            style={{ borderColor: "var(--violet-mid)" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="section-title">
                  <Sparkles className="w-4 h-4 text-violet" aria-hidden="true" />
                  AI Executive Summary
                </h2>
                <p className="section-sub">
                  LLM-generated thematic analysis of recent employee feedback
                </p>
              </div>
              <button
                onClick={generateSummary}
                disabled={summarizing}
                className="btn text-xs px-3 py-1.5 border rounded-lg font-semibold"
                style={{
                  background: "var(--violet-light)",
                  borderColor: "var(--violet-mid)",
                  color: "var(--violet)",
                }}
                aria-label="Generate AI summary"
              >
                {summarizing
                  ? <><RefreshCw className="w-3 h-3 animate-spin" />Analyzing…</>
                  : <><Zap className="w-3 h-3" />Analyze</>
                }
              </button>
            </div>

            {summarizing && (
              <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--surface2)" }}>
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-5/6 rounded" />
                <div className="skeleton h-3 w-4/5 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-3/4 rounded" />
              </div>
            )}

            {!summarizing && summary && (
              <div
                className="rounded-xl p-4 text-sm leading-relaxed"
                style={{ background: "var(--surface2)", color: "var(--text-2)" }}
                role="region"
                aria-label="AI-generated executive summary"
              >
                {summary}
              </div>
            )}

            {!summarizing && !summary && (
              <div
                className="rounded-xl p-6 text-center border-2 border-dashed"
                style={{ borderColor: "var(--violet-mid)", background: "var(--violet-light)" }}
                role="region"
                aria-label="AI summary placeholder"
              >
                <Brain className="w-8 h-8 mx-auto mb-2 text-violet opacity-60" aria-hidden="true" />
                <p className="text-sm font-semibold" style={{ color: "var(--violet)" }}>
                  Click <strong>Analyze</strong> to generate your AI executive briefing
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Requires an active LLM connection in Settings → Integrations
                </p>
              </div>
            )}
          </div>

          {/* Right column: team health + RED employees */}
          <div className="space-y-5">

            {/* Team health bars */}
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="section-title">
                    <Building2 className="w-4 h-4 text-accent" aria-hidden="true" />
                    Team Health
                  </h2>
                  <p className="section-sub">Engagement health score by department</p>
                </div>
                <Link
                  href="/teams"
                  className="text-xs font-semibold text-accent hover:underline flex items-center gap-0.5"
                >
                  All teams <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="space-y-3" role="list" aria-label="Team health scores">
                {topTeamsByHealth.length === 0 ? (
                  <p className="text-xs text-muted text-center py-4">
                    No department health data yet — upload surveys with a department column.
                  </p>
                ) : topTeamsByHealth.map(t => (
                  <div key={t.department} className="flex items-center gap-3" role="listitem">
                    <span className="text-xs font-medium w-24 flex-shrink-0 truncate" style={{ color: "var(--text-2)" }} title={t.department}>
                      {t.department}
                    </span>
                    <div
                      className="progress-track flex-1"
                      role="progressbar"
                      aria-valuenow={t.health as number}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${t.department} health: ${t.health}%`}
                    >
                      <div
                        className="progress-fill"
                        style={{ width: `${t.health}%`, background: healthColor(t.health as number) }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold w-9 text-right font-mono"
                      style={{ color: healthColor(t.health as number) }}
                    >
                      {t.health}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top RED employees */}
            {REDEmps.length > 0 && (
              <div className="card">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="section-title">
                      <ShieldAlert className="w-4 h-4 text-red" aria-hidden="true" />
                      Highest Risk Employees
                    </h2>
                    <p className="section-sub">Top RED zone — immediate action required</p>
                  </div>
                  <Link
                    href="/employees?zone=RED"
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-0.5"
                  >
                    All <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="space-y-2" role="list" aria-label="Highest risk employees">
                  {REDEmps.map(emp => (
                    <Link
                      key={emp.employee_id}
                      href={`/employees/${emp.employee_id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface2 transition-colors group"
                      role="listitem"
                      aria-label={`View profile for ${emp.employee_id}, risk score ${emp.risk_score}%`}
                    >
                      <div className="flex items-center gap-2.5">
                        <RiskBadge zone="RED" />
                        <span className="text-xs font-semibold text-text font-mono">
                          {emp.employee_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono" style={{ color: "var(--red)" }}>
                          {emp.risk_score}%
                        </span>
                        <ChevronRight
                          className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  )
}
