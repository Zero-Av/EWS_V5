"use client"
import { useState, useEffect } from "react"
import AppShell from "@/components/AppShell"
import FileDropzone from "@/components/FileDropzone"
import { retrainModel, listBackups, rollback } from "@/lib/api"
import { RefreshCw, RotateCcw, CheckCircle } from "lucide-react"

export default function RetrainPage() {
  const [file,     setFile]     = useState<File | null>(null)
  const [trials,   setTrials]   = useState(20)
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<any>(null)
  const [error,    setError]    = useState("")
  const [backups,  setBackups]  = useState<string[]>([])
  const [selected, setSelected] = useState("")
  const [rolling,  setRolling]  = useState(false)

  useEffect(() => {
    listBackups().then(r => { setBackups(r.backups); setSelected(r.backups[0] ?? "") }).catch(() => {})
  }, [])

  async function handleRetrain() {
    if (!file) return
    setError(""); setResult(null); setLoading(true)
    try {
      const r = await retrainModel(file, trials)
      setResult(r.results)
      const rb = await listBackups()
      setBackups(rb.backups); setSelected(rb.backups[0] ?? "")
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleRollback() {
    if (!selected) return
    setRolling(true)
    try { await rollback(selected); alert("Rollback complete") }
    catch (e: any) { setError(e.message) }
    finally { setRolling(false) }
  }

  return (
    <AppShell requireAdmin>
      <div className="animate-fadeUp max-w-2xl">
        <h1 className="font-mono text-2xl font-semibold text-text mb-1">Retrain Model</h1>
        <p className="text-muted text-sm mb-8">Incrementally update the model with new labelled data</p>

        <div className="card mb-5">
          <p className="section-label">New Labelled Data (CSV with 'risk' column)</p>
          <FileDropzone onFile={f => setFile(f || null)} current={file} />
          <div className="flex items-center gap-3 mt-4">
            <label className="font-mono text-xs text-muted uppercase tracking-wider">Optuna Trials</label>
            <input type="range" min={5} max={50} value={trials} onChange={e=>setTrials(Number(e.target.value))} className="accent-accent w-32" />
            <span className="font-mono text-sm text-accent">{trials}</span>
          </div>
        </div>

        <button onClick={handleRetrain} disabled={!file||loading} className="btn-primary mb-6">
          <RefreshCw className="w-4 h-4" />
          {loading ? "Retraining…" : "Retrain Model"}
        </button>

        {error && <div className="bg-red/10 border border-red/30 text-red font-mono text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        {result && (
          <div className="card mb-6">
            <div className="flex items-center gap-2 text-green mb-3">
              <CheckCircle className="w-4 h-4"/><span className="font-mono text-sm font-semibold">Retraining Complete</span>
            </div>
            <pre className="font-mono text-xs text-text/80 overflow-auto">{JSON.stringify(result,null,2)}</pre>
          </div>
        )}

        {/* Backups */}
        <div className="card">
          <p className="section-label">Model Backups</p>
          {backups.length === 0 ? (
            <p className="font-mono text-muted text-sm">No backups found.</p>
          ) : (
            <div className="flex items-center gap-3">
              <select value={selected} onChange={e=>setSelected(e.target.value)} className="input flex-1">
                {backups.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <button onClick={handleRollback} disabled={rolling} className="btn-ghost">
                <RotateCcw className="w-4 h-4"/>{rolling ? "Rolling back…" : "Rollback"}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
