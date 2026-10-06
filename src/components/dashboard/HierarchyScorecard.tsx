import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import type { HierarchyRow } from "@/hooks/useDashboardOverview";
import { cn } from "@/lib/utils";
import { formatNumber, percent, STATUS_LABEL, STATUS_SWATCH, type MemberStatusKey } from "./chartTheme";

type SortKey = "name" | "total" | "activePct" | "coverage" | "reportingPct";

interface HierarchyScorecardProps {
  rows: HierarchyRow[];
  /** district rows (state view) add an Areas column; area rows (district view) flag "No admin" in reporting. */
  level: "district" | "area";
  loading?: boolean;
  /** Makes rows drillable (state → district). */
  onSelect?: (row: HierarchyRow) => void;
  /** False when no report form is published: the column counts admins instead of flagging 0/N as silent. */
  reporting?: boolean;
}

const MOBILE_ROWS = 6;
const SEGMENTS: MemberStatusKey[] = ["active", "abroad", "other"];

const sortValue = (r: HierarchyRow, key: SortKey, reporting: boolean): number | string => {
  switch (key) {
    case "name": return r.name;
    case "total": return r.total;
    case "activePct": return percent(r.active, r.total);
    case "coverage": return r.areas;
    // Units with nobody to report sort below 0% — "No admin" is worse than silent admins.
    case "reportingPct": return r.admins > 0 ? (reporting ? percent(r.reportingAdmins, r.admins) : r.admins) : -1;
  }
};

/** Members stacked by status; width is relative to the biggest row so rows compare at a glance. */
function MemberBar({ row, max }: { row: HierarchyRow; max: number }) {
  const scale = max > 0 ? 100 / max : 0;
  return (
    <div
      className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${row.active} active, ${row.abroad} abroad${row.other ? `, ${row.other} other` : ""}`}
    >
      {SEGMENTS.map((key) =>
        row[key] > 0 ? (
          <span key={key} className={cn("h-full first:rounded-l-full last:rounded-r-full", STATUS_SWATCH[key])} style={{ width: `${row[key] * scale}%` }} />
        ) : null,
      )}
    </div>
  );
}

/** Small meter bar. The value is always printed beside it (here or by the caller), never bar alone. */
function Bar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = percent(value, total);
  return (
    <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${pct}%` }} />
    </div>
  );
}

function NoAdmin() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold leading-4 text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-3" aria-hidden /> No admin
    </span>
  );
}

/** "3/15" + bar — the fraction already carries the admin count, so no separate admins column. */
function Reporting({ row, reporting }: { row: HierarchyRow; reporting: boolean }) {
  if (row.admins === 0) return <NoAdmin />;
  if (!reporting) return <span className="text-xs font-semibold tabular-nums text-foreground">{row.admins}</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-xs font-semibold tabular-nums text-foreground">{row.reportingAdmins}/{row.admins}</span>
      <Bar value={row.reportingAdmins} total={row.admins} label={`${row.name} admins reporting`} />
    </div>
  );
}

/** District rows only: how many areas the district has, and how many lack an area admin. */
function Coverage({ row, withUnit = false }: { row: HierarchyRow; withUnit?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums text-foreground">
      {withUnit ? `${row.areas} area${row.areas === 1 ? "" : "s"}` : row.areas}
      {row.areasWithoutAdmin > 0 ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-3" aria-hidden /> {row.areasWithoutAdmin} no admin
        </span>
      ) : null}
    </span>
  );
}

function SortHeader({ label, sortKey, sort, onSort, align = "left" }: {
  label: string; sortKey: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sort.key === sortKey;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn("inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground")}
      >
        {label}
        {active ? <Icon className="size-3" aria-hidden /> : null}
      </button>
    </th>
  );
}

/**
 * One row per child unit — the main hierarchy view. Every figure appears once:
 * members (bar), active share, area cover (districts only), admin reporting.
 */
