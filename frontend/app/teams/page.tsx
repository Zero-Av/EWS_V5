"use client"
import { useState } from "react"
import AppShell  from "@/components/AppShell"
import KpiCard   from "@/components/ui/KpiCard"
import RiskBadge from "@/components/ui/RiskBadge"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { TopicRadarChart, NexusTooltip, C } from "@/components/charts"
import {
  Building2, Users, Activity, TrendingUp, TrendingDown,
  ChevronRight, ChevronDown, Smile, AlertTriangle,
  ShieldCheck, Target, Lightbulb,
} from "lucide-react"
import Link from "next/link"
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip } from "recharts"

/* ─── Static team data ────────────────────────────────────────── */
const TEAMS = [
  {
    id: "eng",
    name: "Engineering",
    manager: "James Smith",
    headcount: 38,
    health: 64,
    trend: -4,
    avgSentiment: -0.22,
    eNPS: -22,
    critical: 2,
    watch: 8,
    stable: 28,
    topTopics: [
      { topic: "Workload",     score: -0.72 },
      { topic: "Recognition",  score:  0.18 },
      { topic: "Management",   score: -0.14 },
      { topic: "Career",       score: -0.08 },
      { topic: "Compensation", score:  0.04 },
    ],
    recommendations: [
      "Schedule team-level workload review with Engineering VP",
      "Run quarterly 1:1 cadence audit for all ICs",
      "Share recognition toolkit with team manager",
    ],
  },
  {
    id: "ops",
    name: "Operations",
    manager: "Maria Garcia",
    headcount: 19,
    health: 51,
    trend: -8,
    avgSentiment: -0.31,
    eNPS: -31,
    critical: 3,
    watch: 7,
    stable: 9,
    topTopics: [
      { topic: "Management",   score: -0.54 },
      { topic: "Workload",     score: -0.38 },
      { topic: "Career",       score: -0.22 },
      { topic: "Recognition",  score: -0.10 },
      { topic: "Compensation", score:  0.02 },
    ],
    recommendations: [
      "Initiate manager effectiveness coaching for Ops lead",
      "Conduct skip-level interviews with Ops ICs",
      "Explore career pathing workshops for Ops team",
    ],
  },
  {
    id: "sales",
    name: "Sales",
    manager: "Robert Lee",
    headcount: 44,
    health: 78,
    trend: +6,
    avgSentiment: 0.18,
    eNPS: 18,
    critical: 1,
    watch: 6,
    stable: 37,
    topTopics: [
      { topic: "Compensation", score:  0.42 },
      { topic: "Recognition",  score:  0.28 },
      { topic: "Management",   score:  0.12 },
      { topic: "Workload",     score: -0.08 },
      { topic: "Career",       score:  0.18 },
    ],
    recommendations: [
      "Maintain current recognition cadence — positive signal",
      "Monitor 1 critical employee proactively",
      "Share Sales team success story org-wide",
    ],
  },
  {
    id: "prod",
    name: "Product",
    manager: "Tanisha Patel",
    headcount: 21,
    health: 81,
    trend: +2,
    avgSentiment: 0.24,
    eNPS: 24,
    critical: 0,
    watch: 3,
    stable: 18,
    topTopics: [
      { topic: "Career",       score:  0.38 },
      { topic: "Management",   score:  0.22 },
      { topic: "Workload",     score:  0.04 },
      { topic: "Recognition",  score:  0.18 },
      { topic: "Compensation", score:  0.08 },
    ],
    recommendations: [
      "Team is thriving — no immediate interventions needed",
      "Consider pairing Prod managers as peer coaches for other teams",
    ],
  },
  {
    id: "hr",
    name: "People Ops",
    manager: "Sarah Chen",
    headcount: 12,
    health: 88,
    trend: +3,
    avgSentiment: 0.38,
    eNPS: 38,
    critical: 0,
    watch: 1,
    stable: 11,
    topTopics: [
      { topic: "Management",   score:  0.52 },
      { topic: "Recognition",  score:  0.44 },
      { topic: "Career",       score:  0.32 },
      { topic: "Workload",     score:  0.08 },
      { topic: "Compensation", score:  0.18 },
    ],
    recommendations: [
      "Benchmark People Ops practices org-wide",
      "One watch-zone employee — schedule proactive check-in",
    ],
  },
]

function healthColor(s: number) {
  return s >= 75 ? C.green : s >= 55 ? C.amber : C.red
}

