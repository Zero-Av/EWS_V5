"use client"
import { useMemo } from "react"
import AppShell from "@/components/AppShell"
import KpiCard  from "@/components/ui/KpiCard"
import RiskBadge from "@/components/ui/RiskBadge"
import { KpiCardSkeleton } from "@/components/ui/Skeleton"
import { useDashboard }    from "@/lib/hooks/useDashboard"
import {
  ZoneTrendChart, RiskDonutChart, NexusTooltip, C,
} from "@/components/charts"
import {
  Activity, Users, Smile, TrendingUp, TrendingDown,
  AlertTriangle, Building2, ChevronRight, RefreshCw,
  ShieldCheck, Clock,
} from "lucide-react"
import Link from "next/link"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts"

/* ── static team health data (populated from classification zones in real use) */
const DEPT_HEALTH = [
  { dept: "Engineering",  health: 64, employees: 38, red: 2, amber: 8,  green: 28 },
  { dept: "Product",      health: 81, employees: 21, red: 0, amber: 3,  green: 18 },
  { dept: "Sales",        health: 78, employees: 44, red: 1, amber: 6,  green: 37 },
  { dept: "Operations",   health: 51, employees: 19, red: 3, amber: 7,  green:  9 },
  { dept: "People Ops",   health: 88, employees: 12, red: 0, amber: 1,  green: 11 },
  { dept: "Finance",      health: 72, employees: 15, red: 0, amber: 4,  green: 11 },
  { dept: "Legal",        health: 85, employees:  8, red: 0, amber: 1,  green:  7 },
]

const TOPIC_TREND = [
  { month: "Jan", Workload: -0.12, Management: -0.08, Compensation: 0.04, Recognition: 0.18 },
  { month: "Feb", Workload: -0.18, Management: -0.05, Compensation: 0.06, Recognition: 0.15 },
  { month: "Mar", Workload: -0.25, Management: -0.10, Compensation: 0.03, Recognition: 0.12 },
  { month: "Apr", Workload: -0.30, Management: -0.14, Compensation: 0.02, Recognition: 0.10 },
  { month: "May", Workload: -0.35, Management: -0.12, Compensation: 0.05, Recognition: 0.14 },
  { month: "Jun", Workload: -0.38, Management: -0.14, Compensation: 0.02, Recognition: 0.21 },
]

function healthColor(score: number) {
  if (score >= 75) return C.green
  if (score >= 55) return C.amber
  return C.red
}

function buildZoneTrend(dist: Record<string, number>) {
  const g = dist.GREEN ?? 0, a = dist.AMBER ?? 0, r = dist.RED ?? 0
  if (!g && !a && !r) return []
  return ["Jan","Feb","Mar","Apr","May","Jun"].map((m, i) => {
    const f = 0.65 + (i / 5) * 0.35
    return { month: m, Stable: Math.round(g * f), Watch: Math.round(a * f), Critical: Math.round(r * f) }
  })
}

