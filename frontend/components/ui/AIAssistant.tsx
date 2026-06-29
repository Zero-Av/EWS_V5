"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { askAssistant } from "@/lib/api"
import { Sparkles, X, Send, RefreshCw, Brain, ChevronDown } from "lucide-react"

interface Message {
  id:      number
  role:    "user" | "assistant"
  content: string
  loading?: boolean
}

const SUGGESTED = [
  "Summarise today's workforce health",
  "Which teams need immediate attention?",
  "What are the top risk factors this week?",
  "Generate an executive briefing",
]

let _mid = 0

export default function AIAssistant({
  open,
  onClose,
}: {
  open:    boolean
  onClose: () => void
}) {
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [minimised, setMinimised] = useState(false)
  const endRef  = useRef<HTMLDivElement>(null)
  const inputRef= useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open && !minimised) inputRef.current?.focus()
  }, [open, minimised])

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose() }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [open, onClose])

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput("")

    const userMsg: Message = { id: ++_mid, role: "user", content }
    const loadMsg: Message = { id: ++_mid, role: "assistant", content: "", loading: true }
    setMessages(prev => [...prev, userMsg, loadMsg])
    setLoading(true)

    try {
      // Send the user's actual message to the backend, which grounds the
      // LLM in a live data snapshot (KPIs, risk zones, alerts, teams) and
      // answers the specific question that was asked.
      const res = await askAssistant(content)
      const reply = res.answer || "I couldn't generate a response. Please check the LLM connection in Settings → Integrations."
      setMessages(prev => prev.map(m => m.id === loadMsg.id ? { ...m, content: reply, loading: false } : m))
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === loadMsg.id
          ? { ...m, content: err?.message || "⚠ Could not reach the AI service. Check Settings → Integrations to connect an LLM.", loading: false }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }, [input, loading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className="fixed inset-0 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col rounded-2xl border overflow-hidden animate-slide-left"
        style={{
          width: "min(400px, calc(100vw - 40px))",
          height: minimised ? "auto" : "min(580px, calc(100vh - 120px))",
          background: "var(--surface)",
          borderColor: "var(--violet-mid)",
          boxShadow: "var(--shadow-modal)",
        }}
        role="dialog"
        aria-label="AI Assistant"
        aria-modal="true"
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0"
          style={{ background: "var(--violet-light)", borderColor: "var(--violet-mid)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--violet)" }}
            aria-hidden="true"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-text leading-tight">NEXUS AI Assistant</p>
            <p className="text-[10px] font-medium" style={{ color: "var(--violet)" }}>
              Powered by your connected LLM
            </p>
          </div>
          <button
            onClick={() => setMinimised(v => !v)}
            className="btn-icon w-7 h-7 flex-shrink-0"
            aria-label={minimised ? "Expand assistant" : "Minimise assistant"}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${minimised ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="btn-icon w-7 h-7 flex-shrink-0"
            aria-label="Close AI assistant"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {!minimised && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                  <Brain className="w-10 h-10 mb-3 text-violet opacity-60" aria-hidden="true" />
                  <p className="text-sm font-semibold text-text mb-1">Ask about your Employee</p>
                  {/* <p className="text-xs text-muted mb-5 max-w-xs">
                    I can analyse sentiment trends, summarise risk patterns, and recommend actions.
                  </p> */}
                  <div className="space-y-2 w-full" role="list" aria-label="Suggested questions">
                    {SUGGESTED.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border hover:bg-surface2 hover:border-accent transition-all text-muted hover:text-text"
                        role="listitem"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(m => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-1"
                      style={{ background: "var(--violet)", flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] px-3 py-2.5 rounded-xl text-xs leading-relaxed ${
                      m.role === "user"
                        ? "text-white rounded-br-sm"
                        : "text-text rounded-bl-sm border border-border"
                    }`}
                    style={{
                      background: m.role === "user" ? "var(--accent)" : "var(--surface2)",
                    }}
                  >
                    {m.loading ? (
                      <span className="flex items-center gap-2 text-muted">
                        <RefreshCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                        Analysing…
                      </span>
                    ) : m.content}
                  </div>
                </div>
              ))}
              <div ref={endRef} aria-hidden="true" />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-3 border-t border-border">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about workforce health, risk trends, or actions…"
                  className="flex-1 input resize-none text-xs"
                  style={{ minHeight: 36, maxHeight: 100 }}
                  rows={1}
                  disabled={loading}
                  aria-label="Message input"
                />
                <button
                  onClick={() => send()}
                  disabled={!input.trim() || loading}
                  className="btn-violet btn-sm w-9 h-9 flex-shrink-0 p-0 flex items-center justify-center"
                  aria-label="Send message"
                >
                  {loading
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
              <p className="text-[10px] text-subtle mt-1.5 text-center">
                Press Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
