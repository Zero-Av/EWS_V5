"use client"
import { useState } from "react"
import AppShell from "@/components/AppShell"
import { getEmployeeHistory, getEmployeeIssues, getTrends, updateEmployee } from "@/lib/api"
import { Search, TrendingUp, AlertCircle, Loader2, ChevronDown, Edit3, Save, CheckCircle, X } from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import RiskBadge from "@/components/RiskBadge"
import clsx from "clsx"

const C = {
  blue: "#60a5fa", green: "#4ade80", amber: "#fbbf24",
  red: "#f87171", purple: "#a78bfa", muted: "#4a6580",
}

const ISSUE_SEVERITY: Record<number, { color: string; label: string }> = {
  3: { color: C.amber,  label: "Watch" },
  5: { color: C.red,    label: "Chronic" },
  8: { color: "#ef4444", label: "Critical" },
}

function issueSeverity(months: number) {
  if (months >= 8) return ISSUE_SEVERITY[8]
  if (months >= 5) return ISSUE_SEVERITY[5]
  return ISSUE_SEVERITY[3]
}

const METRIC_FIELDS = [
  { key: "stress_level",       label: "Stress Level",          high_bad: true  },
  { key: "workload_level",     label: "Workload Level",        high_bad: true  },
  { key: "absenteeism",        label: "Absenteeism",           high_bad: true  },
  { key: "work_life_balance",  label: "Work-Life Balance",     high_bad: false },
  { key: "manager_support",    label: "Manager Support",       high_bad: false },
  { key: "job_satisfaction",   label: "Job Satisfaction",      high_bad: false },
  { key: "happiness_score",    label: "Happiness Score",       high_bad: false },
  { key: "productivity",       label: "Productivity",          high_bad: false },
  { key: "team_collaboration", label: "Team Collaboration",    high_bad: false },
  { key: "career_growth",      label: "Career Growth",         high_bad: false },
]

