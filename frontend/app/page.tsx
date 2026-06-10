"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace(user.role === "admin" ? "/dashboard" : "/dashboard")
    } else {
      router.replace("/login")
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="font-mono text-muted text-sm animate-pulse2">initialising…</div>
    </div>
  )
}
