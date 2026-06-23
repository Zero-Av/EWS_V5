interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: "sm" | "md" | "lg" | "full"
}

export function Skeleton({ className = "", width, height, rounded = "md" }: SkeletonProps) {
  const r = { sm: "rounded", md: "rounded-lg", lg: "rounded-xl", full: "rounded-full" }[rounded]
  return (
    <div
      className={`skeleton ${r} ${className}`}
      style={{ width, height: height || "1rem" }}
      aria-hidden="true"
    />
  )
}

export function KpiCardSkeleton() {
  return (
    <div className="kpi-card" aria-busy="true">
      <div className="flex items-center justify-between mb-3">
        <Skeleton width={80} height={10} />
        <Skeleton width={36} height={36} rounded="lg" />
      </div>
      <Skeleton width={64} height={28} className="mb-2" />
      <Skeleton width={100} height={10} />
    </div>
  )
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <Skeleton height={12} width={i === 0 ? 120 : i === cols - 1 ? 60 : 90} />
        </td>
      ))}
    </tr>
  )
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card space-y-3" aria-busy="true">
      <Skeleton width="40%" height={14} />
      <Skeleton width="70%" height={11} />
      <div className="h-px bg-border my-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <Skeleton width="50%" height={11} />
          <Skeleton width={60} height={11} />
        </div>
      ))}
    </div>
  )
}
