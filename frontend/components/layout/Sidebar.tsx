"use client"
import Link          from "next/link"
import { usePathname } from "next/navigation"
import { useAuth }    from "@/lib/auth-context"
import { useAlerts }  from "@/lib/hooks/useAlerts"
import {
  LayoutDashboard, Activity, Users, Building2,
  Sparkles, Zap, BarChart2, FileText, Settings,
  LogOut, Shield, X,
} from "lucide-react"

interface NavItem {
  href:      string
  label:     string
  icon:      React.ElementType
  hiddenFor: string[]   // role names that should NOT see this item
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard",        icon: LayoutDashboard, hiddenFor: [] },
      { href: "/workforce", label: "Workforce Health", icon: Activity,        hiddenFor: ["analyst"] },
      { href: "/employees", label: "Employees",        icon: Users,           hiddenFor: [] },
      { href: "/teams",     label: "Teams",            icon: Building2,       hiddenFor: [] },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/insights", label: "AI Insights", icon: Sparkles, hiddenFor: ["analyst"] },
      { href: "/actions",  label: "Actions",     icon: Zap,      hiddenFor: [] },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart2, hiddenFor: [] },
      { href: "/reports",   label: "Reports",   icon: FileText,  hiddenFor: [] },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings, hiddenFor: ["analyst", "manager", "hrbp"] },
    ],
  },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { unreadCount } = useAlerts()

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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text leading-tight tracking-tight">NEXUS</p>
          <p className="text-[10px] font-semibold uppercase tracking-widest leading-tight" style={{ color: "var(--subtle)" }}>
            Employee Intelligence
          </p>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="btn-icon w-7 h-7 flex-shrink-0 md:hidden"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(
            item => !item.hiddenFor.includes(user?.role ?? "")
          )
          if (!visibleItems.length) return null

          return (
            <div key={group.label} className="mb-2">
              <p className="nav-group-label" aria-hidden="true">{group.label}</p>

              {visibleItems.map(item => {
                const active = pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href))
                const showBadge = item.href === "/actions" && unreadCount > 0

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? "active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={onClose}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {showBadge && (
                      <span
                        className="badge badge-red px-1.5 py-0.5 text-[10px]"
                        aria-label={`${unreadCount} pending`}
                      >
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User session */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-border" aria-label="User account">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-text truncate leading-tight">{user?.full_name ?? "—"}</p>
            <p className="text-[10px] font-medium capitalize leading-tight" style={{ color: "var(--subtle)" }}>
              {user?.role}
            </p>
          </div>
        </div>
        <button
          onClick={() => { logout(); onClose?.() }}
          className="nav-item w-full text-left"
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
