"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/AppShell"
import { getDashboard, getAnalyticsDashboard, getAlerts } from "@/lib/api"
import { Activity, Database, Layers, Zap, AlertTriangle, TrendingUp, Users, CheckCircle, Bell, Smile, Gauge } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const [data,    setData]    = useState<any>(null)
  const [kpis,    setKpis]    = useState<any>(null)
  const [alerts,  setAlerts]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  useEffect(() => {
    Promise.all([
      getDashboard(),
      getAnalyticsDashboard().catch(() => null),
      getAlerts({ acknowledged: false, limit: 5 }).catch(() => ({ alerts: [] })),
    ])
      .then(([d, k, a]) => { setData(d); setKpis(k); setAlerts(a.alerts) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="animate-fadeUp">
        <h1 className="font-mono text-2xl font-semibold text-text mb-1">Dashboard</h1>
        <p className="text-muted text-sm mb-8">System overview, model status &amp; workforce snapshot</p>

        {loading && <p className="font-mono text-muted text-sm animate-pulse2">Loading…</p>}
        {error   && <div className="badge-red mb-6">{error}</div>}

        {/* Workforce KPIs (when data is available) */}
        {kpis && kpis.total_employees > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <KpiCard icon={<Users className="w-4 h-4"/>}      label="Total Employees"    value={kpis.total_employees}               color="#60a5fa" />
            <KpiCard icon={<TrendingUp className="w-4 h-4"/>} label="Avg Attrition Risk" value={`${kpis.avg_attrition_risk ?? 0}%`} color={riskColor(kpis.avg_attrition_risk)} />
            <KpiCard icon={<AlertTriangle className="w-4 h-4"/>} label="High Risk (RED)"  value={kpis.high_risk_count}               color="#f87171" />
            <KpiCard icon={<CheckCircle className="w-4 h-4"/>} label="Success Rate"       value={`${kpis.intervention_success_rate}%`} color="#4ade80" />
            {kpis.enps && (
              <KpiCard 
                icon={<Smile className="w-4 h-4"/>} 
                label="eNPS Score"       
                value={kpis.enps.enps > 0 ? `+${kpis.enps.enps}` : kpis.enps.enps} 
                color={kpis.enps.enps >= 30 ? "#4ade80" : kpis.enps.enps >= 0 ? "#fbbf24" : "#f87171"} 
              />
            )}
            {kpis.engagement && (
              <KpiCard 
                icon={<Gauge className="w-4 h-4"/>} 
                label="Engagement"       
                value={kpis.engagement.engagement_index} 
                color={kpis.engagement.engagement_index >= 70 ? "#4ade80" : kpis.engagement.engagement_index >= 50 ? "#fbbf24" : "#f87171"} 
              />
            )}
          </div>
        )}

        {/* Unacknowledged alerts strip */}
        {alerts.length > 0 && (
          <div className="card border-red/20 bg-red/5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-red" />
                <p className="font-mono text-sm text-red font-semibold">{alerts.length} Unacknowledged Alerts</p>
              </div>
              <Link href="/alerts" className="font-mono text-xs text-muted hover:text-text transition-colors">
                View all →
              </Link>
            </div>
            <div className="space-y-1.5">
              {alerts.slice(0, 3).map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-red shrink-0">●</span>
                  <span className="text-text font-bold">{a.employee_id}</span>
                  <span className="text-muted truncate">{a.message}</span>
                  <span
                    className="ml-auto shrink-0 px-2 py-0.5 rounded border text-[10px] capitalize"
                    style={severityStyle(a.severity)}
                  >
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data && !data.has_model && (
          <div className="card border-amber/30 bg-amber/5 text-amber font-mono text-sm mb-6">
            No trained model found. Go to <strong>Train Model</strong> to get started.
          </div>
        )}

        {data?.model_metadata && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={<Database className="w-4 h-4"/>} label="Training Samples" value={data.model_metadata.samples?.toLocaleString() ?? "—"} />
              <StatCard icon={<Activity  className="w-4 h-4"/>} label="Model Accuracy"  value={data.model_metadata.accuracy ? `${(data.model_metadata.accuracy*100).toFixed(1)}%` : "—"} />
              <StatCard icon={<Layers    className="w-4 h-4"/>} label="Features"        value={data.model_metadata.features ?? "—"} />
              <StatCard icon={<Zap       className="w-4 h-4"/>} label="Embedding Dim"   value={data.model_metadata.embedding_dim ?? 384} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <p className="section-label">Model Metadata</p>
                <pre className="font-mono text-xs text-text/80 overflow-auto max-h-72">
                  {JSON.stringify(data.model_metadata, null, 2)}
                </pre>
              </div>
              {data.versions?.length > 0 && (
                <div className="card">
                  <p className="section-label">Training History</p>
                  <div className="overflow-auto max-h-72">
                    <table className="w-full font-mono text-xs">
                      <thead>
                        <tr className="text-muted border-b border-border">
                          <th className="text-left py-2 pr-4">Trained At</th>
                          <th className="text-left py-2 pr-4">Samples</th>
                          <th className="text-left py-2">Accuracy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.versions.map((v: any, i: number) => (
                          <tr key={i} className="border-b border-border/50 text-text/80">
                            <td className="py-1.5 pr-4">{v.trained_at?.slice(0,16)}</td>
                            <td className="py-1.5 pr-4">{v.samples}</td>
                            <td className="py-1.5">{v.accuracy ? `${(v.accuracy*100).toFixed(1)}%` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { href: "/analytics",     label: "Analytics Dashboard", color: "#60a5fa" },
            { href: "/trends",        label: "Trend Analysis",      color: "#a78bfa" },
            { href: "/alerts",        label: "Early Warnings",      color: "#f87171" },
            { href: "/interventions", label: "Interventions",       color: "#4ade80" },
          ].map(({ href, label, color }) => (
            <Link
              key={href}
              href={href}
              className="card text-center py-4 hover:border-opacity-60 transition-all group"
              style={{ borderColor: color + "25" }}
            >
              <span className="font-mono text-xs group-hover:opacity-100 opacity-80" style={{ color }}>
                {label} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-muted mb-2">{icon}<span className="stat-lbl">{label}</span></div>
      <div className="stat-val">{value}</div>
    </div>
  )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: any; color: string }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}<span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      </div>
      <div className="font-mono text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function riskColor(r: number) {
  return r >= 65 ? "#f87171" : r >= 35 ? "#fbbf24" : "#4ade80"
}
function severityStyle(s: string) {
  const m: Record<string, any> = {
    critical: { color: "#f87171", borderColor: "#f8717140", background: "#f8717110" },
    high:     { color: "#fbbf24", borderColor: "#fbbf2440", background: "#fbbf2410" },
    medium:   { color: "#60a5fa", borderColor: "#60a5fa40", background: "#60a5fa10" },
  }
  return m[s] || {}
}
