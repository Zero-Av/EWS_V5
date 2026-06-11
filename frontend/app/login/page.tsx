"use client"
import { useState, FormEvent } from "react"
import { useAuth } from "@/lib/auth-context"
import { login as apiLogin } from "@/lib/api"
import { ShieldCheck, Eye, EyeOff, Sparkles } from "lucide-react"

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Soft Grid Background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#2563eb 1px,transparent 1px),linear-gradient(90deg,#2563eb 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Light Radial Glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-400/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Banner */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200/50 mb-4 transition-transform hover:rotate-3 duration-300">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-bold text-2xl text-slate-800 tracking-tight flex items-center gap-1.5 font-sans">
            EWS Suite
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">v5.0</span>
          </h1>
          <p className="text-muted text-xs font-semibold uppercase tracking-wider mt-1.5">
            Workforce Early Warning System
          </p>
        </div>

        {/* Card Panel */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl shadow-slate-900/[0.03] md:p-10">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-blue-600" />
              Sign in to Dashboard
            </h2>
            <p className="text-slate-500 text-xs mt-1">Please enter your HR administration credentials.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Username
              </label>
              <input
                className="input"
                placeholder="e.g. admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  className="input pr-11"
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 py-3.5 text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
                  <span>Authenticating...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Credentials hints */}
        <div className="text-center mt-6">
          <p className="text-slate-400 text-xs font-medium">
            Demo Access: <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">admin</code> / <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">admin123</code>
          </p>
        </div>
      </div>
    </div>
  )
}
