"use client"
import { useState, FormEvent } from "react"
import { useAuth } from "@/lib/auth-context"
import { login as apiLogin } from "@/lib/api"
import { ShieldAlert, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await apiLogin(username, password)
      login(res.access_token, {
        username:  username,
        full_name: res.full_name,
        role:      res.role,
      })
    } catch (err: any) {
      setError(err.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#60a5fa 1px,transparent 1px),linear-gradient(90deg,#60a5fa 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm animate-fadeUp relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center mb-4">
            <ShieldAlert className="w-7 h-7 text-accent" />
          </div>
          <h1 className="font-mono text-xl font-semibold text-text tracking-tight">EWS</h1>
          <p className="text-muted text-xs font-mono mt-1 tracking-widest uppercase">
            Employee Early Warning System
          </p>
        </div>

        {/* Card */}
        <div className="card">
          <p className="section-label mb-6">Sign In</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                className="input"
                placeholder="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-muted mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red/10 border border-red/30 text-red text-xs font-mono px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary justify-center mt-2 py-3"
            >
              {loading ? (
                <span className="animate-pulse2">Authenticating…</span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Hint */}
        <p className="text-center text-muted text-xs font-mono mt-6 opacity-50">
          admin / manager access only
        </p>
      </div>
    </div>
  )
}