export function HierarchyScorecard({ rows, level, loading, onSelect, reporting = true }: HierarchyScorecardProps) {
  const isMobile = useIsMobile();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="space-y-2 p-4 sm:p-5">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="px-4 pb-6 pt-2 text-center text-sm text-muted-foreground sm:px-5">
        No {level === "district" ? "districts" : "areas"} to show yet.
      </p>
    );
  }

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));

  const sorted = [...rows].sort((a, b) => {
    const av = sortValue(a, sort.key, reporting);
    const bv = sortValue(b, sort.key, reporting);
    const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : av - Number(bv);
    return (sort.dir === "asc" ? cmp : -cmp) || b.total - a.total;
  });
  const max = Math.max(0, ...rows.map((r) => r.total));
  const noun = level === "district" ? "District" : "Area";
  // Area count per district is its own fact; per area, admin count lives in "Admins reporting".
  const showAreas = level === "district";

  const legend = (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 sm:px-5" aria-label="Legend">
      {SEGMENTS.filter((k) => k !== "other" || rows.some((r) => r.other > 0)).map((key) => (
        <li key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("size-2.5 rounded-sm", STATUS_SWATCH[key])} aria-hidden />
          {STATUS_LABEL[key]}
        </li>
      ))}
    </ul>
  );

  if (isMobile) {
    const visible = expanded ? sorted : sorted.slice(0, MOBILE_ROWS);
    return (
      <div>
        {legend}
        <ul className="space-y-2 px-3 pb-3">
          {visible.map((r) => {
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">{r.name}</span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums">
                    {formatNumber(r.total)}
                    {onSelect ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden /> : null}
                  </span>
                </div>
                <div className="my-2"><MemberBar row={r} max={max} /></div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    { label: "Active", value: r.total ? `${percent(r.active, r.total)}%` : "—" },
                    reporting
                      ? { label: "Reporting", value: r.admins ? `${r.reportingAdmins}/${r.admins}` : "—" }
                      : { label: "Admins", value: r.admins ? String(r.admins) : "—" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-muted/50 px-1 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
                      <p className="text-xs font-semibold tabular-nums text-foreground">{s.value}</p>
                    </div>
                  ))}
                </div>
                {showAreas ? (
                  <div className="mt-2"><Coverage row={r} withUnit /></div>
                ) : r.admins === 0 ? (
                  <div className="mt-2"><NoAdmin /></div>
                ) : null}
              </>
            );
            return (
              <li key={r.id} className="rounded-xl border bg-card">
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(r)}
                    className="w-full rounded-xl p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {body}
                  </button>
                ) : <div className="p-3">{body}</div>}
              </li>
            );
          })}
        </ul>
        {sorted.length > MOBILE_ROWS ? (
          <Button variant="ghost" size="sm" className="mb-2 min-h-11 w-full text-xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? `Show top ${MOBILE_ROWS}` : `Show all ${sorted.length}`}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {legend}
      <div className="overflow-x-auto">
        <table className={cn("w-full border-collapse text-sm", showAreas ? "min-w-[620px]" : "min-w-[500px]")}>
          <thead className="border-y bg-muted/40">
            <tr className="text-left">
              <SortHeader label={noun} sortKey="name" sort={sort} onSort={onSort} />
              <SortHeader label="Members" sortKey="total" sort={sort} onSort={onSort} />
              <SortHeader label="Active" sortKey="activePct" sort={sort} onSort={onSort} align="right" />
              {showAreas ? <SortHeader label="Areas" sortKey="coverage" sort={sort} onSort={onSort} /> : null}
              <SortHeader label={reporting ? "Admins reporting" : "Admins"} sortKey="reportingPct" sort={sort} onSort={onSort} />
              {onSelect ? <th scope="col" className="w-8" aria-label="Open" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((r) => (
              <tr
                key={r.id}
                onClick={onSelect ? () => onSelect(r) : undefined}
                className={cn("transition-colors", onSelect && "cursor-pointer hover:bg-muted/40")}
              >
                <td className="max-w-[12rem] px-3 py-2.5">
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSelect(r); }}
                      className="truncate text-left font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {r.name}
                    </button>
                  ) : (
                    <span className="block truncate font-semibold text-foreground">{r.name}</span>
                  )}
                </td>
                <td className="w-[28%] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{formatNumber(r.total)}</span>
                    {/* Desktop table only (mobile uses cards) — keep the bar readable in the narrow drill-down sheet */}
                    <div className="min-w-[7rem] flex-1"><MemberBar row={r} max={max} /></div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">{r.total ? `${percent(r.active, r.total)}%` : "—"}</td>
                {showAreas ? <td className="px-3 py-2.5"><Coverage row={r} /></td> : null}
                <td className="px-3 py-2.5"><Reporting row={r} reporting={reporting} /></td>
                {onSelect ? <td className="pr-3"><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
