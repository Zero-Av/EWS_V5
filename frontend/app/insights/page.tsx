"use client"
import { useState, useCallback, useEffect } from "react"
import AppShell from "@/components/AppShell"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/Skeleton"
import { useToast } from "@/lib/toast-context"
import { getSurveySummary, getTopics, getAnalyticsDashboard, type TeamTopic } from "@/lib/api"
import {
  Sparkles, RefreshCw, Zap, Brain, TrendingUp,
  TrendingDown, MessageSquare, AlertTriangle, ShieldAlert, Users, Shield,
} from "lucide-react"

function sentColor(v: number) {
  return v < -0.1 ? "var(--red)" : v <= 0.1 ? "var(--amber)" : "var(--green)"
}

export default function InsightsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [summary,     setSummary]     = useState("")
  const [summarizing, setSummarizing] = useState(false)

  const [topics, setTopics] = useState<TeamTopic[]>([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [kpis, setKpis] = useState<any>(null)
  const [kpisLoading, setKpisLoading] = useState(true)

  const generate = useCallback(async () => {
    setSummarizing(true)
    try {
      const res = await getSurveySummary()
      setSummary(res.summary)
    } catch (e: any) {
      toast.error("Summary failed", e.message || "Check your LLM connection in Settings → Integrations")
    } finally {
      setSummarizing(false)
    }
  }, [toast])

  const loadData = useCallback(async () => {
    setTopicsLoading(true); setKpisLoading(true)
    try {
      const res = await getTopics()
      setTopics(res.topics ?? [])
    } catch (e: any) {
      toast.error("Failed to load theme clusters", e.message)
    } finally {
      setTopicsLoading(false)
    }
    try {
      setKpis(await getAnalyticsDashboard())
    } catch {
      setKpis(null)
    } finally {
      setKpisLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const redCount   = kpis?.zone_distribution?.RED   ?? 0
  const amberCount = kpis?.zone_distribution?.AMBER ?? 0
  const greenCount = kpis?.zone_distribution?.GREEN ?? 0

  if (user?.role === "analyst") {
    return (
      <AppShell>
        <div className="page-container flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <Shield className="w-12 h-12 mx-auto text-muted opacity-40" />
            <h1 className="text-lg font-bold text-text">Access Restricted</h1>
            <p className="text-sm text-muted">This page is not available for your role.</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        <div className="page-header">
          <div>
            <h1 className="page-title">AI Insights Center</h1>
            <p className="page-subtitle">LLM-powered thematic analysis, sentiment trends, and workforce intelligence — grounded in your uploaded survey data</p>
          </div>
          <button onClick={generate} disabled={summarizing} className="btn-violet text-xs">
            {summarizing
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Analyzing…</>
              : <><Zap className="w-3.5 h-3.5" />Generate Briefing</>
            }
          </button>
        </div>

        {/* AI Executive Narrative */}
        <div className="card" style={{ borderColor: "var(--violet-mid)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="badge badge-violet text-[10px]">
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  AI Analysis
                </span>
              </div>
              <h2 className="text-sm font-bold text-text">Executive Workforce Narrative</h2>
              <p className="text-xs text-muted mt-0.5">AI-generated summary of recent employee feedback patterns</p>
            </div>
          </div>

          {summarizing && (
            <div className="rounded-xl p-5 space-y-2.5" style={{ background: "var(--surface2)" }}>
              {[100, 90, 95, 80, 85, 60].map((w, i) => (
                <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {!summarizing && summary && (
            <div className="rounded-xl p-5 text-sm leading-relaxed"
              style={{ background: "var(--surface2)", color: "var(--text-2)" }}
              role="region" aria-label="AI executive narrative">
              {summary}
            </div>
          )}

          {!summarizing && !summary && (
            <div className="rounded-xl p-8 text-center border-2 border-dashed"
              style={{ borderColor: "var(--violet-mid)", background: "var(--violet-light)" }}>
              <Brain className="w-10 h-10 mx-auto mb-3 text-violet opacity-60" aria-hidden="true" />
              <p className="text-sm font-semibold text-violet">Click <strong>Generate Briefing</strong> to run AI analysis</p>
              <p className="text-xs text-muted mt-1.5">
                Analyzes all survey comments using your connected LLM · Requires an active integration
              </p>
            </div>
          )}
        </div>

        {/* Theme Clusters — real topic aggregates from survey comments */}
        <div>
          <h2 className="section-title mb-4">
            <MessageSquare className="w-4 h-4 text-accent" aria-hidden="true" />
            Theme Clusters
            <span className="text-xs font-normal text-muted ml-2">Zero-shot topic analysis across all survey comments</span>
          </h2>

          {topicsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={140} rounded="lg" />)}
            </div>
          ) : topics.length === 0 ? (
            <div className="card text-center py-10">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted opacity-40" aria-hidden="true" />
              <p className="text-sm font-semibold text-text">No theme data yet</p>
              <p className="text-xs text-muted mt-1">Upload surveys with topic analysis enabled to populate this section.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
              {topics.map(tc => (
                <div key={tc.topic} className="card hover:shadow-hover cursor-default" role="listitem">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-bold text-text capitalize">{tc.topic}</h3>
                    <span className="text-xs font-semibold text-muted bg-surface2 border border-border px-2 py-0.5 rounded-full">
                      {tc.mentions} mention{tc.mentions !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl font-extrabold font-mono" style={{ color: sentColor(tc.avg_sentiment) }}>
                      {tc.avg_sentiment > 0 ? `+${tc.avg_sentiment.toFixed(2)}` : tc.avg_sentiment.toFixed(2)}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Sentiment</span>
                      <span className="flex items-center gap-1 text-[10px] font-bold"
                        style={{ color: tc.sentiment_delta > 0 ? "var(--green)" : tc.sentiment_delta < 0 ? "var(--red)" : "var(--muted)" }}>
                        {tc.sentiment_delta > 0 ? <TrendingUp className="w-3 h-3" /> : tc.sentiment_delta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                        {tc.sentiment_delta > 0 ? `+${tc.sentiment_delta.toFixed(2)}` : tc.sentiment_delta === 0 ? "No change" : tc.sentiment_delta.toFixed(2)} vs earlier surveys
                      </span>
                    </div>
                  </div>

                  <div className="progress-track">
                    <div className="progress-fill" style={{
                      width: `${Math.round((tc.avg_sentiment + 1) * 50)}%`,
                      background: sentColor(tc.avg_sentiment),
                    }} />
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-muted">Negative</span>
                    <span className="text-[10px] text-muted">Positive</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current risk snapshot — real classification counts, not a forecast */}
        <div className="card" style={{ borderColor: "var(--accent-mid)", background: "var(--accent-light)" }}>
          <h2 className="section-title mb-4">
            <Brain className="w-4 h-4 text-accent" aria-hidden="true" />
            Current Risk Snapshot
          </h2>
          {kpisLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={90} rounded="lg" />)}
            </div>
          ) : !kpis || kpis.total_employees === 0 ? (
            <p className="text-sm text-muted text-center py-6">
              No classification data yet. Run the classifier from the Employees page to populate this snapshot.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "RED now",      value: String(redCount),   sub: "RED zone — needs action this week", color: "var(--red)",   icon: ShieldAlert },
                  { label: "Needs monitoring",  value: String(amberCount), sub: "AMBER zone — proactive check-ins",  color: "var(--amber)", icon: AlertTriangle },
                  { label: "Currently stable",  value: String(greenCount), sub: "GREEN zone — no action needed",     color: "var(--green)", icon: Users },
                ].map(p => (
                  <div key={p.label} className="p-4 rounded-xl bg-surface border border-border text-center">
                    <p.icon className="w-5 h-5 mx-auto mb-2" style={{ color: p.color }} aria-hidden="true" />
                    <p className="text-xl font-extrabold" style={{ color: p.color }}>{p.value}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mt-1">{p.label}</p>
                    <p className="text-[10px] text-muted">{p.sub}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted mt-3 text-center">
                Reflects the most recent classifier run · re-run the classifier after new survey uploads to refresh
              </p>
            </>
          )}
        </div>

      </div>
    </AppShell>
  )
}
