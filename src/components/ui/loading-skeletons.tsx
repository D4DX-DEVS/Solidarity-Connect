import { Skeleton } from "@/components/ui/skeleton";

/** Stacked card rows — lists of members, announcements, notifications, etc. */
function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-[1.2rem] border border-border/60 bg-background/75 p-4 shadow-sm">
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
          <Skeleton className="h-11 w-full rounded-[1rem]" />
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-[1rem]" />
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
        <Skeleton className="h-10 flex-1 rounded-[1rem]" />
        <Skeleton className="h-10 flex-1 rounded-[1rem]" />
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
          <div key={i} className="rounded-[1.2rem] border border-border/60 bg-background/75 p-4 shadow-sm">
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

/** Full-viewport skeleton — route guards / whole-page loads. */
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 pt-8" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
        <DashboardSkeleton />
      </div>
    </div>
  );
}

export { ListSkeleton, FormSkeleton, DetailSkeleton, DashboardSkeleton, PageSkeleton };
