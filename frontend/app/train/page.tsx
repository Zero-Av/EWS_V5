"use client"
import { useState, useEffect } from "react"
import AppShell from "@/components/AppShell"
import FileDropzone from "@/components/FileDropzone"
import { trainModel, getAvailableModels, switchModel } from "@/lib/api"
import {
  Upload, CheckCircle, Loader2, Star, Cpu, Zap,
  BarChart2, AlertCircle, RefreshCw,
} from "lucide-react"
import clsx from "clsx"

// ── Types ─────────────────────────────────────────────────────────────────────
interface MemberResult {
  member:      string
  label:       string
  cv_score:    number
  accuracy:    number
  best_params: Record<string, unknown>
}

interface TrainResult {
  trained_at:        string
  model_label:       string
  ensemble_accuracy: number
  best_member:       string
  best_member_label: string
  best_member_acc:   number
  samples:           number
  features:          number
  embedding_dim:     number
  cv_folds:          number
  optuna_trials:     number
  members:           MemberResult[]
}

interface MemberInfo {
  model_type:  string
  label:       string
  trained:     boolean
  shap_active: boolean
}

interface AvailableResp {
  ensemble:   { trained: boolean; label: string }
  members:    MemberInfo[]
  shap_member: string | null
  active:     string
}

const MEMBER_COLORS: Record<string, string> = {
  random_forest: "#4ade80",
  lightgbm:      "#60a5fa",
  catboost:      "#f97316",
  extra_trees:   "#a78bfa",
}

