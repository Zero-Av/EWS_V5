"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  LayoutDashboard, Activity, Users, Building2,
  Sparkles, Zap, BarChart2, FileText, Settings,
  LogOut, Shield,
} from "lucide-react"

interface NavItem {
  href:      string
  label:     string
  icon:      React.ElementType
  adminOnly: boolean
  badge?:    number
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard",  label: "Dashboard",       icon: LayoutDashboard, adminOnly: false },
      { href: "/workforce",  label: "Workforce Health", icon: Activity,        adminOnly: false },
      { href: "/employees",  label: "Employees",        icon: Users,           adminOnly: false },
      { href: "/teams",      label: "Teams",            icon: Building2,       adminOnly: false },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/insights", label: "AI Insights", icon: Sparkles, adminOnly: false },
      { href: "/actions",  label: "Actions",     icon: Zap,      adminOnly: false },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart2, adminOnly: false },
      { href: "/reports",   label: "Reports",   icon: FileText,  adminOnly: false },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, adminOnly: true },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout, isAdmin } = useAuth()

  const initials = user?.full_name
    ?.split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <aside
      className="sidebar"
      aria-label="Primary navigation"
      role="navigation"
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
          aria-hidden="true"
        >
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-text leading-tight tracking-tight">NEXUS</p>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest leading-tight"
            style={{ color: "var(--subtle)" }}
          >
            Employee Intelligence
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(
            item => !item.adminOnly || isAdmin
          )
          if (!visibleItems.length) return null

          return (
            <div key={group.label} className="mb-2">
              <p className="nav-group-label" aria-hidden="true">
                {group.label}
              </p>
              {visibleItems.map(item => {
                const active = pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? "active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <item.icon
                      className="w-4 h-4 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className="badge badge-red px-1.5 py-0.5 text-[10px]"
                        aria-label={`${item.badge} items`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User session */}
      <div
        className="flex-shrink-0 px-3 py-3 border-t border-border"
        aria-label="User account"
      >
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold
                       text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-text truncate leading-tight">
              {user?.full_name ?? "—"}
            </p>
            <p
              className="text-[10px] font-medium capitalize leading-tight"
              style={{ color: "var(--subtle)" }}
            >
              {user?.role}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="nav-item w-full text-left hover:!text-red"
          style={{ color: "var(--muted)" }}
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
