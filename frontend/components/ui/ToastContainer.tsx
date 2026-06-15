"use client"
import { useToast } from "@/lib/toast-context"
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react"

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-green flex-shrink-0" />,
  error:   <XCircle    className="w-4 h-4 text-red   flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber flex-shrink-0" />,
  info:    <Info       className="w-4 h-4 text-accent flex-shrink-0" />,
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()
  if (!toasts.length) return null

  return (
    <div
      className="toast-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          role="alert"
        >
          {ICONS[t.type]}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-text">{t.title}</p>
            {t.message && <p className="text-xs text-muted mt-0.5">{t.message}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="flex-shrink-0 p-1 rounded-md text-muted hover:text-text transition-colors ml-2"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
