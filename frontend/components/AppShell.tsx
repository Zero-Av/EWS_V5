"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Sidebar from "@/components/Sidebar"

interface Props {
  children:      React.ReactNode
  requireAdmin?: boolean
  activeTab?:    string
  onTabChange?:  (tab: string) => void
}

export default function AppShell({ children, requireAdmin = false, activeTab, onTabChange }: Props) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace("/login"); return }
    if (requireAdmin && user.role !== "admin") onTabChange?.("overview")
  }, [user, loading, requireAdmin, router, onTabChange])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center animate-spin">
            <div className="w-4 h-4 rounded-lg bg-blue-600"></div>
          </div>
          <span className="text-xs font-semibold text-slate-500 animate-pulse">Initializing EWS...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8 md:p-12">
          {children}
        </div>
      </main>
    </div>
  )
}
