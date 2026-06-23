import AppShell from "@/components/AppShell"
import { TableRowSkeleton } from "@/components/ui/Skeleton"

export default function EmployeesLoading() {
  return (
    <AppShell>
      <div className="page-container space-y-5">
        <div className="page-header">
          <div className="space-y-2">
            <div className="skeleton h-7 w-52 rounded-lg" />
            <div className="skeleton h-4 w-64 rounded" />
          </div>
          <div className="skeleton h-8 w-32 rounded-lg" />
        </div>

        {/* Filter bar */}
        <div className="flex gap-3">
          <div className="skeleton h-9 w-72 rounded-lg" />
          <div className="skeleton h-9 w-64 rounded-lg" />
        </div>

        {/* Table */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Risk Zone</th>
                <th className="text-right">Risk Score</th>
                <th className="text-right">Last Classified</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={6} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
