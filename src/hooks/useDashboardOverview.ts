import { useQuery } from "@tanstack/react-query";
import { apiCall, reportsAPI } from "@/utils/api";

export type ScopeLevel = "state" | "district" | "area";

/** One district (state view) or area (district view) in the scorecard. */
export interface HierarchyRow {
  id: string;
  name: string;
  total: number;
  active: number;
  abroad: number;
  other: number;
  completeProfiles: number;
  areas: number;
  areasWithoutAdmin: number;
  admins: number;
  /** The due month's report: a district row adds its areas'. Missing on an area dashboard's groups. */
  report?: { submitted: boolean; areasSubmitted?: number; areaTotal?: number };
}

export interface SubmittedCount {
  submitted: number;
  total: number;
}

/** The monthly report due now, from the Monthly Reports module. */
export interface DashboardReport {
  year: number;
  /** 1-12 */
  month: number;
  /** ISO; the last editable moment (deadline day of the next month, IST). */
  deadline: string;
  /** The month is over and its report is due (1st to the deadline); false while it is still running. */
  closing: boolean;
  /** The viewer's own report; null when they have none (e.g. an area admin without an area). */
  own: { level: ScopeLevel; label: string; canFill: boolean; submitted: boolean; submittedAt: string | null } | null;
  /** State view only. */
  districts: SubmittedCount | null;
  /** State and district views. */
  areas: SubmittedCount | null;
}

export interface DashboardOverview {
  scope: { level: ScopeLevel; name: string; parentName: string | null };
  generatedAt: string;
  /** Current members only. archived = age-over members, set on the state admin's state-wide view, else null. */
  members: { total: number; active: number; abroad: number; other: number; archived?: number | null };
  admins: { district: number; area: number; total: number };
  areas: { total: number; withoutAdmin: number };
  profiles: { total: number; complete: number; fields: { field: string; label: string; filled: number }[] };
  children: { level: "district" | "area" | null; rows: HierarchyRow[] };
  /** Missing on an API older than the Monthly Reports dashboards. */
  report?: DashboardReport;
  /** Trailing-30-day growth vs the prior total. pct is null when there is no
   * prior total to compare against (badge hidden); 0 is a real measured zero. */
  deltas: {
    windowDays: number;
    members: { added: number; pct: number | null };
    areas: { added: number; pct: number | null };
    admins: { added: number; pct: number | null };
  };
}

/** Pending work, upcoming meetings and the latest members from the existing dashboard endpoint. */
export interface DashboardSummary {
  pendingRequestsCount: number;
  pendingTransfersCount: number;
  upcomingMeetings: { _id: string; title: string; scheduledDate: string }[];
  recentMembers?: { _id?: string; name: string; district?: { name?: string }; group?: { name?: string }; createdAt: string }[];
}

// Keyed by account id: one number can hold several admin accounts, and switching
// between them must never paint another scope's cached numbers.
// `districtId` is the state admin's drill-down into one district.
export function useDashboardOverview(accountId: string | undefined, districtId?: string) {
  return useQuery({
    queryKey: ["dashboard", "overview", accountId, districtId ?? "all"],
    queryFn: async () =>
      (await apiCall(`/reports/overview${districtId ? `?district=${encodeURIComponent(districtId)}` : ""}`)).data as DashboardOverview,
    enabled: !!accountId,
  });
}

// The summary and the recent-activity feed share one query (same key + fetcher),
// so GET /reports/dashboard runs once per dashboard load, not twice.
const summaryKey = (accountId: string | undefined) => ["dashboard", "summary", accountId];
const fetchSummary = async () => (await reportsAPI.getDashboard()).data as DashboardSummary;

export function useDashboardSummary(accountId: string | undefined) {
  return useQuery({
    queryKey: summaryKey(accountId),
    queryFn: fetchSummary,
    enabled: !!accountId,
  });
}

export interface MembershipTrendPoint {
  key: string;
  label: string;
  added: number;
  /** Running total ending at the current member count. */
  total: number;
}

export interface RegistrationTrendRow {
  _id: { year: number; month: number };
  count: number;
}

const TREND_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * 12-month member-growth series. No new backend: reuses
 * GET /reports/members `registrationTrend` (new members per month). Only the
 * monthly additions are cached; totals are walked back from the live
 * `currentTotal` on every render, so the last point always matches the KPI
 * tile even when the overview refetches and this cache does not.
 * Never fabricates — returns [] when the endpoint has no data.
 */
/**
 * Two months or more. A single month is the import baseline — just the member
 * total the Members tile already shows — so the trend card waits for a second.
 */
export const hasTrend = (points: MembershipTrendPoint[] | undefined): boolean => (points?.length ?? 0) > 1;

export function useMembershipTrend(accountId: string | undefined, currentTotal: number | undefined) {
  return useQuery({
    queryKey: ["dashboard", "membership-trend", accountId],
    queryFn: async (): Promise<Omit<MembershipTrendPoint, "total">[]> => {
      const res = await reportsAPI.getMembers({ page: 1, limit: 1 });
      const rows = (res.data?.registrationTrend ?? []) as RegistrationTrendRow[];
      if (!rows.length) return [];
      const now = new Date();
      const byKey = new Map(rows.map((r) => [`${r._id.year}-${r._id.month}`, r.count]));
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        return {
          key: `${year}-${String(month).padStart(2, "0")}`,
          label: TREND_MONTH_LABELS[month - 1],
          added: byKey.get(`${year}-${month}`) ?? 0,
        };
      });
    },
    // Walk backwards: total[i] = currentTotal - members added after month i.
    select: (months): MembershipTrendPoint[] => {
      let after = 0;
      const totals = new Array<number>(months.length);
      for (let i = months.length - 1; i >= 0; i -= 1) {
        totals[i] = Math.max(0, (currentTotal ?? 0) - after);
        after += months[i].added;
      }
      const points = months.map((m, i) => ({ ...m, total: totals[i] }));
      // A bulk import (the 1 Oct 2026 full re-import: 1,419 of 1,421) lands in one month and
      // drew a flat line with a fake spike. Start at the latest month whose joins are >= 80% of
      // the total so far — that month is the baseline; earlier months (a few QA accounts) are noise.
      let start = points.findIndex((p) => p.total > 0);
      if (start === -1) return [];
      for (let i = points.length - 1; i > start; i -= 1) {
        if (points[i].added >= points[i].total * 0.8) { start = i; break; }
      }
      return points.slice(start);
    },
    enabled: !!accountId && currentTotal !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}

export interface RecentActivityItem {
  id: string;
  title: string;
  detail: string;
  when: string;
}

/**
 * Recent-activity feed: the latest members added in scope (`recentMembers` of
 * the shared summary query). Upcoming meetings are left out — they already sit
 * in the action queue, and a future date is not recent activity.
 * `unit` is the level one below the viewer (state → district, else group).
 */
export function useRecentActivity(accountId: string | undefined, unit: "district" | "group") {
  return useQuery({
    queryKey: summaryKey(accountId),
    queryFn: fetchSummary,
    select: (data): RecentActivityItem[] =>
      (data.recentMembers ?? []).map((m) => {
        const where = (unit === "district" ? m.district?.name : m.group?.name) || m.group?.name || m.district?.name;
        return {
          id: `member-${m._id ?? m.name}`,
          title: m.name,
          detail: where ? `New member · ${where}` : "New member",
          when: m.createdAt,
        };
      }),
    enabled: !!accountId,
  });
}
