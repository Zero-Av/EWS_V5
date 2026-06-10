"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import clsx from "clsx"
import {
  LayoutDashboard, Cpu, BookOpen, FlaskConical,
  RefreshCw, Settings, Users, LogOut,
  TrendingUp, Bell, ClipboardList, Activity,
} from "lucide-react"

const NAV = [
  { href: "/dashboard",     label: "Dashboard",      icon: LayoutDashboard, adminOnly: false },
  { href: "/analytics",     label: "Analytics",      icon: Activity,        adminOnly: false },
  { href: "/trends",        label: "Trends",         icon: TrendingUp,      adminOnly: false },
  { href: "/alerts",        label: "Alerts",         icon: Bell,            adminOnly: false },
  { href: "/interventions", label: "Interventions",  icon: ClipboardList,   adminOnly: false },
  { href: "/predict",       label: "Predict & Recommend", icon: Cpu,        adminOnly: false },
  { href: "/train",         label: "Train Model",    icon: BookOpen,        adminOnly: true  },
  { href: "/evaluate",      label: "Evaluate",       icon: FlaskConical,    adminOnly: true  },
  { href: "/retrain",       label: "Retrain",        icon: RefreshCw,       adminOnly: true  },
  { href: "/users",         label: "Users",          icon: Users,           adminOnly: true  },
  { href: "/settings",      label: "Settings",       icon: Settings,        adminOnly: true  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.push("/login")
  }

  const isAdmin = user?.role === "admin"

  return (
    <aside className="w-56 shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold font-mono">EW</span>
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-text">EWS Platform</p>
            <p className="font-mono text-[10px] text-muted">v3.0</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map(({ href, label, icon: Icon, adminOnly }) => {
          if (adminOnly && !isAdmin) return null
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all group",
                active
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "text-muted hover:text-text hover:bg-white/5"
              )}
            >
              <Icon className={clsx("w-4 h-4 shrink-0", active ? "text-blue-400" : "text-muted group-hover:text-text")} />
              <span className="font-mono text-xs">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <span className="font-mono text-xs text-blue-400">{user?.full_name?.[0] ?? "?"}</span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs text-text truncate">{user?.full_name ?? "—"}</p>
            <p className="font-mono text-[10px] text-muted capitalize">{user?.role ?? ""}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-muted hover:text-red hover:bg-red/5 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-mono text-xs">Sign out</span>
        </button>
      </div>
    </aside>
  )
}
