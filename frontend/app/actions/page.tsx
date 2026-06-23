"use client"
import { useState, useEffect, useCallback } from "react"
import AppShell from "@/components/AppShell"
import { useAlerts } from "@/lib/hooks/useAlerts"
import { useToast } from "@/lib/toast-context"
import { useAuth } from "@/lib/auth-context"
import RiskBadge from "@/components/ui/RiskBadge"
import {
  generateEmployeeRecommendation, generateBulkRecommendations,
  listInterventions, updateIntervention, deleteIntervention,
  type Intervention,
} from "@/lib/api"
import {
  Zap, CheckCircle, RefreshCw, AlertTriangle, ChevronRight, ChevronDown,
  Sparkles, Users, Clock, User, Trash2, ListChecks,
} from "lucide-react"
import Link from "next/link"

/* ─── Priority / status badge helpers ──────────────────────────── */
const PRIORITY_CLS: Record<string, string> = {
  critical: "badge-red", high: "badge-amber", medium: "badge-blue", low: "badge-gray",
}
const STATUS_CLS: Record<string, string> = {
  Pending: "badge-gray", "In Progress": "badge-blue", Completed: "badge-green",
}
const NEXT_STATUS: Record<string, string> = {
  Pending: "In Progress", "In Progress": "Completed",
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`badge ${PRIORITY_CLS[priority] ?? "badge-gray"} text-[10px] uppercase`}>
      {priority}
    </span>
  )
}

