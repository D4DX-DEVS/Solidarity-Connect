import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Archive, CalendarClock, CalendarRange, Search, Star, X, type LucideIcon } from "lucide-react";
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
  /** Turned 38 so far this month / this calendar year. */
  thisMonth: number;
  thisYear: number;
}

interface ArchivesResponse {
  data: ArchivedMember[];
  /** Follows the district/area filters only, not role, age, period or search. */
  summary: ArchivesSummary;
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

const AGE_OPTIONS: Option[] = [
  { value: "38", label: "38 years" },
  { value: "39", label: "39 years" },
  { value: "40", label: "40 years" },
  { value: "41", label: "41 years" },
  { value: "42plus", label: "42 and above" },
];

const SORT_OPTIONS: Option[] = [
  { value: "name", label: "Name A–Z" },
  { value: "oldest", label: "Oldest first" },
  { value: "youngest", label: "Youngest first" },
];

const PERIODS = ["month", "year"];

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

/** Members aged 38 and above (or set to "Age over"), moved out of Members — state admin only. */
const Archives = () => {
  // Every filter, page and size lives in the URL
  const list = useListParams();
  const { setParam, setParams } = list;
  const [search, setSearch] = useDebouncedParam(list, "q");
  const committedSearch = list.getParam("q").trim();
  const district = list.getParam("district");
  const group = list.getParam("group");
  const role = pick(list.getParam("role"), ROLE_OPTIONS);
  const age = pick(list.getParam("age"), AGE_OPTIONS);
  const period = pick(list.getParam("period"), PERIODS);
  const sort = pick(list.getParam("sort"), SORT_OPTIONS) || "name";
  // The API ignores one-letter searches, so they don't count as a filter
  const searchSent = committedSearch.length >= 2;
  const activeFilters = [searchSent, district, group, role, age, period].filter(Boolean).length;

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
    ...(age ? { age } : {}),
    ...(period ? { period } : {}),
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

  const clearFilters = () => {
    setSearch("");
    setParams({ q: "", district: "", group: "", role: "", age: "", period: "", sort: "" });
  };

  const now = new Date();
  const cards: SummaryCard[] = [
    {
      title: "Age over",
      value: summary?.total,
      detail: "Aged 38 and above",
      icon: Archive,
      tone: "warning",
      active: !role && !period,
      onClick: () => setParams({ role: "", period: "" }),
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
      title: "This month",
      value: summary?.thisMonth,
      detail: `Turned 38 in ${now.toLocaleString("en-IN", { month: "long" })}`,
      icon: CalendarClock,
      tone: "danger",
      active: period === "month",
      onClick: () => setParam("period", period === "month" ? "" : "month"),
    },
    {
      title: "This year",
      value: summary?.thisYear,
      detail: `Turned 38 in ${now.getFullYear()}`,
      icon: CalendarRange,
      tone: "neutral",
      active: period === "year",
      onClick: () => setParam("period", period === "year" ? "" : "year"),
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
        subtitle="Members aged 38 and above"
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
            <FilterSelect label="Age" value={age} allLabel="All Ages" options={AGE_OPTIONS} onChange={(v) => setParam("age", v)} />
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
                {period ? ` · aged out this ${period}` : ""}
              </span>
              <Button variant="ghost" size="sm" className="min-h-11 gap-1 sm:min-h-9" onClick={clearFilters}>
                <X className="h-4 w-4" aria-hidden />
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>

        <p className="data-strip px-3 py-2 text-xs text-muted-foreground sm:text-sm">
          Members are listed here from their 38th birthday, or when their status is set to Age over. They still show in
          Members with an Age over tag and count in dashboards and reports. Correcting a date of birth clears the tag.
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
                <p className="mt-1 text-sm text-muted-foreground">Nobody is 38 or older yet.</p>
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

export default Archives;
