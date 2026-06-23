"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useCommandPalette } from "@/lib/command-palette-context"
import { useAuth } from "@/lib/auth-context"
import { getClassifications } from "@/lib/api"
import {
  Search, X, LayoutDashboard, Activity, Users, Building2,
  Sparkles, Zap, BarChart2, FileText, Settings,
  ChevronRight, ArrowRight, Shield, Loader2,
} from "lucide-react"

/* ─── Static navigation commands ────────────────────────────── */
interface Command {
  id:       string
  label:    string
  sub?:     string
  icon:     React.ElementType
  iconColor:string
  href:     string
  group:    string
  keywords: string[]
}

const NAV_COMMANDS: Command[] = [
  { id: "dashboard",  label: "Executive Dashboard",  sub: "KPIs · alerts · AI summary",         icon: LayoutDashboard, iconColor: "var(--accent)",  href: "/dashboard",  group: "Navigation", keywords: ["home","overview","executive","kpi"] },
  { id: "workforce",  label: "Workforce Health",     sub: "Zone trends · department matrix",     icon: Activity,        iconColor: "var(--green)",   href: "/workforce",  group: "Navigation", keywords: ["health","trends","department","org"] },
  { id: "employees",  label: "Employee Directory",   sub: "Risk monitoring · all employees",     icon: Users,           iconColor: "var(--accent)",  href: "/employees",  group: "Navigation", keywords: ["employees","directory","list","risk"] },
  { id: "teams",      label: "Teams",                sub: "Team health · manager view",          icon: Building2,       iconColor: "var(--accent)",  href: "/teams",      group: "Navigation", keywords: ["teams","manager","department"] },
  { id: "insights",   label: "AI Insights Center",   sub: "LLM analysis · theme clusters",       icon: Sparkles,        iconColor: "var(--violet)",  href: "/insights",   group: "Navigation", keywords: ["ai","insights","llm","themes","sentiment"] },
  { id: "actions",    label: "Action Center",        sub: "Alerts · resolve interventions",      icon: Zap,             iconColor: "var(--amber)",   href: "/actions",    group: "Navigation", keywords: ["actions","alerts","interventions","resolve"] },
  { id: "analytics",  label: "Analytics",            sub: "Upload surveys · classifier",         icon: BarChart2,       iconColor: "var(--accent)",  href: "/analytics",  group: "Navigation", keywords: ["analytics","charts","survey","upload","classify"] },
  { id: "reports",    label: "Reports & Exports",    sub: "Generate PDF/CSV reports",            icon: FileText,        iconColor: "var(--muted)",   href: "/reports",    group: "Navigation", keywords: ["reports","export","pdf","csv"] },
  { id: "settings",   label: "Settings",             sub: "Users · model · integrations",       icon: Settings,        iconColor: "var(--muted)",   href: "/settings",   group: "Navigation", keywords: ["settings","users","model","llm","integrations"] },
]

const QUICK_ACTIONS: Command[] = [
  { id: "qa-red",    label: "View critical employees", sub: "Filter to RED zone",     icon: Shield, iconColor: "var(--red)",    href: "/employees?zone=RED",   group: "Quick Actions", keywords: ["critical","red","urgent"] },
  { id: "qa-upload", label: "Upload survey data",      sub: "Ingest new CSV",         icon: BarChart2, iconColor: "var(--accent)", href: "/analytics",           group: "Quick Actions", keywords: ["upload","csv","survey","ingest"] },
  { id: "qa-alerts", label: "Resolve alerts",          sub: "Open Action Center",     icon: Zap,    iconColor: "var(--amber)",  href: "/actions",              group: "Quick Actions", keywords: ["alerts","resolve","acknowledge"] },
]

