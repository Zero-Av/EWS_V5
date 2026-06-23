import AppShell from "@/components/AppShell"
import { KpiCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton"

export default function GenericLoading() {
  return (
    <AppShell>
      <div className="page-container space-y-6">
        {/* Page header */}
        <div className="page-header">
          <div className="space-y-2">
            <div className="skeleton h-7 w-48 rounded-lg" />
            <div className="skeleton h-4 w-72 rounded" />
          </div>
          <div className="skeleton h-8 w-24 rounded-lg" />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>

        {/* Content panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card">
            <div className="skeleton h-4 w-40 rounded mb-4" />
            <div className="skeleton h-[200px] w-full rounded-xl" />
          </div>
          <CardSkeleton rows={5} />
        </div>

        <CardSkeleton rows={4} />
      </div>
    </AppShell>
  )
}
