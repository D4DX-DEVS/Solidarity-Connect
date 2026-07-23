import { Skeleton } from "@/components/ui/skeleton";

/** Stacked card rows — lists of members, announcements, notifications, etc. */
function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-background/75 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Label + input pairs — add/edit forms. */
function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading form">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

/** Title, meta line, and paragraph blocks — detail views. */
function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading details">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

/** Stat cards grid + list — dashboards. */
function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-background/75 p-4 shadow-sm">
            <Skeleton className="mb-3 h-8 w-8 rounded-full" />
            <Skeleton className="mb-2 h-6 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <ListSkeleton rows={3} />
    </div>
  );
}

/** Full-page skeleton mirroring the dashboard layout — route guards / whole-page loads.
    Rendered inside .app-page so the persistent sidebar/offset stay in place while loading. */
function PageSkeleton() {
  return (
    <div className="app-page" aria-busy="true" aria-label="Loading page">
      <main className="app-main">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="hidden gap-2 sm:flex">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-10 w-10 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5">
              <Skeleton className="mb-1.5 h-5 w-36" />
              <Skeleton className="mb-4 h-3.5 w-48" />
              <ListSkeleton rows={3} />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="mb-1.5 h-5 w-32" />
          <Skeleton className="mb-4 h-3.5 w-44" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export { ListSkeleton, FormSkeleton, DetailSkeleton, DashboardSkeleton, PageSkeleton };
