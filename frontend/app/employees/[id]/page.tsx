"use client"
import { useState, useEffect, useCallback } from "react"
import AppShell from "@/components/AppShell"
import RiskBadge from "@/components/ui/RiskBadge"
import { Skeleton } from "@/components/ui/Skeleton"
import { useEmployeeSentiment } from "@/lib/hooks/useEmployeeSentiment"
import {
  getClassifications, listInterventions, generateEmployeeRecommendation,
  getEmployeeProfile,
  type Intervention,
} from "@/lib/api"
import { useToast } from "@/lib/toast-context"
import {
  SentimentLineChart, TopicRadarChart, ShapWaterfallChart, C,
} from "@/components/charts"
import {
  ArrowLeft, AlertTriangle, Calendar, MessageSquare, Brain,
  TrendingDown, TrendingUp, Minus, Activity, Lightbulb,
  Clock, RefreshCw, ShieldAlert, Sparkles, User2,
} from "lucide-react"
import Link from "next/link"

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const ZONE_COLORS: Record<string, string> = {
  GREEN: "#16A34A", AMBER: "#D97706", RED: "#DC2626",
}
const ZONE_BG: Record<string, string> = {
  GREEN: "var(--green-light)", AMBER: "var(--amber-light)", RED: "var(--red-light)",
}
const ZONE_BORDER: Record<string, string> = {
  GREEN: "#86EFAC", AMBER: "#FCD34D", RED: "#FCA5A5",
}
const PRIORITY_CLS: Record<string, string> = {
  RED: "badge-red", high: "badge-amber", medium: "badge-blue", low: "badge-gray",
}

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