export default function CommandPalette() {
  const { open, hide } = useCommandPalette()
  const { isAdmin }    = useAuth()
  const router         = useRouter()

  const [query,         setQuery]         = useState("")
  const [employees,     setEmployees]     = useState<any[]>([])
  const [empLoading,    setEmpLoading]    = useState(false)
  const [empLoaded,     setEmpLoaded]     = useState(false)
  const [activeIndex,   setActiveIndex]   = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  // Load employees once on first open
  useEffect(() => {
    if (open && !empLoaded) {
      setEmpLoading(true)
      getClassifications()
        .then(r => setEmployees(r.classifications ?? []))
        .catch(() => {})
        .finally(() => { setEmpLoading(false); setEmpLoaded(true) })
    }
  }, [open, empLoaded])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery("")
      setActiveIndex(0)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") hide() }
    if (open) window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, hide])

  const q = query.toLowerCase().trim()

  // Filter nav commands
  const matchedNav = NAV_COMMANDS.filter(c =>
    !q || c.label.toLowerCase().includes(q) ||
    c.keywords.some(k => k.includes(q)) ||
    (c.sub ?? "").toLowerCase().includes(q)
  ).filter(c => c.id !== "settings" || isAdmin)

  // Filter quick actions
  const matchedActions = QUICK_ACTIONS.filter(c =>
    !q || c.label.toLowerCase().includes(q) ||
    c.keywords.some(k => k.includes(q))
  )

  // Filter employees
  const matchedEmps = q.length >= 2
    ? employees.filter(e => e.employee_id.toLowerCase().includes(q)).slice(0, 6)
    : []

  // Flatten for keyboard nav
  const allItems: { href: string; label: string }[] = [
    ...matchedNav.map(c => ({ href: c.href, label: c.label })),
    ...matchedActions.map(c => ({ href: c.href, label: c.label })),
    ...matchedEmps.map(e => ({ href: `/employees/${e.employee_id}`, label: e.employee_id })),
  ]

  const navigate = useCallback((href: string) => {
    hide()
    router.push(href)
  }, [hide, router])

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (allItems[activeIndex]) navigate(allItems[activeIndex].href)
    }
  }

  useEffect(() => { setActiveIndex(0) }, [query])

  if (!open) return null

  let flatIdx = 0
  const renderCommand = (cmd: Command) => {
    const idx     = flatIdx++
    const active  = activeIndex === idx
    return (
      <button
        key={cmd.id}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          active ? "bg-accent-light" : "hover:bg-surface2"
        }`}
        onClick={() => navigate(cmd.href)}
        onMouseEnter={() => setActiveIndex(idx)}
        role="option"
        aria-selected={active}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--surface2)" }}
          aria-hidden="true"
        >
          <cmd.icon className="w-4 h-4" style={{ color: cmd.iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text truncate">{cmd.label}</p>
          {cmd.sub && <p className="text-xs text-muted truncate">{cmd.sub}</p>}
        </div>
        {active && <ArrowRight className="w-3.5 h-3.5 text-accent flex-shrink-0" aria-hidden="true" />}
      </button>
    )
  }

  const renderEmp = (emp: any) => {
    const idx    = flatIdx++
    const active = activeIndex === idx
    const zone   = emp.risk_zone
    const color  = zone === "RED" ? "var(--red)" : zone === "AMBER" ? "var(--amber)" : "var(--green)"
    return (
      <button
        key={emp.employee_id}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
          active ? "bg-accent-light" : "hover:bg-surface2"
        }`}
        onClick={() => navigate(`/employees/${emp.employee_id}`)}
        onMouseEnter={() => setActiveIndex(idx)}
        role="option"
        aria-selected={active}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
          style={{ background: color }}
          aria-hidden="true"
        >
          {emp.employee_id.slice(-2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text font-mono">{emp.employee_id}</p>
          <p className="text-xs" style={{ color }}>
            {zone === "RED" ? "Critical" : zone === "AMBER" ? "Watch" : "Stable"} · {emp.risk_score}% risk
          </p>
        </div>
        {active && <ArrowRight className="w-3.5 h-3.5 text-accent flex-shrink-0" aria-hidden="true" />}
      </button>
    )
  }

  const hasResults = matchedNav.length || matchedActions.length || matchedEmps.length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/30 animate-fade-in"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={hide}
        aria-hidden="true"
      />

      {/* Palette */}
      <div
        className="fixed left-1/2 top-[12vh] -translate-x-1/2 z-50 w-full max-w-xl bg-surface rounded-2xl border border-border overflow-hidden animate-fade-up"
        style={{ boxShadow: "var(--shadow-modal)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search className="w-4 h-4 text-subtle flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-text placeholder-subtle outline-none"
            placeholder="Search pages, employees, actions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Command palette search"
            aria-autocomplete="list"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-subtle hover:text-text transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd
            className="text-[10px] bg-surface2 border border-border text-muted px-1.5 py-0.5 rounded font-mono"
            aria-hidden="true"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          id="palette-results"
          ref={listRef}
          className="overflow-y-auto"
          style={{ maxHeight: "60vh" }}
          role="listbox"
          aria-label="Search results"
        >
          {!hasResults && (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 mx-auto mb-2 text-subtle opacity-40" aria-hidden="true" />
              <p className="text-sm font-semibold text-muted">No results for "{query}"</p>
              <p className="text-xs text-subtle mt-1">Try a page name, employee ID, or action</p>
            </div>
          )}

          {matchedNav.length > 0 && (
            <div>
              <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-subtle border-b border-border"
                style={{ background: "var(--surface2)" }}>
                Navigation
              </p>
              {matchedNav.map(renderCommand)}
            </div>
          )}

          {matchedActions.length > 0 && (
            <div>
              <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-subtle border-b border-border"
                style={{ background: "var(--surface2)" }}>
                Quick Actions
              </p>
              {matchedActions.map(renderCommand)}
            </div>
          )}

          {(matchedEmps.length > 0 || (q.length >= 2 && empLoading)) && (
            <div>
              <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-subtle border-b border-border"
                style={{ background: "var(--surface2)" }}>
                Employees {empLoading && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
              </p>
              {matchedEmps.map(renderEmp)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-4 text-[10px] text-subtle"
          style={{ background: "var(--surface2)" }}>
          <span className="flex items-center gap-1"><kbd className="bg-border px-1 py-0.5 rounded font-mono text-[9px]">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-border px-1 py-0.5 rounded font-mono text-[9px]">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="bg-border px-1 py-0.5 rounded font-mono text-[9px]">ESC</kbd> close</span>
          <span className="ml-auto">NEXUS Search</span>
        </div>
      </div>
    </>
  )
}
