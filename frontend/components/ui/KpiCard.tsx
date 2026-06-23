import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface DeltaProps {
  value: number
  label?: string
}

export function Delta({ value, label }: DeltaProps) {
  if (value === 0 || value === undefined || value === null) {
    return (
      <span className="kpi-delta-flat">
        <Minus className="w-3 h-3" aria-hidden="true" />
        {label ?? "No change"}
      </span>
    )
  }
  if (value > 0) {
    return (
      <span className="kpi-delta-up">
        <TrendingUp className="w-3 h-3" aria-hidden="true" />
        +{value} {label}
      </span>
    )
  }
  return (
    <span className="kpi-delta-down">
      <TrendingDown className="w-3 h-3" aria-hidden="true" />
      {value} {label}
    </span>
  )
}

type ChipColor = "blue" | "green" | "amber" | "red" | "violet"

interface KpiCardProps {
  label: string
  value: string | number
  delta?: DeltaProps
  sub?: string
  icon: LucideIcon
  iconColor?: ChipColor
  valueColor?: string
}

const CHIP_CLS: Record<ChipColor, string> = {
  blue:   "icon-chip icon-chip-blue   text-accent",
  green:  "icon-chip icon-chip-green  text-green",
  amber:  "icon-chip icon-chip-amber  text-amber",
  red:    "icon-chip icon-chip-red    text-red",
  violet: "icon-chip icon-chip-violet text-violet",
}

export default function KpiCard({ label, value, delta, sub, icon: Icon, iconColor = "blue", valueColor }: KpiCardProps) {
  return (
    <div className="kpi-card" role="region" aria-label={label}>
      <div className="flex items-start justify-between mb-3">
        <span className="kpi-label">{label}</span>
        <div className={CHIP_CLS[iconColor]} aria-hidden="true">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div
        className="kpi-val mb-1.5"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {delta && <Delta value={delta.value} label={delta.label} />}
      {sub && !delta && (
        <span className="text-xs text-muted">{sub}</span>
      )}
    </div>
  )
}
