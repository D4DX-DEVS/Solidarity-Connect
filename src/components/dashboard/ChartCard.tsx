import type { ReactNode } from "react";
import { AlertTriangle, BarChart3, RotateCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Data loaded but nothing to plot. */
  empty?: boolean;
  emptyText?: string;
  /** Skeleton height while loading — match the real chart so nothing jumps. */
  skeletonClassName?: string;
  className?: string;
  /** e.g. "p-0" for a table that should run edge to edge. */
  contentClassName?: string;
  children: ReactNode;
}

/** Card frame for one dashboard chart: title row plus loading / error / empty states. */
export function ChartCard({
  title,
  description,
  action,
  loading,
  error,
  onRetry,
  empty,
  emptyText = "Nothing to show yet.",
  skeletonClassName = "h-56",
  className,
  contentClassName,
  children,
}: ChartCardProps) {
  let body: ReactNode = children;
  if (loading) {
    body = <Skeleton className={cn("w-full rounded-xl", skeletonClassName)} />;
  } else if (error) {
    body = (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <AlertTriangle className="size-5 text-destructive" aria-hidden />
        <p className="text-sm text-muted-foreground">Couldn't load this chart.</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="min-h-11 gap-2 sm:min-h-9" onClick={onRetry}>
            <RotateCw className="size-4" aria-hidden /> Retry
          </Button>
        ) : null}
      </div>
    );
  } else if (empty) {
    body = (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <BarChart3 className="size-5 text-muted-foreground" aria-hidden />
        <p className="max-w-xs text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <Card className={cn("flex h-full flex-col rounded-2xl", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-sm font-semibold tracking-tight sm:text-base">{title}</CardTitle>
          {description ? <CardDescription className="text-xs sm:text-sm">{description}</CardDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className={cn("flex-1 p-4 pt-2 sm:p-5 sm:pt-2", !loading && !error && !empty && contentClassName)}>{body}</CardContent>
    </Card>
  );
}
