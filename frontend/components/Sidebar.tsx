"use client"
import { useAuth } from "@/lib/auth-context"
import {
  LayoutDashboard,
  Users,
  Database,
  UserPlus,
  LogOut,
  Sparkles,
} from "lucide-react"

interface SidebarProps {
  activeTab?: string
  onTabChange?: (tab: string) => void
}

export default function Sidebar({ activeTab = "overview", onTabChange }: SidebarProps) {
  const { user, logout } = useAuth()

  const NAV = [
    { id: "overview",  label: "Dashboard Overview",  icon: LayoutDashboard, adminOnly: false },
    { id: "employees", label: "Employee Directory",  icon: Users,           adminOnly: false },
    { id: "data",      label: "Data & Model Center", icon: Database,        adminOnly: false },
    { id: "users",     label: "Users & Settings",    icon: UserPlus,        adminOnly: true  },
  ]

  const isAdmin = user?.role === "admin"

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 z-20">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shadow-blue-200">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-800 text-sm tracking-tight leading-tight">EWS Platform</h1>
            <p className="text-[10px] text-muted font-semibold tracking-wider uppercase">Early Warning System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {NAV.map(({ id, label, icon: Icon, adminOnly }) => {
          if (adminOnly && !isAdmin) return null
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange?.(id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all group duration-200 ${
                active
                  ? "bg-blue-50 text-blue-600 shadow-sm shadow-blue-50"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* User Session Info */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300/30 flex items-center justify-center shrink-0 shadow-inner">
            <span className="font-semibold text-xs text-slate-600">{user?.full_name?.[0]?.toUpperCase() ?? "?"}</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{user?.full_name ?? "—"}</p>
            <span className="inline-block text-[9px] font-bold text-muted uppercase tracking-wider bg-white border border-slate-200 px-1.5 py-0.5 rounded-md mt-0.5 capitalize">{user?.role ?? ""}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-slate-500 hover:text-red hover:bg-red-50 hover:border-red-100 transition-all font-medium text-xs duration-200 border border-transparent"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
