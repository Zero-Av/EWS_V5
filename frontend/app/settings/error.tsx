"use client"
import { useEffect } from "react"
import AppShell from "@/components/AppShell"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[NEXUS] Route error:", error)
  }, [error])

  return (
    <AppShell>
      <div className="page-container flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-md animate-fade-up">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "var(--red-light)" }}
            aria-hidden="true"
          >
            <AlertTriangle className="w-8 h-8" style={{ color: "var(--red)" }} />
          </div>

          <h1 className="text-xl font-extrabold text-text mb-2">Failed to load this page</h1>
          <p className="text-sm text-muted mb-2">
            Something went wrong while loading this view. Your data is safe — try refreshing or navigate to another page.
          </p>

          {error.digest && (
            <p className="font-mono text-[11px] text-subtle mb-6 bg-surface2 border border-border rounded-lg px-3 py-2">
              Error ID: {error.digest}
            </p>
          )}

          {!error.digest && error.message && (
            <p className="font-mono text-[11px] text-subtle mb-6 bg-surface2 border border-border rounded-lg px-3 py-2 text-left">
              {error.message}
            </p>
          )}

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={reset}
              className="btn-primary btn-md"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
            <Link href="/dashboard" className="btn-ghost btn-md">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
