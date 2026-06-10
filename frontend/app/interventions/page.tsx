"use client"
import { useEffect, useState } from "react"
import AppShell from "@/components/AppShell"
import {
  listInterventions, createIntervention, updateInterventionStatus,
  addInterventionNote, recordFollowUp,
} from "@/lib/api"
import {
  ClipboardList, Plus, ChevronDown, ChevronUp, Check, Loader2,
  MessageSquare, TrendingDown, Clock, User, Calendar,
} from "lucide-react"
import RiskBadge from "@/components/RiskBadge"

interface Intervention {
  id:           number
  employee_id:  string
  created_by:   string
  assigned_to:  string
  status:       string
  priority:     string
  timeline:     string
  reasoning:    string
  actions:      string[]
  notes:        string | null
  due_date:     string | null
  created_at:   string
  updated_at:   string
  completed_at: string | null
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Pending:     { color: "#4a6580", label: "Pending"     },
  Approved:    { color: "#60a5fa", label: "Approved"    },
  "In Progress": { color: "#fbbf24", label: "In Progress" },
  Completed:   { color: "#4ade80", label: "Completed"   },
  Rejected:    { color: "#f87171", label: "Rejected"    },
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#f87171", HIGH: "#fbbf24", MEDIUM: "#60a5fa", LOW: "#4ade80",
}

