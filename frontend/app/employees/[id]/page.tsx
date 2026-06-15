"use client"
import { use } from "react"
import AppShell from "@/components/AppShell"
import RiskBadge from "@/components/ui/RiskBadge"
import { Skeleton } from "@/components/ui/Skeleton"
import { useEmployeeSentiment } from "@/lib/hooks/useEmployeeSentiment"
import {
  SentimentLineChart, TopicRadarChart, ShapWaterfallChart, C,
} from "@/components/charts"
import {
  ArrowLeft, AlertTriangle, Calendar, MessageSquare, Brain,
  TrendingDown, TrendingUp, Minus, Activity, Lightbulb,
  Clock, RefreshCw, ShieldAlert,
} from "lucide-react"
import Link from "next/link"

/* ─── helpers ───────────────────────────────────────────────── */
function sentimentColor(v: number | undefined | null) {
  if (v == null) return "var(--muted)"
  return v < -0.1 ? C.red : v <= 0.1 ? C.amber : C.green
}

function VelocityIndicator({ v }: { v: number }) {
  if (v > 0.02)  return <span className="flex items-center gap-1 font-semibold" style={{ color: C.green }}><TrendingUp className="w-4 h-4" />Improving (+{v})</span>
  if (v < -0.02) return <span className="flex items-center gap-1 font-semibold" style={{ color: C.red }}><TrendingDown className="w-4 h-4" />Declining ({v})</span>
  return <span className="flex items-center gap-1 font-semibold text-muted"><Minus className="w-4 h-4" />Stable</span>
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center p-4 rounded-xl border border-border" style={{ background: "var(--surface2)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className="text-2xl font-extrabold font-mono" style={{ color: color ?? "var(--text)" }}>{value}</p>
    </div>
  )
}