// Compact inline RAG badge used inside the HRBP Assessment card
function RagBadge({ zone }: { zone: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
      style={{
        background:  ZONE_BG[zone]     ?? "var(--surface2)",
        borderColor: ZONE_BORDER[zone] ?? "var(--border)",
        color:       ZONE_COLORS[zone] ?? "var(--muted)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: ZONE_COLORS[zone] }} />
      {zone}
    </span>
  )
}

// Single labeled field row inside the HRBP Assessment card
function ProfileRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs font-semibold text-right" style={{ color: "var(--text)" }}>{children}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function EmployeeProfilePage({ params }: { params: { id: string } }) {
  const employeeId = decodeURIComponent(params.id)
  const toast = useToast()

  const { data, loading, error, refresh } = useEmployeeSentiment(employeeId)

  const [classification,        setClassification]        = useState<any>(null)
  const [classificationLoading, setClassificationLoading] = useState(true)
  const [interventions,         setInterventions]         = useState<Intervention[]>([])
  const [interventionsLoading,  setInterventionsLoading]  = useState(true)
  const [profile,               setProfile]               = useState<Record<string, any> | null>(null)
  const [profileLoading,        setProfileLoading]        = useState(true)
  const [generating,            setGenerating]            = useState(false)

  const loadExtras = useCallback(async () => {
    setClassificationLoading(true)
    setInterventionsLoading(true)
    setProfileLoading(true)

    // Classification
    try {
      const res = await getClassifications(employeeId)
      const list = res.classifications ?? []
      setClassification(list.find((c: any) => c.employee_id === employeeId) ?? null)
    } catch { setClassification(null) }
    finally { setClassificationLoading(false) }

    // Interventions
    try {
      const res = await listInterventions({ employee_id: employeeId, limit: 20 })
      setInterventions(res.interventions ?? [])
    } catch { setInterventions([]) }
    finally { setInterventionsLoading(false) }

    // HRBP profile (previous RAG, concerns, status, etc.)
    try {
      const p = await getEmployeeProfile(employeeId)
      setProfile(p && Object.keys(p).length > 0 ? p : null)
    } catch { setProfile(null) }
    finally { setProfileLoading(false) }
  }, [employeeId])

  useEffect(() => { loadExtras() }, [loadExtras])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const rec = await generateEmployeeRecommendation(employeeId)
      toast.success(
        "Recommendation generated",
        `${rec.priority.toUpperCase()} priority · ${rec.actions.length} action(s)`
      )
      await loadExtras()
    } catch (e: any) {
      toast.error("Generation failed", e.message)
    } finally {
      setGenerating(false)
    }
  }

  const topFactors: { feature: string; shap_value: number }[] =
    Array.isArray(classification?.top_factors) ? classification.top_factors : []
  const riskZone:  string | null = classification?.risk_zone  ?? null
  const riskScore: number | null = classification?.risk_score ?? null

  // Fields that are meaningful to show from the profile
  const hasProfileContent = profile && (
    profile.hrbp_risk_zone || profile.previous_rag ||
    profile.primary_concern || profile.previous_concern ||
    profile.secondary_reason || profile.employee_status ||
    profile.hrbp_connect_month || profile.ageing != null ||
    profile.rating != null || profile.score != null || profile.comments
  )

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
                  {classificationLoading ? null : riskZone ? (
                    <RiskBadge zone={riskZone} score={riskScore ?? undefined} showScore />
                  ) : (
                    <span className="badge badge-gray text-[10px]">Not yet classified</span>
                  )}
                  {/* HRBP zone alongside AI zone if they differ or if no AI zone yet */}
                  {!profileLoading && profile?.hrbp_risk_zone && profile.hrbp_risk_zone !== riskZone && (
                    <RagBadge zone={profile.hrbp_risk_zone} />
                  )}
                </div>
                <p className="text-sm text-muted">
                  {classification?.department ? `${classification.department} · ` : ""}
                  Employee · Full sentiment and risk profile
                  {classification?.manager_id && ` · Manager: ${classification.manager_id}`}
                </p>
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
            <button onClick={() => refresh()} className="btn-ghost text-xs" aria-label="Refresh employee data">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert-RED mb-6" role="alert">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Failed to load employee data</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
            <button onClick={() => refresh()} className="btn-ghost btn-sm ml-auto">Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
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

            {/* ═══════════════════════════════════════════════════
                LEFT SIDEBAR
            ═══════════════════════════════════════════════════ */}
            <div className="space-y-5">

              {/* Risk summary */}
              <div
                className="card"
                style={
                  riskZone === "RED"   ? { borderColor: "#FCA5A5", background: "var(--red-light)"   } :
                  riskZone === "AMBER" ? { borderColor: "#FCD34D", background: "var(--amber-light)" } : {}
                }
              >
                <h2 className="section-title mb-4">
                  <Activity className="w-4 h-4 text-accent" aria-hidden="true" />
                  Risk Summary
                </h2>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <StatTile label="Avg Sent"
                    value={data.avg_sentiment > 0 ? `+${data.avg_sentiment}` : String(data.avg_sentiment)}
                    color={sentimentColor(data.avg_sentiment)} />
                  <StatTile label="Velocity"
                    value={data.sentiment_velocity > 0 ? `+${data.sentiment_velocity}` : String(data.sentiment_velocity)}
                    color={sentimentColor(data.sentiment_velocity)} />
                  <StatTile label="Surveys" value={String(data.survey_count)} />
                </div>
                <div className="text-xs font-semibold flex items-center gap-2">
                  <span className="text-muted">Trend:</span>
                  <VelocityIndicator v={data.sentiment_velocity} />
                </div>
              </div>

              {/* ── HRBP Assessment card ────────────────────────── */}
              {profileLoading ? (
                <div className="card space-y-3">
                  <Skeleton height={12} width="50%" />
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={11} />)}
                </div>
              ) : hasProfileContent ? (
                <div className="card">
                  <h2 className="section-title mb-3">
                    <User2 className="w-4 h-4 text-accent" aria-hidden="true" />
                    HRBP Assessment
                  </h2>

                  {/* RAG comparison row */}
                  {(profile?.hrbp_risk_zone || profile?.previous_rag) && (
                    <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-border">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1.5">Current RAG</p>
                        {profile?.hrbp_risk_zone
                          ? <RagBadge zone={profile.hrbp_risk_zone} />
                          : <span className="text-xs text-muted italic">Not set</span>
                        }
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1.5">Previous RAG</p>
                        {profile?.previous_rag
                          ? <RagBadge zone={profile.previous_rag} />
                          : <span className="text-xs text-muted italic">Not set</span>
                        }
                      </div>
                    </div>
                  )}

                  {/* Concerns */}
                  <div className="divide-y divide-border">
                    {profile?.primary_concern && (
                      <ProfileRow label="Primary Concern">
                        <span
                          className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold"
                          style={{ background: "var(--amber-light)", color: "var(--amber)" }}
                        >
                          {profile.primary_concern}
                        </span>
                      </ProfileRow>
                    )}
                    {profile?.previous_concern && (
                      <ProfileRow label="Previous Concern">
                        <span className="text-muted">{profile.previous_concern}</span>
                      </ProfileRow>
                    )}
                    {profile?.secondary_reason && (
                      <ProfileRow label="Secondary Reason">
                        <span className="text-muted">{profile.secondary_reason}</span>
                      </ProfileRow>
                    )}
                    {profile?.employee_status && (
                      <ProfileRow label="Status">
                        <span
                          className={`badge text-[10px] ${
                            profile.employee_status === "Active"        ? "badge-green" :
                            profile.employee_status === "Notice Period" ? "badge-red"   : "badge-amber"
                          }`}
                        >
                          {profile.employee_status}
                        </span>
                      </ProfileRow>
                    )}
                    {profile?.hrbp_connect_month && (
                      <ProfileRow label="Last Connect">
                        <span className={profile.hrbp_connect_month === "Not Connected" ? "text-muted italic" : ""}>
                          {profile.hrbp_connect_month}
                        </span>
                      </ProfileRow>
                    )}
                    {profile?.ageing != null && (
                      <ProfileRow label="Ageing">
                        <span className="font-mono">
                          {profile.ageing}d
                          {profile.ageing > 90 && (
                            <span className="ml-1.5 text-[10px]" style={{ color: "var(--red)" }}>⚠ overdue</span>
                          )}
                        </span>
                      </ProfileRow>
                    )}
                    {profile?.rating != null && (
                      <ProfileRow label="Rating 2025–26">
                        <span className="font-mono">
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} style={{ color: s <= Math.round(profile.rating) ? "#F59E0B" : "var(--border2)" }}>★</span>
                          ))}
                          {" "}{Number(profile.rating).toFixed(1)}
                        </span>
                      </ProfileRow>
                    )}
                    {profile?.score != null && (
                      <ProfileRow label="Engagement Score">
                        <span
                          className="font-mono font-bold"
                          style={{ color: profile.score >= 7 ? "var(--green)" : profile.score >= 4 ? "var(--amber)" : "var(--red)" }}
                        >
                          {profile.score}/10
                        </span>
                      </ProfileRow>
                    )}
                  </div>

                  {/* HRBP notes */}
                  {profile?.comments && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted mb-1.5">HRBP Notes</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                        {profile.comments}
                      </p>
                    </div>
                  )}

                  <p className="text-[9px] text-muted mt-3 italic">
                    Last updated via Assessment Form
                  </p>
                </div>
              ) : !profileLoading && (
                <div className="card text-center py-5">
                  <User2 className="w-5 h-5 mx-auto mb-2 text-muted opacity-40" />
                  <p className="text-xs text-muted">No HRBP assessment saved yet.</p>
                  <Link
                    href="/employees"
                    className="text-xs text-accent hover:underline mt-1 inline-block"
                  >
                    Open Assessment Form →
                  </Link>
                </div>
              )}

              {/* Top SHAP factors */}
              {topFactors.length > 0 ? (
                <div className="card" style={{ borderColor: "var(--accent-mid)", background: "var(--accent-light)" }}>
                  <h2 className="section-title mb-3">
                    <Brain className="w-4 h-4 text-accent" aria-hidden="true" />
                    Top Risk Factors (SHAP)
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
              ) : !classificationLoading && (
                <div className="card text-center py-6">
                  <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-muted opacity-40" aria-hidden="true" />
                  <p className="text-xs text-muted">
                    Not yet classified — run the classifier from Analytics to see SHAP-based risk factors.
                  </p>
                </div>
              )}

              {/* Recommendations */}
              <div className="card" style={{ borderColor: "var(--violet-mid)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="section-title">
                    <Lightbulb className="w-4 h-4 text-violet" aria-hidden="true" />
                    Recommended Actions
                  </h2>
                  <button onClick={handleGenerate} disabled={generating} className="btn-violet btn-sm text-[11px]">
                    {generating
                      ? <><RefreshCw className="w-3 h-3 animate-spin" />Generating…</>
                      : <><Sparkles className="w-3 h-3" />Generate</>
                    }
                  </button>
                </div>
                {interventionsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={40} rounded="lg" />)}
                  </div>
                ) : interventions.length === 0 ? (
                  <p className="text-xs text-muted">
                    No recommendations generated yet. Click "Generate" to create one from the latest survey and classification data.
                  </p>
                ) : (
                  <ul className="space-y-2.5" role="list">
                    {interventions.map(iv => (
                      <li
                        key={iv.id}
                        className="text-xs rounded-lg p-2.5"
                        style={{ background: "var(--violet-light)", color: "var(--text-2)", border: "1px solid var(--violet-mid)" }}
                        role="listitem"
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`badge text-[10px] uppercase ${PRIORITY_CLS[iv.priority] ?? "badge-gray"}`}>{iv.priority}</span>
                          <span className="badge badge-gray text-[10px]">{iv.status}</span>
                          <span className="text-[10px] text-muted font-mono ml-auto">{new Date(iv.created_at).toLocaleDateString()}</span>
                        </div>
                        <p>{iv.reasoning}</p>
                        {iv.actions?.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {iv.actions.map((a, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <span className="text-accent mt-0.5">→</span>
                                <span className="font-semibold">{a.title}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </div>

            {/* ═══════════════════════════════════════════════════
                RIGHT COLUMN
            ═══════════════════════════════════════════════════ */}
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
                    <div className="space-y-3">
                      {Object.entries(data.topic_breakdown)
                        .sort(([, a], [, b]) => (a as number) - (b as number))
                        .map(([topic, val]: [string, any]) => {
                          const pct   = Math.round((val + 1) * 50)
                          const color = val < -0.1 ? C.red : val <= 0.1 ? C.amber : C.green
                          return (
                            <div key={topic}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold capitalize" style={{ color: "var(--text-2)" }}>{topic}</span>
                                <span className="text-xs font-bold font-mono" style={{ color }}>
                                  {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}
                                </span>
                              </div>
                              <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${topic} sentiment: ${pct}%`}>
                                <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                              </div>
                            </div>
                          )
                        })}
                      <div className="flex items-center justify-between text-[10px] text-muted pt-1">
                        <span>← Very negative</span><span>Neutral</span><span>Very positive →</span>
                      </div>
                    </div>
                    <TopicRadarChart
                      data={Object.entries(data.topic_breakdown).map(([topic, score]) => ({ topic, score: score as number }))}
                      height={220}
                    />
                  </div>
                </div>
              )}

              {/* SHAP waterfall */}
              {topFactors.length > 0 && (
                <div className="card">
                  <h2 className="section-title mb-4">
                    <Brain className="w-4 h-4 text-violet" aria-hidden="true" />
                    Risk Driver Breakdown (SHAP)
                  </h2>
                  <p className="text-xs text-muted mb-3">
                    From the classifier's most recent run for this employee.{" "}
                    <span style={{ color: C.red }}>Red bars</span> push risk up ·{" "}
                    <span style={{ color: C.green }}>Green bars</span> pull risk down
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
                    <div className="absolute left-4 top-2 bottom-2 w-0.5" style={{ background: "var(--border)" }} aria-hidden="true" />
                    <div className="space-y-4 pl-10" role="list" aria-label="Survey history timeline">
                      {data.history.map((h, i) => {
                        const lbl   = h.sentiment_label ?? "neutral"
                        const color = lbl === "positive" ? C.green : lbl === "negative" ? C.red : C.amber
                        return (
                          <div key={i} className="relative" role="listitem">
                            <div className="absolute -left-6 top-3 w-3 h-3 rounded-full border-2 border-white" style={{ background: color }} aria-hidden="true" />
                            <div className="rounded-xl p-4 border border-border" style={{ background: "var(--surface2)" }}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-semibold text-muted flex items-center gap-1.5">
                                  <Calendar className="w-3 h-3" aria-hidden="true" />{h.survey_date}
                                </span>
                                <span className={`badge text-[10px] ${lbl === "positive" ? "badge-green" : lbl === "negative" ? "badge-red" : "badge-amber"}`}>
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
                  <p className="text-xs text-muted">Upload surveys for this employee to see sentiment analysis and risk breakdown</p>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
