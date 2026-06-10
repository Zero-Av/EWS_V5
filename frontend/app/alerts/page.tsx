"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/AppShell"
import { getAlerts, acknowledgeAlert } from "@/lib/api"
import { Bell, BellOff, AlertTriangle, AlertCircle, Info, Check, Loader2, RefreshCw } from "lucide-react"

interface Alert {
  id:             number
  employee_id:    string
  alert_type:     string
  severity:       string
  message:        string
  old_value:      number | null
  new_value:      number | null
  acknowledged:   number
  acknowledged_by: string | null
  created_at:     string
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  critical: { color: "#f87171", bg: "#f87171/10", icon: AlertTriangle },
  high:     { color: "#fbbf24", bg: "#fbbf24/10", icon: AlertCircle  },
  medium:   { color: "#60a5fa", bg: "#60a5fa/10", icon: Info          },
}

const TYPE_LABELS: Record<string, string> = {
  risk_spike:           "🔺 Risk Spike",
  satisfaction_drop:    "📉 Satisfaction Drop",
  stress_spike:         "🔥 Stress Spike",
  absenteeism_spike:    "📅 Absenteeism Spike",
  wlb_drop:             "⚖️ Work-Life Balance Drop",
  manager_support_drop: "👤 Manager Support Drop",
  entered_red:          "🚨 Entered RED Zone",
}

export default function AlertsPage() {
  const [alerts,       setAlerts]       = useState<Alert[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showAll,      setShowAll]      = useState(false)
  const [acking,       setAcking]       = useState<Record<number, boolean>>({})
  const [error,        setError]        = useState("")
  const [filterSev,    setFilterSev]    = useState<string[]>(["critical","high","medium"])

  async function fetchAlerts() {
    setLoading(true)
    try {
      const r = await getAlerts({ acknowledged: showAll ? undefined : false, limit: 100 })
      setAlerts(r.alerts)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlerts() }, [showAll])

  async function handleAck(alertId: number) {
    setAcking(a => ({ ...a, [alertId]: true }))
    try {
      await acknowledgeAlert(alertId)
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: 1 } : a))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAcking(a => ({ ...a, [alertId]: false }))
    }
  }

  const filtered = alerts.filter(a => filterSev.includes(a.severity))
  const unreadCount = alerts.filter(a => !a.acknowledged).length

  const bySeverity = {
    critical: filtered.filter(a => a.severity === "critical").length,
    high:     filtered.filter(a => a.severity === "high").length,
    medium:   filtered.filter(a => a.severity === "medium").length,
  }

  return (
    <AppShell>
      <div className="animate-fadeUp">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-mono text-2xl font-semibold text-text">Early Warning Alerts</h1>
          {unreadCount > 0 && (
            <span className="font-mono text-xs px-3 py-1.5 rounded-full bg-red/10 border border-red/30 text-red">
              {unreadCount} unacknowledged
            </span>
          )}
        </div>
        <p className="text-muted text-sm mb-8">
          Automatic alerts triggered when employee metrics cross critical thresholds
        </p>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-5 flex-wrap">
          {/* Severity filters */}
          <div className="flex gap-2">
            {(["critical","high","medium"] as const).map(sev => {
              const cfg = SEVERITY_CONFIG[sev]
              const active = filterSev.includes(sev)
              return (
                <button
                  key={sev}
                  onClick={() => setFilterSev(f => active ? f.filter(x => x !== sev) : [...f, sev])}
                  className="font-mono text-xs px-3 py-1.5 rounded-full border transition-all capitalize"
                  style={active
                    ? { borderColor: cfg.color + "60", color: cfg.color, background: cfg.color + "10" }
                    : { borderColor: "#1a2a40", color: "#4a6580" }
                  }
                >
                  {sev} ({bySeverity[sev]})
                </button>
              )
            })}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => setShowAll(s => !s)}
              className="btn-primary text-xs py-1.5"
              style={{ borderColor: showAll ? "#4a6580" : undefined }}
            >
              {showAll ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              {showAll ? "Show Unread" : "Show All"}
            </button>
            <button onClick={fetchAlerts} className="btn-primary text-xs py-1.5">
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red/10 border border-red/30 text-red font-mono text-sm px-4 py-3 rounded-lg mb-5">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted font-mono text-sm py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading alerts…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-muted">
            <div className="w-14 h-14 rounded-full bg-green/10 border border-green/30 flex items-center justify-center">
              <Check className="w-7 h-7 text-green" />
            </div>
            <p className="font-mono text-sm text-green">
              {showAll ? "No alerts found" : "All alerts acknowledged"}
            </p>
            <p className="font-mono text-xs opacity-60 text-center max-w-xs">
              Alerts are generated automatically when employee metrics change significantly between snapshots.
            </p>
          </div>
        )}

        {/* Alert cards */}
        <div className="space-y-2">
          {filtered.map(alert => {
            const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium
            const Icon = cfg.icon
            const acked = Boolean(alert.acknowledged)

            return (
              <div
                key={alert.id}
                className="flex items-start gap-4 px-5 py-4 rounded-xl border transition-all"
                style={{
                  borderColor: acked ? "#1a2a40" : cfg.color + "40",
                  background: acked ? "transparent" : cfg.color + "08",
                  opacity: acked ? 0.5 : 1,
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: cfg.color + "15", border: `1px solid ${cfg.color}30` }}
                >
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-muted">
                      {TYPE_LABELS[alert.alert_type] || alert.alert_type}
                    </span>
                    <span
                      className="font-mono text-[10px] px-2 py-0.5 rounded border capitalize"
                      style={{ color: cfg.color, borderColor: cfg.color + "40", background: cfg.color + "10" }}
                    >
                      {alert.severity}
                    </span>
                    <span className="font-mono text-[10px] text-muted ml-auto">
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs font-bold text-text">{alert.employee_id}</span>
                    <span className="text-sm text-text/80">{alert.message}</span>
                  </div>
                  {acked && alert.acknowledged_by && (
                    <p className="font-mono text-[10px] text-muted mt-1">
                      ✓ Acknowledged by {alert.acknowledged_by}
                    </p>
                  )}
                </div>

                {!acked && (
                  <button
                    onClick={() => handleAck(alert.id)}
                    disabled={acking[alert.id]}
                    className="shrink-0 font-mono text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:border-green/30 hover:text-green transition-all"
                  >
                    {acking[alert.id]
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <><Check className="w-3 h-3 inline mr-1" />Ack</>
                    }
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Rules reference */}
        <div className="mt-8 card opacity-60">
          <p className="section-label">Alert Rules Reference</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ["Risk Spike",             "Risk score increases ≥ 15 points",   "critical"],
              ["Entered RED Zone",       "Risk score crosses 65 threshold",     "critical"],
              ["Satisfaction Drop",      "Job satisfaction drops ≥ 2 points",   "high"    ],
              ["Stress Spike",           "Stress level increases ≥ 2 points",   "high"    ],
              ["Absenteeism Spike",      "Absenteeism increases ≥ 3 days",      "high"    ],
              ["Work-Life Balance Drop", "WLB drops ≥ 2 points",               "medium"  ],
              ["Manager Support Drop",   "Manager support drops ≥ 2 points",   "medium"  ],
            ].map(([name, rule, sev]) => {
              const cfg = SEVERITY_CONFIG[sev as string] || SEVERITY_CONFIG.medium
              return (
                <div key={name} className="flex items-center gap-3 py-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                  <span className="font-mono text-xs text-text">{name}:</span>
                  <span className="font-mono text-xs text-muted">{rule}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