export default function TrendsPage() {
  const [employeeId,  setEmployeeId]  = useState("")
  const [history,     setHistory]     = useState<any[]>([])
  const [issues,      setIssues]      = useState<any[]>([])
  const [searching,   setSearching]   = useState(false)
  const [months,      setMonths]      = useState(12)
  const [threshold,   setThreshold]   = useState(3)
  const [error,       setError]       = useState("")

  // Employee metric editor
  const [editing,     setEditing]     = useState(false)
  const [editValues,  setEditValues]  = useState<Record<string, string>>({})
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState("")

  async function handleSearch() {
    if (!employeeId.trim()) return
    setError(""); setSearching(true)
    setHistory([]); setIssues([])
    setEditing(false); setSaveMsg("")
    try {
      const [hist, iss] = await Promise.all([
        getEmployeeHistory(employeeId.trim(), months),
        getEmployeeIssues(employeeId.trim(), threshold),
      ])
      setHistory(hist.snapshots)
      setIssues(iss.persistent_issues)

      // Pre-fill edit values from latest snapshot
      if (hist.snapshots.length > 0) {
        const latest = hist.snapshots[hist.snapshots.length - 1]
        const vals: Record<string, string> = {}
        METRIC_FIELDS.forEach(f => {
          if (latest[f.key] != null) vals[f.key] = String(latest[f.key])
        })
        setEditValues(vals)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSearching(false)
    }
  }

  async function handleSaveUpdates() {
    if (!employeeId.trim()) return
    setSaving(true); setSaveMsg("")
    try {
      const updates: Record<string, number> = {}
      METRIC_FIELDS.forEach(f => {
        const v = editValues[f.key]
        if (v !== "" && v !== undefined) {
          const n = parseFloat(v)
          if (!isNaN(n)) updates[f.key] = n
        }
      })
      const r = await updateEmployee(employeeId.trim(), updates)
      setSaveMsg(`✓ Saved. ${r.alerts_fired > 0 ? `${r.alerts_fired} alert(s) fired.` : ""}`)
      setEditing(false)
      // Refresh history to show the new snapshot
      const hist = await getEmployeeHistory(employeeId.trim(), months)
      setHistory(hist.snapshots)
    } catch (e: any) {
      setSaveMsg(`✗ ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <div className="animate-fadeUp">
        <h1 className="font-mono text-2xl font-semibold text-text mb-1">Trend Analysis</h1>
        <p className="text-muted text-sm mb-8">
          Individual employee history, persistent issue detection & metric trajectories
        </p>

        {/* Search controls */}
        <div className="card mb-6">
          <p className="section-label">Employee Lookup</p>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-48">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Employee ID</label>
              <div className="relative">
                <input
                  className="input w-full pl-9"
                  placeholder="e.g. EMP001"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">History (months)</label>
              <select className="input" value={months} onChange={e => setMonths(Number(e.target.value))}>
                {[3,6,12,24].map(m => <option key={m} value={m}>{m} months</option>)}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 block">Issue threshold</label>
              <select className="input" value={threshold} onChange={e => setThreshold(Number(e.target.value))}>
                <option value={2}>2+ months</option>
                <option value={3}>3+ months</option>
                <option value={4}>4+ months</option>
                <option value={6}>6+ months</option>
              </select>
            </div>
            <button onClick={handleSearch} disabled={!employeeId.trim() || searching} className="btn-primary">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching ? "Loading…" : "Analyze"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red/10 border border-red/30 text-red font-mono text-sm px-4 py-3 rounded-lg mb-5">
            {error}
          </div>
        )}

        {/* Persistent issues */}
        {issues.length > 0 && (
          <div className="card mb-6 border-amber/20">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-amber" />
              <p className="section-label mb-0">Longest-Standing Issues — {employeeId}</p>
            </div>
            <div className="space-y-2">
              {issues.map((issue, i) => {
                const sev = issueSeverity(issue.months_count)
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-surface/50">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ background: sev.color }} />
                      <div>
                        <p className="font-mono text-sm text-text">{issue.issue}</p>
                        <p className="font-mono text-[10px] text-muted">
                          First seen: {issue.first_seen} → Last seen: {issue.last_seen}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="font-mono text-xs px-2 py-0.5 rounded border"
                        style={{ color: sev.color, borderColor: sev.color + "40", background: sev.color + "10" }}
                      >
                        {sev.label}
                      </span>
                      <span className="font-mono text-sm font-bold" style={{ color: sev.color }}>
                        {issue.months_count} months
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {issues.length === 0 && history.length > 0 && (
          <div className="card mb-6 border-green/20 bg-green/5 flex items-center gap-3 py-4">
            <div className="w-6 h-6 rounded-full bg-green/20 border border-green/30 flex items-center justify-center">
              <span className="text-green text-xs">✓</span>
            </div>
            <p className="font-mono text-sm text-green">
              No persistent issues detected for {employeeId} (threshold: {threshold}+ months)
            </p>
          </div>
        )}

        {/* ── Metric Editor ─────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="card mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Update Employee Metrics</p>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 font-mono text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditing(false); setSaveMsg("") }}
                    className="font-mono text-xs text-muted hover:text-text transition-colors flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button
                    onClick={handleSaveUpdates}
                    disabled={saving}
                    className="flex items-center gap-1.5 font-mono text-xs bg-accent text-bg px-3 py-1 rounded hover:bg-accent/80 transition-colors"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {saving ? "Saving…" : "Save & Update Trends"}
                  </button>
                </div>
              )}
            </div>

            {saveMsg && (
              <div className={clsx(
                "flex items-center gap-2 mb-3 px-3 py-2 rounded text-xs font-mono",
                saveMsg.startsWith("✓") ? "bg-green/10 text-green" : "bg-red/10 text-red"
              )}>
                {saveMsg.startsWith("✓") ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {saveMsg}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {METRIC_FIELDS.map(f => {
                const latest = history[history.length - 1]
                const curVal = latest?.[f.key]
                const editVal = editValues[f.key] ?? ""
                const changed = editing && editVal !== "" && parseFloat(editVal) !== curVal

                return (
                  <div key={f.key} className={clsx(
                    "rounded-lg px-3 py-2.5 border transition-colors",
                    changed ? "border-accent/50 bg-accent/5" : "border-border bg-surface"
                  )}>
                    <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1 truncate">{f.label}</p>
                    {editing ? (
                      <input
                        type="number"
                        min={0} max={10} step={0.1}
                        value={editVal}
                        onChange={e => setEditValues(v => ({ ...v, [f.key]: e.target.value }))}
                        className="w-full bg-transparent font-mono text-lg font-bold text-text border-b border-accent/40 focus:border-accent outline-none pb-0.5"
                      />
                    ) : (
                      <p className={clsx(
                        "font-mono text-lg font-bold",
                        curVal == null ? "text-muted" :
                        f.high_bad
                          ? (curVal >= 7 ? "text-red" : curVal >= 5 ? "text-amber" : "text-green")
                          : (curVal <= 4 ? "text-red" : curVal <= 6 ? "text-amber" : "text-green")
                      )}>
                        {curVal != null ? curVal.toFixed(1) : "—"}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {!editing && (
              <p className="text-muted text-xs mt-3">
                Editing saves a new snapshot — changes will immediately reflect in the trend charts below.
              </p>
            )}
          </div>
        )}

        {/* Risk score trend */}
        {history.length > 0 && (
          <>
            <div className="card mb-5">
              <p className="section-label">Risk Score Timeline — {employeeId}</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                    <XAxis dataKey="snapshot_date" tick={{ fill: C.muted, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: C.muted, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0d1625", border: "1px solid #1a2a40", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 11 }}
                      formatter={(v: any) => [v, "Risk Score"]}
                    />
                    {/* Risk zone bands via reference areas would be ideal, using lines as proxy */}
                    <Line type="monotone" dataKey="risk_score" stroke={C.red} strokeWidth={2}
                      dot={(p: any) => <RiskDot {...p} />} activeDot={{ r: 6, fill: C.red }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Zone labels */}
              <div className="flex items-center gap-6 mt-2">
                {[["GREEN", "#4ade80", "0–35"], ["AMBER", "#fbbf24", "35–65"], ["RED", "#f87171", "65–100"]].map(([z, c, r]) => (
                  <div key={z} className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5" style={{ background: c as string }} />
                    <span className="font-mono text-[10px]" style={{ color: c as string }}>{z} ({r})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics chart */}
            <div className="card mb-5">
              <p className="section-label">Metric Trajectories</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ left: -10, right: 20, top: 10, bottom: 0 }}>
                    <XAxis dataKey="snapshot_date" tick={{ fill: C.muted, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fill: C.muted, fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#0d1625", border: "1px solid #1a2a40", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 11 }}
                    />
                    <Legend iconType="circle" iconSize={7}
                      formatter={(v: any) => <span className="font-mono text-[10px] text-muted">{v.replace(/_/g," ")}</span>}
                    />
                    <Line type="monotone" dataKey="stress_level"      stroke={C.red}    strokeWidth={1.5} dot={false} name="Stress" />
                    <Line type="monotone" dataKey="job_satisfaction"   stroke={C.green}  strokeWidth={1.5} dot={false} name="Satisfaction" />
                    <Line type="monotone" dataKey="work_life_balance"  stroke={C.blue}   strokeWidth={1.5} dot={false} name="Work-Life Balance" />
                    <Line type="monotone" dataKey="manager_support"    stroke={C.amber}  strokeWidth={1.5} dot={false} name="Manager Support" />
                    <Line type="monotone" dataKey="career_growth"      stroke={C.purple} strokeWidth={1.5} dot={false} name="Career Growth" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Snapshot table */}
            <div className="card">
              <p className="section-label">Snapshot History</p>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="text-muted border-b border-border">
                      {["Date","Risk Score","Zone","Attrition %","Stress","Satisfaction","WLB","Manager Sup."].map(h => (
                        <th key={h} className="text-left py-2 pr-4 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((snap: any, i: number) => (
                      <tr key={i} className="border-b border-border/30 text-text/70 hover:bg-white/2">
                        <td className="py-1.5 pr-4">{snap.snapshot_date}</td>
                        <td className="py-1.5 pr-4">
                          <span style={{ color: zoneColor(snap.risk_zone) }}>{snap.risk_score}</span>
                        </td>
                        <td className="py-1.5 pr-4">
                          <RiskBadge label={snap.risk_zone} />
                        </td>
                        <td className="py-1.5 pr-4">{snap.attrition_prob != null ? `${(snap.attrition_prob * 100).toFixed(1)}%` : "—"}</td>
                        <td className="py-1.5 pr-4">{snap.stress_level ?? "—"}</td>
                        <td className="py-1.5 pr-4">{snap.job_satisfaction ?? "—"}</td>
                        <td className="py-1.5 pr-4">{snap.work_life_balance ?? "—"}</td>
                        <td className="py-1.5 pr-4">{snap.manager_support ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!searching && history.length === 0 && !error && employeeId && (
          <div className="flex flex-col items-center justify-center py-16 text-muted gap-3">
            <TrendingUp className="w-10 h-10 opacity-20" />
            <p className="font-mono text-sm">No snapshot history found for <strong className="text-text">{employeeId}</strong></p>
            <p className="font-mono text-xs opacity-60">Save snapshots from the Analytics page to start tracking.</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function RiskDot(props: any) {
  const { cx, cy, payload } = props
  const c = zoneColor(payload?.risk_zone)
  return <circle cx={cx} cy={cy} r={4} fill={c} stroke={c} strokeWidth={1} />
}

function zoneColor(zone: string) {
  if (zone === "RED")   return "#f87171"
  if (zone === "AMBER") return "#fbbf24"
  return "#4ade80"
}
