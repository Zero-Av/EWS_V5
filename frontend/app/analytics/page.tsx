"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/AppShell"
import { getAnalyticsDashboard, getTrends, saveSnapshot, getDriftMetrics, getSurveySummary, downloadExcelReport } from "@/lib/api"
import {
  Users, TrendingUp, AlertTriangle, CheckCircle,
  Activity, BarChart2, Upload, Loader2, Gauge, Zap,
} from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts"
import FileDropzone from "@/components/FileDropzone"

const ZONE_COLOR = { GREEN: "#4ade80", AMBER: "#fbbf24", RED: "#f87171" }
const C = {
  blue:   "#60a5fa",
  green:  "#4ade80",
  amber:  "#fbbf24",
  red:    "#f87171",
  purple: "#a78bfa",
  muted:  "#4a6580",
}

interface KPI {
  total_employees:          number
  avg_attrition_risk:       number
  high_risk_count:          number
  medium_risk_count:        number
  low_risk_count:           number
  interventions_pending:    number
  interventions_in_progress: number
  interventions_completed:  number
  intervention_success_rate: number
  avg_improvement_pct:      number
  unacknowledged_alerts:    number
  enps: {
    enps: number;
    promoters: number;
    passives: number;
    detractors: number;
    total: number;
  }
  engagement: {
    engagement_index: number;
    breakdown: Record<string, number>;
    total_employees: number;
  }
  manager_effectiveness?: number;
}

