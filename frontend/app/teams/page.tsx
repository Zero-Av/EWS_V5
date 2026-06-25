"use client"
import { useState, useEffect, useCallback } from "react"
import AppShell  from "@/components/AppShell"
import KpiCard   from "@/components/ui/KpiCard"
import RiskBadge from "@/components/ui/RiskBadge"
import { Skeleton } from "@/components/ui/Skeleton"
import { useToast } from "@/lib/toast-context"
import { getTeams, type TeamRecord } from "@/lib/api"
import { TopicRadarChart, C } from "@/components/charts"
import {
  Building2, Users, Activity, ChevronRight, ChevronDown, Smile,
  AlertTriangle, ShieldCheck, Target, Lightbulb, RefreshCw, User,
} from "lucide-react"
import Link from "next/link"

function healthColor(s: number | null) {
  if (s == null) return C.amber
  return s >= 75 ? C.green : s >= 55 ? C.amber : C.red
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-")
}

/* ─── Team Card ──────────────────────────────────────────────── */
function TeamCard({ team }: { team: TeamRecord }) {
  const [expanded, setExpanded] = useState(false)
  const hc = healthColor(team.health)
  const slug = slugify(team.department)
  const classified = team.red + team.amber + team.green
  const radarData = team.topics.map(t => ({ topic: t.topic, score: t.avg_sentiment }))

  return (
    <div className="card p-0 overflow-hidden transition-all duration-200 hover:shadow-hover">
      <div className="h-1.5 w-full" style={{ background: hc }} aria-hidden="true" />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-text">{team.department}</h3>
            <p className="text-xs text-muted mt-0.5 flex items-center gap-1 flex-wrap">
              <Users className="w-3 h-3" aria-hidden="true" />
              {team.headcount} employee{team.headcount !== 1 ? "s" : ""}
              {team.manager_id && (
                <span className="flex items-center gap-1 ml-1">
                  <User className="w-3 h-3" aria-hidden="true" />
                  <span className="font-mono">{team.manager_id}</span>
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold font-mono leading-none" style={{ color: hc }}>
              {team.health != null ? `${team.health}%` : "—"}
            </p>
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-0.5">
              Health Score
            </p>
          </div>
        </div>

        {/* Zone pills */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {team.red   > 0 && <RiskBadge zone="RED" />}
          {team.amber > 0 && <RiskBadge zone="AMBER" />}
          {team.green > 0 && <RiskBadge zone="GREEN" />}
          {classified === 0 && <span className="badge badge-gray text-[10px]">Not yet classified</span>}
          <span className="text-xs text-muted ml-auto">
            {team.red} · {team.amber} · {team.green}
            {team.unclassified > 0 ? ` · ${team.unclassified} unclassified` : ""}
          </span>
        </div>

        {/* Sentiment strip */}
        <div className="flex items-center justify-between p-3 rounded-lg mb-4" style={{ background: "var(--surface2)" }}>
          <div className="text-center flex-1">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">Avg Sentiment</p>
            <p className="text-base font-extrabold font-mono" style={{ color: (team.avg_sentiment ?? 0) >= 0 ? C.green : C.red }}>
              {team.avg_sentiment == null ? "—" : team.avg_sentiment > 0 ? `+${team.avg_sentiment.toFixed(2)}` : team.avg_sentiment.toFixed(2)}
            </p>
          </div>
          <div className="w-px h-8 bg-border" aria-hidden="true" />
          <div className="text-center flex-1">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">eNPS</p>
            <p className="text-base font-extrabold font-mono" style={{ color: (team.enps ?? 0) >= 0 ? C.green : C.red }}>
              {team.enps == null ? "—" : team.enps > 0 ? `+${team.enps}` : team.enps}
            </p>
          </div>
          <div className="w-px h-8 bg-border" aria-hidden="true" />
          <div className="text-center flex-1">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">RED</p>
            <p className="text-base font-extrabold font-mono" style={{ color: team.red > 0 ? C.red : C.green }}>
              {team.red}
            </p>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between text-xs font-semibold text-muted hover:text-text transition-colors py-1"
          aria-expanded={expanded}
          aria-controls={`team-details-${slug}`}
        >
          <span>Details & Recommendations</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {expanded && (
          <div id={`team-details-${slug}`} className="mt-4 space-y-4 animate-fade-in">
            {team.topics.length > 0 ? (
              <>
                <div>
                  <p className="text-xs font-bold text-text mb-2 flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-violet" aria-hidden="true" />
                    Topic Sentiment
                  </p>
                  <TopicRadarChart data={radarData} height={200} />
                </div>

                <div className="space-y-2">
                  {team.topics.map(t => {
                    const pct   = Math.round((t.avg_sentiment + 1) * 50)
                    const color = t.avg_sentiment < -0.1 ? C.red : t.avg_sentiment <= 0.1 ? C.amber : C.green
                    return (
                      <div key={t.topic}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium capitalize" style={{ color: "var(--text-2)" }}>
                            {t.topic} <span className="text-muted">({t.mentions})</span>
                          </span>
                          <span className="text-xs font-bold font-mono" style={{ color }}>
                            {t.avg_sentiment > 0 ? `+${t.avg_sentiment.toFixed(2)}` : t.avg_sentiment.toFixed(2)}
                          </span>
                        </div>
                        <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                          <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted text-center py-3">No topic data yet for this team.</p>
            )}

            {/* Data-grounded recommendations */}
            <div className="rounded-xl p-3.5 border border-violet-200" style={{ background: "var(--violet-light)" }}>
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
              href={`/employees?dept=${encodeURIComponent(team.department)}`}
              className="flex items-center justify-center gap-1 w-full py-2 text-xs font-semibold text-accent hover:underline border-t border-border mt-2 pt-3"
            >
              View {team.department} employees <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TEAMS PAGE — real department rollups, no placeholder teams
═══════════════════════════════════════════════════════════════ */
export default function TeamsPage() {
  const toast = useToast()
  const [teams, setTeams]     = useState<TeamRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<"all" | "risk" | "healthy">("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTeams()
      setTeams(res.teams ?? [])
    } catch (e: any) {
      toast.error("Failed to load teams", e.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = teams.filter(t => {
    if (filter === "risk")    return (t.health ?? 100) < 70
    if (filter === "healthy") return (t.health ?? 0) >= 75
    return true
  })

  const withHealth = teams.filter(t => t.health != null)
  const avgHealth  = withHealth.length ? Math.round(withHealth.reduce((s, t) => s + (t.health as number), 0) / withHealth.length) : null
  const atRisk     = teams.filter(t => (t.health ?? 100) < 70).length
  const thriving   = teams.filter(t => (t.health ?? 0) >= 80).length

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        <div className="page-header">
          <div>
            <h1 className="page-title">Teams</h1>
            <p className="page-subtitle">
              Department-level health, sentiment, topic breakdown, and recommendations — derived from your uploaded survey data
            </p>
          </div>
          <button onClick={load} className="btn-ghost text-xs" aria-label="Refresh teams">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={90} rounded="lg" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Org Avg Health"  value={avgHealth != null ? `${avgHealth}%` : "—"} icon={Activity} iconColor="blue" valueColor="var(--accent)" />
            <KpiCard label="Teams Found"     value={teams.length} icon={Building2} iconColor="blue" />
            <KpiCard label="Teams at Risk"   value={atRisk} icon={AlertTriangle} iconColor="red"
              valueColor={atRisk > 0 ? "var(--red)" : undefined} sub="Health below 70%" />
            <KpiCard label="Thriving Teams"  value={thriving} icon={ShieldCheck} iconColor="green"
              valueColor="var(--green)" sub="Health above 80%" />
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
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

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={260} rounded="lg" />)}
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Building2 className="w-10 h-10 text-muted opacity-40 mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-text">No team data yet</p>
            <p className="text-xs text-muted mt-1 max-w-xs">
              Upload a survey CSV with a department column to see team-level breakdowns here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Target className="w-10 h-10 text-muted opacity-40 mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-text">No teams match this filter</p>
            <button onClick={() => setFilter("all")} className="text-xs text-accent hover:underline mt-2">
              Show all teams
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" role="list" aria-label="Team health cards">
            {filtered.map(t => (
              <div key={t.department} role="listitem">
                <TeamCard team={t} />
              </div>
            ))}
          </div>
        )}

      </div>
    </AppShell>
  )
}