const STATUSES = Object.keys(STATUS_CONFIG)

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading,       setLoading]       = useState(true)
  const [expanded,      setExpanded]      = useState<Record<number, boolean>>({})
  const [filterStatus,  setFilterStatus]  = useState<string>("All")
  const [showCreate,    setShowCreate]    = useState(false)
  const [error,         setError]         = useState("")

  async function fetchAll() {
    setLoading(true)
    try {
      const r = await listInterventions()
      setInterventions(r.interventions)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = interventions.filter(i =>
    filterStatus === "All" || i.status === filterStatus
  )

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = interventions.filter(i => i.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <AppShell>
      <div className="animate-fadeUp">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-mono text-2xl font-semibold text-text">Intervention Tracking</h1>
          <button onClick={() => setShowCreate(s => !s)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Intervention
          </button>
        </div>
        <p className="text-muted text-sm mb-8">
          Track manager actions, recommendation status, and measure intervention effectiveness
        </p>

        {/* Create form */}
        {showCreate && (
          <CreateInterventionForm
            onCreated={() => { setShowCreate(false); fetchAll() }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {error && (
          <div className="bg-red/10 border border-red/30 text-red font-mono text-sm px-4 py-3 rounded-lg mb-5">
            {error}
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button
            onClick={() => setFilterStatus("All")}
            className="font-mono text-xs px-3 py-1.5 rounded-full border transition-all"
            style={filterStatus === "All"
              ? { borderColor: "#60a5fa60", color: "#60a5fa", background: "#60a5fa10" }
              : { borderColor: "#1a2a40", color: "#4a6580" }
            }
          >
            All ({interventions.length})
          </button>
          {STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s]
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className="font-mono text-xs px-3 py-1.5 rounded-full border transition-all"
                style={filterStatus === s
                  ? { borderColor: cfg.color + "60", color: cfg.color, background: cfg.color + "10" }
                  : { borderColor: "#1a2a40", color: "#4a6580" }
                }
              >
                {s} ({counts[s] || 0})
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted font-mono text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-3">
            <ClipboardList className="w-10 h-10 opacity-20" />
            <p className="font-mono text-sm">No interventions {filterStatus !== "All" ? `with status "${filterStatus}"` : "yet"}</p>
            <p className="font-mono text-xs opacity-60">
              Create interventions from prediction results or use the button above.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(iv => (
            <InterventionCard
              key={iv.id}
              intervention={iv}
              open={expanded[iv.id] ?? false}
              onToggle={() => setExpanded(s => ({ ...s, [iv.id]: !s[iv.id] }))}
              onUpdate={fetchAll}
            />
          ))}
        </div>
      </div>
    </AppShell>
  )
}

// ── Intervention Card ─────────────────────────────────────────────────────────
function InterventionCard({ intervention: iv, open, onToggle, onUpdate }: {
  intervention: Intervention; open: boolean; onToggle: () => void; onUpdate: () => void
}) {
  const cfg = STATUS_CONFIG[iv.status] || STATUS_CONFIG.Pending
  const pc  = PRIORITY_COLOR[iv.priority] || "#60a5fa"

  const [note,       setNote]       = useState("")
  const [newStatus,  setNewStatus]  = useState(iv.status)
  const [statusNote, setStatusNote] = useState("")
  const [updating,   setUpdating]   = useState(false)
  const [noting,     setNoting]     = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [fuMsg,      setFuMsg]      = useState("")

  // Follow-up state
  const [riskBefore, setRiskBefore] = useState("")
  const [riskAfter,  setRiskAfter]  = useState("")

  async function handleUpdateStatus() {
    if (newStatus === iv.status) return
    setUpdating(true)
    try {
      await updateInterventionStatus(iv.id, newStatus, statusNote)
      onUpdate()
    } catch (e: any) {
      console.error(e)
    } finally {
      setUpdating(false); setStatusNote("")
    }
  }

  async function handleAddNote() {
    if (!note.trim()) return
    setNoting(true)
    try {
      await addInterventionNote(iv.id, note.trim())
      setNote("")
      onUpdate()
    } catch (e: any) {
      console.error(e)
    } finally {
      setNoting(false)
    }
  }

  async function handleFollowUp() {
    const rb = parseFloat(riskBefore)
    const ra = parseFloat(riskAfter)
    if (isNaN(rb) || isNaN(ra)) { setFuMsg("Enter valid numbers"); return }
    try {
      const r = await recordFollowUp(iv.id, {
        metrics_before: {}, metrics_after: {},
        risk_before: rb, risk_after: ra,
      })
      setFuMsg(`✓ ${r.effectiveness} effectiveness. Risk reduced by ${r.improvement_pct}%`)
      onUpdate()
    } catch (e: any) {
      setFuMsg(`✗ ${e.message}`)
    }
  }

  return (
    <div
      className="border rounded-xl overflow-hidden transition-all"
      style={{ borderColor: open ? cfg.color + "40" : "#1a2a40" }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 bg-surface hover:bg-surface/80 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div>
            <p className="font-mono text-sm font-bold text-text">{iv.employee_id}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <User className="w-3 h-3 text-muted" />
              <span className="font-mono text-[10px] text-muted">{iv.assigned_to}</span>
            </div>
          </div>
          <div className="ml-3">
            <span
              className="font-mono text-[10px] px-2 py-0.5 rounded border"
              style={{ color: pc, borderColor: pc + "40", background: pc + "10" }}
            >
              {iv.priority}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <span
            className="font-mono text-xs px-3 py-1 rounded-full border"
            style={{ color: cfg.color, borderColor: cfg.color + "40", background: cfg.color + "10" }}
          >
            {iv.status}
          </span>
          {iv.due_date && (
            <div className="flex items-center gap-1 text-muted">
              <Calendar className="w-3 h-3" />
              <span className="font-mono text-[10px]">Due {iv.due_date}</span>
            </div>
          )}
          <span className="font-mono text-[10px] text-muted">{iv.created_at?.slice(0,10)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted shrink-0" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Left: Details */}
          <div className="p-5 border-r border-border space-y-4">
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">Reasoning</p>
              <p className="text-sm text-text/80 leading-relaxed">{iv.reasoning}</p>
            </div>

            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">Recommended Actions</p>
              <ol className="space-y-1.5">
                {(iv.actions || []).map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text/80">
                    <span className="font-mono text-[10px] text-muted mt-0.5 w-5 shrink-0">{String(i+1).padStart(2,"0")}</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </div>

            {iv.notes && (
              <div className="bg-[#070d1a] border border-border rounded-lg px-4 py-3">
                <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-text/80">{iv.notes}</p>
              </div>
            )}

            {/* Add note */}
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">Add Note</p>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm py-2"
                  placeholder="Manager note…"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
                <button onClick={handleAddNote} disabled={noting || !note.trim()} className="btn-primary py-2 px-3">
                  {noting ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Right: Status + Follow-up */}
          <div className="p-5 bg-[#090f1c] space-y-4">
            {/* Status update */}
            <div>
              <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">Update Status</p>
              <div className="space-y-2">
                <select
                  className="input w-full"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input
                  className="input w-full text-sm"
                  placeholder="Optional note for this status change…"
                  value={statusNote}
                  onChange={e => setStatusNote(e.target.value)}
                />
                <button
                  onClick={handleUpdateStatus}
                  disabled={updating || newStatus === iv.status}
                  className="btn-primary w-full justify-center"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {updating ? "Updating…" : "Update Status"}
                </button>
              </div>
            </div>

            {/* Follow-up: Before/After */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] text-muted uppercase tracking-wider">Before / After Comparison</p>
                <button
                  onClick={() => setShowFollowUp(s => !s)}
                  className="font-mono text-[10px] text-blue-400 hover:text-blue-300"
                >
                  {showFollowUp ? "Hide" : "Record follow-up"}
                </button>
              </div>

              {showFollowUp && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-mono text-[10px] text-muted mb-1 block">Risk Score Before</label>
                      <input
                        className="input w-full text-sm"
                        type="number" min={0} max={100}
                        placeholder="e.g. 75"
                        value={riskBefore}
                        onChange={e => setRiskBefore(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] text-muted mb-1 block">Risk Score After</label>
                      <input
                        className="input w-full text-sm"
                        type="number" min={0} max={100}
                        placeholder="e.g. 42"
                        value={riskAfter}
                        onChange={e => setRiskAfter(e.target.value)}
                      />
                    </div>
                  </div>
                  <button onClick={handleFollowUp} className="btn-primary w-full justify-center text-sm">
                    <TrendingDown className="w-4 h-4" />
                    Calculate Effectiveness
                  </button>
                  {fuMsg && (
                    <p className={`font-mono text-xs ${fuMsg.startsWith("✓") ? "text-green" : "text-red"}`}>
                      {fuMsg}
                    </p>
                  )}

                  {/* Visual comparison */}
                  {riskBefore && riskAfter && !isNaN(parseFloat(riskBefore)) && !isNaN(parseFloat(riskAfter)) && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <ScoreBar label="Before" value={parseFloat(riskBefore)} />
                      <ScoreBar label="After"  value={parseFloat(riskAfter)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 65 ? "#f87171" : value >= 35 ? "#fbbf24" : "#4ade80"
  return (
    <div>
      <p className="font-mono text-[10px] text-muted mb-1">{label}: {value.toFixed(0)}</p>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

// ── Create Form ───────────────────────────────────────────────────────────────
function CreateInterventionForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    employee_id: "", assigned_to: "", priority: "HIGH",
    timeline: "2 weeks", reasoning: "",
    actions: ["", "", ""], due_date: "",
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")

  async function handleSave() {
    const actions = form.actions.filter(a => a.trim())
    if (!form.employee_id || !form.assigned_to || !form.reasoning || !actions.length) {
      setError("Fill in Employee ID, Assigned To, Reasoning, and at least one Action."); return
    }
    setSaving(true); setError("")
    try {
      await createIntervention({ ...form, actions })
      onCreated()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card mb-6 border-blue-500/20">
      <p className="section-label">Create New Intervention</p>
      {error && <p className="font-mono text-xs text-red mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Employee ID *</label>
          <input className="input w-full" placeholder="EMP001" value={form.employee_id}
            onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} />
        </div>
        <div>
          <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Assign To (manager username) *</label>
          <input className="input w-full" placeholder="manager" value={form.assigned_to}
            onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
        </div>
        <div>
          <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Priority</label>
          <select className="input w-full" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
            {["CRITICAL","HIGH","MEDIUM","LOW"].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Timeline</label>
          <input className="input w-full" placeholder="2 weeks" value={form.timeline}
            onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Due Date</label>
          <input className="input w-full" type="date" value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Reasoning *</label>
          <textarea className="input w-full h-20 resize-none" placeholder="Why is this intervention needed?"
            value={form.reasoning} onChange={e => setForm(f => ({ ...f, reasoning: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Actions (at least 1) *</label>
          {form.actions.map((a, i) => (
            <input key={i} className="input w-full mb-2" placeholder={`Action ${i+1}`} value={a}
              onChange={e => setForm(f => ({ ...f, actions: f.actions.map((x, j) => j===i ? e.target.value : x) }))} />
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saving ? "Saving…" : "Create Intervention"}
        </button>
        <button onClick={onCancel} className="btn-primary opacity-60">Cancel</button>
      </div>
    </div>
  )
}
