"use client"
import { useEffect, useState, useCallback, FormEvent } from "react"
import AppShell from "@/components/AppShell"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/lib/toast-context"
import FileDropzone from "@/components/ui/FileDropzone"
import { CardSkeleton } from "@/components/ui/Skeleton"
import {
  listUsers, addUser, deleteUser,
  connectLLM, getLLMStatus,
  trainClassifier, getModelInfo,
} from "@/lib/api"
import {
  Users, Brain, Plug, Plus, Trash2, RefreshCw,
  CheckCircle, XCircle, Shield, AlertTriangle,
  Loader2, Server, Zap,
} from "lucide-react"

type Tab = "users" | "model" | "integrations"

/* ─── User Management ───────────────────────────────────────── */
function UserManagementPanel() {
  const toast = useToast()
  const [users,      setUsers]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ username: "", password: "", full_name: "", role: "manager" })

  const load = useCallback(async () => {
    try { const r = await listUsers(); setUsers(r.users ?? []) }
    catch (e: any) { toast.error("Failed to load users", e.message) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.username || !form.password || !form.full_name) {
      toast.warning("Missing fields", "All fields are required"); return
    }
    setSubmitting(true)
    try {
      await addUser(form)
      toast.success("User created", `${form.full_name} added as ${form.role}`)
      setForm({ username: "", password: "", full_name: "", role: "manager" })
      setShowForm(false)
      await load()
    } catch (e: any) { toast.error("Failed to create user", e.message) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (username: string) => {
    setDeleting(username)
    try {
      await deleteUser(username)
      toast.success("User removed", `${username} has been deleted`)
      setUsers(prev => prev.filter(u => u.username !== username))
    } catch (e: any) { toast.error("Failed to delete user", e.message) }
    finally { setDeleting(null) }
  }

  if (loading) return <CardSkeleton rows={4} />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-text">{users.length} platform users</p>
          <p className="text-xs text-muted mt-0.5">Manage access roles and credentials</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary btn-sm" aria-expanded={showForm}>
          <Plus className="w-3.5 h-3.5" />
          {showForm ? "Cancel" : "Add User"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card" style={{ background: "var(--accent-light)", borderColor: "var(--accent-mid)" }} aria-label="Add user form">
          <h3 className="text-xs font-bold text-accent uppercase tracking-wider mb-4">New User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {[
              { id: "fn", label: "Full Name",  key: "full_name", type: "text",     placeholder: "Jane Smith" },
              { id: "un", label: "Username",   key: "username",  type: "text",     placeholder: "jsmith" },
              { id: "pw", label: "Password",   key: "password",  type: "password", placeholder: "••••••••" },
            ].map(f => (
              <div key={f.id}>
                <label htmlFor={f.id} className="label">{f.label}</label>
                <input id={f.id} className="input" type={f.type} placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required aria-required="true" />
              </div>
            ))}
            <div>
              <label htmlFor="role-sel" className="label">Role</label>
              <select id="role-sel" className="input" value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="manager">Manager</option>
                <option value="analyst">Analyst</option>
                <option value="admin">Admin / HRBP</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary btn-sm">
            {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</> : <><Plus className="w-3.5 h-3.5" />Create User</>}
          </button>
        </form>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <table className="data-table" aria-label="Platform users">
          <thead>
            <tr>
              <th scope="col">Full Name</th>
              <th scope="col">Username</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col" className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-muted">No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.username}>
                <td className="font-semibold">{u.full_name}</td>
                <td className="font-mono text-xs text-muted">{u.username}</td>
                <td><span className={`badge text-[10px] ${u.role === "admin" ? "badge-violet" : "badge-blue"}`}>{u.role}</span></td>
                <td><span className={`badge text-[10px] ${u.is_active ? "badge-green" : "badge-gray"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                <td className="text-right">
                  <button onClick={() => handleDelete(u.username)} disabled={deleting === u.username}
                    className="btn-danger btn-sm" aria-label={`Delete ${u.full_name}`}>
                    {deleting === u.username ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─── Model & Data Panel ────────────────────────────────────── */
function ModelPanel() {
  const toast = useToast()
  const [model,    setModel]    = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [training, setTraining] = useState(false)
  const [file,     setFile]     = useState<File | null>(null)

  const load = useCallback(async () => {
    try { setModel(await getModelInfo()) }
    catch (e: any) { toast.error("Failed to load model info", e.message) }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleTrain = async () => {
    if (!file) { toast.warning("No file selected", "Please select a labelled CSV file"); return }
    setTraining(true)
    try {
      const res = await trainClassifier(file)
      const m = res.metadata
      toast.success("Model trained", `Accuracy: ${(m.accuracy * 100).toFixed(1)}% · ${m.samples} samples`)
      setFile(null); await load()
    } catch (e: any) { toast.error("Training failed", e.message) }
    finally { setTraining(false) }
  }

  if (loading) return <CardSkeleton rows={5} />
  const meta = model?.metadata

  return (
    <div className="space-y-5">
      <div className={`card`} style={model?.has_model ? { borderColor: "#86EFAC", background: "var(--green-light)" } : {}}>
        <div className="flex items-start gap-4">
          <div className={`icon-chip ${model?.has_model ? "icon-chip-green text-green" : "icon-chip-red text-red"}`}>
            {model?.has_model ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-text">{model?.has_model ? "Classifier Active" : "No Model Trained"}</h3>
              <span className={`badge text-[10px] ${model?.has_model ? "badge-green" : "badge-red"}`}>
                {model?.has_model ? "● Live" : "○ Offline"}
              </span>
            </div>
            {meta ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {[
                  { label: "Accuracy", value: `${(meta.accuracy * 100).toFixed(1)}%` },
                  { label: "Samples",  value: meta.samples.toLocaleString() },
                  { label: "Features", value: meta.features },
                  { label: "Trained",  value: new Date(meta.trained_at).toLocaleDateString() },
                ].map(s => (
                  <div key={s.label} className="text-center p-2.5 rounded-lg bg-surface border border-border">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">{s.label}</p>
                    <p className="text-base font-extrabold font-mono text-text">{s.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted mt-1">Upload a labelled CSV below to train the LightGBM risk classifier</p>
            )}
          </div>
        </div>
      </div>

      {meta?.top_features && Object.keys(meta.top_features).length > 0 && (
        <div className="card">
          <h3 className="section-title mb-4"><Brain className="w-4 h-4 text-violet" />Top Predictive Features (SHAP)</h3>
          <div className="space-y-2.5">
            {Object.entries(meta.top_features).sort(([,a]: any,[,b]: any) => b - a).slice(0, 8).map(([feat, imp]: any) => {
              const pct = Math.round(imp * 100)
              return (
                <div key={feat} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-40 truncate flex-shrink-0" style={{ color: "var(--text-2)" }}>{feat}</span>
                  <div className="progress-track flex-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: "var(--violet)" }} />
                  </div>
                  <span className="text-xs font-bold font-mono w-10 text-right" style={{ color: "var(--violet)" }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="section-title mb-1"><RefreshCw className="w-4 h-4 text-accent" />Train New Model</h3>
        <p className="text-xs text-muted mb-4">
          Upload a labelled CSV with a <code className="font-mono bg-surface2 px-1 py-0.5 rounded text-[10px]">risk_zone</code> column (GREEN / AMBER / RED).
        </p>
        <FileDropzone file={file} onChange={setFile} accept=".csv" label="Drop labelled training CSV here" hint="Required column: risk_zone" />
        {file && (
          <button onClick={handleTrain} disabled={training} className="btn-primary btn-sm mt-4">
            {training ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Training…</> : <><Zap className="w-3.5 h-3.5" />Start Training</>}
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Integrations Panel ────────────────────────────────────── */
function IntegrationsPanel() {
  const toast = useToast()
  const [status,     setStatus]     = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [provider,   setProvider]   = useState("anthropic")

  const loadStatus = useCallback(async () => {
    try { setStatus(await getLLMStatus()) }
    catch { setStatus({ connected: false }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await connectLLM(provider)
      toast.success("LLM connected", `${res.provider} is now active`)
      await loadStatus()
    } catch (e: any) { toast.error("Connection failed", e.message) }
    finally { setConnecting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="card" style={status?.connected ? { borderColor: "#86EFAC", background: "var(--green-light)" } : {}}>
        <div className="flex items-start gap-4">
          <div className={`icon-chip ${status?.connected ? "icon-chip-green text-green" : "icon-chip-amber text-amber"}`}>
            <Server className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-text">LLM Integration</h3>
              <span className={`badge text-[10px] ${status?.connected ? "badge-green" : "badge-amber"}`}>
                {loading ? "Checking…" : status?.connected ? "● Connected" : "○ Not connected"}
              </span>
            </div>
            <p className="text-xs text-muted">
              {status?.connected ? "AI-powered summaries and recommendations are active" : "Connect an LLM provider to enable AI features"}
            </p>
          </div>
          <button onClick={loadStatus} className="btn-icon flex-shrink-0" aria-label="Refresh LLM status">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="section-title mb-4"><Plug className="w-4 h-4 text-accent" />Connect LLM Provider</h3>
        <div className="space-y-2.5 mb-5" role="radiogroup" aria-label="LLM provider selection">
          {[
            { value: "anthropic", label: "Anthropic Claude", badge: "Recommended", badgeCls: "badge-violet" },
            { value: "ollama",    label: "Ollama (Local)",   badge: "Self-hosted",  badgeCls: "badge-blue"   },
          ].map(p => (
            <label key={p.value}
              className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${provider === p.value ? "border-accent bg-accent-light" : "border-border hover:bg-surface2"}`}>
              <input type="radio" name="provider" value={p.value} checked={provider === p.value}
                onChange={() => setProvider(p.value)} className="accent-blue-600" aria-label={p.label} />
              <span className="flex-1 text-sm font-semibold text-text">{p.label}</span>
              <span className={`badge text-[10px] ${p.badgeCls}`}>{p.badge}</span>
            </label>
          ))}
        </div>
        <div className="alert-info text-xs mb-4" role="note">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Ensure your <strong>ANTHROPIC_API_KEY</strong> (or Ollama endpoint) is set in the backend environment.
        </div>
        <button onClick={handleConnect} disabled={connecting} className="btn-primary btn-sm">
          {connecting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Connecting…</> : <><Plug className="w-3.5 h-3.5" />Connect {provider === "anthropic" ? "Claude" : "Ollama"}</>}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS PAGE
═══════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>("users")

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="page-container flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <Shield className="w-12 h-12 mx-auto text-muted opacity-40" />
            <h1 className="text-lg font-bold text-text">Access Restricted</h1>
            <p className="text-sm text-muted">Settings are only available to platform administrators.</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "users",        label: "User Management", icon: Users  },
    { id: "model",        label: "Model & Data",    icon: Brain  },
    { id: "integrations", label: "Integrations",    icon: Plug   },
  ]

  return (
    <AppShell>
      <div className="page-container animate-fade-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings & Administration</h1>
            <p className="page-subtitle">Manage users, the risk model, and platform integrations</p>
          </div>
        </div>

        <div className="tab-group mb-6 w-fit" role="tablist" aria-label="Settings sections">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`tab-item flex items-center gap-2 ${tab === t.id ? "active" : ""}`}
              role="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`}>
              <t.icon className="w-3.5 h-3.5" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" aria-labelledby={`tab-${tab}`} className="animate-fade-in">
          {tab === "users"        && <UserManagementPanel />}
          {tab === "model"        && <ModelPanel />}
          {tab === "integrations" && <IntegrationsPanel />}
        </div>
      </div>
    </AppShell>
  )
}
