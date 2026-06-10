"use client"
import { useState } from "react"
import AppShell from "@/components/AppShell"
import FileDropzone from "@/components/FileDropzone"
import { evaluateModel } from "@/lib/api"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { LineChart } from "lucide-react"

const ZONE_COLOR = { GREEN: "#4ade80", AMBER: "#fbbf24", RED: "#f87171" }

export default function EvaluatePage() {
  const [file,    setFile]    = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<any>(null)
  const [error,   setError]   = useState("")

  async function handleEval() {
    if (!file) return
    setError(""); setResult(null); setLoading(true)
    try {
      const r = await evaluateModel(file)
      setResult(r.results)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const reportData = result
    ? ["GREEN","AMBER","RED"].flatMap(z => [
        { zone: z, metric: "Precision", value: result.classification_report?.[z]?.precision ?? 0 },
        { zone: z, metric: "Recall",    value: result.classification_report?.[z]?.recall    ?? 0 },
        { zone: z, metric: "F1",        value: result.classification_report?.[z]?.["f1-score"] ?? 0 },
      ])
    : []

  return (
    <AppShell requireAdmin>
      <div className="animate-fadeUp">
        <h1 className="font-mono text-2xl font-semibold text-text mb-1">Evaluate Model</h1>
        <p className="text-muted text-sm mb-8">Upload a labelled dataset to measure model performance</p>

        <div className="card max-w-2xl mb-5">
          <p className="section-label">Evaluation Dataset (must include 'risk' column)</p>
          <FileDropzone onFile={f => setFile(f || null)} current={file} />
        </div>

        <button onClick={handleEval} disabled={!file || loading} className="btn-primary mb-6">
          <LineChart className="w-4 h-4" />
          {loading ? "Evaluating…" : "Run Evaluation"}
        </button>

        {error && <div className="bg-red/10 border border-red/30 text-red font-mono text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        {result && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                ["Accuracy",  result.accuracy],
                ["Precision", result.precision],
                ["Recall",    result.recall],
                ["F1 Score",  result.f1],
              ].map(([label, val]) => (
                <div key={label as string} className="stat-card">
                  <span className="stat-lbl">{label}</span>
                  <span className="stat-val">{typeof val === "number" ? `${(val*100).toFixed(1)}%` : "—"}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Confusion matrix */}
              <div className="card">
                <p className="section-label">Confusion Matrix</p>
                <div className="grid grid-cols-3 gap-1 font-mono text-xs">
                  <div/>
                  {["GREEN","AMBER","RED"].map(l => (
                    <div key={l} className="text-center text-muted py-1">{l}</div>
                  ))}
                  {result.confusion_matrix?.map((row: number[], i: number) => (
                    <>
                      <div key={`lbl${i}`} className="text-muted flex items-center">{["GREEN","AMBER","RED"][i]}</div>
                      {row.map((val: number, j: number) => (
                        <div
                          key={j}
                          className="text-center py-2 rounded"
                          style={{ background: i===j ? "rgba(59,158,255,.15)" : "rgba(255,255,255,.02)" }}
                        >
                          {val}
                        </div>
                      ))}
                    </>
                  ))}
                </div>
              </div>

              {/* Per-class metrics */}
              <div className="card">
                <p className="section-label">Per-class Metrics</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={["GREEN","AMBER","RED"].map(z => ({
                      zone: z,
                      precision: result.classification_report?.[z]?.precision ?? 0,
                      recall:    result.classification_report?.[z]?.recall    ?? 0,
                      f1:        result.classification_report?.[z]?.["f1-score"] ?? 0,
                    }))} barSize={14}>
                      <XAxis dataKey="zone" tick={{ fill: "#4a6580", fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#4a6580", fontSize: 10 }} tickFormatter={v=>`${(v*100).toFixed(0)}%`} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "#0d1625", border:"1px solid #1a2a40", borderRadius:8, fontFamily:"IBM Plex Mono", fontSize:11 }}
                        formatter={(v:any)=>[`${(v*100).toFixed(1)}%`]}
                      />
                      {["precision","recall","f1"].map((k,i) => (
                        <Bar key={k} dataKey={k} fill={["#60a5fa","#4ade80","#fbbf24"][i]} radius={[3,3,0,0]} fillOpacity={0.85} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
