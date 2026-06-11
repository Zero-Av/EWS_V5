"use client"
import { useEffect, useState, useRef } from "react"
import AppShell from "@/components/AppShell"
import {
  getAnalyticsDashboard,
  getAlerts,
  acknowledgeAlert,
  getClassifications,
  getEmployeeSentiment,
  uploadSurveys,
  trainClassifier,
  getSurveySummary,
  classifyEmployees,
  getModelInfo,
  listUsers,
  addUser,
  deleteUser,
  connectLLM,
  getLLMStatus,
  UserRecord
} from "@/lib/api"
import {
  Users,
  AlertTriangle,
  Smile,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Brain,
  UploadCloud,
  Settings,
  ShieldCheck,
  Search,
  ArrowRight,
  Sparkles,
  Calendar,
  X,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  FileSpreadsheet,
  Zap,
  RefreshCw,
  Sliders,
  Cpu
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell
} from "recharts"

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [kpis, setKpis] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [summary, setSummary] = useState<string>("")
  const [classifications, setClassifications] = useState<any[]>([])
  const [modelInfo, setModelInfo] = useState<any>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Fetch all basic dashboard data
  const loadDashboardData = async () => {
    try {
      const [k, a, c, m] = await Promise.all([
        getAnalyticsDashboard().catch(() => null),
        getAlerts({ acknowledged: false, limit: 10 }).catch(() => ({ alerts: [] })),
        getClassifications().catch(() => ({ classifications: [] })),
        getModelInfo().catch(() => ({ has_model: false }))
      ])
      setKpis(k)
      setAlerts(a.alerts)
      setClassifications(c.classifications || [])
      setModelInfo(m)
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard data")
    }
  }

  useEffect(() => {
    loadDashboardData().finally(() => setLoading(false))
  }, [])

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="space-y-8 animate-fadeUp">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-xs tracking-wider uppercase mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Intelligence Dashboard
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight font-sans">
              Workforce Early Warning System
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Predictive attrition risk modeling, semantic sentiment analysis, and HR BP intervention recommendations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setLoading(true)
                await loadDashboardData()
                setLoading(false)
              }}
              className="btn-ghost flex items-center gap-2 py-2.5 px-4 font-semibold text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Refresh Data
            </button>
          </div>
        </div>

        {error && (
          <div className="alert-red font-semibold">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p>System Alert</p>
              <p className="text-xs font-normal opacity-90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Tab Contents */}
        {activeTab === "overview" && (
          <OverviewTab
            kpis={kpis}
            alerts={alerts}
            classifications={classifications}
            summary={summary}
            setSummary={setSummary}
            loadDashboardData={loadDashboardData}
            onAcknowledge={async (id) => {
              await acknowledgeAlert(id)
              await loadDashboardData()
            }}
          />
        )}
        
        {activeTab === "employees" && (
          <EmployeesTab
            classifications={classifications}
          />
        )}

        {activeTab === "data" && (
          <DataCenterTab
            modelInfo={modelInfo}
            loadDashboardData={loadDashboardData}
          />
        )}

        {activeTab === "users" && (
          <SettingsTab />
        )}
      </div>
    </AppShell>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TABS COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// 1. OVERVIEW TAB
function OverviewTab({ kpis, alerts, classifications, summary, setSummary, loadDashboardData, onAcknowledge }: any) {
  const [summarizing, setSummarizing] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")

  const runClassification = async () => {
    setClassifying(true)
    setSuccessMsg("")
    try {
      const res = await classifyEmployees()
      setSuccessMsg(`Successfully classified ${res.employees_classified} employees! Generated ${res.alerts_created} alerts.`)
      await loadDashboardData()
    } catch (err: any) {
      alert(err.message || "Failed to classify employees")
    } finally {
      setClassifying(false)
    }
  }

  const generateSummary = async () => {
    setSummarizing(true)
    try {
      const res = await getSurveySummary()
      setSummary(res.summary)
    } catch (err: any) {
      setSummary("Could not generate summary. Check if your LLM connection is online.")
    } finally {
      setSummarizing(false)
    }
  }

  const hasAlerts = alerts && alerts.length > 0

  // Chart data formatting
  const chartData = kpis
    ? [
        { name: "Green", value: kpis.zone_distribution?.GREEN || 0, fill: "#10B981" },
        { name: "Amber", value: kpis.zone_distribution?.AMBER || 0, fill: "#F59E0B" },
        { name: "Red", value: kpis.zone_distribution?.RED || 0, fill: "#EF4444" }
      ]
    : []

  return (
    <div className="space-y-8 animate-fadeUp">
      {/* Action Banner */}
      {successMsg && (
        <div className="alert-green font-semibold animate-fadeUp">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Section */}
      {kpis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-lbl">Total Monitored</span>
              <Users className="w-5 h-5 text-blue-600 bg-blue-50 p-1 rounded-lg" />
            </div>
            <span className="stat-val">{kpis.total_employees}</span>
            <span className="text-[10px] text-slate-400 font-semibold">Unique employees</span>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-lbl">Average Sentiment</span>
              <Smile className="w-5 h-5 text-emerald-600 bg-emerald-50 p-1 rounded-lg" />
            </div>
            <span className="stat-val text-emerald-700">
              {kpis.avg_sentiment > 0 ? `+${kpis.avg_sentiment}` : kpis.avg_sentiment}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Range [-1.0 to +1.0]</span>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-lbl">eNPS Score</span>
              <MessageSquare className="w-5 h-5 text-indigo-600 bg-indigo-50 p-1 rounded-lg" />
            </div>
            <span className="stat-val text-indigo-600">
              {kpis.survey_coverage > 0 ? `+${Math.round(kpis.avg_sentiment * 100)}` : "—"}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold">Calculated on coverage</span>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-lbl">Critical Alerts (RED)</span>
              <AlertTriangle className="w-5 h-5 text-red-600 bg-red-50 p-1 rounded-lg" />
            </div>
            <span className="stat-val text-red-600">{kpis.zone_distribution?.RED || 0}</span>
            <span className="text-[10px] text-slate-400 font-semibold">Require immediate action</span>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-lbl">Survey Coverage</span>
              <FileSpreadsheet className="w-5 h-5 text-purple-600 bg-purple-50 p-1 rounded-lg" />
            </div>
            <span className="stat-val text-purple-700">{kpis.survey_coverage}</span>
            <span className="text-[10px] text-slate-400 font-semibold">Employees with survey data</span>
          </div>
        </div>
      ) : (
        <div className="card text-center py-10 bg-slate-50 border-dashed border-slate-300">
          <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-slate-700 font-bold">No survey data loaded yet</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
            Please head over to the <strong>Data &amp; Model Center</strong> and upload a survey CSV to initialize the metrics.
          </p>
        </div>
      )}

      {/* Grid Dashboard Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Risk Distribution and Classifier Controls */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-blue-600" />
                  Workforce Risk Segmentation
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">Distribution of employees across early warning risk zones.</p>
              </div>
              
              <button
                onClick={runClassification}
                disabled={classifying}
                className="btn-primary flex items-center gap-2 py-2 px-3 text-xs"
              >
                {classifying ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>{classifying ? "Running Classification..." : "Run Classifier"}</span>
              </button>
            </div>

            {kpis && kpis.total_employees > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                    <Tooltip cursor={{ fill: '#F8FAFC' }} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={45}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-xs font-semibold">No distribution data</span>
              </div>
            )}
          </div>

          {/* AI Semantic Summarizer */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
                  <Brain className="w-4.5 h-4.5 text-blue-600" />
                  AI Thematic Summary
                </h3>
                <p className="text-slate-500 text-xs mt-0.5">Generates semantic summaries of recent negative comments via connected LLM.</p>
              </div>
              <button
                onClick={generateSummary}
                disabled={summarizing}
                className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5 border-blue-200 bg-blue-50/20 text-blue-700 hover:bg-blue-50"
              >
                {summarizing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>{summarizing ? "Summarizing..." : "Analyze Themes"}</span>
              </button>
            </div>

            {summary ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm text-slate-700 leading-relaxed font-sans">
                {summary}
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-xs bg-slate-50/30">
                Click <strong>Analyze Themes</strong> to process and cluster employee attrition drivers.
              </div>
            )}
          </div>
        </div>

        {/* Early Warning Active Alerts Feed */}
        <div className="card h-fit">
          <div className="mb-5 border-b border-slate-100 pb-4">
            <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5 text-red-600" />
              Active Warnings ({alerts.length})
            </h3>
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-1">Requires HRBP review</p>
          </div>

          {hasAlerts ? (
            <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
              {alerts.map((a: any) => (
                <div key={a.id} className="p-4 rounded-xl border border-red-100 bg-red-50/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-red-800 uppercase bg-red-100/60 px-2 py-0.5 rounded-md">
                      {a.employee_id}
                    </span>
                    <span className="text-[9px] font-bold text-red-600 bg-white border border-red-100 px-1.5 py-0.5 rounded uppercase">
                      Critical Risk
                    </span>
                  </div>
                  <p className="text-slate-700 text-xs font-medium leading-relaxed">{a.message}</p>
                  
                  <div className="flex items-center justify-between pt-1 border-t border-red-100/40">
                    <span className="text-[9px] text-slate-400 font-mono">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => onAcknowledge(a.id)}
                      className="text-[10px] font-bold text-blue-600 bg-white hover:bg-blue-50 hover:text-blue-700 transition-colors border border-blue-100 px-2.5 py-1 rounded-lg"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2.5" />
              All alerts acknowledged. Excellent work!
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// 2. EMPLOYEE DIRECTORY TAB
function EmployeesTab({ classifications }: any) {
  const [search, setSearch] = useState("")
  const [filterZone, setFilterZone] = useState("ALL")
  const [selectedEmp, setSelectedEmp] = useState<any>(null)
  const [empData, setEmpData] = useState<any>(null)
  const [empLoading, setEmpLoading] = useState(false)
  const [empError, setEmpError] = useState("")

  const loadEmployeeDetail = async (empId: string) => {
    setEmpLoading(true)
    setEmpError("")
    setEmpData(null)
    try {
      const res = await getEmployeeSentiment(empId)
      setEmpData(res)
    } catch (err: any) {
      setEmpError(err.message || "Failed to load employee details")
    } finally {
      setEmpLoading(false)
    }
  }

  const handleRowClick = (emp: any) => {
    setSelectedEmp(emp)
    loadEmployeeDetail(emp.employee_id)
  }

  // Search & Filter rows
  const filtered = classifications.filter((c: any) => {
    const matchesSearch = c.employee_id.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filterZone === "ALL" || c.risk_zone === filterZone
    return matchesSearch && matchesFilter
  })

  // Group by departments or manager if available
  const zones = ["ALL", "RED", "AMBER", "GREEN"]

  return (
    <div className="space-y-6 animate-fadeUp relative">
      
      {/* Search & Filter Headers */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            className="input pl-10"
            placeholder="Search by Employee ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
          {zones.map(z => (
            <button
              key={z}
              onClick={() => setFilterZone(z)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                filterZone === z
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Grid/Table */}
      <div className="card overflow-hidden !p-0 border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <th className="py-4 px-6">Employee ID</th>
                <th className="py-4 px-6 text-center">Risk Zone</th>
                <th className="py-4 px-6 text-right">Risk Score</th>
                <th className="py-4 px-6 text-right">Last Survey Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((c: any) => (
                  <tr
                    key={c.employee_id}
                    onClick={() => handleRowClick(c)}
                    className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-slate-800">{c.employee_id}</td>
                    <td className="py-4 px-6 text-center">
                      <span className={
                        c.risk_zone === "RED" ? "badge-red" : (c.risk_zone === "AMBER" ? "badge-amber" : "badge-green")
                      }>
                        {c.risk_zone}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-bold text-slate-700">{c.risk_score}%</td>
                    <td className="py-4 px-6 text-right text-slate-400 text-xs font-mono">
                      {c.classified_at ? new Date(c.classified_at).toLocaleDateString() : "N/A"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 text-xs font-medium">
                    No employees matching search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Side Drawer for Employee Details */}
      {selectedEmp && (
        <div className="fixed inset-0 z-40 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedEmp(null)}
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px] transition-opacity"
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 animate-slideLeft">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-0.5 rounded-md">
                  Employee Dossier
                </span>
                <h2 className="text-xl font-extrabold text-slate-800 mt-1">{selectedEmp.employee_id}</h2>
              </div>
              <button
                onClick={() => setSelectedEmp(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {empLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
                  <span className="text-xs font-semibold text-slate-400 animate-pulse">Loading employee logs...</span>
                </div>
              )}

              {empError && (
                <div className="alert-red font-semibold">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>{empError}</span>
                </div>
              )}

              {empData && (
                <>
                  {/* Top Stats Strip */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-center flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Zone Class</span>
                      <span className={`text-base font-bold w-fit mx-auto mt-0.5 ${
                        selectedEmp.risk_zone === "RED" ? "badge-red" : (selectedEmp.risk_zone === "AMBER" ? "badge-amber" : "badge-green")
                      }`}>{selectedEmp.risk_zone}</span>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-center flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Avg Sentiment</span>
                      <span className="text-base font-bold text-slate-700 mt-0.5 font-mono">
                        {empData.avg_sentiment > 0 ? `+${empData.avg_sentiment}` : empData.avg_sentiment}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-center flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Sentiment Velocity</span>
                      <span className={`text-base font-bold mt-0.5 font-mono ${
                        empData.sentiment_velocity < 0 ? "text-red-600" : (empData.sentiment_velocity > 0 ? "text-emerald-600" : "text-slate-500")
                      }`}>
                        {empData.sentiment_velocity > 0 ? `+${empData.sentiment_velocity}` : empData.sentiment_velocity}
                      </span>
                    </div>
                  </div>

                  {/* Sentiment History Line Chart */}
                  <div className="card">
                    <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-4">Sentiment Trajectory</h4>
                    {empData.history && empData.history.length > 0 ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={empData.history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                            <XAxis dataKey="survey_date" stroke="#64748B" fontSize={9} tickLine={false} />
                            <YAxis stroke="#64748B" fontSize={9} tickLine={false} domain={[-1, 1]} />
                            <Tooltip />
                            <Line type="monotone" dataKey="sentiment_score" stroke="#2563EB" strokeWidth={2.5} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-slate-400 text-xs">
                        No sentiment history log
                      </div>
                    )}
                  </div>

                  {/* zero-shot topic distribution progress bars */}
                  <div className="card">
                    <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-4">Topic Sentiment Breakdown</h4>
                    {Object.keys(empData.topic_breakdown).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(empData.topic_breakdown).map(([topic, val]: [string, any]) => {
                          const percentage = Math.round((val + 1) * 50)  // scale -1/+1 to 0/100
                          let color = "bg-emerald-500"
                          if (val < -0.1) color = "bg-red-500"
                          else if (val <= 0.1) color = "bg-amber-500"

                          return (
                            <div key={topic} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-700 capitalize">{topic}</span>
                                <span className="font-mono text-slate-500 font-bold">{val > 0 ? `+${val}` : val}</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className={`h-full ${color}`} style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs text-center py-4">
                        No semantic topic scores computed yet. Check if zero-shot models are enabled during ingestion.
                      </div>
                    )}
                  </div>

                  {/* SHAP Explanation factors */}
                  {selectedEmp.top_factors && selectedEmp.top_factors.length > 0 && (
                    <div className="card border-blue-100 bg-blue-50/10">
                      <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider mb-4 flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-blue-600" />
                        SHAP Top Risk Factors
                      </h4>
                      <div className="space-y-2.5 font-mono text-xs">
                        {JSON.parse(selectedEmp.top_factors).map((f: any) => {
                          const isHigh = f.shap_value > 0
                          return (
                            <div key={f.feature} className="flex items-center justify-between">
                              <span className="text-slate-600">{f.feature}</span>
                              <span className={`font-semibold ${isHigh ? "text-red-600" : "text-emerald-600"}`}>
                                {isHigh ? "↑ Increase" : "↓ Decrease"} ({f.shap_value > 0 ? `+${f.shap_value}` : f.shap_value})
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Chronological list of comments */}
                  <div className="space-y-4">
                    <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-slate-500" />
                      Survey Comments ({empData.history.length})
                    </h4>
                    <div className="space-y-3">
                      {empData.history.map((h: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              {h.survey_date}
                            </span>
                            <span className={
                              h.sentiment_label === "positive" ? "badge-green scale-90" : (h.sentiment_label === "negative" ? "badge-red scale-90" : "badge-amber scale-90")
                            }>
                              {h.sentiment_label || "neutral"} ({h.sentiment_score ?? "0"})
                            </span>
                          </div>
                          <p className="text-slate-700 text-xs leading-relaxed font-sans">{h.comments || "(No comments provided)"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

// 3. DATA & MODEL CENTER TAB
function DataCenterTab({ modelInfo, loadDashboardData }: any) {
  const [surveyFile, setSurveyFile] = useState<File | null>(null)
  const [trainFile, setTrainFile] = useState<File | null>(null)
  const [runTopics, setRunTopics] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [training, setTraining] = useState(false)
  
  const [surveyStats, setSurveyStats] = useState<any>(null)
  const [trainStats, setTrainStats] = useState<any>(null)

  const handleSurveyUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!surveyFile) return
    setUploading(true)
    setSurveyStats(null)
    try {
      const res = await uploadSurveys(surveyFile, runTopics)
      setSurveyStats(res)
      setSurveyFile(null)
      await loadDashboardData()
    } catch (err: any) {
      alert(err.message || "Failed to upload surveys")
    } finally {
      setUploading(false)
    }
  }

  const handleTrainUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!trainFile) return
    setTraining(true)
    setTrainStats(null)
    try {
      const res = await trainClassifier(trainFile)
      setTrainStats(res.metadata)
      setTrainFile(null)
      await loadDashboardData()
    } catch (err: any) {
      alert(err.message || "Failed to train classifier")
    } finally {
      setTraining(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeUp">
      
      {/* CSV Ingestion Panels */}
      <div className="space-y-8">
        
        {/* Survey Ingest panel */}
        <div className="card">
          <h3 className="text-slate-800 font-bold text-base flex items-center gap-2 mb-1">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            Ingest Surveys
          </h3>
          <p className="text-slate-500 text-xs mb-6">Upload raw surveys. Runs sentiment &amp; topic analysis sequentially.</p>

          <form onSubmit={handleSurveyUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
              <input
                type="file"
                accept=".csv"
                onChange={e => setSurveyFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <span className="block text-xs font-semibold text-slate-700">
                {surveyFile ? surveyFile.name : "Drag & drop surveys.csv or click here"}
              </span>
              <span className="block text-[10px] text-slate-400 mt-1">Accepts CSV files with employee_id, comments, etc.</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="run_topics"
                checked={runTopics}
                onChange={e => setRunTopics(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="run_topics" className="text-xs font-medium text-slate-600">
                Run zero-shot topic detector (slower, model BART)
              </label>
            </div>

            <button
              type="submit"
              disabled={uploading || !surveyFile}
              className="btn-primary w-full py-3"
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing CSV Pipeline...</span>
                </div>
              ) : (
                "Upload and Ingest"
              )}
            </button>
          </form>

          {surveyStats && (
            <div className="mt-5 p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 text-emerald-800 text-xs font-medium space-y-1 animate-fadeUp">
              <p className="font-bold">✓ Upload Complete!</p>
              <p>Surveys Ingested: {surveyStats.surveys_ingested}</p>
              <p>Avg Sentiment Score: {surveyStats.sentiment_summary?.avg_score}</p>
            </div>
          )}
        </div>

        {/* Model Training panel */}
        <div className="card">
          <h3 className="text-slate-800 font-bold text-base flex items-center gap-2 mb-1">
            <Cpu className="w-5 h-5 text-indigo-600" />
            Train Risk Classifier
          </h3>
          <p className="text-slate-500 text-xs mb-6">Train LightGBM model on survey datasets with risk_label.</p>

          <form onSubmit={handleTrainUpload} className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
              <input
                type="file"
                accept=".csv"
                onChange={e => setTrainFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <span className="block text-xs font-semibold text-slate-700">
                {trainFile ? trainFile.name : "Drag & drop training_labels.csv or click here"}
              </span>
              <span className="block text-[10px] text-slate-400 mt-1">Required cols: employee_id, comments, risk_label</span>
            </div>

            <button
              type="submit"
              disabled={training || !trainFile}
              className="btn-primary w-full py-3 !bg-indigo-600 hover:bg-indigo-700"
            >
              {training ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Fitting LightGBM parameters...</span>
                </div>
              ) : (
                "Train Classifier Model"
              )}
            </button>
          </form>

          {trainStats && (
            <div className="mt-5 p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 text-emerald-800 text-xs font-medium space-y-1 animate-fadeUp">
              <p className="font-bold">✓ Model Trained!</p>
              <p>Accuracy Score: {Math.round(trainStats.accuracy * 100)}%</p>
              <p>Samples Used: {trainStats.samples}</p>
            </div>
          )}
        </div>

      </div>

      {/* Model status view */}
      <div className="space-y-8">
        <div className="card h-fit">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
            <h3 className="text-slate-800 font-bold text-base flex items-center gap-2">
              <Sliders className="w-4.5 h-4.5 text-blue-600" />
              Classifier Status
            </h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              modelInfo?.has_model ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              {modelInfo?.has_model ? "Active Model" : "No Model Fitted"}
            </span>
          </div>

          {modelInfo?.has_model && modelInfo.metadata ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-center">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Trained Accuracy</span>
                  <span className="block text-xl font-extrabold text-blue-700 mt-1 font-mono">
                    {Math.round(modelInfo.metadata.accuracy * 100)}%
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 text-center">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Training Samples</span>
                  <span className="block text-xl font-extrabold text-indigo-700 mt-1 font-mono">
                    {modelInfo.metadata.samples}
                  </span>
                </div>
              </div>

              {/* Top SHAP Features importances */}
              {modelInfo.metadata.top_features && (
                <div className="space-y-3.5">
                  <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider">Top Predictor Features</h4>
                  <div className="space-y-2.5 font-mono text-xs">
                    {Object.entries(modelInfo.metadata.top_features).slice(0, 7).map(([feat, imp]: [string, any]) => (
                      <div key={feat} className="flex items-center justify-between">
                        <span className="text-slate-600 truncate mr-4">{feat}</span>
                        <span className="font-semibold text-slate-800">Importance: {imp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-slate-400 text-xs">
              Classifier pickle file not found in <code>models/</code>. Please upload a labeled dataset to trigger LightGBM training.
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// 4. USER SETTINGS TAB
function SettingsTab() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("manager")
  const [loading, setLoading] = useState(true)
  
  const [llmProvider, setLlmProvider] = useState("auto")
  const [llmConnected, setLlmConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const loadSettingsData = async () => {
    try {
      const [u, l] = await Promise.all([
        listUsers().catch(() => ({ users: [] })),
        getLLMStatus().catch(() => ({ connected: false }))
      ])
      setUsers(u.users || [])
      setLlmConnected(l.connected)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadSettingsData().finally(() => setLoading(false))
  }, [])

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password || !fullName) return
    try {
      await addUser({ username, password, full_name: fullName, role })
      setUsername("")
      setPassword("")
      setFullName("")
      await loadSettingsData()
    } catch (err: any) {
      alert(err.message || "Failed to create user")
    }
  }

  const handleDeleteUser = async (uname: string) => {
    if (uname === "admin") {
      alert("Cannot delete root admin user!")
      return
    }
    if (!confirm(`Are you sure you want to delete user ${uname}?`)) return
    try {
      await deleteUser(uname)
      await loadSettingsData()
    } catch (err: any) {
      alert(err.message || "Failed to delete user")
    }
  }

  const handleConnectLLM = async (e: FormEvent) => {
    e.preventDefault()
    setConnecting(true)
    try {
      const res = await connectLLM(llmProvider)
      setLlmConnected(res.status === "connected")
      alert(res.status === "connected" ? `Connected to ${res.provider}!` : "LLM provider offline.")
    } catch (err: any) {
      alert(err.message || "Connection failed")
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeUp">
      
      {/* User administration */}
      <div className="card space-y-6 h-fit">
        <div>
          <h3 className="text-slate-800 font-bold text-base flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-blue-600" />
            User Management
          </h3>
          <p className="text-slate-500 text-xs">Manage administrative and manager dashboard access credentials.</p>
        </div>

        {/* Add User form */}
        <form onSubmit={handleAddUser} className="space-y-3.5 border-b border-slate-100 pb-5">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Full Name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
            <select className="input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="manager">Manager</option>
              <option value="admin">Administrator / HRBP</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            Add User Account
          </button>
        </form>

        {/* User Table List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {users.map((u: UserRecord) => (
            <div key={u.username} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/30 text-xs font-semibold">
              <div className="flex flex-col gap-0.5">
                <span className="text-slate-800 leading-tight">{u.full_name}</span>
                <span className="font-mono text-slate-400 font-medium">@{u.username} ({u.role})</span>
              </div>
              <button
                onClick={() => handleDeleteUser(u.username)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:text-red hover:border-red-100 text-slate-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Settings Panel */}
      <div className="card space-y-6 h-fit">
        <div>
          <h3 className="text-slate-800 font-bold text-base flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-indigo-600" />
            System Integrations
          </h3>
          <p className="text-slate-500 text-xs">Configure third-party LLM providers for eNPS semantic analysis.</p>
        </div>

        {/* LLM Connection Panel */}
        <form onSubmit={handleConnectLLM} className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-600">Semantic Engine Status</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${llmConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
              <span className={`text-xs font-bold ${llmConnected ? "text-emerald-700" : "text-slate-500"}`}>
                {llmConnected ? "Connected" : "Offline"}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              LLM Provider Selector
            </label>
            <select
              className="input"
              value={llmProvider}
              onChange={e => setLlmProvider(e.target.value)}
            >
              <option value="auto">Auto-detect (Recommended)</option>
              <option value="anthropic">Anthropic (Claude Sonnet)</option>
              <option value="ollama">Ollama (Qwen local)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={connecting}
            className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center gap-1.5"
          >
            {connecting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{connecting ? "Initializing provider handshake..." : "Test Provider Connection"}</span>
          </button>
        </form>
      </div>

    </div>
  )
}
