"use client"
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
  ReferenceLine,
} from "recharts"

/* ─── Design tokens (matches globals.css) ───────────────────── */
export const C = {
  green:  "#16A34A",
  amber:  "#D97706",
  red:    "#DC2626",
  blue:   "#2563EB",
  violet: "#7C3AED",
  cyan:   "#0891B2",
  border: "#E2E8F0",
  subtle: "#94A3B8",
  muted:  "#64748B",
  text:   "#0F172A",
}

export const ZONE_COLOR: Record<string, string> = {
  GREEN: C.green, AMBER: C.amber, RED: C.red,
}

/* ─── Shared tooltip ────────────────────────────────────────── */
export function NexusTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-hover)",
        padding: "8px 12px", fontSize: 12, minWidth: 120,
      }}
    >
      {label && <p style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? C.muted }}>
          <span style={{ opacity: 0.7 }}>{p.name ?? p.dataKey}: </span>
          <span style={{ fontWeight: 700 }}>
            {typeof p.value === "number" && p.value % 1 !== 0
              ? p.value.toFixed(3)
              : p.value}
          </span>
        </p>
      ))}
    </div>
  )
}

/* ─── Shared axis props ─────────────────────────────────────── */
const axisProps = {
  stroke:    C.subtle,
  fontSize:  11,
  tickLine:  false,
  axisLine:  false,
}

/* ═══════════════════════════════════════════════════════════════
   SENTIMENT LINE CHART
   Props: data [{ date, score, label? }], height?
═══════════════════════════════════════════════════════════════ */
interface SentimentPoint { survey_date: string; sentiment_score: number; sentiment_label?: string }
interface SentimentLineChartProps {
  data: SentimentPoint[]
  height?: number
  showZeroLine?: boolean
}

export function SentimentLineChart({ data, height = 180, showZeroLine = true }: SentimentLineChartProps) {
  if (!data?.length) {
    return (
      <div className="chart-empty" style={{ height }} role="img" aria-label="No sentiment data">
        <p className="text-sm">No sentiment history available</p>
      </div>
    )
  }
  return (
    <div
      role="img"
      aria-label={`Sentiment trajectory over ${data.length} surveys, range ${Math.min(...data.map(d => d.sentiment_score)).toFixed(2)} to ${Math.max(...data.map(d => d.sentiment_score)).toFixed(2)}`}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={C.blue} stopOpacity={0.12} />
              <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
          {showZeroLine && (
            <ReferenceLine y={0} stroke={C.subtle} strokeDasharray="4 4" strokeWidth={1} />
          )}
          <XAxis dataKey="survey_date" {...axisProps} />
          <YAxis {...axisProps} domain={[-1, 1]} tickCount={5} />
          <Tooltip content={<NexusTooltip />} />
          <Line
            type="monotone"
            dataKey="sentiment_score"
            name="Sentiment"
            stroke={C.blue}
            strokeWidth={2.5}
            dot={(props: any) => {
              const color =
                props.payload.sentiment_score < -0.1 ? C.red :
                props.payload.sentiment_score <  0.1 ? C.amber : C.green
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />
            }}
            activeDot={{ r: 6, fill: C.blue }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ZONE AREA TREND CHART
   Props: data [{ month, GREEN, AMBER, RED }], height?
═══════════════════════════════════════════════════════════════ */
interface ZoneTrendPoint { month: string; GREEN: number; AMBER: number; RED: number }
export function ZoneTrendChart({ data, height = 220 }: { data: ZoneTrendPoint[]; height?: number }) {
  if (!data?.length) {
    return <div className="chart-empty" style={{ height }} aria-label="No zone trend data"><p className="text-sm">Run the classifier to see trends</p></div>
  }
  return (
    <div role="img" aria-label="Risk zone distribution trend over time">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            {[["gGreen", C.green], ["gAmber", C.amber], ["gRed", C.red]].map(([id, color]) => (
              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip content={<NexusTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Area type="monotone" dataKey="GREEN"   stroke={C.green} strokeWidth={2} fill="url(#gGreen)" />
          <Area type="monotone" dataKey="AMBER"    stroke={C.amber} strokeWidth={2} fill="url(#gAmber)" />
          <Area type="monotone" dataKey="RED" stroke={C.red}   strokeWidth={2} fill="url(#gRed)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TOPIC RADAR CHART
   Props: data [{ topic, score }], height?
═══════════════════════════════════════════════════════════════ */
interface TopicPoint { topic: string; score: number }
export function TopicRadarChart({ data, height = 240 }: { data: TopicPoint[]; height?: number }) {
  if (!data?.length) {
    return <div className="chart-empty" style={{ height }} aria-label="No topic data"><p className="text-sm">No topic data available</p></div>
  }
  const normalised = data.map(d => ({ ...d, score: Math.round((d.score + 1) * 50) }))
  return (
    <div role="img" aria-label="Topic sentiment radar chart">
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={normalised} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke={C.border} />
          <PolarAngleAxis dataKey="topic" tick={{ fontSize: 11, fill: C.muted }} />
          <Radar
            name="Sentiment"
            dataKey="score"
            stroke={C.violet}
            fill={C.violet}
            fillOpacity={0.18}
            strokeWidth={2}
          />
          <Tooltip content={<NexusTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SHAP WATERFALL / HORIZONTAL BAR CHART
   Props: features [{ feature, shap_value }], height?
═══════════════════════════════════════════════════════════════ */
interface ShapFeature { feature: string; shap_value: number }
export function ShapWaterfallChart({ features, height = 220 }: { features: ShapFeature[]; height?: number }) {
  if (!features?.length) {
    return <div className="chart-empty" style={{ height }} aria-label="No SHAP data"><p className="text-sm">No feature importance data</p></div>
  }
  const sorted = [...features].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value)).slice(0, 8)
  return (
    <div role="img" aria-label="SHAP feature importances for risk prediction">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={v => v.toFixed(2)} />
          <YAxis type="category" dataKey="feature" {...axisProps} width={130} tick={{ fontSize: 10 }} />
          <Tooltip content={<NexusTooltip />} />
          <ReferenceLine x={0} stroke={C.subtle} strokeWidth={1.5} />
          <Bar dataKey="shap_value" name="SHAP value" radius={[0, 4, 4, 0]}>
            {sorted.map((f, i) => (
              <Cell key={i} fill={f.shap_value > 0 ? C.red : C.green} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   RISK SCORE DONUT
   Props: distribution { GREEN, AMBER, RED }
═══════════════════════════════════════════════════════════════ */
import { PieChart, Pie } from "recharts"

export function RiskDonutChart({ distribution, height = 200 }: {
  distribution: Record<string, number>; height?: number
}) {
  const data = [
    { name: "GREEN",   value: distribution.GREEN ?? 0, color: C.green },
    { name: "AMBER",    value: distribution.AMBER ?? 0, color: C.amber },
    { name: "RED", value: distribution.RED   ?? 0, color: C.red   },
  ].filter(d => d.value > 0)

  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <div className="chart-empty" style={{ height }} aria-label="No distribution data"><p className="text-sm">No data</p></div>

  return (
    <div role="img" aria-label={`Risk distribution: ${data.map(d => `${d.name} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={height * 0.25}
            outerRadius={height * 0.38}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<NexusTooltip />} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
