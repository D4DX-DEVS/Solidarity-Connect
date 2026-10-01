import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardOverview } from "@/hooks/useDashboardOverview";
import { ChartCard } from "./ChartCard";

// recharts is heavy and this is the only chart on the dashboards — load it on
// demand so it stays out of the main bundle (PWA precache caps entry at 2 MiB).
const ActivityTrendChart = lazy(() => import("./ActivityTrendChart"));

interface ActivityCardProps {
  overview: DashboardOverview | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  className?: string;
}

/** Recurring targets marked done by admins in scope over the last 6 months. */
export function ActivityCard({ overview, loading, error, onRetry, className }: ActivityCardProps) {
  const total = overview?.activity.months.reduce((sum, m) => sum + m.completed, 0) ?? 0;
  const latest = overview?.activity.months.at(-1);
  return (
    <ChartCard
      className={className}
      title="Target activity"
      description={overview ? `${total} targets marked done by admins in 6 months${latest ? ` · ${latest.completed} in ${latest.label}` : ""}` : undefined}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={!!overview && total === 0}
      emptyText="No admin here has marked a recurring target done in the last 6 months."
      skeletonClassName="h-52"
    >
      {overview ? (
        <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
          <ActivityTrendChart months={overview.activity.months} />
        </Suspense>
      ) : null}
    </ChartCard>
  );
}
