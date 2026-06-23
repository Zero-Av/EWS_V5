"use client"
import { useState, FormEvent } from "react"
import { useAuth } from "@/lib/auth-context"
import { login }   from "@/lib/api"
import { useToast } from "@/lib/toast-context"
import { Shield, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react"

export default function LoginPage() {
  const { login: authLogin } = useAuth()
  const toast = useToast()

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError("")
    try {
      const res = await login(username.trim(), password)
      authLogin(res.access_token, {
        username:  username.trim(),
        full_name: res.full_name,
        role:      res.role,
      })
      toast.success("Welcome back!", `Signed in as ${res.full_name}`)
    } catch (err: any) {
      const msg = err.message || "Invalid credentials. Please try again."
      setError(msg)
      toast.error("Sign in failed", msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--bg)" }}
    >
      {/* Subtle dot grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, #CBD5E1 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.45,
        }}
      />

      <div className="relative w-full max-w-sm animate-fade-up">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
          >
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight">NEXUS</h1>
          <p className="text-sm text-muted mt-1 font-medium">Employee Intelligence Platform</p>
        </div>

        {/* Card */}
        <div
          className="bg-surface rounded-2xl border border-border p-8"
          style={{ boxShadow: "var(--shadow-modal)" }}
        >
          <h2 className="text-lg font-bold text-text mb-1">Welcome back</h2>
          <p className="text-sm text-muted mb-6">Sign in to your workspace</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Username */}
            <div>
              <label htmlFor="username" className="label">Username</label>
              <input
                id="username"
                className={`input ${error ? "input-error" : ""}`}
                type="text"
                autoComplete="username"
                placeholder="your.username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError("") }}
                disabled={loading}
                required
                aria-required="true"
                aria-describedby={error ? "login-error" : undefined}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  className={`input pr-10 ${error ? "input-error" : ""}`}
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError("") }}
                  disabled={loading}
                  required
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye    className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p
                id="login-error"
                className="text-xs font-semibold text-red bg-red-light border border-red-200 rounded-lg px-3 py-2"
                role="alert"
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full py-3 mt-2 text-sm justify-center"
              disabled={loading || !username || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer trust badges */}
        <p className="text-center text-[11px] text-subtle mt-6 flex items-center justify-center gap-3">
          <span>AES-256 Encrypted</span>
          <span aria-hidden="true">·</span>
          <span>JWT Session</span>
          <span aria-hidden="true">·</span>
          <span>Role-Based Access</span>
        </p>
      </div>
    </div>
  )
}
