import clsx from "clsx"

const MAP: Record<string, string> = {
  GREEN:    "badge-green",
  AMBER:    "badge-amber",
  RED:      "badge-red",
  CRITICAL: "badge-red",
  HIGH:     "badge-amber",
  MEDIUM:   "badge-blue",
  LOW:      "badge-green",
  "—":      "font-mono text-xs text-muted px-2",
}

export default function RiskBadge({ label }: { label: string }) {
  const cls = MAP[label] ?? "badge-blue"
  return <span className={cls}>{label}</span>
}
