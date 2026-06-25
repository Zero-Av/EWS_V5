import { ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react"

type Zone = "GREEN" | "AMBER" | "RED" | "STABLE" | "WATCH" | "CRITICAL" | string

interface RiskBadgeProps {
  zone: Zone
  score?: number
  showScore?: boolean
  size?: "sm" | "md"
}

const CONFIG: Record<string, {
  cls: string
  icon: React.ReactNode
  label: string
}> = {
  GREEN: {
    cls: "risk-stable",
    icon: <ShieldCheck className="w-3 h-3" aria-hidden="true" />,
    label: "Stable",
  },
  STABLE: {
    cls: "risk-stable",
    icon: <ShieldCheck className="w-3 h-3" aria-hidden="true" />,
    label: "Stable",
  },
  AMBER: {
    cls: "risk-watch",
    icon: <AlertTriangle className="w-3 h-3" aria-hidden="true" />,
    label: "Watch",
  },
  WATCH: {
    cls: "risk-watch",
    icon: <AlertTriangle className="w-3 h-3" aria-hidden="true" />,
    label: "Watch",
  },
  RED: {
    cls: "risk-critical",
    icon: <ShieldAlert className="w-3 h-3" aria-hidden="true" />,
    label: "Critical",
  },
  CRITICAL: {
    cls: "risk-critical",
    icon: <ShieldAlert className="w-3 h-3" aria-hidden="true" />,
    label: "Critical",
  },
}

export default function RiskBadge({ zone, score, showScore = false }: RiskBadgeProps) {
  const cfg = CONFIG[zone] ?? {
    cls: "badge badge-gray",
    icon: null,
    label: zone,
  }

  const ariaLabel = `${cfg.label} risk zone${score !== undefined ? `, score ${score}%` : ""}`

  return (
    <span className={cfg.cls} aria-label={ariaLabel} role="status">
      {cfg.icon}
      {cfg.label}
      {showScore && score !== undefined && (
        <span className="font-mono ml-0.5">{score}%</span>
      )}
    </span>
  )
}
