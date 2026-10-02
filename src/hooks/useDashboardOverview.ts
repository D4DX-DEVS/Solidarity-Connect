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
  reportingAdmins: number;
}

export interface DashboardOverview {
  scope: { level: ScopeLevel; name: string; parentName: string | null };
  generatedAt: string;
  members: { total: number; active: number; abroad: number; other: number };
  /** reporting = every admin in scope; reportingArea = area-level admins only. */
  admins: { district: number; area: number; total: number; reporting: number; reportingArea: number };
  areas: { total: number; withoutAdmin: number };
  profiles: { total: number; complete: number; fields: { field: string; label: string; filled: number }[] };
  children: { level: "district" | "area" | null; rows: HierarchyRow[] };
  /** recurringTargets: active recurring targets aimed at admins. 0 → nobody has been asked to
   * report yet, so "0 reporting" is not a failure. Missing on older APIs → treat as live. */
  activity: { months: { key: string; label: string; completed: number }[]; reportingWindow: { from: string; to: string }; recurringTargets?: number };
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
      return months.map((m, i) => ({ ...m, total: totals[i] }));
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