/* ─── Team Card ──────────────────────────────────────────────── */
function TeamCard({ team }: { team: typeof TEAMS[0] }) {
  const [expanded, setExpanded] = useState(false)
  const hc = healthColor(team.health)

  return (
    <div className="card p-0 overflow-hidden transition-all duration-200 hover:shadow-hover">
      {/* Header bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: hc }}
        aria-hidden="true"
      />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-text">{team.name}</h3>
            <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
              <Users className="w-3 h-3" aria-hidden="true" />
              {team.headcount} employees · {team.manager}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold font-mono leading-none" style={{ color: hc }}>
              {team.health}%
            </p>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-0.5">
              Health Score
            </p>
            <div
              className={`flex items-center justify-end gap-0.5 text-[10px] font-bold mt-0.5 ${
                team.trend > 0 ? "text-green-600" : team.trend < 0 ? "text-red-600" : "text-muted"
              }`}
            >
              {team.trend > 0
                ? <TrendingUp  className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />
              }
              {team.trend > 0 ? "+" : ""}{team.trend}% vs last month
            </div>
          </div>
        </div>

        {/* Zone pills */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {team.critical > 0 && <RiskBadge zone="RED"   />}
          {team.watch    > 0 && <RiskBadge zone="AMBER" />}
          {team.stable   > 0 && <RiskBadge zone="GREEN" />}
          <span className="text-xs text-muted ml-auto">
            {team.critical} · {team.watch} · {team.stable}
          </span>
        </div>

        {/* Sentiment strip */}
        <div className="flex items-center justify-between p-3 rounded-lg mb-4"
          style={{ background: "var(--surface2)" }}>
          <div className="text-center">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">Avg Sentiment</p>
            <p className="text-base font-extrabold font-mono"
              style={{ color: team.avgSentiment >= 0 ? C.green : C.red }}>
              {team.avgSentiment > 0 ? `+${team.avgSentiment}` : team.avgSentiment}
            </p>
          </div>
          <div className="w-px h-8 bg-border" aria-hidden="true" />
          <div className="text-center">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">eNPS</p>
            <p className="text-base font-extrabold font-mono"
              style={{ color: team.eNPS >= 0 ? C.green : C.red }}>
              {team.eNPS > 0 ? `+${team.eNPS}` : team.eNPS}
            </p>
          </div>
          <div className="w-px h-8 bg-border" aria-hidden="true" />
          <div className="text-center">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">Critical</p>
            <p className="text-base font-extrabold font-mono"
              style={{ color: team.critical > 0 ? C.red : C.green }}>
              {team.critical}
            </p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between text-xs font-semibold text-muted hover:text-text transition-colors py-1"
          aria-expanded={expanded}
          aria-controls={`team-details-${team.id}`}
        >
          <span>Details & Recommendations</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {/* Expanded section */}
        {expanded && (
          <div
            id={`team-details-${team.id}`}
            className="mt-4 space-y-4 animate-fade-in"
          >
            {/* Topic radar */}
            <div>
              <p className="text-xs font-bold text-text mb-2 flex items-center gap-1.5">
                <Smile className="w-3.5 h-3.5 text-violet" aria-hidden="true" />
                Topic Sentiment
              </p>
              <TopicRadarChart data={team.topTopics} height={200} />
            </div>

            {/* Topic breakdown bars */}
            <div className="space-y-2">
              {team.topTopics.map(t => {
                const pct   = Math.round((t.score + 1) * 50)
                const color = t.score < -0.1 ? C.red : t.score <= 0.1 ? C.amber : C.green
                return (
                  <div key={t.topic}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: "var(--text-2)" }}>{t.topic}</span>
                      <span className="text-xs font-bold font-mono" style={{ color }}>
                        {t.score > 0 ? `+${t.score}` : t.score}
                      </span>
                    </div>
                    <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* AI recommendations */}
            <div className="rounded-xl p-3.5 border border-violet-200"
              style={{ background: "var(--violet-light)" }}>
              <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: "var(--violet)" }}>
                <Lightbulb className="w-3.5 h-3.5" aria-hidden="true" />
                Recommended Actions
              </p>
              <ul className="space-y-1.5" role="list">
                {team.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-2)" }}>
                    <span className="font-bold mt-px flex-shrink-0" style={{ color: "var(--violet)" }}>{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href={`/employees?dept=${team.name}`}
              className="flex items-center justify-center gap-1 w-full py-2 text-xs font-semibold text-accent hover:underline border-t border-border mt-2 pt-3"
            >
              View {team.name} employees <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TEAMS PAGE
═══════════════════════════════════════════════════════════════ */
export default function TeamsPage() {
  const { kpis, loading } = useDashboard(120_000)
  const [filter, setFilter] = useState<"all" | "risk" | "healthy">("all")

  const filtered = TEAMS.filter(t => {
    if (filter === "risk")    return t.health < 70
    if (filter === "healthy") return t.health >= 75
    return true
  })

  const avgHealth = Math.round(TEAMS.reduce((s, t) => s + t.health, 0) / TEAMS.length)
  const atRisk    = TEAMS.filter(t => t.health < 70).length
  const thriving  = TEAMS.filter(t => t.health >= 80).length

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Teams</h1>
            <p className="page-subtitle">
              Team-level health, sentiment analysis, topic breakdown, and manager action recommendations
            </p>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Org Avg Health"  value={`${avgHealth}%`}     icon={Activity}      iconColor="blue"   valueColor="var(--accent)" />
          <KpiCard label="Teams Monitored" value={TEAMS.length}        icon={Building2}     iconColor="blue" />
          <KpiCard label="Teams at Risk"   value={atRisk}              icon={AlertTriangle} iconColor="red"
            valueColor={atRisk > 0 ? "var(--red)" : undefined}
            sub="Health below 70%" />
          <KpiCard label="Thriving Teams"  value={thriving}            icon={ShieldCheck}   iconColor="green"
            valueColor="var(--green)" sub="Health above 80%" />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center justify-between">
          <div className="tab-group" role="group" aria-label="Filter teams">
            {[
              { id: "all",     label: "All Teams" },
              { id: "risk",    label: `Needs Attention (${atRisk})` },
              { id: "healthy", label: `Thriving (${thriving})` },
            ].map(f => (
              <button
                key={f.id}
                className={`tab-item ${filter === f.id ? "active" : ""}`}
                onClick={() => setFilter(f.id as typeof filter)}
                aria-pressed={filter === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">{filtered.length} teams</span>
        </div>

        {/* Team cards grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
          role="list"
          aria-label="Team health cards"
        >
          {filtered.map(t => (
            <div key={t.id} role="listitem">
              <TeamCard team={t} />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target className="w-10 h-10 text-muted opacity-40 mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-text">No teams match this filter</p>
            <button onClick={() => setFilter("all")} className="text-xs text-accent hover:underline mt-2">
              Show all teams
            </button>
          </div>
        )}

      </div>
    </AppShell>
  )
}
