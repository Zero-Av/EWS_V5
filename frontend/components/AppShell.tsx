"use client"
import { useState } from "react"
import { ReactNode } from "react"
import Sidebar        from "@/components/layout/Sidebar"
import TopBar         from "@/components/layout/TopBar"
import ToastContainer from "@/components/ui/ToastContainer"
import CommandPalette from "@/components/ui/CommandPalette"
import AIAssistant    from "@/components/ui/AIAssistant"
import { Menu, X }   from "lucide-react"

interface AppShellProps {
  children: ReactNode
  activeTab?:    string
  onTabChange?:  (tab: string) => void
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [aiOpen,        setAiOpen]        = useState(false)

  return (
    <div className="app-layout relative">

      {/* ── Mobile nav overlay ────────────────────────────────── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden animate-fade-in"
          style={{ backdropFilter: "blur(2px)" }}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <div
        className={`
          fixed md:static inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out
          ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <Sidebar onClose={() => setMobileNavOpen(false)} />
      </div>

      {/* ── Main area ─────────────────────────────────────────── */}
      <div className="main-content flex flex-col min-w-0">
        <TopBar
          onMobileMenuClick={() => setMobileNavOpen(v => !v)}
          onAIClick={() => setAiOpen(v => !v)}
          aiActive={aiOpen}
        />

        {/* Mobile menu toggle button (visible only on small screens) */}
        <button
          className="fixed bottom-5 left-5 z-30 md:hidden w-11 h-11 rounded-xl bg-accent text-white shadow-lg flex items-center justify-center"
          onClick={() => setMobileNavOpen(v => !v)}
          aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileNavOpen}
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <main
          id="main-content"
          className="flex-1 overflow-auto"
          aria-label="Main content"
        >
          {children}
        </main>
      </div>

      {/* ── Global overlays ───────────────────────────────────── */}
      <ToastContainer />
      <CommandPalette />
      <AIAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  )
}
