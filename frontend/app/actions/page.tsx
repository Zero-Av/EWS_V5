"use client"
import { useState } from "react"
import AppShell from "@/components/AppShell"
import { useAlerts } from "@/lib/hooks/useAlerts"
import { useToast } from "@/lib/toast-context"
import RiskBadge from "@/components/ui/RiskBadge"
import { Zap, CheckCircle, RefreshCw, AlertTriangle, ChevronRight } from "lucide-react"
import Link from "next/link"

export default function ActionsPage() {
  const { alerts, acknowledge, loading } = useAlerts()
  const toast = useToast()
  const [acking, setAcking] = useState<number | null>(null)

  const handleAck = async (id: number, empId: string) => {
    setAcking(id)
    try {
      await acknowledge(id)
      toast.success("Alert resolved", `${empId} — marked as reviewed`)
    } catch (e: any) {
      toast.error("Failed to acknowledge", e.message)
    } finally {
      setAcking(null)
    }
  }

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        <div className="page-header">
          <div>
            <h1 className="page-title">Action Center</h1>
            <p className="page-subtitle">
              {alerts.length > 0
                ? `${alerts.length} unacknowledged alert${alerts.length !== 1 ? "s" : ""} require review`
                : "All alerts resolved — workforce is in good standing"}
            </p>
          </div>
          {alerts.length > 0 && (
            <span className="badge badge-red">
              {alerts.length} pending
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card animate-pulse-dot h-24 skeleton" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CheckCircle className="w-14 h-14 mb-4" style={{ color: "var(--green)" }} aria-hidden="true" />
            <h2 className="text-lg font-bold text-text mb-2">All clear</h2>
            <p className="text-sm text-muted max-w-xs">
              No unacknowledged alerts. Run the classifier to check for new risks.
            </p>
            <Link href="/analytics" className="btn-primary btn-sm mt-6">
              <RefreshCw className="w-3.5 h-3.5" /> Go to Analytics
            </Link>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-label="Pending action items">
            {alerts.map(a => (
              <div
                key={a.id}
                className="card flex items-start gap-4"
                style={{ borderColor: "#FCA5A5", background: "var(--red-light)" }}
                role="listitem"
              >
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--red)" }} aria-hidden="true" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge badge-red font-mono text-[10px]">{a.employee_id}</span>
                    <RiskBadge zone="RED" />
                    <span className="text-[10px] text-muted font-mono ml-auto">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-text-2 leading-relaxed">{a.message}</p>
                  <p className="text-xs text-muted mt-1 font-semibold uppercase tracking-wider">
                    Recommended: Schedule immediate 1:1 · Workload review · Sentiment check-in
                  </p>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link
                    href={`/employees?highlight=${a.employee_id}`}
                    className="btn-ghost btn-sm flex items-center gap-1 text-[11px]"
                  >
                    View Profile <ChevronRight className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => handleAck(a.id, a.employee_id)}
                    disabled={acking === a.id}
                    className="btn-primary btn-sm text-[11px]"
                  >
                    {acking === a.id
                      ? <><RefreshCw className="w-3 h-3 animate-spin" />Resolving…</>
                      : <><Zap className="w-3 h-3" />Resolve</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </AppShell>
  )
}
