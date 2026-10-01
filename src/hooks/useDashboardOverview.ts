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
  activity: { months: { key: string; label: string; completed: number }[]; reportingWindow: { from: string; to: string } };
}

/** Pending work + upcoming meetings from the existing dashboard endpoint. */
export interface DashboardSummary {
  pendingRequestsCount: number;
  pendingTransfersCount: number;
  upcomingMeetings: { _id: string; title: string; scheduledDate: string }[];
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

export function useDashboardSummary(accountId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", "summary", accountId],
    queryFn: async () => (await reportsAPI.getDashboard()).data as DashboardSummary,
    enabled: !!accountId,
  });
}