/* ─── Recommendations based on sentiment data ───────────────── */
function buildRecommendations(data: any): string[] {
  const recs: string[] = []
  if (!data) return recs
  if (data.sentiment_velocity < -0.15) recs.push("Schedule urgent 1:1 with direct manager within 48 hours")
  if (data.avg_sentiment < -0.2)       recs.push("Initiate HR business partner check-in")
  const wb = data.topic_breakdown
  if (wb) {
    if ((wb.workload ?? 0) < -0.3)     recs.push("Conduct workload audit — redistribute if possible")
    if ((wb.management ?? 0) < -0.2)   recs.push("Facilitate manager effectiveness conversation")
    if ((wb.compensation ?? 0) < -0.2) recs.push("Flag for compensation review cycle")
    if ((wb.recognition ?? 0) < -0.1)  recs.push("Include in next recognition programme cycle")
    if ((wb.career ?? 0) < -0.2)       recs.push("Schedule career development discussion")
  }
  if (data.survey_count < 3)           recs.push("Increase survey cadence to capture fuller picture")
  if (!recs.length)                     recs.push("No immediate intervention required — continue monitoring")
  return recs
}

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE PROFILE 360 PAGE
═══════════════════════════════════════════════════════════════ */
export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const employeeId = decodeURIComponent(id)

  const { data, loading, error, refresh } = useEmployeeSentiment(employeeId)

  const topFactors: { feature: string; shap_value: number }[] = (() => {
    if (!data) return []
    return Object.entries(data.topic_breakdown ?? {})
      .map(([feature, val]) => ({ feature, shap_value: val as number }))
      .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
  })()

  const recommendations = buildRecommendations(data)

  const riskZone = data
    ? (data.avg_sentiment < -0.2 || data.sentiment_velocity < -0.15 ? "RED" :
       data.avg_sentiment < 0    || data.sentiment_velocity < -0.05  ? "AMBER" : "GREEN")
    : null

  return (
    <AppShell>
      <div className="page-container animate-fade-up">

        {/* Back link */}
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text mb-5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Employee Directory
        </Link>

        {/* ── Profile header ───────────────────────────────────── */}
        <div
          className="card mb-6"
          style={{ background: "linear-gradient(135deg, var(--accent-light) 0%, var(--surface) 60%)" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
                aria-hidden="true"
              >
                {employeeId.slice(-2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-xl font-extrabold font-mono text-text">{employeeId}</h1>
                  {riskZone && <RiskBadge zone={riskZone} />}
                </div>
                <p className="text-sm text-muted">Employee · Full sentiment and risk profile</p>
                {data && (
                  <p className="text-xs text-muted mt-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {data.survey_count} survey{data.survey_count !== 1 ? "s" : ""} on record
                    {data.history?.[0]?.survey_date && ` · First: ${data.history[0].survey_date}`}
                    {data.history?.at(-1)?.survey_date && ` · Latest: ${data.history.at(-1)!.survey_date}`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => refresh()} className="btn-ghost text-xs" aria-label="Refresh employee data">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Error state ──────────────────────────────────────── */}
        {error && (
          <div className="alert-critical mb-6" role="alert">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Failed to load employee data</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
            <button onClick={() => refresh()} className="btn-ghost btn-sm ml-auto">Retry</button>
          </div>
        )}

        {/* ── Loading state ────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="space-y-5">
              <div className="card space-y-3">
                <Skeleton height={14} width="60%" />
                <Skeleton height={32} width="50%" />
                <Skeleton height={11} width="80%" />
              </div>
              <div className="card space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={11} />)}
              </div>
            </div>
            <div className="lg:col-span-2 space-y-5">
              <div className="card"><Skeleton height={180} rounded="lg" /></div>
              <div className="card"><Skeleton height={140} rounded="lg" /></div>
            </div>
          </div>
        )}

        {/* ── Main content ─────────────────────────────────────── */}
        {data && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── LEFT COLUMN (sticky sidebar) ─────────────────── */}
            <div className="space-y-5">

              {/* Risk summary */}
              <div className={`card ${riskZone === "RED" ? "border-red-200" : riskZone === "AMBER" ? "border-amber-200" : ""}`}
                style={riskZone === "RED" ? { borderColor: "#FCA5A5", background: "var(--red-light)" } : riskZone === "AMBER" ? { borderColor: "#FCD34D", background: "var(--amber-light)" } : {}}>
                <h2 className="section-title mb-4">
                  <Activity className="w-4 h-4 text-accent" aria-hidden="true" />
                  Risk Summary
                </h2>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <StatTile label="Avg Sent" value={data.avg_sentiment > 0 ? `+${data.avg_sentiment}` : String(data.avg_sentiment)} color={sentimentColor(data.avg_sentiment)} />
                  <StatTile label="Velocity" value={data.sentiment_velocity > 0 ? `+${data.sentiment_velocity}` : String(data.sentiment_velocity)} color={sentimentColor(data.sentiment_velocity)} />
                  <StatTile label="Surveys"  value={String(data.survey_count)} />
                </div>
                <div className="text-xs font-semibold flex items-center gap-2">
                  <span className="text-muted">Trend:</span>
                  <VelocityIndicator v={data.sentiment_velocity} />
                </div>
              </div>

              {/* Top risk factors */}
              {topFactors.length > 0 && (
                <div className="card" style={{ borderColor: "var(--accent-mid)", background: "var(--accent-light)" }}>
                  <h2 className="section-title mb-3">
                    <Brain className="w-4 h-4 text-accent" aria-hidden="true" />
                    Top Topic Factors
                  </h2>
                  <div className="space-y-2.5">
                    {topFactors.slice(0, 5).map((f, i) => {
                      const color = f.shap_value < -0.1 ? C.red : f.shap_value <= 0.1 ? C.amber : C.green
                      return (
                        <div key={f.feature} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold w-4 text-muted">{i + 1}.</span>
                          <span className="text-xs capitalize flex-1 font-medium" style={{ color: "var(--text-2)" }}>
                            {f.feature}
                          </span>
                          <span className="text-xs font-bold font-mono" style={{ color }}>
                            {f.shap_value > 0 ? "+" : ""}{f.shap_value.toFixed(2)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="card" style={{ borderColor: "var(--violet-mid)" }}>
                <h2 className="section-title mb-3">
                  <Lightbulb className="w-4 h-4 text-violet" aria-hidden="true" />
                  Recommended Actions
                </h2>
                <ul className="space-y-2.5" role="list">
                  {recommendations.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs rounded-lg p-2.5"
                      style={{
                        background: "var(--violet-light)",
                        color: "var(--text-2)",
                        border: "1px solid var(--violet-mid)",
                      }}
                      role="listitem"
                    >
                      <span className="font-extrabold mt-px flex-shrink-0" style={{ color: "var(--violet)" }}>
                        {i + 1}
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            {/* ── RIGHT COLUMN (scrollable detail) ─────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Sentiment trajectory */}
              <div className="card">
                <h2 className="section-title mb-4">
                  <TrendingDown className="w-4 h-4 text-accent" aria-hidden="true" />
                  Sentiment Trajectory
                </h2>
                <SentimentLineChart data={data.history ?? []} height={200} />
                <p className="text-xs text-muted mt-3">
                  Coloured dots: <span style={{ color: C.green }}>● positive</span> ·{" "}
                  <span style={{ color: C.amber }}>● neutral</span> ·{" "}
                  <span style={{ color: C.red }}>● negative</span> · Dashed line = neutral baseline
                </p>
              </div>

              {/* Topic breakdown */}
              {Object.keys(data.topic_breakdown ?? {}).length > 0 && (
                <div className="card">
                  <h2 className="section-title mb-4">
                    <MessageSquare className="w-4 h-4 text-accent" aria-hidden="true" />
                    Topic Sentiment Breakdown
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Bars */}
                    <div className="space-y-3">
                      {Object.entries(data.topic_breakdown)
                        .sort(([, a], [, b]) => (a as number) - (b as number))
                        .map(([topic, val]: [string, any]) => {
                          const pct   = Math.round((val + 1) * 50)
                          const color = val < -0.1 ? C.red : val <= 0.1 ? C.amber : C.green
                          return (
                            <div key={topic}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold capitalize" style={{ color: "var(--text-2)" }}>
                                  {topic}
                                </span>
                                <span className="text-xs font-bold font-mono" style={{ color }}>
                                  {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                                </span>
                              </div>
                              <div
                                className="progress-track"
                                role="progressbar"
                                aria-valuenow={pct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${topic} sentiment: ${pct}%`}
                              >
                                <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                              </div>
                            </div>
                          )
                        })}
                      <div className="flex items-center justify-between text-[10px] text-muted pt-1">
                        <span>← Very negative</span><span>Neutral</span><span>Very positive →</span>
                      </div>
                    </div>
                    {/* Radar */}
                    <TopicRadarChart
                      data={Object.entries(data.topic_breakdown).map(([topic, score]) => ({ topic, score: score as number }))}
                      height={220}
                    />
                  </div>
                </div>
              )}

              {/* SHAP feature importance */}
              {topFactors.length > 0 && (
                <div className="card">
                  <h2 className="section-title mb-4">
                    <Brain className="w-4 h-4 text-violet" aria-hidden="true" />
                    Feature Importance (Topic Analysis)
                  </h2>
                  <p className="text-xs text-muted mb-3">
                    <span style={{ color: C.red }}>Red bars</span> indicate negative sentiment (increases risk) ·{" "}
                    <span style={{ color: C.green }}>Green bars</span> indicate positive sentiment (decreases risk)
                  </p>
                  <ShapWaterfallChart features={topFactors} height={Math.max(180, topFactors.length * 30)} />
                </div>
              )}

              {/* Survey history timeline */}
              {(data.history?.length ?? 0) > 0 && (
                <div className="card">
                  <h2 className="section-title mb-4">
                    <Calendar className="w-4 h-4 text-muted" aria-hidden="true" />
                    Survey History · {data.survey_count} entries
                  </h2>
                  <div className="relative">
                    {/* Timeline line */}
                    <div
                      className="absolute left-4 top-2 bottom-2 w-0.5"
                      style={{ background: "var(--border)" }}
                      aria-hidden="true"
                    />
                    <div className="space-y-4 pl-10" role="list" aria-label="Survey history timeline">
                      {data.history.map((h, i) => {
                        const lbl   = h.sentiment_label ?? "neutral"
                        const color = lbl === "positive" ? C.green : lbl === "negative" ? C.red : C.amber
                        return (
                          <div key={i} className="relative" role="listitem">
                            {/* Timeline dot */}
                            <div
                              className="absolute -left-6 top-3 w-3 h-3 rounded-full border-2 border-white"
                              style={{ background: color }}
                              aria-hidden="true"
                            />
                            <div
                              className="rounded-xl p-4 border border-border"
                              style={{ background: "var(--surface2)" }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3" aria-hidden="true" />
                                  {h.survey_date}
                                </span>
                                <span
                                  className={`badge text-[10px] ${
                                    lbl === "positive" ? "badge-green" :
                                    lbl === "negative" ? "badge-red"   : "badge-amber"
                                  }`}
                                >
                                  {lbl}
                                  {h.sentiment_score != null && (
                                    <span className="font-mono ml-1 opacity-80">
                                      ({h.sentiment_score > 0 ? "+" : ""}{Number(h.sentiment_score).toFixed(2)})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                                {h.comments || "(No comments provided for this survey)"}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!data.history?.length && !Object.keys(data.topic_breakdown ?? {}).length && (
                <div className="card text-center py-12">
                  <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted opacity-40" aria-hidden="true" />
                  <p className="text-sm font-semibold text-text mb-1">No survey history</p>
                  <p className="text-xs text-muted">
                    Upload surveys for this employee to see sentiment analysis and risk breakdown
                  </p>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </AppShell>
  )
}