const MEMBER_DESCS: Record<string, string> = {
  random_forest: "Bagged decision trees — robust, low variance",
  lightgbm:      "Leaf-wise gradient boosting — fast, high accuracy",
  catboost:      "Ordered boosting — great on heterogeneous features",
  extra_trees:   "Extreme randomization — fast, strong regulariser",
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TrainPage() {
  const [file,       setFile]       = useState<File | null>(null)
  const [trials,     setTrials]     = useState(20)
  const [loading,    setLoading]    = useState(false)
  const [result,     setResult]     = useState<TrainResult | null>(null)
  const [error,      setError]      = useState("")
  const [available,  setAvailable]  = useState<AvailableResp | null>(null)
  const [switching,  setSwitching]  = useState("")

  useEffect(() => { loadAvailable() }, [])

  async function loadAvailable() {
    try {
      const r = await getAvailableModels() as unknown as AvailableResp
      setAvailable(r)
    } catch {}
  }

  async function handleTrain() {
    if (!file) return
    setError(""); setResult(null); setLoading(true)
    try {
      const r = await trainModel(file, trials, "ensemble")
      setResult(r.results as unknown as TrainResult)
      await loadAvailable()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleSwitchShap(mt: string) {
    setSwitching(mt)
    try {
      await switchModel(mt)
      await loadAvailable()
    } catch (e: any) { setError(e.message) }
    finally { setSwitching("") }
  }

  const sortedMembers = result
    ? [...result.members].sort((a, b) => b.accuracy - a.accuracy)
    : []

  return (
    <AppShell requireAdmin>
      <div className="animate-fadeUp max-w-3xl">
        <h1 className="font-mono text-2xl font-semibold text-text mb-1">Train Ensemble Model</h1>
        <p className="text-muted text-sm mb-8">
          Trains a soft-voting ensemble of four Optuna-tuned tree models.
          SHAP explanations use the best single member.
        </p>

        {/* Ensemble architecture card */}
        <div className="card mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-4 h-4 text-accent" />
            <p className="font-mono text-sm font-semibold text-text">
              Voting Ensemble Architecture
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {Object.entries(MEMBER_DESCS).map(([key, desc]) => (
              <div
                key={key}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-border"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                  style={{ background: MEMBER_COLORS[key] }}
                />
                <div>
                  <p className="font-mono text-xs font-semibold text-text capitalize">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="font-mono text-[10px] text-muted mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20">
            <Zap className="w-3.5 h-3.5 text-accent flex-shrink-0" />
            <p className="font-mono text-xs text-muted">
              Soft-voting combines all four probability outputs.
              The highest-accuracy member backs SHAP <code className="text-accent">TreeExplainer</code>.
            </p>
          </div>
        </div>

        {/* Dataset + trials */}
        <div className="card mb-5">
          <p className="section-label">Training Dataset</p>
          <FileDropzone onFile={f => setFile(f || null)} current={file} />
          <div className="flex items-center gap-4 mt-4">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider">
              Optuna Trials (per member)
            </label>
            <input
              type="range" min={5} max={50}
              value={trials}
              onChange={e => setTrials(Number(e.target.value))}
              className="accent-accent w-36"
            />
            <span className="font-mono text-sm text-accent w-6">{trials}</span>
            <span className="font-mono text-[10px] text-muted">
              ({4 * trials} total trials)
            </span>
          </div>
        </div>

        <button onClick={handleTrain} disabled={!file || loading} className="btn-primary mb-6">
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Upload className="w-4 h-4" />
          }
          {loading ? "Training ensemble…" : "Train Ensemble"}
        </button>

        {error && (
          <div className="flex items-start gap-2 bg-red/10 border border-red/30 text-red font-mono text-sm px-4 py-3 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Training results */}
        {result && (
          <div className="card mb-6 space-y-5">
            {/* Summary */}
            <div>
              <div className="flex items-center gap-2 text-green mb-4">
                <CheckCircle className="w-4 h-4" />
                <span className="font-mono text-sm font-semibold">Training Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-surface rounded-lg p-3 text-center">
                  <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1">Ensemble Acc</p>
                  <p className="font-mono text-xl font-bold text-green">
                    {(result.ensemble_accuracy * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-surface rounded-lg p-3 text-center">
                  <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1">Samples</p>
                  <p className="font-mono text-xl font-bold text-text">{result.samples}</p>
                </div>
                <div className="bg-surface rounded-lg p-3 text-center">
                  <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1">Features</p>
                  <p className="font-mono text-xl font-bold text-text">{result.features}</p>
                </div>
              </div>
            </div>

            {/* Per-member leaderboard */}
            <div>
              <p className="section-label mb-3">Member Leaderboard</p>
              <div className="space-y-2">
                {sortedMembers.map((m, rank) => {
                  const isBest  = m.member === result.best_member
                  const color   = MEMBER_COLORS[m.member] || "#94a3b8"
                  const barPct  = Math.round(m.accuracy * 100)
                  return (
                    <div
                      key={m.member}
                      className={clsx(
                        "px-4 py-3 rounded-lg border transition-colors",
                        isBest ? "border-green/40 bg-green/5" : "border-border"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {isBest
                          ? <Star className="w-3.5 h-3.5 text-green flex-shrink-0" />
                          : <span className="font-mono text-xs text-muted w-3.5 text-center">{rank + 1}</span>
                        }
                        <span className="font-mono text-sm text-text flex-1">{m.label}</span>
                        <span className="font-mono text-[10px] text-muted">
                          CV {(m.cv_score * 100).toFixed(1)}%
                        </span>
                        <span
                          className="font-mono text-sm font-bold"
                          style={{ color: isBest ? "#4ade80" : color }}
                        >
                          {(m.accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                      {/* Accuracy bar */}
                      <div className="h-1 bg-surface rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${barPct}%`, background: isBest ? "#4ade80" : color }}
                        />
                      </div>
                      {isBest && (
                        <p className="font-mono text-[10px] text-green mt-1.5">
                          ★ Best member — backing SHAP TreeExplainer
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Embed + fold info */}
            <div className="flex gap-4 text-xs font-mono text-muted">
              <span>Embedding dim: {result.embedding_dim}</span>
              <span>·</span>
              <span>CV folds: {result.cv_folds}</span>
              <span>·</span>
              <span>Trials/member: {result.optuna_trials}</span>
            </div>
          </div>
        )}

        {/* Ensemble status panel */}
        {available && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Ensemble Status</p>
              <button
                onClick={loadAvailable}
                className="text-muted hover:text-text transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Ensemble row */}
            <div className={clsx(
              "flex items-center gap-3 px-4 py-3 rounded-lg border mb-3",
              available.ensemble.trained
                ? "border-accent/40 bg-accent/5"
                : "border-border"
            )}>
              <div className={clsx(
                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                available.ensemble.trained ? "bg-accent" : "bg-border"
              )} />
              <span className="font-mono text-sm text-text flex-1">
                {available.ensemble.label}
              </span>
              <span className={clsx(
                "font-mono text-[10px] px-2 py-0.5 rounded border",
                available.ensemble.trained
                  ? "text-accent border-accent/30 bg-accent/10"
                  : "text-muted border-border"
              )}>
                {available.ensemble.trained ? "Active" : "Not trained"}
              </span>
            </div>

            {/* Members */}
            <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">
              Members — click to set as SHAP explainer
            </p>
            <div className="space-y-1.5">
              {available.members.map(m => {
                const color = MEMBER_COLORS[m.model_type] || "#94a3b8"
                return (
                  <div
                    key={m.model_type}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                      m.shap_active ? "border-opacity-40 bg-opacity-5" : "border-border",
                    )}
                    style={m.shap_active
                      ? { borderColor: color + "60", background: color + "08" }
                      : {}}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: m.trained ? color : "#1a2a40" }}
                    />
                    <span className="font-mono text-xs text-text flex-1">{m.label}</span>

                    {m.shap_active && (
                      <span
                        className="font-mono text-[10px] px-2 py-0.5 rounded border"
                        style={{ color, borderColor: color + "50", background: color + "12" }}
                      >
                        SHAP
                      </span>
                    )}

                    {m.trained && !m.shap_active && (
                      <button
                        onClick={() => handleSwitchShap(m.model_type)}
                        disabled={switching === m.model_type}
                        className="font-mono text-[10px] text-muted hover:text-text underline transition-colors"
                      >
                        {switching === m.model_type ? "Setting…" : "Use for SHAP"}
                      </button>
                    )}
                    {!m.trained && (
                      <span className="font-mono text-[10px] text-muted">Not trained</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