export default function WorkforcePage() {
  const { kpis, classifications, loading, lastUpdated, refresh } = useDashboard(120_000)

  const trendData = useMemo(
    () => kpis ? buildZoneTrend(kpis.zone_distribution ?? {}) : [],
    [kpis]
  )

  const eNPS = kpis ? Math.round((kpis.avg_sentiment ?? 0) * 100) : null

  const topRiskDepts = [...DEPT_HEALTH].sort((a, b) => a.health - b.health).slice(0, 3)

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Workforce Health</h1>
            <p className="page-subtitle">
              Organisation-wide engagement, sentiment trends, and department health overview
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button onClick={refresh} className="btn-ghost text-xs" aria-label="Refresh workforce data">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {loading ? Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />) : (
            <>
              <KpiCard label="Total Monitored"  value={kpis?.total_employees ?? "—"}  icon={Users}        iconColor="blue" />
              <KpiCard label="Org Health Score" value={`${DEPT_HEALTH.reduce((s, d) => s + d.health, 0) / DEPT_HEALTH.length | 0}%`}
                icon={Activity} iconColor="green" valueColor="var(--green)"
                delta={{ value: 4, label: "vs last month" }} />
              <KpiCard label="eNPS Score"       value={eNPS !== null ? (eNPS > 0 ? `+${eNPS}` : eNPS) : "—"}
                icon={Smile} iconColor="violet" valueColor="var(--violet)"
                sub="Based on avg sentiment" />
              <KpiCard label="Depts at Risk"    value={DEPT_HEALTH.filter(d => d.health < 60).length}
                icon={AlertTriangle} iconColor="red"
                valueColor={DEPT_HEALTH.filter(d => d.health < 60).length > 0 ? "var(--red)" : undefined}
                sub="Health score below 60%" />
              <KpiCard label="Survey Coverage"  value={kpis?.survey_coverage ?? "—"}  icon={TrendingUp}   iconColor="blue"
                sub="Employees with survey data" />
            </>
          )}
        </div>

        {/* Main row: trend + donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Zone trend area chart */}
          <div className="card lg:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="section-title">
                  <TrendingUp className="w-4 h-4 text-accent" aria-hidden="true" />
                  Risk Zone Trend
                </h2>
                <p className="section-sub">6-month rolling window — stable, watch, and critical employee counts</p>
              </div>
            </div>
            <ZoneTrendChart data={trendData} height={210} />
          </div>

          {/* Risk donut */}
          <div className="card flex flex-col">
            <h2 className="section-title mb-2">
              <Activity className="w-4 h-4 text-accent" aria-hidden="true" />
              Current Distribution
            </h2>
            <p className="section-sub mb-4">Live zone breakdown</p>
            <RiskDonutChart
              distribution={kpis?.zone_distribution ?? {}}
              height={180}
            />
            {kpis && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Stable",   pct: kpis.pct_green ?? 0, color: C.green },
                  { label: "Watch",    pct: kpis.pct_amber ?? 0, color: C.amber },
                  { label: "Critical", pct: kpis.pct_red   ?? 0, color: C.red   },
                ].map(z => (
                  <div key={z.label}>
                    <p className="text-base font-extrabold font-mono" style={{ color: z.color }}>
                      {Math.round(z.pct)}%
                    </p>
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{z.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Department health matrix */}
        <div className="card">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="section-title">
                <Building2 className="w-4 h-4 text-accent" aria-hidden="true" />
                Department Health Matrix
              </h2>
              <p className="section-sub">
                Health scores derived from sentiment velocity, risk zone distribution, and survey coverage
              </p>
            </div>
            <Link href="/teams" className="text-xs font-semibold text-accent hover:underline flex items-center gap-1">
              Team details <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div role="img" aria-label="Department health bar chart">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={DEPT_HEALTH}
                  layout="vertical"
                  margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke={C.subtle} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="dept" stroke={C.subtle} fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <Tooltip content={<NexusTooltip />} />
                  <Bar dataKey="health" name="Health Score" radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {DEPT_HEALTH.map((d, i) => (
                      <Cell key={i} fill={healthColor(d.health)} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="data-table" aria-label="Department health details">
                <thead>
                  <tr>
                    <th scope="col">Department</th>
                    <th scope="col" className="text-right">Health</th>
                    <th scope="col" className="text-right">Headcount</th>
                    <th scope="col" className="text-right">At Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {DEPT_HEALTH.map(d => (
                    <tr key={d.dept}>
                      <td className="font-semibold">{d.dept}</td>
                      <td className="text-right">
                        <span className="font-bold font-mono" style={{ color: healthColor(d.health) }}>
                          {d.health}%
                        </span>
                      </td>
                      <td className="text-right font-mono text-muted">{d.employees}</td>
                      <td className="text-right">
                        {d.red > 0 ? (
                          <span className="badge badge-red text-[10px]">{d.red} critical</span>
                        ) : d.amber > 0 ? (
                          <span className="badge badge-amber text-[10px]">{d.amber} watch</span>
                        ) : (
                          <span className="flex items-center justify-end gap-1 text-xs font-semibold" style={{ color: C.green }}>
                            <ShieldCheck className="w-3 h-3" aria-hidden="true" /> All stable
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Topic sentiment trend */}
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="section-title">
                <Smile className="w-4 h-4 text-violet" aria-hidden="true" />
                Topic Sentiment Trends
              </h2>
              <p className="section-sub">6-month sentiment trajectory by survey theme</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
              {[
                { key: "Workload", color: C.red },
                { key: "Management", color: C.amber },
                { key: "Compensation", color: C.green },
                { key: "Recognition", color: C.blue },
              ].map(t => (
                <span key={t.key} className="flex items-center gap-1.5" style={{ color: t.color }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: t.color }} aria-hidden="true" />
                  {t.key}
                </span>
              ))}
            </div>
          </div>

          <div role="img" aria-label="Topic sentiment trend line chart over 6 months">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={TOPIC_TREND} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="month" stroke={C.subtle} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={C.subtle} fontSize={11} tickLine={false} axisLine={false} domain={[-0.5, 0.3]} />
                <Tooltip content={<NexusTooltip />} />
                {[
                  { key: "Workload", color: C.red },
                  { key: "Management", color: C.amber },
                  { key: "Compensation", color: C.green },
                  { key: "Recognition", color: C.blue },
                ].map(t => (
                  <Bar key={t.key} dataKey={t.key} fill={t.color} fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={14} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Departments needing attention */}
        {topRiskDepts.some(d => d.health < 75) && (
          <div className="alert-warning" role="alert">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Departments needing attention</p>
              <p className="text-xs mt-0.5">
                {topRiskDepts.filter(d => d.health < 75).map(d => d.dept).join(", ")} — health scores
                below recommended threshold. Consider pulse surveys and manager coaching sessions.
              </p>
            </div>
            <Link href="/teams" className="text-xs font-bold whitespace-nowrap hover:underline flex items-center gap-1">
              View teams <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

      </div>
    </AppShell>
  )
}
