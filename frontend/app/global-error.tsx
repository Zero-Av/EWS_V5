"use client"
import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // In production, send to error tracking (Sentry, etc.)
    console.error("[NEXUS] Unhandled error:", error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
          style={{ background: "#F8FAFC" }}
        >
          <div
            style={{
              width: 64, height: 64, borderRadius: 16,
              background: "#FFF1F2", display: "flex",
              alignItems: "center", justifyContent: "center",
              marginBottom: 24,
            }}
            aria-hidden="true"
          >
            <AlertTriangle style={{ width: 32, height: 32, color: "#DC2626" }} />
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", maxWidth: 380, marginBottom: 8 }}>
            An unexpected error occurred in NEXUS. Your data is safe — this error has been logged.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#94A3B8", marginBottom: 24 }}>
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 10,
                background: "#2563EB", color: "#fff",
                border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
              }}
            >
              <RefreshCw style={{ width: 14, height: 14 }} />
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 10,
                background: "#F8FAFC", color: "#334155",
                border: "1px solid #E2E8F0", cursor: "pointer",
                fontSize: 13, fontWeight: 600, textDecoration: "none",
              }}
            >
              <Home style={{ width: 14, height: 14 }} />
              Go to Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
