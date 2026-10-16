import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Archive, CalendarClock, Hand, Search, Star, X, type LucideIcon } from "lucide-react";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { MetricCard } from "@/components/app/AppShell";
import DataPagination from "@/components/app/DataPagination";
import { ArchivedMemberCard, type ArchivedMember } from "@/components/archives/ArchivedMemberCard";
import { formatNumber, percent } from "@/components/dashboard/chartTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedParam, useListParams } from "@/hooks/useListParams";
import { cn } from "@/lib/utils";
import { apiCall, districtsAPI, groupsAPI } from "@/utils/api";

interface ArchivesSummary {
  total: number;
  leaders: number;
  /** Born in this term's cutoff year: newly age over when the term began. */
  thisTerm: number;
  /** Status set to "Age over" by hand. */
  manual: number;
}

/** Born in `cutoffBirthYear` or earlier = age over; null before the first term (2027). */
interface AgeOverRule {
  cutoffBirthYear: number | null;
  termStart: string | null;
  next: { date: string; cutoffBirthYear: number };
}

interface ArchivesResponse {
  data: ArchivedMember[];
  /** Follows the district/area filters only, not role, birth year, source or search. */
  summary: ArchivesSummary;
  rule: AgeOverRule;
  pagination: { totalPages: number; totalDocs: number };
}

interface Place {
  _id: string;
  name: string;
  code: string;
}

interface Option {
  value: string;
  label: string;
}

const ROLE_OPTIONS: Option[] = [
  { value: "leader", label: "All leaders" },
  { value: "none", label: "Not a leader" },
  { value: "state", label: "State leaders" },
  { value: "district", label: "District leaders" },
  { value: "area", label: "Area leaders" },
  { value: "unit", label: "Unit leaders" },
  { value: "murabi", label: "Murabi" },
  { value: "coordinator", label: "Coordinators" },
];

/** The cutoff year and the three before it, then everything earlier ("upto-<year>"). */
function bornOptions(cutoff: number | null | undefined): Option[] {
  if (!cutoff) return [];
  return [
    ...[0, 1, 2, 3].map((back) => ({ value: String(cutoff - back), label: `Born ${cutoff - back}` })),
    { value: `upto-${cutoff - 4}`, label: `Born ${cutoff - 4} or earlier` },
  ];
}

const BORN_PATTERN = /^(upto-)?\d{4}$/;

const SORT_OPTIONS: Option[] = [
  { value: "name", label: "Name A–Z" },
  { value: "oldest", label: "Oldest first" },
  { value: "youngest", label: "Youngest first" },
];

const SOURCES = ["manual"];

/** Keeps a URL value only when it is one of the options (old links, hand edits). */
const pick = (raw: string, options: Option[] | string[]) =>
  options.some((o) => (typeof o === "string" ? o : o.value) === raw) ? raw : "";

