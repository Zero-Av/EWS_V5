"use client"
import { useState } from "react"
import { Search, Bell, Sparkles, ChevronDown, LogOut, Settings, User, Menu } from "lucide-react"
import { useAuth }           from "@/lib/auth-context"
import { useAlerts }         from "@/lib/hooks/useAlerts"
import { useCommandPalette } from "@/lib/command-palette-context"
import Link from "next/link"

interface TopBarProps {
  onMobileMenuClick?: () => void
  onAIClick?:         () => void
  aiActive?:          boolean
}

export default function TopBar({ onMobileMenuClick, onAIClick, aiActive }: TopBarProps) {
  const { user, logout, isAdmin } = useAuth()
  const { unreadCount }           = useAlerts()
  const { show: showPalette }     = useCommandPalette()
  const [menuOpen, setMenuOpen]   = useState(false)

  const initials = user?.full_name
    ?.split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <header className="topbar" role="banner">

      {/* Mobile hamburger */}
      <button
        className="btn-icon md:hidden flex-shrink-0"
        onClick={onMobileMenuClick}
        aria-label="Toggle navigation"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Search — opens command palette */}
      <button
        onClick={showPalette}
        className="search-wrap flex-1 max-w-md text-left cursor-pointer group"
        aria-label="Open command palette (⌘K)"
      >
        <Search className="w-4 h-4 text-subtle group-hover:text-muted transition-colors" aria-hidden="true" />
        <span className="search-input w-full cursor-pointer text-subtle text-sm select-none group-hover:text-muted transition-colors">
          Search employees, insights, actions…
        </span>
        <kbd
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-surface2 border border-border text-subtle px-1.5 py-0.5 rounded font-mono pointer-events-none hidden sm:block"
          aria-hidden="true"
        >
          ⌘K
        </kbd>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 ml-auto">

        {/* Notifications */}
        <Link
          href="/actions"
          className="btn-icon relative"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
          title="Action Center"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center
                         bg-red text-white text-[9px] font-bold rounded-full border-2 border-surface"
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {/* AI Assistant toggle */}
        <button
          onClick={onAIClick}
          className="btn-icon transition-all"
          style={aiActive
            ? { background: "var(--violet)", borderColor: "var(--violet)", color: "#fff" }
            : { background: "var(--violet-light)", borderColor: "var(--violet-mid)", color: "var(--violet)" }
          }
          aria-label={aiActive ? "Close AI assistant" : "Open AI assistant"}
          aria-pressed={aiActive}
          title="AI Assistant"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-border mx-0.5 hidden sm:block" aria-hidden="true" />

        {/* User menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface2 transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="User menu"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #2563EB, #7C3AED)" }}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-text leading-tight">{user?.full_name}</p>
              <p className="text-[10px] text-muted capitalize">{user?.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted hidden sm:block" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div
                className="absolute right-0 top-full mt-1.5 w-52 bg-surface border border-border rounded-xl z-40 py-1 overflow-hidden"
                style={{ boxShadow: "var(--shadow-modal)" }}
                role="menu"
              >
                <div className="px-3 py-2.5 border-b border-border mb-1 bg-surface2">
                  <p className="text-xs font-bold text-text">{user?.full_name}</p>
                  <p className="text-[10px] text-muted capitalize mt-0.5">{user?.role} · NEXUS Platform</p>
                </div>
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted hover:bg-surface2 hover:text-text transition-colors"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="w-3.5 h-3.5" /> Profile
                </button>
                {isAdmin && (
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted hover:bg-surface2 hover:text-text transition-colors"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </Link>
                )}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-red-light transition-colors"
                    style={{ color: "var(--red)" }}
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); logout() }}
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
