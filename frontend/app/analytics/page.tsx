"use client"
import { useEffect, useState, useCallback } from "react"
import AppShell from "@/components/AppShell"
import RiskBadge from "@/components/ui/RiskBadge"
import KpiCard from "@/components/ui/KpiCard"
import { KpiCardSkeleton } from "@/components/ui/Skeleton"
import FileDropzone from "@/components/ui/FileDropzone"
import { useToast } from "@/lib/toast-context"
import { getAnalyticsDashboard, getClassifications, uploadSurveys, classifyEmployees } from "@/lib/api"
import {
  BarChart2, TrendingUp, Users, AlertTriangle,
  UploadCloud, Play, RefreshCw, Loader2, ChevronRight,
} from "lucide-react"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend,
} from "recharts"
import Link from "next/link"

function NexusTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="card-sm text-xs" style={{ boxShadow: "var(--shadow-hover)", minWidth: 120 }}>
      <p className="font-semibold text-text mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color ?? p.fill }}>
          {p.name ?? p.dataKey}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

const ZONE_COLORS: Record<string, string> = {
  GREEN: "#16A34A", AMBER: "#D97706", RED: "#DC2626",
}

export default function AnalyticsPage() {
  const toast = useToast()
  const [kpis,       setKpis]       = useState<any>(null)
  const [clsf,       setClsf]       = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [classifying,setClassifying]= useState(false)
  const [surveyFile, setSurveyFile] = useState<File | null>(null)
  const [runTopics,  setRunTopics]  = useState(true)

  const load = useCallback(async () => {
    try {
      const [k, c] = await Promise.all([
        getAnalyticsDashboard().catch(() => null),
        getClassifications().catch(() => ({ classifications: [] })),
      ])
      setKpis(k)
      setClsf(c.classifications ?? [])
    } catch (e: any) { toast.error("Failed to load analytics", e.message) }
  }, [toast])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const handleUpload = async () => {
    if (!surveyFile) { toast.warning("No file selected", "Select a survey CSV first"); return }
    setUploading(true)
    try {
      const res = await uploadSurveys(surveyFile, runTopics)
      toast.success("Surveys uploaded", `${res.surveys_ingested} records ingested · topics: ${res.topics_analyzed ? "✓" : "skipped"}`)
      setSurveyFile(null)
      await load()
    } catch (e: any) { toast.error("Upload failed", e.message) }
    finally { setUploading(false) }
  }

  const handleClassify = async () => {
    setClassifying(true)
    try {
      const res = await classifyEmployees()
      toast.success("Classification complete", `${res.employees_classified} employees · ${res.alerts_created} alerts created`)
      await load()
    } catch (e: any) { toast.error("Classification failed", e.message) }
    finally { setClassifying(false) }
  }

  const zoneData = [
    { name: "GREEN",   value: kpis?.zone_distribution?.GREEN ?? 0, color: "#16A34A" },
    { name: "AMBER",    value: kpis?.zone_distribution?.AMBER ?? 0, color: "#D97706" },
    { name: "RED", value: kpis?.zone_distribution?.RED   ?? 0, color: "#DC2626" },
  ]

  const topRisk = [...clsf].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10)

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Survey ingestion, risk classification, and workforce distribution</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleClassify} disabled={classifying} className="btn-primary text-xs">
              {classifying ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Running…</> : <><Play className="w-3.5 h-3.5" />Run Classifier</>}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />) : (
            <>
              <KpiCard label="Total Employees"   value={kpis?.total_employees ?? "—"}   icon={Users}         iconColor="blue" />
              <KpiCard label="RED"    value={kpis?.zone_distribution?.RED ?? 0}   icon={AlertTriangle} iconColor="red"   valueColor={kpis?.zone_distribution?.RED > 0 ? "var(--red)" : undefined} />
              <KpiCard label="AMBER"     value={kpis?.zone_distribution?.AMBER ?? 0} icon={AlertTriangle} iconColor="amber" valueColor="var(--amber)" />
              <KpiCard label="Avg Sentiment"     value={kpis?.avg_sentiment != null ? (kpis.avg_sentiment > 0 ? `+${kpis.avg_sentiment}` : String(kpis.avg_sentiment)) : "—"} icon={TrendingUp} iconColor="green" valueColor="var(--green)" />
            </>
          )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Zone distribution donut */}
          <div className="card">
            <h2 className="section-title mb-4"><BarChart2 className="w-4 h-4 text-accent" />Risk Zone Distribution</h2>
            {kpis?.total_employees > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={zoneData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                    dataKey="value" nameKey="name" paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {zoneData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<NexusTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty" style={{ height: 220 }}>
                <p className="text-sm">No classification data — run the classifier first</p>
              </div>
            )}
          </div>

          {/* Top risk employees bar chart */}
          <div className="card">
            <h2 className="section-title mb-4">
              <AlertTriangle className="w-4 h-4 text-red" />
              Top 10 Risk Scores
            </h2>
            {topRisk.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topRisk} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--subtle)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="employee_id" stroke="var(--subtle)" fontSize={10} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<NexusTooltip />} />
                  <Bar dataKey="risk_score" radius={[0, 4, 4, 0]} name="Risk Score">
                    {topRisk.map((e, i) => <Cell key={i} fill={ZONE_COLORS[e.risk_zone] ?? "#94A3B8"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty" style={{ height: 220 }}>
                <p className="text-sm">No employee data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Survey upload */}
        <div className="card">
          <h2 className="section-title mb-1"><UploadCloud className="w-4 h-4 text-accent" />Upload Survey Data</h2>
          <p className="text-xs text-muted mb-4">
            Upload a CSV with columns: <code className="font-mono bg-surface2 px-1 py-0.5 rounded text-[10px]">employee_id, survey_date, comments</code>.
            Sentiment and topic analysis run automatically.
          </p>
          <FileDropzone file={surveyFile} onChange={setSurveyFile} accept=".csv" label="Drop survey CSV here or click to browse" hint="Columns: employee_id, survey_date, comments" />

          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={runTopics} onChange={e => setRunTopics(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded" aria-label="Run zero-shot topic analysis" />
              <span className="text-xs font-medium text-text">Run zero-shot topic analysis</span>
              <span className="badge badge-violet text-[10px]">Recommended</span>
            </label>
            {surveyFile && (
              <button onClick={handleUpload} disabled={uploading} className="btn-primary btn-sm ml-auto">
                {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</> : <><UploadCloud className="w-3.5 h-3.5" />Upload & Process</>}
              </button>
            )}
          </div>
        </div>

        {/* Employee risk table */}
        {!loading && clsf.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="section-title mb-0"><Users className="w-4 h-4 text-accent" />All Classified Employees</h2>
              <Link href="/employees" className="text-xs font-semibold text-accent flex items-center gap-1 hover:underline">
                Full directory <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table" aria-label="Classified employees">
                <thead>
                  <tr>
                    <th scope="col">Employee ID</th>
                    <th scope="col">Risk Zone</th>
                    <th scope="col" className="text-right">Score</th>
                    <th scope="col" className="text-right">Classified</th>
                  </tr>
                </thead>
                <tbody>
                  {clsf.slice(0, 20).map(r => (
                    <tr key={r.employee_id}>
                      <td className="font-mono font-semibold">{r.employee_id}</td>
                      <td><RiskBadge zone={r.risk_zone} /></td>
                      <td className="text-right font-mono font-bold" style={{ color: ZONE_COLORS[r.risk_zone] ?? "var(--muted)" }}>{r.risk_score}%</td>
                      <td className="text-right text-xs text-muted font-mono">{r.classified_at ? new Date(r.classified_at).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {clsf.length > 20 && (
              <div className="px-5 py-3 border-t border-border bg-surface2 text-xs text-muted flex items-center justify-between">
                <span>Showing 20 of {clsf.length} employees</span>
                <Link href="/employees" className="text-accent hover:underline font-semibold flex items-center gap-1">
                  View all <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  )
}
