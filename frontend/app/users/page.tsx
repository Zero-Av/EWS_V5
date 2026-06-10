"use client"
import { useState, useEffect, FormEvent } from "react"
import AppShell from "@/components/AppShell"
import { listUsers, addUser, deleteUser, type UserRecord } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { UserPlus, Trash2, Shield, UserCheck } from "lucide-react"

export default function UsersPage() {
  const { user: me } = useAuth()
  const [users,   setUsers]   = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  const [form, setForm] = useState({ username: "", password: "", full_name: "", role: "manager" })
  const [adding, setAdding] = useState(false)
  const [formErr, setFormErr] = useState("")

  function reload() {
    listUsers().then(setUsers).catch(e=>setError(e.message)).finally(()=>setLoading(false))
  }
  useEffect(reload, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setFormErr(""); setAdding(true)
    try {
      await addUser(form)
      setForm({ username:"", password:"", full_name:"", role:"manager" })
      reload()
    } catch (e: any) { setFormErr(e.message) }
    finally { setAdding(false) }
  }

  async function handleDelete(username: string) {
    if (!confirm(`Delete user "${username}"?`)) return
    try { await deleteUser(username); reload() }
    catch (e: any) { setError(e.message) }
  }

  return (
    <AppShell requireAdmin>
      <div className="animate-fadeUp">
        <h1 className="font-mono text-2xl font-semibold text-text mb-1">User Management</h1>
        <p className="text-muted text-sm mb-8">Manage admin and manager accounts</p>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* User list */}
          <div className="lg:col-span-3 card">
            <p className="section-label">Accounts</p>
            {loading ? (
              <p className="font-mono text-muted text-sm animate-pulse2">Loading…</p>
            ) : error ? (
              <p className="text-red font-mono text-sm">{error}</p>
            ) : (
              <div className="space-y-2">
                {users.map(u => (
                  <div
                    key={u.username}
                    className="flex items-center gap-3 px-4 py-3 bg-[#070d1a] border border-border rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                      <span className="font-mono text-xs text-accent font-semibold">{u.full_name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-text">{u.full_name}</div>
                      <div className="font-mono text-xs text-muted">@{u.username}</div>
                    </div>
                    <span className={u.role === "admin" ? "badge-red" : "badge-blue"}>
                      {u.role === "admin" ? <Shield className="w-3 h-3"/> : <UserCheck className="w-3 h-3"/>}
                      {u.role}
                    </span>
                    {u.username !== me?.username && (
                      <button onClick={() => handleDelete(u.username)} className="text-muted hover:text-red transition-colors ml-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add user form */}
          <div className="lg:col-span-2 card">
            <p className="section-label">Add User</p>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              {[
                { label:"Full Name",  key:"full_name", type:"text",     ph:"Jane Smith" },
                { label:"Username",   key:"username",  type:"text",     ph:"jsmith" },
                { label:"Password",   key:"password",  type:"password", ph:"••••••••" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block font-mono text-[10px] text-muted uppercase tracking-wider mb-1">{f.label}</label>
                  <input
                    className="input"
                    type={f.type}
                    placeholder={f.ph}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                    required
                  />
                </div>
              ))}
              <div>
                <label className="block font-mono text-[10px] text-muted uppercase tracking-wider mb-1">Role</label>
                <select className="input" value={form.role} onChange={e=>setForm(v=>({...v,role:e.target.value}))}>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {formErr && <p className="text-red font-mono text-xs">{formErr}</p>}
              <button type="submit" disabled={adding} className="btn-primary justify-center mt-1">
                <UserPlus className="w-4 h-4"/>
                {adding ? "Adding…" : "Add User"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
