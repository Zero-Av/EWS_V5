"use client"
import { useMemo, useState, useEffect, useCallback } from "react"
import AppShell from "@/components/AppShell"
import KpiCard  from "@/components/ui/KpiCard"
import { KpiCardSkeleton, Skeleton } from "@/components/ui/Skeleton"
import { useDashboard }    from "@/lib/hooks/useDashboard"
import { useToast } from "@/lib/toast-context"
import { getTeams, getTopics, type TeamRecord } from "@/lib/api"
import {
  ZoneTrendChart, RiskDonutChart, NexusTooltip, C,
} from "@/components/charts"
import {
  Activity, Users, Smile, TrendingUp,
  AlertTriangle, Building2, ChevronRight, RefreshCw,
  ShieldCheck, Clock,
} from "lucide-react"
import Link from "next/link"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts"

const TOPIC_COLORS = [C.red, C.amber, C.blue, C.violet, C.green, C.cyan]

function healthColor(score: number) {
  if (score >= 75) return C.green
  if (score >= 55) return C.amber
  return C.red
}

export default function WorkforcePage() {
  const { kpis, loading, lastUpdated, refresh } = useDashboard(120_000)
  const toast = useToast()

  const [teams, setTeams] = useState<TeamRecord[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [topTopics, setTopTopics] = useState<string[]>([])
  const [topicTrend, setTopicTrend] = useState<Record<string, string | number>[]>([])
  const [topicsLoading, setTopicsLoading] = useState(true)

  const loadTeams = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const res = await getTeams()
      setTeams(res.teams ?? [])
    } catch (e: any) {
      toast.error("Failed to load department health", e.message)
    } finally {
      setTeamsLoading(false)
    }
  }, [toast])

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true)
    try {
      const res = await getTopics()
      const topN = (res.topics ?? []).slice(0, 4).map(t => t.topic)
      setTopTopics(topN)
      setTopicTrend(res.monthly_trend ?? [])
    } catch (e: any) {
      toast.error("Failed to load topic trends", e.message)
    } finally {
      setTopicsLoading(false)
    }
  }, [toast])

  useEffect(() => { loadTeams(); loadTopics() }, [loadTeams, loadTopics])

  const handleRefresh = () => { refresh(); loadTeams(); loadTopics() }

  // Real risk-zone trend, built only from actual classifier run history —
  // no interpolated/fabricated months.
  const trendData = useMemo(
    () => (kpis?.zone_trend ?? []).map(p => ({
      month: p.month, Stable: p.GREEN, Watch: p.AMBER, Critical: p.RED,
    })),
    [kpis]
  )

  const eNPS = kpis ? Math.round((kpis.avg_sentiment ?? 0) * 100) : null

  const withHealth = teams.filter(t => t.health != null)
  const orgHealth = withHealth.length
    ? Math.round(withHealth.reduce((s, t) => s + (t.health as number), 0) / withHealth.length)
    : null
  const deptsAtRisk = teams.filter(t => (t.health ?? 100) < 60)
  const attentionDepts = teams.filter(t => (t.health ?? 100) < 75)

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Workforce Health</h1>
            <p className="page-subtitle">
              Organisation-wide engagement, sentiment trends, and department health — all derived from your uploaded survey data
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <button onClick={handleRefresh} className="btn-ghost text-xs" aria-label="Refresh workforce data">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {loading || teamsLoading ? Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />) : (
            <>
              <KpiCard label="Total Monitored"  value={kpis?.total_employees ?? "—"}  icon={Users}        iconColor="blue" />
              <KpiCard label="Org Health Score" value={orgHealth != null ? `${orgHealth}%` : "—"}
                icon={Activity} iconColor="green" valueColor="var(--green)" />
              <KpiCard label="eNPS Score"       value={eNPS !== null ? (eNPS > 0 ? `+${eNPS}` : eNPS) : "—"}
                icon={Smile} iconColor="violet" valueColor="var(--violet)"
                sub="Based on avg sentiment" />
              <KpiCard label="Depts at Risk"    value={deptsAtRisk.length}
                icon={AlertTriangle} iconColor="red"
                valueColor={deptsAtRisk.length > 0 ? "var(--red)" : undefined}
                sub="Health score below 60%" />
              <KpiCard label="Survey Coverage"  value={kpis?.survey_coverage ?? "—"}  icon={TrendingUp}   iconColor="blue"
                sub="Employees with survey data" />
            </>
          )}
        </div>

        {/* Main row: trend + donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          <div className="card lg:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="section-title">
                  <TrendingUp className="w-4 h-4 text-accent" aria-hidden="true" />
                  Risk Zone Trend
                </h2>
                <p className="section-sub">
                  Real history from classifier runs — one point per month the classifier was actually run
                </p>
              </div>
            </div>
            <ZoneTrendChart data={trendData} height={210} />
          </div>

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
                Health = share of classified employees in GREEN/AMBER vs RED, from your actual survey data
              </p>
            </div>
            <Link href="/teams" className="text-xs font-semibold text-accent hover:underline flex items-center gap-1">
              Team details <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {teamsLoading ? (
            <Skeleton height={240} rounded="lg" />
          ) : teams.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">
              No department data yet — upload surveys with a department column to populate this matrix.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div role="img" aria-label="Department health bar chart">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={teams.filter(t => t.health != null)}
                    layout="vertical"
                    margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke={C.subtle} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="department" stroke={C.subtle} fontSize={11} tickLine={false} axisLine={false} width={80} />
                    <Tooltip content={<NexusTooltip />} />
                    <Bar dataKey="health" name="Health Score" radius={[0, 6, 6, 0]} maxBarSize={20}>
                      {teams.filter(t => t.health != null).map((d, i) => (
                        <Cell key={i} fill={healthColor(d.health as number)} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

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
                    {teams.map(d => (
                      <tr key={d.department}>
                        <td className="font-semibold">{d.department}</td>
                        <td className="text-right">
                          <span className="font-bold font-mono" style={{ color: d.health != null ? healthColor(d.health) : C.subtle }}>
                            {d.health != null ? `${d.health}%` : "—"}
                          </span>
                        </td>
                        <td className="text-right font-mono text-muted">{d.headcount}</td>
                        <td className="text-right">
                          {d.red > 0 ? (
                            <span className="badge badge-red text-[10px]">{d.red} critical</span>
                          ) : d.amber > 0 ? (
                            <span className="badge badge-amber text-[10px]">{d.amber} watch</span>
                          ) : d.red + d.amber + d.green > 0 ? (
                            <span className="flex items-center justify-end gap-1 text-xs font-semibold" style={{ color: C.green }}>
                              <ShieldCheck className="w-3 h-3" aria-hidden="true" /> All stable
                            </span>
                          ) : (
                            <span className="text-xs text-muted">Unclassified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Topic sentiment trend */}
        <div className="card">
          <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
            <div>
              <h2 className="section-title">
                <Smile className="w-4 h-4 text-violet" aria-hidden="true" />
                Topic Sentiment Trends
              </h2>
              <p className="section-sub">Monthly sentiment by the most-discussed survey themes, from your actual comments</p>
            </div>
            {topTopics.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
                {topTopics.map((t, i) => (
                  <span key={t} className="flex items-center gap-1.5 capitalize" style={{ color: TOPIC_COLORS[i % TOPIC_COLORS.length] }}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: TOPIC_COLORS[i % TOPIC_COLORS.length] }} aria-hidden="true" />
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {topicsLoading ? (
            <Skeleton height={200} rounded="lg" />
          ) : topTopics.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">
              No topic-tagged survey data yet. Upload surveys with topic analysis enabled to see this chart.
            </p>
          ) : (
            <div role="img" aria-label="Topic sentiment trend chart by month">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topicTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="month" stroke={C.subtle} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={C.subtle} fontSize={11} tickLine={false} axisLine={false} domain={[-1, 1]} />
                  <Tooltip content={<NexusTooltip />} />
                  {topTopics.map((t, i) => (
                    <Bar key={t} dataKey={t} fill={TOPIC_COLORS[i % TOPIC_COLORS.length]} fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={14} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Departments needing attention */}
        {!teamsLoading && attentionDepts.length > 0 && (
          <div className="alert-warning" role="alert">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Departments needing attention</p>
              <p className="text-xs mt-0.5">
                {attentionDepts.map(d => d.department).join(", ")} — health scores
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
