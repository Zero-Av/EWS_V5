import Link from "next/link"
import { FileQuestion } from "lucide-react"

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "var(--surface2)" }}
        aria-hidden="true"
      >
        <FileQuestion className="w-8 h-8 text-muted" />
      </div>
      <h1 className="text-2xl font-extrabold text-text mb-2">Page not found</h1>
      <p className="text-sm text-muted max-w-sm mb-8">
        The page you're looking for doesn't exist or has been moved to a new location.
      </p>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Link href="/dashboard" className="btn-primary btn-md">
          Go to Dashboard
        </Link>
        <Link href="/employees" className="btn-ghost btn-md">
          Employee Directory
        </Link>
      </div>
      <p className="text-xs text-subtle mt-8">NEXUS Employee Intelligence Platform</p>
    </div>
  )
}
