"use client"
import { useState, useCallback } from "react"
import AppShell from "@/components/AppShell"
import { useToast } from "@/lib/toast-context"
import { getSurveySummary } from "@/lib/api"
import {
  Sparkles, RefreshCw, Zap, Brain, TrendingUp,
  TrendingDown, MessageSquare, AlertTriangle,
} from "lucide-react"

const THEME_CARDS = [
  { topic: "Workload",      mentions: 42, trend: "up",   sentiment: -0.38, delta: -0.12 },
  { topic: "Management",    mentions: 28, trend: "down",  sentiment: -0.14, delta: +0.08 },
  { topic: "Compensation",  mentions: 19, trend: "flat",  sentiment:  0.02, delta:  0.00 },
  { topic: "Career Growth", mentions: 15, trend: "up",   sentiment: -0.19, delta: -0.06 },
  { topic: "Recognition",   mentions: 11, trend: "flat",  sentiment:  0.21, delta: +0.03 },
  { topic: "Work-Life",     mentions:  9, trend: "down",  sentiment: -0.08, delta: +0.04 },
]

function sentColor(v: number) {
  return v < -0.1 ? "var(--red)" : v <= 0.1 ? "var(--amber)" : "var(--green)"
}

export default function InsightsPage() {
  const toast = useToast()
  const [summary,     setSummary]     = useState("")
  const [summarizing, setSummarizing] = useState(false)
  const [generated,   setGenerated]   = useState(false)

  const generate = useCallback(async () => {
    setSummarizing(true)
    try {
      const res = await getSurveySummary()
      setSummary(res.summary)
      setGenerated(true)
    } catch (e: any) {
      toast.error("Summary failed", e.message || "Check your LLM connection in Settings → Integrations")
    } finally {
      setSummarizing(false)
    }
  }, [toast])

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        <div className="page-header">
          <div>
            <h1 className="page-title">AI Insights Center</h1>
            <p className="page-subtitle">LLM-powered thematic analysis, sentiment trends, and workforce intelligence</p>
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

        {/* Theme Clusters */}
        <div>
          <h2 className="section-title mb-4">
            <MessageSquare className="w-4 h-4 text-accent" aria-hidden="true" />
            Theme Clusters
            <span className="text-xs font-normal text-muted ml-2">Zero-shot topic analysis across all survey comments</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
            {THEME_CARDS.map(tc => (
              <div key={tc.topic} className="card hover:shadow-hover cursor-default" role="listitem">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-bold text-text">{tc.topic}</h3>
                  <span className="text-xs font-semibold text-muted bg-surface2 border border-border px-2 py-0.5 rounded-full">
                    {tc.mentions} mentions
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl font-extrabold font-mono" style={{ color: sentColor(tc.sentiment) }}>
                    {tc.sentiment > 0 ? `+${tc.sentiment}` : tc.sentiment}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Sentiment</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold"
                      style={{ color: tc.delta > 0 ? "var(--green)" : tc.delta < 0 ? "var(--red)" : "var(--muted)" }}>
                      {tc.delta > 0 ? <TrendingUp className="w-3 h-3" /> : tc.delta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                      {tc.delta > 0 ? `+${tc.delta}` : tc.delta === 0 ? "No change" : tc.delta} vs last cycle
                    </span>
                  </div>
                </div>

                <div className="progress-track">
                  <div className="progress-fill" style={{
                    width: `${Math.round((tc.sentiment + 1) * 50)}%`,
                    background: sentColor(tc.sentiment),
                  }} />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted">Negative</span>
                  <span className="text-[10px] text-muted">Positive</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Predictive intelligence */}
        <div className="card" style={{ borderColor: "var(--accent-mid)", background: "var(--accent-light)" }}>
          <h2 className="section-title mb-4">
            <Brain className="w-4 h-4 text-accent" aria-hidden="true" />
            Predictive Intelligence
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "30-day attrition risk",  value: "3–5",        sub: "employees projected",      color: "var(--amber)", icon: AlertTriangle },
              { label: "90-day attrition risk",  value: "8–12",       sub: "without intervention",     color: "var(--red)",   icon: AlertTriangle },
              { label: "Est. replacement cost",  value: "$240K–$480K",sub: "if no action taken",       color: "var(--red)",   icon: TrendingDown  },
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
            Projections based on current risk scores and sentiment velocity · Run classifier for updated estimates
          </p>
        </div>

      </div>
    </AppShell>
  )
}
