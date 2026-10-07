import { lazy, Suspense, useId, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarClock, CheckCircle2, Minus, Search, UserPlus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DashboardOverview, DashboardReport, MembershipTrendPoint, RecentActivityItem } from "@/hooks/useDashboardOverview";
import { cn } from "@/lib/utils";
import { ChartCard } from "./ChartCard";
import { formatNumber, percent, STATUS_COLOR, STATUS_LABEL, type MemberStatusKey } from "./chartTheme";
import { daysLeft, deadlineLabel, reportLink, reportMonthName, reportMonthShort, timeLeftLabel } from "./reportStatus";

// recharts is heavy — lazy so it stays out of the main bundle (PWA precache caps entry at 2 MiB).
const MembershipTrendChart = lazy(() => import("./MembershipTrendChart"));
const DonutChart = lazy(() => import("./DonutChart"));

/** Shared state for every card fed by GET /reports/overview. */
interface OverviewCardProps {
  overview: DashboardOverview | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Toolbar: monthly report chip + member search                       */
/* ------------------------------------------------------------------ */

/** The viewer's own report as a word: in, locked (deadline passed), time left once the month is over, else the due date. */
function reportChipStatus(report: DashboardReport): { text: string; tone: string } {
  if (report.own?.submitted) return { text: "Submitted", tone: "text-success" };
  if (daysLeft(report.deadline) < 0) return { text: "Locked", tone: "text-muted-foreground" };
  if (report.closing) return { text: timeLeftLabel(report.deadline), tone: "text-amber-700 dark:text-amber-400" };
  return { text: `Due ${deadlineLabel(report.deadline)}`, tone: "text-foreground" };
}

/** The month's report this dashboard tracks, with the viewer's own status. Opens that month on Reports. */
function ReportChip({ report }: { report?: DashboardReport }) {
  const navigate = useNavigate();
  const submitted = report?.own?.submitted;
  const Icon = submitted ? CheckCircle2 : CalendarClock;
  const status = report ? reportChipStatus(report) : null;
  return (
    <button
      type="button"
      disabled={!report}
      onClick={() => report && navigate(reportLink(report, "mine"))}
      title={report ? `${reportMonthName(report)} ${report.year} report · due ${deadlineLabel(report.deadline)}` : undefined}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
    >
      <Icon className={cn("h-4 w-4", submitted && "text-success")} aria-hidden />
      {report && status ? (
        <>
          <span className="whitespace-nowrap font-semibold text-foreground">
            {reportMonthShort(report)}<span className="sr-only sm:not-sr-only"> {report.year} report</span>
          </span>
          <span aria-hidden>·</span>
          <span className={cn("whitespace-nowrap font-semibold", status.tone)}>{status.text}</span>
        </>
      ) : <span className="font-semibold text-foreground">…</span>}
    </button>
  );
}

/**
 * One row at every width (report chip + search), so phones don't spend two rows on it.
 * The chip is left out when the API has no report status (older API) once loaded.
 */
export function DashboardToolbar({ report, loading }: { report?: DashboardReport; loading?: boolean }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const submit = () => {
    const q = search.trim();
    navigate(q ? `/members?search=${encodeURIComponent(q)}` : "/members");
  };
  return (
    <div className="flex items-center gap-2">
      {report || loading ? <ReportChip report={report} /> : null}
      <form
        className="relative min-w-0 flex-1"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        role="search"
        aria-label="Search members"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          aria-label="Search members by name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isMobile ? "Search members…" : "Search members by name or phone…"}
          className="min-h-11 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-ring"
        />
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI card with sparkline + 30-day growth pill (mobile: 2-col grid)    */
/* ------------------------------------------------------------------ */

export interface KpiSparkProps {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "neutral" | "muted";
  /** Small series drawn under the value; omit when there is no real history. */
  spark?: number[];
  sparkColor?: string;
  /** Backend-measured trailing-window growth (overview.deltas.*); omit to hide the pill. */
  delta?: { added: number; pct: number | null };
  deltaWindowDays?: number;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}

const TONE_TILE: Record<KpiSparkProps["tone"], string> = {
  primary: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-amber-600 dark:text-amber-400",
  neutral: "bg-[#7c5cff]/10 text-[#7c5cff]",
  // Records kept for reference, not current activity (archives)
  muted: "bg-muted text-muted-foreground",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const id = `spark${useId().replace(/:/g, "")}`;
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data);
    const min = Math.min(...data);
    const span = max - min || 1;
    return data
      .map((v, i) => `${((i / (data.length - 1)) * 120).toFixed(1)},${(25 - ((v - min) / span) * 22).toFixed(1)}`)
      .join(" ");
  }, [data]);
  if (data.length < 2) return null;
  return (
    <svg viewBox="0 0 120 28" className="h-6 w-full" aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={`0,28 ${points} 120,28`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Growth pill. Counts only ever grow (nothing tracks removals), so it is "0%"
 * or up. With no prior total — or a large batch add that makes the percent
 * meaningless (e.g. 142000%) — it shows the added count instead.
 */
function DeltaPill({ added, pct, windowDays }: { added: number; pct: number | null; windowDays: number }) {
  const tip = `${formatNumber(added)} added in the last ${windowDays} days`;
  if (added === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-[11px]" title={tip}>
        <Minus className="h-3 w-3" aria-hidden /> 0%
        <span className="sr-only">, {tip}</span>
      </span>
    );
  }
  // Rounded 0% (1 added to 1,000) and large-batch percents both read better as the count.
  const label = pct !== null && pct > 0 && pct <= 999 ? `${pct}%` : `+${formatNumber(added)}`;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-success sm:text-[11px]" title={tip}>
      <ArrowUpRight className="h-3 w-3" aria-hidden /> {label}
      <span className="sr-only">, {tip}</span>
    </span>
  );
}

export function KpiSparkCard({ title, value, detail, icon: Icon, tone, spark, sparkColor = "#2a78d6", delta, deltaWindowDays = 30, loading, onClick, className }: KpiSparkProps) {
  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={cn(
        "h-full rounded-2xl",
        className,
        onClick && "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex h-full flex-col p-3 sm:p-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : (
          <>
            <div className="flex min-h-8 items-center gap-2">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9", TONE_TILE[tone])}>
                <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
              </span>
              <p className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">{title}</p>
            </div>
            {/* Value and growth pill share a row; the caption gets its own line so the two never read as one phrase */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate text-xl font-bold tabular-nums tracking-tight sm:text-2xl">{value}</p>
              {delta ? <DeltaPill added={delta.added} pct={delta.pct} windowDays={deltaWindowDays} /> : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">{detail}</p>
            {/* Fixed-height slot: bottoms stay aligned whether or not a card has a sparkline */}
            <div className="mt-auto h-7 pt-1">
              {spark && spark.length > 1 ? <Sparkline data={spark} color={sparkColor} /> : null}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Membership trend — running total since records began (max 12 months) */
/* ------------------------------------------------------------------ */

/** "2026-10" key + "Oct" label → "Oct 2026". */
const monthYear = (p: MembershipTrendPoint) => `${p.label} ${p.key.slice(0, 4)}`;

/** Rendered only once `hasTrend` (or to show a load error with Retry). */
export function MembershipTrendCard({ points, error, onRetry, className }: {
  points: MembershipTrendPoint[];
  error: boolean;
  onRetry: () => void;
  className?: string;
}) {
  const data = points.map((p) => ({ label: p.label, value: p.total, added: p.added }));
  const first = points[0];
  const latest = points.at(-1);
  const description = !first || points.length >= 12
    ? "Monthly member growth over the last 12 months"
    : `Total members by month since records began in ${monthYear(first)}`;
  return (
    <ChartCard
      className={className}
      title="Membership Trend"
      description={description}
      action={latest ? (
        <span className="hidden rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold text-foreground sm:block">
          {latest.label} · {formatNumber(latest.total)}
        </span>
      ) : undefined}
      error={error}
      onRetry={onRetry}
      contentClassName="flex flex-col"
    >
      {/* Fills whatever height the row gives it (min 14–16rem), so no dead space under the chart */}
      <div className="relative min-h-56 flex-1 sm:min-h-64">
        <Suspense fallback={<Skeleton className="absolute inset-0 rounded-xl" />}>
          <MembershipTrendChart data={data} className="absolute inset-0" />
        </Suspense>
      </div>
    </ChartCard>
  );
}

/* ------------------------------------------------------------------ */
/* Queue + trend + breakdown cards — the middle of every admin dashboard */
/* ------------------------------------------------------------------ */

/**
 * With a trend: trend beside the queue (3:2), breakdown cards two across below.
 * Without one: the queue joins the breakdown row, three across on desktop.
 * The queue comes first in the DOM either way so it leads on phones.
 * Breakdown cards should pass `stackAtLg={!trend}` for the narrow three-across row.
 */
export function QueueTrendLayout({ queue, trend, children }: {
  queue: ReactNode;
  trend: ReactNode | null;
  children: ReactNode;
}) {
  if (!trend) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-1">{queue}</div>
        {children}
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="lg:order-last lg:col-span-2">{queue}</div>
        <div className="lg:col-span-3">{trend}</div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">{children}</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Donut cards — all derived from the overview, no extra API           */
/* ------------------------------------------------------------------ */

interface DonutItem {
  label: string;
  value: number;
  color: string;
}

function LegendRow({ item, total }: { item: DonutItem; total: number }) {
  return (
    <li className="flex items-center gap-1.5 py-1.5 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span>
      <span className="font-semibold tabular-nums">{formatNumber(item.value)}</span>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{total ? `${percent(item.value, total)}%` : "—"}</span>
    </li>
  );
}

/**
 * Donut beside its legend; `stackAtLg` puts the legend under the donut for the
 * narrow three-across row on desktop.
 */
function DonutPanel({ items, stackAtLg }: { items: DonutItem[]; stackAtLg?: boolean }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  const segments = total > 0
    ? items.map((i) => ({ name: i.label, value: i.value, color: i.color }))
    : [{ name: "None", value: 1, color: "#e2e8f0" }];
  const size = cn("h-32 w-32 lg:h-36 lg:w-36", stackAtLg && "lg:mx-auto lg:h-40 lg:w-40");
  return (
    <div className={cn("flex items-center gap-3 lg:gap-6", stackAtLg && "lg:flex-col lg:items-stretch lg:gap-3")}>
      <Suspense fallback={<Skeleton className={cn("shrink-0 rounded-full", size)} />}>
        <DonutChart segments={segments} className={size} showTooltip={total > 0} />
      </Suspense>
      <ul className={cn("min-w-0 max-w-sm flex-1 divide-y divide-border/60", stackAtLg && "lg:max-w-none lg:flex-none")}>
        {items.map((i) => <LegendRow key={i.label} item={i} total={total} />)}
      </ul>
    </div>
  );
}

function DonutCard({ title, description, items, stackAtLg, loading, error, onRetry, className }: {
  title: string;
  description: string;
  items: DonutItem[];
  stackAtLg?: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <ChartCard
      className={className}
      title={title}
      description={description}
      loading={loading}
      error={error}
      onRetry={onRetry}
      skeletonClassName={cn("h-36", stackAtLg && "lg:h-64")}
    >
      <DonutPanel items={items} stackAtLg={stackAtLg} />
    </ChartCard>
  );
}

const STATUS_KEYS: MemberStatusKey[] = ["active", "abroad", "other"];

/** Active / abroad / other — same colours and labels as the scorecard bars. */
export function MemberStatusCard({ overview, stackAtLg, ...state }: OverviewCardProps & { stackAtLg?: boolean }) {
  const m = overview?.members;
  return (
    <DonutCard
      {...state}
      stackAtLg={stackAtLg}
      title="Member Status"
      description="Active, abroad and other"
      items={STATUS_KEYS.map((k) => ({ label: STATUS_LABEL[k], value: m?.[k] ?? 0, color: STATUS_COLOR[k] }))}
    />
  );
}

// Five distinct hues for the biggest units, slate for the rest. Kept clear of the
// status (green/blue/slate) colours in the neighbouring donut and the amber review chips.
const UNIT_COLORS = ["#7c5cff", "#eb6834", "#0891b2", "#db2777", "#a16207"];
const REST_COLOR = "#94a3b8";

/** Share of members per child unit (districts for state, areas for district). */
export function MembersByUnitCard({ overview, unit, stackAtLg, ...state }: OverviewCardProps & { unit: "District" | "Area"; stackAtLg?: boolean }) {
  const items = useMemo(() => {
    const rows = [...(overview?.children.rows ?? [])].sort((a, b) => b.total - a.total);
    const top = rows.slice(0, UNIT_COLORS.length).map((r, i) => ({ label: r.name, value: r.total, color: UNIT_COLORS[i] }));
    const rest = rows.slice(UNIT_COLORS.length).reduce((s, r) => s + r.total, 0);
    return rest > 0 ? [...top, { label: `Other ${unit.toLowerCase()}s`, value: rest, color: REST_COLOR }] : top;
  }, [overview, unit]);
  return (
    <DonutCard
      {...state}
      stackAtLg={stackAtLg}
      title={`Members by ${unit}`}
      description={`Member share by ${unit.toLowerCase()}`}
      items={items}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Recent activities — latest members added in scope                   */
/* ------------------------------------------------------------------ */

export function RecentActivityCard({ items, loading, error, onRetry, onViewAll, stacked, className }: {
  items: RecentActivityItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onViewAll: () => void;
  /** One column at every width — for a half-width card. */
  stacked?: boolean;
  className?: string;
}) {
  return (
    <ChartCard
      className={className}
      title="Recent Activities"
      description="Latest members added"
      action={(
        <Button variant="ghost" size="sm" className="min-h-11 px-2 text-xs font-semibold text-info sm:min-h-9" onClick={onViewAll}>
          View all
        </Button>
      )}
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={items.length === 0}
      emptyText="No members added yet."
      skeletonClassName="h-32"
    >
      <ul className={cn("grid gap-x-6", !stacked && "sm:grid-cols-2 xl:grid-cols-3")}>
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <UserPlus className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.detail}</span>
            </span>
            <time dateTime={a.when} className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {new Date(a.when).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </time>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
