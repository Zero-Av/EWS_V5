import AppShell from "@/components/AppShell"
import { KpiCardSkeleton, CardSkeleton } from "@/components/ui/Skeleton"

export default function DashboardLoading() {
  return (
    <AppShell>
      <div className="page-container space-y-6">
        {/* Header skeleton */}
        <div className="page-header">
          <div className="space-y-2">
            <div className="skeleton h-7 w-56 rounded-lg" />
            <div className="skeleton h-4 w-80 rounded" />
          </div>
          <div className="skeleton h-8 w-28 rounded-lg" />
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>

        {/* Main panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="card">
              <div className="skeleton h-4 w-48 rounded mb-4" />
              <div className="skeleton h-[200px] w-full rounded-xl" />
              <div className="mt-5 space-y-2.5 pt-4 border-t border-border">
                {[82, 60, 30].map(w => (
                  <div key={w} className="flex items-center gap-3">
                    <div className="skeleton h-3 w-14 rounded" />
                    <div className="skeleton h-2.5 flex-1 rounded-full" />
                    <div className="skeleton h-3 w-8 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <CardSkeleton rows={4} />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CardSkeleton rows={5} />
          <div className="space-y-5">
            <CardSkeleton rows={3} />
            <CardSkeleton rows={2} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
