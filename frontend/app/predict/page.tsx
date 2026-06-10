"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import AppShell from "@/components/AppShell"
import FileDropzone from "@/components/FileDropzone"
import RiskBadge from "@/components/RiskBadge"
import {
  predict, recommend, getRecommendProgress, connectLLM,
  createIntervention, saveSnapshot,
  type PredictionResult, type TopFactor,
} from "@/lib/api"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import {
  Cpu, Bot, ChevronDown, ChevronUp, Zap, AlertTriangle, CheckCircle,
  Loader2, TrendingUp, Save, ClipboardList, Info, Clock,
} from "lucide-react"
import clsx from "clsx"

const ZONE_COLOR = { GREEN: "#4ade80", AMBER: "#fbbf24", RED: "#f87171" }
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#f87171", HIGH: "#fbbf24", MEDIUM: "#60a5fa", LOW: "#4ade80",
}

// Poll interval for progress (ms)
const POLL_INTERVAL = 1500

export default function PredictPage() {
  const [file,        setFile]        = useState<File | null>(null)
  const [topK,        setTopK]        = useState(5)
  const [results,     setResults]     = useState<PredictionResult[]>([])
  const [loading,     setLoading]     = useState(false)
  const [llmStatus,   setLlmStatus]   = useState<"unknown"|"connected"|"offline">("unknown")
  const [provider,    setProvider]    = useState("auto")
  const [error,       setError]       = useState("")
  const [filter,      setFilter]      = useState<string[]>(["GREEN","AMBER","RED"])
  const [search,      setSearch]      = useState("")
  const [expanded,    setExpanded]    = useState<Record<string,boolean>>({})
  const [snapMsg,     setSnapMsg]     = useState("")
  const [savingSnap,  setSavingSnap]  = useState(false)

  // ── LLM progress state ─────────────────────────────────────────────────────
  const [recJobId,     setRecJobId]     = useState<string | null>(null)
  const [recDone,      setRecDone]      = useState(0)
  const [recTotal,     setRecTotal]     = useState(0)
  const [recCurrent,   setRecCurrent]   = useState<string | null>(null)
  const [recComplete,  setRecComplete]  = useState(false)
  const [recError,     setRecError]     = useState<string | null>(null)
  const [elapsed,      setElapsed]      = useState(0)
  const pollRef   = useRef<NodeJS.Timeout | null>(null)
  const timerRef  = useRef<NodeJS.Timeout | null>(null)

  // Elapsed timer
  useEffect(() => {
    if (recJobId && !recComplete) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [recJobId, recComplete])

  // Polling loop
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  const startPolling = useCallback((jobId: string) => {
    stopPolling()
    pollRef.current = setInterval(async () => {
      try {
        const prog = await getRecommendProgress(jobId)
        setRecDone(prog.done)
        setRecTotal(prog.total)
        setRecCurrent(prog.current_employee)

        if (prog.complete) {
          stopPolling()
          setRecComplete(true)
          if (prog.error) {
            setRecError(prog.error)
          } else if (prog.results) {
            setResults(prog.results)
          }
          setRecJobId(null)
        }
      } catch (e) {
        stopPolling()
        setRecError("Lost connection to server while waiting for recommendations.")
        setRecJobId(null)
      }
    }, POLL_INTERVAL)
  }, [stopPolling])

  useEffect(() => () => stopPolling(), [stopPolling])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleConnect() {
    try {
      const r = await connectLLM(provider)
      setLlmStatus(r.status === "connected" ? "connected" : "offline")
    } catch (e: any) {
      setLlmStatus("offline"); setError(e.message)
    }
  }

  const [alertsFired,  setAlertsFired]  = useState(0)
  const [activeModelType, setActiveModelType] = useState("")

  async function handlePredict() {
    if (!file) return
    setError(""); setLoading(true); setResults([])
    setRecJobId(null); setRecDone(0); setRecTotal(0)
    setRecComplete(false); setRecError(null)
    setAlertsFired(0)
    try {
      const r = await predict(file, topK)
      setResults(r.results)
      setAlertsFired((r as any).alerts_fired || 0)
      setActiveModelType((r as any).model_type || "")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRecommend() {
    if (!file) return
    setError(""); setRecComplete(false); setRecError(null)
    setRecDone(0); setRecCurrent(null)
    try {
      const r = await recommend(file, topK)
      // Job started — begin polling
      setRecJobId(r.job_id)
      setRecTotal(r.total_at_risk)
      setRecDone(0)
      startPolling(r.job_id)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleSaveSnapshot() {
    if (!file) return
    setSavingSnap(true); setSnapMsg("")
    try {
      const r = await saveSnapshot(file)
      setSnapMsg(`✓ Snapshot saved. ${r.alerts_fired} alert(s) triggered.`)
    } catch (e: any) {
      setSnapMsg(`✗ ${e.message}`)
    } finally {
      setSavingSnap(false)
    }
  }

  const isRecRunning = recJobId !== null && !recComplete
  const pct = recTotal > 0 ? Math.round((recDone / recTotal) * 100) : 0

  const filtered = results.filter(
    r => filter.includes(r.prediction) &&
         (!search || r.employee_id.toLowerCase().includes(search.toLowerCase()))
  )
  const counts = {
    GREEN: results.filter(r => r.prediction === "GREEN").length,
    AMBER: results.filter(r => r.prediction === "AMBER").length,
    RED:   results.filter(r => r.prediction === "RED").length,
  }

  return (
    <AppShell>
      <div className="animate-fadeUp">
        <h1 className="font-mono text-2xl font-semibold text-text mb-1">Predict &amp; Recommend</h1>
        <p className="text-muted text-sm mb-8">
          Upload employee data to predict attrition risk, explain contributing factors, and generate AI interventions
        </p>

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <div className="card lg:col-span-2">
            <p className="section-label">Employee Dataset</p>
            <FileDropzone
              onFile={f => { setFile(f || null); setResults([]); setSnapMsg(""); setRecComplete(false) }}
              current={file}
            />
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="font-mono text-xs text-muted uppercase tracking-wider">Similar (k)</label>
                <input
                  type="number" min={1} max={10} value={topK}
                  onChange={e => setTopK(Number(e.target.value))}
                  className="input w-16 text-center py-1.5"
                />
              </div>
              <button onClick={handlePredict} disabled={!file || loading} className="btn-primary">
                <Cpu className="w-4 h-4" />
                {loading ? "Running…" : "Run Prediction"}
              </button>
              {results.length > 0 && (
                <>
                  <button
                    onClick={handleRecommend}
                    disabled={!file || isRecRunning}
                    className="btn-primary"
                    style={{ borderColor: "rgba(96,165,250,.4)", color: "#60a5fa" }}
                  >
                    {isRecRunning
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Bot className="w-4 h-4" />
                    }
                    {isRecRunning
                      ? `Processing… ${recDone}/${recTotal}`
                      : `AI Recommendations (${counts.RED + counts.AMBER} at-risk)`
                    }
                  </button>
                  <button
                    onClick={handleSaveSnapshot}
                    disabled={!file || savingSnap}
                    className="btn-primary"
                    style={{ borderColor: "rgba(74,222,128,.3)", color: "#4ade80" }}
                  >
                    {savingSnap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingSnap ? "Saving…" : "Save to History"}
                  </button>
                </>
              )}
            </div>
            {snapMsg && (
              <p className={`font-mono text-xs mt-2 ${snapMsg.startsWith("✓") ? "text-green" : "text-red"}`}>
                {snapMsg}
              </p>
            )}
          </div>

          {/* LLM panel */}
          <div className="card">
            <p className="section-label">LLM Provider</p>
            <select value={provider} onChange={e => setProvider(e.target.value)} className="input mb-3">
              <option value="auto">Auto (Ollama → Anthropic)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="ollama">Ollama (local)</option>
            </select>
            <button onClick={handleConnect} className="btn-primary w-full justify-center mb-3">
              <Zap className="w-4 h-4" />Connect LLM
            </button>
            <div className={clsx(
              "flex items-center gap-2 font-mono text-xs px-3 py-2 rounded-lg border",
              llmStatus === "connected" ? "bg-green/10 border-green/30 text-green"
                : llmStatus === "offline" ? "bg-red/10 border-red/30 text-red"
                : "bg-surface border-border text-muted"
            )}>
              {llmStatus === "connected"
                ? <><CheckCircle className="w-3 h-3"/>LLM Active</>
                : llmStatus === "offline"
                ? <><AlertTriangle className="w-3 h-3"/>Offline – using fallback</>
                : <><span className="w-2 h-2 rounded-full bg-muted animate-pulse2 inline-block"/>Not connected</>
              }
            </div>
            <div className="mt-3 pt-3 border-t border-border space-y-1">
              <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">How it works</p>
              <p className="font-mono text-[10px] text-muted leading-relaxed">
                Ollama runs <strong className="text-text">one employee at a time</strong> (sequential). 
                Each call waits up to 5 min. Progress shows below in real time.
              </p>
              <p className="font-mono text-[10px] text-muted leading-relaxed mt-1">
                Anthropic API runs in parallel for faster batch processing.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red/10 border border-red/30 text-red font-mono text-sm px-4 py-3 rounded-lg mb-5">
            {error}
          </div>
        )}

        {/* ── LLM Progress Panel ───────────────────────────────────────────── */}
        {(isRecRunning || recComplete) && (
          <div className={clsx(
            "card mb-6 border",
            recError ? "border-red/30 bg-red/5"
              : recComplete ? "border-green/30 bg-green/5"
              : "border-blue-500/30 bg-blue-500/5"
          )}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isRecRunning
                  ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  : recError
                  ? <AlertTriangle className="w-4 h-4 text-red" />
                  : <CheckCircle className="w-4 h-4 text-green" />
                }
                <p className="font-mono text-sm font-semibold text-text">
                  {isRecRunning
                    ? "Generating AI Recommendations…"
                    : recError ? "Error during generation"
                    : "All recommendations complete"
                  }
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isRecRunning && (
                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock className="w-3 h-3" />
                    <span className="font-mono text-xs">{elapsed}s elapsed</span>
                  </div>
                )}
                <span className="font-mono text-xs text-muted">
                  {recDone}/{recTotal} employees
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-border rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${recTotal > 0 ? pct : 0}%`,
                  background: recError ? "#f87171" : recComplete ? "#4ade80" : "#60a5fa",
                }}
              />
            </div>

            {/* Current employee */}
            {recCurrent && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted uppercase tracking-wider">Current:</span>
                <span className="font-mono text-xs text-blue-400">{recCurrent}</span>
                {isRecRunning && (
                  <span className="font-mono text-[10px] text-muted ml-2">
                    (Ollama processes 1 at a time — please wait)
                  </span>
                )}
              </div>
            )}

            {/* Employee queue preview */}
            {recTotal > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {results
                  .filter(r => r.prediction !== "GREEN")
                  .map((r, i) => {
                    const done = i < recDone
                    const current = recCurrent?.startsWith(r.employee_id)
                    return (
                      <span
                        key={r.employee_id}
                        className="font-mono text-[10px] px-2 py-0.5 rounded border transition-all"
                        style={{
                          borderColor: done ? "#4ade8040" : current ? "#60a5fa60" : "#1a2a40",
                          color:       done ? "#4ade80"   : current ? "#60a5fa"   : "#4a6580",
                          background:  done ? "#4ade8010" : current ? "#60a5fa10" : "transparent",
                        }}
                      >
                        {done ? "✓ " : current ? "⟳ " : ""}{r.employee_id}
                      </span>
                    )
                  })
                }
              </div>
            )}

            {recError && (
              <p className="font-mono text-xs text-red mt-2">{recError}</p>
            )}
          </div>
        )}

        {/* ── Summary ──────────────────────────────────────────────────────── */}
        {results.length > 0 && (
          <>
            {/* Alerts fired notification */}
            {alertsFired > 0 && (
              <div className="flex items-center gap-3 mb-4 bg-amber/10 border border-amber/30 rounded-lg px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-mono text-sm font-semibold text-amber">
                    {alertsFired} alert{alertsFired !== 1 ? "s" : ""} fired
                  </p>
                  <p className="text-muted text-xs">
                    RED and AMBER employees have been logged in the{" "}
                    <a href="/alerts" className="text-accent underline">Alerts page</a>.
                  </p>
                </div>
              </div>
            )}

            {/* Model type badge */}
            {activeModelType && (
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-3.5 h-3.5 text-muted" />
                <span className="font-mono text-xs text-muted">Model:</span>
                <span className="font-mono text-xs text-accent bg-accent/10 px-2 py-0.5 rounded capitalize">
                  {activeModelType.replace(/_/g, " ")}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="stat-card">
                <span className="stat-lbl">Total</span>
                <span className="stat-val">{results.length}</span>
              </div>
              {(["GREEN","AMBER","RED"] as const).map(z => (
                <div key={z} className="stat-card">
                  <span className="stat-lbl">{z}</span>
                  <span className="stat-val" style={{ color: ZONE_COLOR[z] }}>{counts[z]}</span>
                </div>
              ))}
            </div>

            {/* Attrition avg + top factors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="card">
                <p className="section-label">Average Attrition Probability by Zone</p>
                <div className="space-y-3 mt-2">
                  {(["RED","AMBER","GREEN"] as const).map(z => {
                    const zr = results.filter(r => r.prediction === z)
                    if (!zr.length) return null
                    const avg = zr.reduce((s, r) => s + (r.attrition_prob || 0), 0) / zr.length
                    return (
                      <div key={z}>
                        <div className="flex justify-between mb-1">
                          <span className="font-mono text-xs" style={{ color: ZONE_COLOR[z] }}>{z}</span>
                          <span className="font-mono text-xs text-text">{avg.toFixed(1)}% avg attrition prob</span>
                        </div>
                        <div className="h-2 bg-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${avg}%`, background: ZONE_COLOR[z] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="card">
                <p className="section-label">Top Contributing Attrition Factors</p>
                <TopFactorsSummary results={results} />
              </div>
            </div>

            {/* Filter + search */}
            <div className="flex items-center gap-4 mb-5 flex-wrap">
              <div className="flex gap-2">
                {(["GREEN","AMBER","RED"] as const).map(z => (
                  <button
                    key={z}
                    onClick={() => setFilter(f => f.includes(z) ? f.filter(x=>x!==z) : [...f, z])}
                    className="font-mono text-xs px-3 py-1.5 rounded-full border transition-all"
                    style={filter.includes(z)
                      ? { borderColor: ZONE_COLOR[z]+"80", color: ZONE_COLOR[z] }
                      : { borderColor: "#1a2a40", color: "#4a6580" }
                    }
                  >
                    ● {z}
                  </button>
                ))}
              </div>
              <input
                className="input w-52 py-1.5"
                placeholder="Search by ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {filtered.map(emp => (
                <EmployeeCard
                  key={emp.employee_id}
                  emp={emp}
                  open={expanded[emp.employee_id] ?? emp.prediction === "RED"}
                  onToggle={() =>
                    setExpanded(s => ({ ...s, [emp.employee_id]: !(s[emp.employee_id] ?? emp.prediction === "RED") }))
                  }
                  recRunning={isRecRunning}
                />
              ))}
              {filtered.length === 0 && (
                <p className="font-mono text-muted text-sm text-center py-12">
                  No employees match the current filter.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

// ── Top factors summary ───────────────────────────────────────────────────────
function TopFactorsSummary({ results }: { results: PredictionResult[] }) {
  const agg: Record<string, { label: string; total: number; count: number }> = {}
  for (const emp of results.filter(r => r.prediction !== "GREEN")) {
    for (const f of (emp.top_factors || [])) {
      if (!agg[f.factor]) agg[f.factor] = { label: f.label, total: 0, count: 0 }
      agg[f.factor].total += f.contribution_pct
      agg[f.factor].count++
    }
  }
  const sorted = Object.entries(agg)
    .map(([k, v]) => ({ factor: k, label: v.label, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  if (!sorted.length) return (
    <p className="font-mono text-xs text-muted py-4">No factor data yet — run predictions first.</p>
  )

  const max = sorted[0]?.avg || 1
  return (
    <div className="space-y-2 mt-1">
      {sorted.map(f => (
        <div key={f.factor}>
          <div className="flex justify-between mb-1">
            <span className="font-mono text-xs text-text/80">{f.label}</span>
            <span className="font-mono text-xs text-amber">{f.avg.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-amber/70" style={{ width: `${(f.avg / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Employee Card ─────────────────────────────────────────────────────────────
function EmployeeCard({ emp, open, onToggle, recRunning }: {
  emp: PredictionResult; open: boolean; onToggle: () => void; recRunning: boolean
}) {
  const zc  = ZONE_COLOR[emp.prediction as keyof typeof ZONE_COLOR]
  const rec = emp.recommendation
  const [savingInt, setSavingInt] = useState(false)
  const [intMsg,    setIntMsg]    = useState("")

  const probData = Object.entries(emp.probabilities).map(([k, v]) => ({
    zone: k, value: Math.round(v * 100),
  }))

  async function handleCreateIntervention() {
    if (!rec) return
    setSavingInt(true); setIntMsg("")
    try {
      await createIntervention({
        employee_id: emp.employee_id,
        assigned_to: "manager",
        priority:    rec.priority,
        timeline:    rec.timeline,
        reasoning:   rec.reasoning,
        actions:     rec.actions,
      })
      setIntMsg("✓ Intervention created — track in Interventions page")
    } catch (e: any) {
      setIntMsg(`✗ ${e.message}`)
    } finally {
      setSavingInt(false)
    }
  }

  const isWaiting = recRunning && emp.prediction !== "GREEN" && !rec

  return (
    <div
      className="border rounded-xl overflow-hidden transition-all duration-200"
      style={{ borderColor: open ? zc + "40" : "var(--border)" }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 bg-surface hover:bg-surface/80 transition-colors text-left"
      >
        <div className="font-mono text-sm font-semibold text-text">{emp.employee_id}</div>
        <RiskBadge label={emp.prediction} />

        <div className="flex items-center gap-1.5">
          <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${emp.risk_score}%`, background: zc }} />
          </div>
          <span className="font-mono text-xs" style={{ color: zc }}>{emp.risk_score}</span>
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          <TrendingUp className="w-3 h-3 text-blue-400" />
          <span className="font-mono text-xs text-blue-400 font-bold">
            {emp.attrition_prob?.toFixed(1) ?? "—"}%
          </span>
          <span className="font-mono text-[10px] text-muted">attrition</span>
        </div>

        {/* Full Probabilities */}
        {emp.probabilities && (
          <div className="flex items-center gap-3 ml-auto mr-4 text-[10px] font-mono">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></div>
              <span className="text-muted text-green-400">{(emp.probabilities.GREEN * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#eab308]"></div>
              <span className="text-muted text-yellow-400">{(emp.probabilities.AMBER * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></div>
              <span className="text-muted text-red-400">{(emp.probabilities.RED * 100).toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* Waiting badge */}
        {isWaiting && (
          <span className="flex items-center gap-1 font-mono text-[10px] text-blue-400 border border-blue-400/30 px-2 py-0.5 rounded-full">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            In queue…
          </span>
        )}

        <div className="flex gap-3 ml-auto text-xs font-mono text-muted">
          {(["GREEN","AMBER","RED"] as const).map(z => (
            <span key={z}>
              <span style={{ color: ZONE_COLOR[z] }}>{(emp.probabilities[z]*100).toFixed(0)}%</span>
              <span className="ml-1 opacity-50">{z}</span>
            </span>
          ))}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted shrink-0" />}
      </button>

      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 border-t border-border">

          {/* COL 1: Risk Analysis */}
          <div className="p-5 border-r border-border">
            <p className="section-label">Risk Analysis</p>
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[10px] text-muted">Risk Score (rule-based)</span>
                  <span className="font-mono text-xs" style={{ color: zc }}>{emp.risk_score}/100</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${emp.risk_score}%`, background: zc }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-mono text-[10px] text-muted">Attrition Probability (ML model)</span>
                  <span className="font-mono text-xs text-blue-400">{emp.attrition_prob?.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-blue-400/70" style={{ width: `${emp.attrition_prob ?? 0}%` }} />
                </div>
              </div>
            </div>

            <div className="h-28 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={probData} barSize={28}>
                  <XAxis dataKey="zone" tick={{ fill: "#4a6580", fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "#0d1625", border: "1px solid #1a2a40", borderRadius: 8, fontFamily: "IBM Plex Mono", fontSize: 12 }}
                    formatter={(v: any) => [`${v}%`, "Probability"]}
                  />
                  <Bar dataKey="value" radius={[4,4,0,0]}>
                    {probData.map((d, i) => (
                      <Cell key={i} fill={ZONE_COLOR[d.zone as keyof typeof ZONE_COLOR] ?? "#60a5fa"} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {emp.comment && (
              <div className="bg-[#070d1a] border border-border rounded-lg px-4 py-3 mb-4">
                <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1">Manager Comment</p>
                <p className="text-sm text-text/80">{emp.comment}</p>
              </div>
            )}

            {emp.similar_employees?.length > 0 && (
              <div>
                <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">Similar Employees (FAISS)</p>
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="text-muted border-b border-border">
                      <th className="text-left py-1.5 pr-3">ID</th>
                      <th className="text-left py-1.5 pr-3">Sim</th>
                      <th className="text-left py-1.5">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.similar_employees.slice(0, 4).map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border/40 text-text/70">
                        <td className="py-1 pr-3">{s.employee_id}</td>
                        <td className="py-1 pr-3">{s.similarity?.toFixed(3)}</td>
                        <td className="py-1"><RiskBadge label={s.metadata?.risk ?? "—"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* COL 2: SHAP Factors */}
          <div className="p-5 border-r border-border">
            <p className="section-label">Contributing Factors (SHAP)</p>
            {emp.top_factors && emp.top_factors.length > 0 ? (
              <div className="space-y-3 mt-1">
                {emp.top_factors.map((f, i) => <FactorBar key={f.factor} factor={f} rank={i + 1} />)}
                <p className="font-mono text-[10px] text-muted mt-3">
                  <Info className="w-3 h-3 inline mr-1" />
                  Contribution % = factor's share of total attrition risk
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted gap-2">
                <Info className="w-6 h-6 opacity-30" />
                <p className="font-mono text-xs text-center">Train a model first to see factor attribution.</p>
              </div>
            )}

            {emp.metrics && Object.keys(emp.metrics).length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">Raw Metrics</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(emp.metrics).map(([k, v]) =>
                    v != null && (
                      <div key={k} className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-muted truncate pr-2">
                          {k.replace(/_/g," ")}
                        </span>
                        <span className="font-mono text-[10px] text-text shrink-0">{v}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* COL 3: AI Recommendation */}
          <div className="p-5 bg-[#090f1c]">
            <p className="section-label">AI Recommendation</p>

            {emp.prediction === "GREEN" ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-10 h-10 rounded-full bg-green/10 border border-green/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green" />
                </div>
                <p className="font-mono text-sm text-green">Low Risk — No Action Required</p>
              </div>

            ) : isWaiting ? (
              /* LLM is running but hasn't reached this employee yet */
              <div className="flex flex-col items-center justify-center h-48 text-muted gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="font-mono text-sm text-blue-400">Waiting for LLM…</p>
                <p className="font-mono text-xs text-muted text-center max-w-[200px]">
                  Ollama processes one employee at a time.<br/>This employee is in the queue.
                </p>
              </div>

            ) : !rec ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted">
                <Bot className="w-8 h-8 mb-3 opacity-40" />
                <p className="font-mono text-sm">Click <strong className="text-text">AI Recommendations</strong></p>
                <p className="font-mono text-xs mt-1 opacity-60">to generate insights for this employee</p>
              </div>

            ) : (
              <div className="space-y-3">
                {/* Show whether this is LLM or default */}
                {rec.reasoning?.includes("Default") && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber/10 border border-amber/20">
                    <AlertTriangle className="w-3 h-3 text-amber shrink-0" />
                    <p className="font-mono text-[10px] text-amber">
                      LLM timed out — showing default recommendation
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="font-mono text-xs px-3 py-1 rounded-full border"
                    style={{
                      color: PRIORITY_COLOR[rec.priority] ?? "#fbbf24",
                      borderColor: (PRIORITY_COLOR[rec.priority] ?? "#fbbf24") + "50",
                      background:  (PRIORITY_COLOR[rec.priority] ?? "#fbbf24") + "12",
                    }}
                  >
                    {rec.priority}
                  </span>
                  <span className="font-mono text-xs text-muted">Timeline: {rec.timeline}</span>
                </div>

                <div className="bg-[#070d1a] border border-border rounded-lg px-4 py-3">
                  <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1.5">Reasoning</p>
                  <p className="text-sm text-text/90 leading-relaxed">{rec.reasoning}</p>
                </div>

                {rec.actions?.length > 0 && (
                  <div className="bg-[#070d1a] border border-border rounded-lg px-4 py-3">
                    <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">Recommended Actions</p>
                    <ol className="space-y-2">
                      {rec.actions.map((a: string, i: number) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-text/80">
                          <span className="font-mono text-xs text-muted mt-0.5 w-5 shrink-0">
                            {String(i+1).padStart(2,"0")}
                          </span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <button
                  onClick={handleCreateIntervention}
                  disabled={savingInt}
                  className="w-full btn-primary justify-center text-sm"
                  style={{ borderColor: "rgba(74,222,128,.3)", color: "#4ade80" }}
                >
                  {savingInt ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                  {savingInt ? "Saving…" : "Save as Intervention"}
                </button>
                {intMsg && (
                  <p className={`font-mono text-xs ${intMsg.startsWith("✓") ? "text-green" : "text-red"}`}>
                    {intMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── SHAP factor bar ───────────────────────────────────────────────────────────
function FactorBar({ factor, rank }: { factor: TopFactor; rank: number }) {
  const barColor = factor.direction === "positive" ? "#f87171" : "#fbbf24"
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted w-4 shrink-0">#{rank}</span>
          <span className="font-mono text-xs text-text/90">{factor.label}</span>
        </div>
        <span className="font-mono text-xs font-bold shrink-0 ml-2" style={{ color: barColor }}>
          +{factor.contribution_pct}%
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(factor.contribution_pct * 2.5, 100)}%`, background: barColor + "aa" }}
        />
      </div>
      {factor.value != null && (
        <p className="font-mono text-[10px] text-muted mt-0.5">
          value: {factor.value}/10 ({factor.direction === "positive" ? "↑ raises risk" : "↓ lowers engagement"})
        </p>
      )}
    </div>
  )
}
