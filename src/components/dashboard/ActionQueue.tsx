import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, RotateCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ActionSeverity = "urgent" | "review" | "upcoming";

export interface ActionItem {
  key: string;
  severity: ActionSeverity;
  icon: LucideIcon;
  title: string;
  detail: string;
  /** Big number on the right; omit for one-off items like a meeting. */
  count?: number;
  cta: string;
  /** Route to open, or a handler (e.g. scroll to the scorecard). */
  to: string | (() => void);
}

// Status colours never carry meaning alone — each severity also has a label + icon.
const SEVERITY: Record<ActionSeverity, { label: string; icon: LucideIcon; rail: string; chip: string; tile: string }> = {
  urgent: {
    label: "Urgent",
    icon: AlertTriangle,
    rail: "bg-destructive",
    chip: "bg-destructive/10 text-destructive",
    tile: "bg-destructive/10 text-destructive",
  },
  review: {
    label: "Review",
    icon: Clock3,
    rail: "bg-warning",
    chip: "bg-warning/15 text-amber-700 dark:text-amber-400",
    tile: "bg-warning/15 text-amber-600 dark:text-amber-400",
  },
  upcoming: {
    label: "Upcoming",
    icon: CalendarClock,
    rail: "bg-info",
    chip: "bg-info/10 text-info",
    tile: "bg-info/10 text-info",
  },
};

const ORDER: ActionSeverity[] = ["urgent", "review", "upcoming"];

interface ActionQueueProps {
  items: ActionItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  className?: string;
}

/**
 * "Needs your action": every open item for this admin, most urgent first, each
 * with one button that goes straight to where it gets resolved.
 */
export function ActionQueue({ items, loading, error, onRetry, className }: ActionQueueProps) {
  const navigate = useNavigate();
  const sorted = [...items].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  const openCount = items.filter((i) => i.severity !== "upcoming").length;

  const run = (to: ActionItem["to"]) => (typeof to === "string" ? navigate(to) : to());

  return (
    <Card className={cn("flex h-full flex-col overflow-hidden rounded-2xl", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight sm:text-base">Needs your action</h2>
          <p className="text-xs text-muted-foreground">Most urgent first</p>
        </div>
        {!loading && !error ? (
          <span
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2.5 text-xs font-bold tabular-nums",
              openCount > 0 ? "bg-primary text-primary-foreground" : "bg-success/10 text-success",
            )}
            aria-label={`${openCount} open items`}
          >
            {openCount}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-3 p-4 sm:p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="size-5 text-destructive" aria-hidden />
          <p className="text-sm text-muted-foreground">Couldn't load your queue.</p>
          {onRetry ? (
            <Button variant="outline" size="sm" className="min-h-11 gap-2 sm:min-h-9" onClick={onRetry}>
              <RotateCw className="size-4" aria-hidden /> Retry
            </Button>
          ) : null}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-foreground">You're all caught up</p>
          <p className="max-w-[16rem] text-xs text-muted-foreground">No approvals, gaps or meetings waiting on you right now.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {sorted.map((item, i) => {
            const sev = SEVERITY[item.severity];
            const SevIcon = sev.icon;
            return (
              <li
                key={item.key}
                className="relative animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", sev.rail)} aria-hidden />
                <button
                  type="button"
                  onClick={() => run(item.to)}
                  className="group flex w-full items-center gap-3 py-3 pl-5 pr-4 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:pr-5"
                >
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", sev.tile)}>
                    <item.icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-0.5 flex items-center gap-1.5">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", sev.chip)}>
                        <SevIcon className="size-3" aria-hidden />
                        {sev.label}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  {item.count !== undefined ? (
                    <span className="shrink-0 text-xl font-bold tabular-nums text-foreground">{item.count}</span>
                  ) : null}
                  <span className="hidden shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary sm:inline-flex">
                    {item.cta} <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground sm:hidden" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
