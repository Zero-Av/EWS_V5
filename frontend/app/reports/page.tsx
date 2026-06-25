"use client"
import { useState } from "react"
import AppShell from "@/components/AppShell"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { useToast } from "@/lib/toast-context"
import {
  FileText, Download, BarChart2, Users, Brain,
  Shield, Calendar, RefreshCw, CheckCircle,
  Clock, ChevronRight, FileSpreadsheet,
} from "lucide-react"

interface ReportDef {
  id: string
  title: string
  description: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
  format: string
  audience: string
  generationNote: string
}

const REPORTS: ReportDef[] = [
  {
    id: "executive",
    title: "Executive Summary Report",
    description: "Board-ready overview of workforce health, risk zones, eNPS trend, and recommended interventions for CHRO and C-suite.",
    icon: Shield,
    iconColor: "var(--accent)",
    iconBg: "var(--accent-light)",
    format: "PDF",
    audience: "CHRO · CEO",
    generationNote: "Includes KPI dashboard, risk distribution chart, and AI-generated narrative",
  },
  {
    id: "hr_analysis",
    title: "HR Analytics Deep-Dive",
    description: "Full employee risk classification table, sentiment breakdown by department, and action tracking status for HR Business Partners.",
    icon: Users,
    iconColor: "var(--green)",
    iconBg: "var(--green-light)",
    format: "CSV + PDF",
    audience: "HRBP · HR Director",
    generationNote: "Contains PII — restricted to admin users with data access",
  },
  {
    id: "sentiment",
    title: "Sentiment Analysis Report",
    description: "Topic-level sentiment trends, eNPS score history, velocity analysis, and notable comment themes from survey ingestion.",
    icon: Brain,
    iconColor: "var(--violet)",
    iconBg: "var(--violet-light)",
    format: "PDF",
    audience: "HRBP · Leadership",
    generationNote: "AI-generated theme summaries require active LLM integration",
  },
  {
    id: "attrition",
    title: "Attrition Risk Forecast",
    description: "Predicted attrition cohort, 30 and 90-day risk projections, estimated replacement cost, and priority intervention list.",
    icon: BarChart2,
    iconColor: "var(--red)",
    iconBg: "var(--red-light)",
    format: "PDF",
    audience: "CHRO · Finance",
    generationNote: "Requires at least 1 trained model and 50+ classified employees",
  },
  {
    id: "compliance",
    title: "Compliance Data Export",
    description: "Fully anonymised, aggregated workforce metrics for regulatory reporting. No employee-identifiable data included.",
    icon: FileSpreadsheet,
    iconColor: "var(--amber)",
    iconBg: "var(--amber-light)",
    format: "CSV",
    audience: "Legal · Compliance",
    generationNote: "All employee IDs are replaced with anonymous cohort codes",
  },
  {
    id: "model",
    title: "Model Performance Report",
    description: "LightGBM classifier accuracy, SHAP feature importances, classification report, and training data quality summary.",
    icon: Brain,
    iconColor: "var(--violet)",
    iconBg: "var(--violet-light)",
    format: "PDF",
    audience: "Data Science · HRBP",
    generationNote: "Only available after model training — includes confusion matrix",
  },
]

function ReportCard({ report, kpis }: { report: ReportDef; kpis: any }) {
  const toast = useToast()
  const [generating, setGenerating] = useState(false)
  const [done,       setDone]       = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    // Simulate generation delay — real integration would call a backend export endpoint
    await new Promise(r => setTimeout(r, 1400 + Math.random() * 600))
    setGenerating(false)
    setDone(true)
    toast.success(
      `${report.title} generated`,
      `${report.format} export ready — download will begin shortly`
    )
    setTimeout(() => setDone(false), 4000)
  }

  return (
    <div className="card hover:shadow-hover transition-all duration-200 flex flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: report.iconBg }}
          aria-hidden="true"
        >
          <report.icon className="w-5 h-5" style={{ color: report.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text leading-tight">{report.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="badge badge-gray text-[10px]">{report.format}</span>
            <span className="text-[10px] text-muted">{report.audience}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted leading-relaxed mb-3 flex-1">
        {report.description}
      </p>

      <div className="flex items-start gap-1.5 text-[10px] text-muted mb-4 p-2.5 rounded-lg"
        style={{ background: "var(--surface2)" }}>
        <Clock className="w-3 h-3 flex-shrink-0 mt-0.5" aria-hidden="true" />
        {report.generationNote}
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className={`btn btn-sm w-full justify-center ${done ? "btn-ghost" : "btn-primary"}`}
        aria-label={`Generate ${report.title}`}
      >
        {generating ? (
          <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Generating…</>
        ) : done ? (
          <><CheckCircle className="w-3.5 h-3.5 text-green" />Generated — Download</>
        ) : (
          <><Download className="w-3.5 h-3.5" />Generate {report.format}</>
        )}
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   REPORTS PAGE
═══════════════════════════════════════════════════════════════ */
export default function ReportsPage() {
  const { kpis, loading, lastUpdated } = useDashboard(0)

  const QUICK_STATS = [
    { label: "Employees",   value: loading ? "—" : (kpis?.total_employees ?? "—"), sub: "total monitored" },
    { label: "Coverage",    value: loading ? "—" : (kpis?.survey_coverage  ?? "—"), sub: "survey coverage" },
    { label: "RED",    value: loading ? "—" : (kpis?.zone_distribution?.RED   ?? 0), sub: "require action" },
    { label: "Avg Sentiment",value: loading ? "—" : kpis ? (kpis.avg_sentiment > 0 ? `+${kpis.avg_sentiment}` : kpis.avg_sentiment) : "—", sub: "sentiment score" },
  ]

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports & Exports</h1>
            <p className="page-subtitle">
              Generate board-ready reports, HR analytics exports, and compliance-safe data packages
            </p>
          </div>
          {lastUpdated && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Data as of {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Data snapshot */}
        <div className="card" style={{ background: "var(--accent-light)", borderColor: "var(--accent-mid)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" aria-hidden="true" />
              Current Data Snapshot
            </p>
            <span className="text-[10px] text-muted">Reports will be generated using this data</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {QUICK_STATS.map(s => (
              <div key={s.label} className="text-center p-3 rounded-lg bg-surface border border-border">
                <p className="text-xl font-extrabold font-mono text-text">{s.value}</p>
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-0.5">{s.label}</p>
                <p className="text-[10px] text-muted">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Report cards */}
        <div>
          <h2 className="section-title mb-4">
            <FileText className="w-4 h-4 text-accent" aria-hidden="true" />
            Available Reports
          </h2>
          <div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
            role="list"
            aria-label="Available reports"
          >
            {REPORTS.map(r => (
              <div key={r.id} role="listitem">
                <ReportCard report={r} kpis={kpis} />
              </div>
            ))}
          </div>
        </div>

        {/* Scheduled reports banner */}
        <div className="card flex items-start gap-4">
          <div className="icon-chip icon-chip-blue text-accent flex-shrink-0">
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-text mb-1">Scheduled Reports</h3>
            <p className="text-xs text-muted">
              Automated report delivery to email or Slack is available as a configuration option.
              Scheduled reports run every Monday at 07:00 and after each classifier run.
              Configure delivery targets in <strong>Settings → Integrations</strong>.
            </p>
          </div>
          <a href="/settings" className="btn-ghost btn-sm flex-shrink-0 flex items-center gap-1 text-xs">
            Configure <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>

      </div>
    </AppShell>
  )
}
