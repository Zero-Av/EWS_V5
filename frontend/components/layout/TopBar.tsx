"use client"
import { useState } from "react"
import { Search, Bell, Sparkles, ChevronDown, LogOut, Settings, User } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useAlerts } from "@/lib/hooks/useAlerts"

export default function TopBar() {
  const { user, logout, isAdmin } = useAuth()
  const { unreadCount } = useAlerts()
  const [menuOpen, setMenuOpen] = useState(false)

  const initials = user?.full_name
    ?.split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?"

  return (
    <header className="topbar" role="banner">
      {/* Search */}
      <div className="search-wrap flex-1 max-w-md">
        <Search className="w-4 h-4 text-subtle" aria-hidden="true" />
        <input
          className="search-input w-full"
          placeholder="Search employees, insights, actions…"
          aria-label="Global search"
          readOnly
          onFocus={e => e.target.blur()} /* placeholder until command palette is built */
        />
        <kbd
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-surface2 border border-border text-subtle px-1.5 py-0.5 rounded font-mono pointer-events-none"
          aria-hidden="true"
        >
          ⌘K
        </kbd>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-auto">

        {/* Notifications */}
        <button
          className="btn-icon relative"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
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
        </button>

        {/* AI Assistant */}
        <button
          className="btn-icon"
          style={{ background: "var(--violet-light)", borderColor: "var(--violet-mid)", color: "var(--violet)" }}
          aria-label="Open AI assistant"
          title="AI Assistant"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-border mx-1" aria-hidden="true" />

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
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-text leading-tight">{user?.full_name}</p>
              <p className="text-[10px] text-muted capitalize">{user?.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-muted hidden md:block" aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-xl z-40 py-1"
                style={{ boxShadow: "var(--shadow-modal)" }}
                role="menu"
              >
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-xs font-semibold text-text">{user?.full_name}</p>
                  <p className="text-[10px] text-muted capitalize">{user?.role}</p>
                </div>
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted hover:bg-surface2 hover:text-text transition-colors"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false) }}
                >
                  <User className="w-3.5 h-3.5" />
                  Profile
                </button>
                {isAdmin && (
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted hover:bg-surface2 hover:text-text transition-colors"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false) }}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                )}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red hover:bg-red-light transition-colors"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); logout() }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
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