/** Select bound to one filter; "" is the all/default value. */
function FilterSelect({ label, value, options, allLabel, onChange, className }: {
  label: string;
  value: string;
  options: Option[];
  /** Omit for selects that always hold a value (sort). */
  allLabel?: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <Select value={value || (allLabel ? "all" : options[0].value)} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger aria-label={label} className={cn("h-11 gap-1 px-2 text-xs sm:px-4 sm:text-sm", className)}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        {allLabel ? <SelectItem value="all">{allLabel}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface SummaryCard {
  title: string;
  value: number | undefined;
  detail: string;
  icon: LucideIcon;
  tone: "primary" | "warning" | "danger" | "neutral";
  active: boolean;
  onClick: () => void;
}

// "2027-01-01" → "1 Jan 2027"
const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Members born in or before this term's cutoff year (or set to "Age over") — state admin only. */
const Archives = () => {
  // Every filter, page and size lives in the URL
  const list = useListParams();
  const { setParam, setParams } = list;
  const [search, setSearch] = useDebouncedParam(list, "q");
  const committedSearch = list.getParam("q").trim();
  const district = list.getParam("district");
  const group = list.getParam("group");
  const role = pick(list.getParam("role"), ROLE_OPTIONS);
  // Options depend on the rule from the API, so only the shape is checked here
  const born = BORN_PATTERN.test(list.getParam("born")) ? list.getParam("born") : "";
  const source = pick(list.getParam("source"), SOURCES);
  const sort = pick(list.getParam("sort"), SORT_OPTIONS) || "name";
  // The API ignores one-letter searches, so they don't count as a filter
  const searchSent = committedSearch.length >= 2;
  const activeFilters = [searchSent, district, group, role, born, source].filter(Boolean).length;

  // Same keys as the Members page, so both lists come from one cache
  const { data: districts = [] } = useQuery({
    queryKey: ["members", "districts"],
    queryFn: async () => ((await districtsAPI.getDistricts({ limit: 100 })).data || []) as Place[],
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["members", "groups", district || null],
    queryFn: async () => {
      // Unfiltered there are 120+ areas — fetch them all, not the first 100
      const params: Record<string, string | number> = { limit: 500 };
      if (district) params.district = district;
      return ((await groupsAPI.getGroups(params)).data || []) as Place[];
    },
  });

  const params: Record<string, string> = {
    page: String(list.page),
    limit: String(list.pageSize),
    sort,
    ...(searchSent ? { search: committedSearch } : {}),
    ...(district ? { district } : {}),
    ...(group ? { group } : {}),
    ...(role ? { role } : {}),
    ...(born ? { born } : {}),
    ...(source ? { source } : {}),
  };

  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: ["members", "archives", params],
    // State admin only (GET /members/archives)
    queryFn: async () => (await apiCall(`/members/archives?${new URLSearchParams(params)}`)) as ArchivesResponse,
    placeholderData: keepPreviousData,
  });

  const members = data?.data ?? [];
  const totalDocs = data?.pagination.totalDocs ?? 0;
  const summary = data?.summary;
  const rule = data?.rule;
  const cutoff = rule?.cutoffBirthYear ?? null;

  const clearFilters = () => {
    setSearch("");
    setParams({ q: "", district: "", group: "", role: "", born: "", source: "", sort: "" });
  };

  const cards: SummaryCard[] = [
    {
      title: "Age over",
      value: summary?.total,
      detail: cutoff ? `Born ${cutoff} or earlier` : "Set by hand only",
      icon: Archive,
      tone: "warning",
      active: !role && !born && !source,
      onClick: () => setParams({ role: "", born: "", source: "" }),
    },
    {
      title: "Leaders",
      value: summary?.leaders,
      detail: summary ? `${percent(summary.leaders, summary.total)}% hold a role` : "Hold a role",
      icon: Star,
      tone: "primary",
      active: role === "leader",
      onClick: () => setParam("role", role === "leader" ? "" : "leader"),
    },
    {
      title: "This term",
      value: summary?.thisTerm,
      detail: cutoff && rule?.termStart ? `Born ${cutoff}, from ${formatDay(rule.termStart)}` : "No term yet",
      icon: CalendarClock,
      tone: "danger",
      active: !!cutoff && born === String(cutoff),
      // Nothing to filter before the first term
      onClick: () => {
        if (cutoff) setParams({ born: born === String(cutoff) ? "" : String(cutoff), source: "" });
      },
    },
    {
      title: "Set by hand",
      value: summary?.manual,
      detail: "Status set to Age over",
      icon: Hand,
      tone: "neutral",
      active: source === "manual",
      onClick: () => setParams({ source: source === "manual" ? "" : "manual", born: "" }),
    },
  ];
  // A failed load must read as unknown, never as a real zero
  const show = (value: number | undefined) => (isError && !data ? "—" : value === undefined ? "…" : formatNumber(value));

  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Archive className="h-6 w-6 text-primary-foreground" />}
        title="Archives"
        subtitle="Age over members, by birth year"
      />

      <main className="app-main space-y-3 pb-28 pt-4 lg:pb-8">
        {/* Counts for the chosen district/area; each card also filters the list */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Archive summary">
          {cards.map((c) => (
            <MetricCard
              key={c.title}
              title={c.title}
              value={show(c.value)}
              detail={c.detail}
              icon={c.icon}
              tone={c.tone}
              onClick={c.onClick}
              className={cn("h-full", c.active && "border-primary ring-2 ring-primary/30")}
            />
          ))}
        </section>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search archived members by name or phone"
              placeholder="Search name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 lg:grid-cols-5">
            <FilterSelect
              label="District"
              value={district}
              allLabel="All Districts"
              options={districts.map((d) => ({ value: d._id, label: `${d.name} (${d.code})` }))}
              // A new district empties the area pick — it belonged to the old one
              onChange={(v) => setParams({ district: v, group: "" })}
            />
            <FilterSelect
              label="Area"
              value={group}
              allLabel="All Areas"
              options={groups.map((g) => ({ value: g._id, label: `${g.name} (${g.code})` }))}
              onChange={(v) => setParam("group", v)}
            />
            <FilterSelect label="Role" value={role} allLabel="All Roles" options={ROLE_OPTIONS} onChange={(v) => setParam("role", v)} />
            <FilterSelect
              label="Birth year"
              value={born}
              allLabel="All birth years"
              options={bornOptions(cutoff)}
              onChange={(v) => setParams({ born: v, source: "" })}
            />
            <FilterSelect
              label="Sort"
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => setParam("sort", v === "name" ? "" : v)}
              className="col-span-2 lg:col-span-1"
            />
          </div>

          {activeFilters > 0 ? (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground sm:text-sm">
              <span>
                {activeFilters} filter{activeFilters === 1 ? "" : "s"} applied
                {source === "manual" ? " · set by hand" : ""}
              </span>
              <Button variant="ghost" size="sm" className="min-h-11 gap-1 sm:min-h-9" onClick={clearFilters}>
                <X className="h-4 w-4" aria-hidden />
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>

        <p className="data-strip px-3 py-2 text-xs text-muted-foreground sm:text-sm">
          {rule ? <AgeOverRuleText rule={rule} /> : null} Members whose status is set to Age over are listed too. Archived
          members stay in Members, untagged, and count in dashboards and reports.
        </p>

        {isPending ? (
          <ListSkeleton rows={5} />
        ) : isError ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="font-medium text-destructive">Failed to load archived members</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
              {/* A stale or hand-edited URL (unknown district) fails every retry */}
              {activeFilters > 0 ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        ) : totalDocs === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
            <Archive className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden />
            {activeFilters > 0 ? (
              <>
                <p className="font-medium text-foreground">No archived members match these filters</p>
                <Button variant="outline" className="mt-3" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">No archived members</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {rule && !cutoff
                    ? `Members born in ${rule.next.cutoffBirthYear} or earlier move here on ${formatDay(rule.next.date)}.`
                    : "Nobody is age over yet."}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`space-y-2 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
              {members.map((m) => (
                <ArchivedMemberCard key={m._id} member={m} />
              ))}
            </div>
            <DataPagination
              page={list.page}
              pageSize={list.pageSize}
              totalPages={data?.pagination.totalPages ?? 1}
              totalDocs={totalDocs}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              itemLabel="archived members"
              disabled={isPlaceholderData}
            />
          </div>
        )}
      </main>
    </div>
  );
};

/** Who is age over now, and when the cutoff moves next. */
function AgeOverRuleText({ rule }: { rule: AgeOverRule }) {
  const next = `From ${formatDay(rule.next.date)}: born ${rule.next.cutoffBirthYear} or earlier.`;
  if (rule.cutoffBirthYear === null || !rule.termStart) {
    return <>Age over starts on {formatDay(rule.next.date)} with members born {rule.next.cutoffBirthYear} or earlier, and moves one birth year on every two-year term.</>;
  }
  return <>This term (from {formatDay(rule.termStart)}): born {rule.cutoffBirthYear} or earlier. {next}</>;
}

export default Archives;