/* ─── A single generated recommendation card ──────────────────── */
function InterventionCard({
  item, onAdvance, onDelete, advancing, deleting, canDelete,
}: {
  item: Intervention
  onAdvance: (id: number, nextStatus: string) => void
  onDelete: (id: number) => void
  advancing: boolean
  deleting: boolean
  canDelete: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const next = NEXT_STATUS[item.status]

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/employees/${item.employee_id}`} className="font-mono font-bold text-sm text-text hover:text-accent hover:underline">
              {item.employee_id}
            </Link>
            <PriorityBadge priority={item.priority} />
            <span className={`badge ${STATUS_CLS[item.status] ?? "badge-gray"} text-[10px]`}>{item.status}</span>
            {item.source === "llm" && (
              <span className="badge badge-violet text-[10px]"><Sparkles className="w-2.5 h-2.5" />AI-generated</span>
            )}
          </div>
          <span className="text-[10px] text-muted font-mono whitespace-nowrap">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
        </div>

        <p className="text-xs text-text-2 leading-relaxed mb-2">{item.reasoning}</p>

        <div className="flex items-center gap-3 text-[10px] text-muted mb-2 flex-wrap">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.timeline}</span>
          {item.assigned_to && <span className="flex items-center gap-1"><User className="w-3 h-3" />Assigned to {item.assigned_to}</span>}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
          aria-expanded={expanded}
        >
          {item.actions.length} action{item.actions.length !== 1 ? "s" : ""}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>

        {expanded && (
          <ul className="mt-2 space-y-2" role="list">
            {item.actions.map((a, i) => (
              <li key={i} className="rounded-lg p-2.5 text-xs" style={{ background: "var(--surface2)" }}>
                <p className="font-semibold text-text">{a.title} <span className="text-muted font-normal">· {a.owner}</span></p>
                <p className="text-muted mt-0.5">{a.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-border" style={{ background: "var(--surface2)" }}>
        {canDelete && (
          <button onClick={() => onDelete(item.id)} disabled={deleting} className="btn-ghost btn-sm text-[11px]" aria-label="Delete recommendation">
            {deleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Delete
          </button>
        )}
        {next && (
          <button onClick={() => onAdvance(item.id, next)} disabled={advancing} className="btn-primary btn-sm text-[11px]">
            {advancing
              ? <><RefreshCw className="w-3 h-3 animate-spin" />Updating…</>
              : <>Mark {next}</>
            }
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ACTION CENTER
═══════════════════════════════════════════════════════════════ */
export default function ActionsPage() {
  const { alerts, acknowledge, loading: alertsLoading, refresh: refreshAlerts } = useAlerts()
  const { isAdmin } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState<"alerts" | "recommendations">("alerts")
  const [acking, setAcking] = useState<number | null>(null)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [batchGenerating, setBatchGenerating] = useState(false)

  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [interventionsLoading, setInterventionsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"all" | "Pending" | "In Progress" | "Completed">("all")
  const [advancingId, setAdvancingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadInterventions = useCallback(async () => {
    try {
      const res = await listInterventions({ limit: 100 })
      setInterventions(res.interventions ?? [])
    } catch (e: any) {
      toast.error("Failed to load recommendations", e.message)
    } finally {
      setInterventionsLoading(false)
    }
  }, [toast])

  useEffect(() => { loadInterventions() }, [loadInterventions])

  /* ── Acknowledge an alert ──────────────────────────────────── */
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

  /* ── Generate a recommendation for one employee ───────────── */
  const handleGenerateOne = async (employeeId: string) => {
    setGeneratingFor(employeeId)
    try {
      const rec = await generateEmployeeRecommendation(employeeId)
      toast.success(
        `Recommendation generated for ${employeeId}`,
        `${rec.priority.toUpperCase()} priority · ${rec.actions.length} action(s) · view in Recommendations tab`
      )
      await Promise.all([loadInterventions(), refreshAlerts()])
    } catch (e: any) {
      toast.error("Generation failed", e.message)
    } finally {
      setGeneratingFor(null)
    }
  }

  /* ── Generate recommendations for every RED/AMBER employee ── */
  const handleGenerateBatch = async () => {
    setBatchGenerating(true)
    try {
      const res = await generateBulkRecommendations()
      if (res.generated === 0 && res.failed.length === 0) {
        toast.info("Nothing to generate", "No employees are currently classified RED or AMBER")
      } else {
        toast.success(
          "Batch recommendations generated",
          `${res.generated} generated${res.alerts_created ? ` · ${res.alerts_created} new alerts` : ""}${res.failed.length ? ` · ${res.failed.length} failed` : ""}`
        )
      }
      await Promise.all([loadInterventions(), refreshAlerts()])
      setTab("recommendations")
    } catch (e: any) {
      toast.error("Batch generation failed", e.message)
    } finally {
      setBatchGenerating(false)
    }
  }

  /* ── Advance / delete an intervention ──────────────────────── */
  const handleAdvance = async (id: number, nextStatus: string) => {
    setAdvancingId(id)
    try {
      await updateIntervention(id, { status: nextStatus })
      setInterventions(prev => prev.map(i => i.id === id ? { ...i, status: nextStatus } : i))
      toast.success("Status updated", `Marked as ${nextStatus}`)
    } catch (e: any) {
      toast.error("Update failed", e.message)
    } finally {
      setAdvancingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteIntervention(id)
      setInterventions(prev => prev.filter(i => i.id !== id))
      toast.success("Recommendation deleted")
    } catch (e: any) {
      toast.error("Delete failed", e.message)
    } finally {
      setDeletingId(null)
    }
  }

  const filteredInterventions = interventions.filter(i => statusFilter === "all" || i.status === statusFilter)
  const pendingCount = interventions.filter(i => i.status === "Pending").length

  return (
    <AppShell>
      <div className="page-container animate-fade-up space-y-6">

        <div className="page-header">
          <div>
            <h1 className="page-title">Action Center</h1>
            <p className="page-subtitle">
              {alerts.length > 0
                ? `${alerts.length} unacknowledged alert${alerts.length !== 1 ? "s" : ""} · ${pendingCount} pending recommendation${pendingCount !== 1 ? "s" : ""}`
                : "All alerts resolved — workforce is in good standing"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {alerts.length > 0 && <span className="badge badge-red">{alerts.length} pending</span>}
            <button
              onClick={handleGenerateBatch}
              disabled={batchGenerating}
              className="btn-violet text-xs"
              aria-label="Generate recommendations for all at-risk employees"
            >
              {batchGenerating
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Generating…</>
                : <><Users className="w-3.5 h-3.5" />Generate for All At-Risk</>
              }
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-group w-fit" role="tablist" aria-label="Action center sections">
          <button className={`tab-item flex items-center gap-1.5 ${tab === "alerts" ? "active" : ""}`} onClick={() => setTab("alerts")} role="tab" aria-selected={tab === "alerts"}>
            <AlertTriangle className="w-3.5 h-3.5" /> Pending Alerts ({alerts.length})
          </button>
          <button className={`tab-item flex items-center gap-1.5 ${tab === "recommendations" ? "active" : ""}`} onClick={() => setTab("recommendations")} role="tab" aria-selected={tab === "recommendations"}>
            <ListChecks className="w-3.5 h-3.5" /> Recommendations ({interventions.length})
          </button>
        </div>

        {/* ── Pending Alerts tab ─────────────────────────────────── */}
        {tab === "alerts" && (
          alertsLoading ? (
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
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link
                      href={`/employees/${a.employee_id}`}
                      className="btn-ghost btn-sm flex items-center gap-1 text-[11px]"
                    >
                      View Profile <ChevronRight className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => handleGenerateOne(a.employee_id)}
                      disabled={generatingFor === a.employee_id}
                      className="btn-violet btn-sm text-[11px]"
                    >
                      {generatingFor === a.employee_id
                        ? <><RefreshCw className="w-3 h-3 animate-spin" />Generating…</>
                        : <><Sparkles className="w-3 h-3" />Generate Rec.</>
                      }
                    </button>
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
          )
        )}

        {/* ── Recommendations tab ───────────────────────────────── */}
        {tab === "recommendations" && (
          <div className="space-y-4">
            <div className="tab-group w-fit" role="group" aria-label="Filter recommendations by status">
              {(["all", "Pending", "In Progress", "Completed"] as const).map(s => (
                <button
                  key={s}
                  className={`tab-item ${statusFilter === s ? "active" : ""}`}
                  onClick={() => setStatusFilter(s)}
                  aria-pressed={statusFilter === s}
                >
                  {s === "all" ? "All" : s}
                </button>
              ))}
            </div>

            {interventionsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card animate-pulse-dot h-32 skeleton" />)}
              </div>
            ) : filteredInterventions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="w-10 h-10 text-muted opacity-40 mb-3" aria-hidden="true" />
                <p className="text-sm font-semibold text-text">No recommendations yet</p>
                <p className="text-xs text-muted mt-1 max-w-xs">
                  Generate one from a pending alert, an employee profile, or use "Generate for All At-Risk" above.
                </p>
              </div>
            ) : (
              <div className="space-y-3" role="list" aria-label="Generated recommendations">
                {filteredInterventions.map(item => (
                  <InterventionCard
                    key={item.id}
                    item={item}
                    onAdvance={handleAdvance}
                    onDelete={handleDelete}
                    advancing={advancingId === item.id}
                    deleting={deletingId === item.id}
                    canDelete={isAdmin}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </AppShell>
  )
}
