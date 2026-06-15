"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Shield } from "lucide-react"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    router.replace(user ? "/dashboard" : "/login")
  }, [user, loading, router])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: "var(--bg)" }}
      aria-label="Loading platform"
      aria-busy="true"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center animate-pulse-dot"
        style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
        aria-hidden="true"
      >
        <Shield className="w-6 h-6 text-white" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--subtle)" }}>
        NEXUS · Loading…
      </p>
    </div>
  )
}