export default function AnalyticsPage() {
  const [kpi,     setKpi]     = useState<KPI | null>(null)
  const [trends,  setTrends]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshotFile, setSnapshotFile] = useState<File | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

  const [drift, setDrift] = useState<any[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    Promise.all([
      getAnalyticsDashboard(),
      getTrends(6),
      getDriftMetrics(30).catch(() => ({ drift_metrics: [] })),
      getSurveySummary().catch(() => ({ summary: null })),
    ]).then(([k, t, d, s]) => {
      setKpi(k)
      setTrends(t.data)
      setDrift(d.drift_metrics)
      setSummary(s.summary)
    }).finally(() => setLoading(false))
  }, [])

  async function handleDownloadReport() {
    setDownloading(true)
    try {
      await downloadExcelReport()
    } catch (e: any) {
      alert("Failed to download report: " + e.message)
    } finally {
      setDownloading(false)
    }
  }

  async function handleSaveSnapshot() {
    if (!snapshotFile) return
    setSaving(true); setSaveMsg("")
    try {
      const r = await saveSnapshot(snapshotFile)
      setSaveMsg(`✓ Saved ${r.saved} snapshots. ${r.alerts_fired} alert(s) fired.`)
      // Refresh KPIs
      const k = await getAnalyticsDashboard()
      setKpi(k)
    } catch (e: any) {
      setSaveMsg(`✗ ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Pie data for risk distribution
  const pieData = kpi ? [
    { name: "Low Risk",    value: kpi.low_risk_count,    fill: C.green },
    { name: "Medium Risk", value: kpi.medium_risk_count, fill: C.amber },
    { name: "High Risk",   value: kpi.high_risk_count,   fill: C.red   },
  ] : []

  const enpsPieData = kpi?.enps ? [
    { name: "Promoters",  value: kpi.enps.promoters,  fill: C.green },
    { name: "Passives",   value: kpi.enps.passives,   fill: C.amber },
    { name: "Detractors", value: kpi.enps.detractors, fill: C.red   },
  ] : []

  return (
    <AppShell>
      <div className="animate-fadeUp">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-mono text-2xl font-semibold text-text">Analytics Dashboard</h1>
          <span className="font-mono text-xs text-muted bg-surface border border-border px-3 py-1 rounded-full">
            Executive View
          </span>
        </div>
        <p className="text-muted text-sm mb-8">Real-time workforce intelligence & attrition monitoring</p>

        {loading && (
          <div className="flex items-center gap-2 text-muted font-mono text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading KPIs…
          </div>
        )}

        {/* ── Save Snapshot Strip ─────────────────────────────────────────── */}
        <div className="card mb-6 border-blue-500/20 bg-blue-500/5">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="font-mono text-xs text-blue-400 uppercase tracking-wider mb-2">
                📸 Save Historical Snapshot
              </p>
              <p className="text-xs text-muted mb-3">
                Upload employee CSV to persist metrics as a historical snapshot for trend tracking and early warnings.
              </p>
              <FileDropzone onFile={f => setSnapshotFile(f || null)} current={snapshotFile} />
            </div>
            <div className="flex flex-col gap-2 shrink-0 pt-6">
              <button
                onClick={handleSaveSnapshot}
                disabled={!snapshotFile || saving}
                className="btn-primary"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {saving ? "Saving…" : "Save Snapshot"}
              </button>
              {saveMsg && (
                <p className={`font-mono text-xs ${saveMsg.startsWith("✓") ? "text-green" : "text-red"}`}>
                  {saveMsg}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0 pt-6 border-l border-border pl-4 ml-2">
              <button
                onClick={handleDownloadReport}
                disabled={downloading}
                className="btn-outline border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
                {downloading ? "Downloading…" : "Download Report"}
              </button>
            </div>
          </div>
        </div>

        {kpi && (
          <>
            {/* ── KPI Cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KPICard
                icon={<Users className="w-5 h-5" />}
                label="Total Employees"
                value={kpi.total_employees}
                color={C.blue}
              />
              {(kpi.manager_effectiveness !== undefined && kpi.manager_effectiveness !== null) && (
                <KPICard
                  icon={<Gauge className="w-5 h-5" />}
                  label="Manager Effectiveness"
                  value={kpi.manager_effectiveness}
                  color={kpi.manager_effectiveness >= 75 ? C.green : kpi.manager_effectiveness >= 50 ? C.amber : C.red}
                  sub="Score (0-100)"
                />
              )}
              <KPICard
                icon={<Activity className="w-5 h-5" />}
                label="Avg Attrition Risk"
                value={`${kpi.avg_attrition_risk ?? 0}%`}
                color={riskColor(kpi.avg_attrition_risk)}
                sub="across workforce"
              />
              <KPICard
                icon={<AlertTriangle className="w-5 h-5" />}
                label="High Risk (RED)"
                value={kpi.high_risk_count}
                color={C.red}
                sub="require immediate action"
              />
              <KPICard
                icon={<BarChart2 className="w-5 h-5" />}
                label="Medium Risk (AMBER)"
                value={kpi.medium_risk_count}
                color={C.amber}
                sub="need monitoring"
              />
              <KPICard
                icon={<CheckCircle className="w-5 h-5" />}
                label="Interventions Pending"
                value={kpi.interventions_pending}
                color={C.amber}
              />
              <KPICard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Completed"
                value={kpi.interventions_completed}
                color={C.green}
                sub={`${kpi.intervention_success_rate}% success rate`}
              />
              <KPICard
                icon={<Activity className="w-5 h-5" />}
                label="Avg Improvement"
                value={`${kpi.avg_improvement_pct ?? 0}%`}
                color={C.purple}
                sub="post-intervention"
              />
              <KPICard
                icon={<AlertTriangle className="w-5 h-5" />}
                label="Unread Alerts"
                value={kpi.unacknowledged_alerts}
                color={kpi.unacknowledged_alerts > 0 ? C.red : C.green}
              />
            </div>

            {/* ── Sentiment & eNPS ────────────────────────────────────────── */}
            {kpi.enps && kpi.enps.total > 0 && (
              <div className="card mb-6">
                <p className="section-label">Employee Sentiment & eNPS</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="flex flex-col items-center justify-center p-6 bg-[#070d1a] border border-border rounded-xl">
                    <p className="font-mono text-sm text-muted uppercase tracking-wider mb-2">Net Promoter Score</p>
                    <p className={`text-6xl font-black mb-1 ${kpi.enps.enps >= 30 ? 'text-green' : kpi.enps.enps >= 0 ? 'text-amber' : 'text-red'}`}>
                      {kpi.enps.enps > 0 ? `+${kpi.enps.enps}` : kpi.enps.enps}
                    </p>
                    <p className="font-mono text-xs text-muted">Based on {kpi.enps.total} surveys</p>
                  </div>
                  
                  <div className="md:col-span-2 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={enpsPieData}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {enpsPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b" }}
                          itemStyle={{ color: "#e2e8f0" }}
                        />
                        <Legend verticalAlign="middle" align="right" layout="vertical" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── Engagement Index ──────────────────────────────────────── */}
            {kpi.engagement && kpi.engagement.total_employees > 0 && (
              <div className="card mb-6">
                <p className="section-label">Engagement Index</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="flex flex-col items-center justify-center p-6 bg-[#070d1a] border border-border rounded-xl">
                    <Gauge className="w-8 h-8 mb-2" style={{ color: kpi.engagement.engagement_index >= 70 ? C.green : kpi.engagement.engagement_index >= 50 ? C.amber : C.red }} />
                    <p className={`text-5xl font-black mb-1 ${kpi.engagement.engagement_index >= 70 ? 'text-green' : kpi.engagement.engagement_index >= 50 ? 'text-amber' : 'text-red'}`}>
                      {kpi.engagement.engagement_index}
                    </p>
                    <p className="font-mono text-xs text-muted">out of 100</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="font-mono text-xs text-muted mb-3">Weighted breakdown of employee experience metrics</p>
                    <div className="space-y-2">
                      {Object.entries(kpi.engagement.breakdown).map(([key, val]) => {
                        const pct = ((val as number) / 10) * 100
                        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        return (
                          <div key={key}>
                            <div className="flex justify-between font-mono text-xs mb-0.5">
                              <span className="text-text/80">{label}</span>
                              <span className="text-muted">{val}/10</span>
                            </div>
                            <div className="h-2 rounded-full bg-border overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: pct >= 70 ? C.green : pct >= 50 ? C.amber : C.red
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Survey Insights (LLM) ──────────────────────────────────────── */}
            {summary && (
              <div className="card mb-6 border border-purple-500/20 bg-purple-500/5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <p className="section-label mb-0 text-purple-400">Survey Insights (LLM Analysis)</p>
                </div>
                <div className="text-sm text-text/90 leading-relaxed font-mono whitespace-pre-wrap">
                  {summary}
                </div>
              </div>
            )}

            {/* ── Charts Grid ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Risk distribution pie */}
              <div className="card">
                <p className="section-label">Risk Distribution</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        strokeWidth={0}
                      >
                        {pieData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.85} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#0d1625", border: "1px solid #1a2a40", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12 }}
                        formatter={(v: any) => [v, ""]}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v: any) => <span className="font-mono text-xs text-muted">{v}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Avg risk trend line */}
              <div className="card lg:col-span-2">
                <p className="section-label">Average Risk Score Trend</p>
                {trends.length > 0 ? (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "#0d1625", border: "1px solid #1a2a40", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12 }}
                          formatter={(v: any) => [v, "Avg Risk"]}
                        />
                        <Line type="monotone" dataKey="avg_risk" stroke={C.red} strokeWidth={2} dot={{ fill: C.red, r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyTrendState />
                )}
              </div>
            </div>

            {/* ── Sentiment Trends ───────────────────────────────────────── */}
            {trends.length > 0 && (
              <div className="card mb-6">
                <p className="section-label">Workforce Sentiment Trends</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends} margin={{ left: -10, right: 20, top: 10, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#0d1625", border: "1px solid #1a2a40", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 11 }}
                      />
                      <Legend iconType="circle" iconSize={8} formatter={(v: any) => <span className="font-mono text-xs text-muted">{v.replace(/_/g," ")}</span>} />
                      <Line type="monotone" dataKey="avg_satisfaction"   stroke={C.green}  strokeWidth={1.5} dot={false} name="Job Satisfaction" />
                      <Line type="monotone" dataKey="avg_stress"         stroke={C.red}    strokeWidth={1.5} dot={false} name="Stress (inverted)" />
                      <Line type="monotone" dataKey="avg_wlb"            stroke={C.blue}   strokeWidth={1.5} dot={false} name="Work-Life Balance" />
                      <Line type="monotone" dataKey="avg_manager_support" stroke={C.amber} strokeWidth={1.5} dot={false} name="Manager Support" />
                      <Line type="monotone" dataKey="avg_career_growth"  stroke={C.purple} strokeWidth={1.5} dot={false} name="Career Growth" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── RED/AMBER/GREEN count by month ─────────────────────────── */}
            {trends.length > 0 && (
              <div className="card">
                <p className="section-label">Risk Zone Distribution Over Time</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trends} margin={{ left: -10, right: 20, top: 10, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#0d1625", border: "1px solid #1a2a40", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 11 }}
                      />
                      <Legend iconType="circle" iconSize={8} formatter={(v: any) => <span className="font-mono text-xs text-muted">{v}</span>} />
                      <Bar dataKey="green_count" name="GREEN" fill={C.green} fillOpacity={0.7} radius={[2,2,0,0]} stackId="a" />
                      <Bar dataKey="amber_count" name="AMBER" fill={C.amber} fillOpacity={0.7} radius={[0,0,0,0]} stackId="a" />
                      <Bar dataKey="red_count"   name="RED"   fill={C.red}   fillOpacity={0.7} radius={[2,2,0,0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {/* ── Model Drift Metrics ─────────────────────────── */}
            {drift.length > 0 && (
              <div className="card mt-6">
                <p className="section-label">Model Drift Metrics (Prediction Distribution)</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={drift} margin={{ left: -10, right: 20, top: 10, bottom: 0 }}>
                      <XAxis dataKey="snapshot_date" tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: C.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#0d1625", border: "1px solid #1a2a40", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 11 }}
                      />
                      <Legend iconType="circle" iconSize={8} formatter={(v: any) => <span className="font-mono text-xs text-muted">{v}</span>} />
                      <Bar dataKey="pct_green" name="% GREEN" fill={C.green} fillOpacity={0.7} stackId="a" />
                      <Bar dataKey="pct_amber" name="% AMBER" fill={C.amber} fillOpacity={0.7} stackId="a" />
                      <Bar dataKey="pct_red"   name="% RED"   fill={C.red}   fillOpacity={0.7} radius={[2,2,0,0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

function KPICard({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: any; color: string; sub?: string
}) {
  return (
    <div className="stat-card group">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      </div>
      <div className="font-mono text-2xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-muted mt-1">{sub}</div>}
    </div>
  )
}

function EmptyTrendState() {
  return (
    <div className="h-52 flex flex-col items-center justify-center text-muted gap-2">
      <TrendingUp className="w-8 h-8 opacity-20" />
      <p className="font-mono text-xs text-center">
        No trend data yet.<br />Save a snapshot above to start tracking.
      </p>
    </div>
  )
}

function riskColor(risk: number): string {
  if (risk >= 65) return "#f87171"
  if (risk >= 35) return "#fbbf24"
  return "#4ade80"
}
