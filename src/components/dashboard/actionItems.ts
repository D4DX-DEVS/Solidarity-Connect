import { ArrowRightLeft, CalendarDays, FileCheck, MapPinOff, TrendingDown } from "lucide-react";
import type { DashboardOverview, DashboardSummary, HierarchyRow } from "@/hooks/useDashboardOverview";
import type { ActionItem } from "./ActionQueue";

// The title already carries the count; the row truncates with an ellipsis, so no "+N more"
// suffix that the truncation could cut into a wrong number ("+13 more" → "+1…").
const listNames = (rows: HierarchyRow[]) => rows.map((r) => r.name).join(", ");

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Transfers waiting on this admin: final sign-off for state, first approval for district. */
export function transferItem(summary: DashboardSummary | undefined, level: "state" | "district"): ActionItem[] {
  const n = summary?.pendingTransfersCount ?? 0;
  if (n === 0) return [];
  return [{
    key: "transfers",
    severity: "urgent",
    icon: ArrowRightLeft,
    title: `${plural(n, "transfer")} awaiting your approval`,
    detail: level === "state" ? "Both districts approved — your sign-off completes the move" : "Members moving in or out of your district",
    count: n,
    cta: "Review",
    to: "/state-admin/transfer-approvals",
  }];
}

export function requestItem(summary: DashboardSummary | undefined): ActionItem[] {
  const n = summary?.pendingRequestsCount ?? 0;
  if (n === 0) return [];
  return [{
    key: "requests",
    severity: "urgent",
    icon: FileCheck,
    title: `${plural(n, "member request")} pending`,
    detail: "Profile edits and affiliation changes",
    count: n,
    cta: "Review",
    to: "/requests",
  }];
}

/** Children whose admins have marked nothing in the reporting window. */
export function silentChildrenItem(overview: DashboardOverview | undefined, onView: () => void): ActionItem[] {
  if (!overview?.children.level) return [];
  const silent = overview.children.rows.filter((r) => r.admins > 0 && r.reportingAdmins === 0);
  if (silent.length === 0) return [];
  const noun = overview.children.level === "district" ? "district" : "area";
  const { from } = overview.activity.reportingWindow;
  return [{
    key: "silent",
    severity: "review",
    icon: TrendingDown,
    title: `${plural(silent.length, noun)} with no admin reporting since ${from.split(" ")[0]}`,
    detail: listNames(silent),
    count: silent.length,
    cta: "View",
    to: onView,
  }];
}

export function uncoveredAreasItem(overview: DashboardOverview | undefined, to: string): ActionItem[] {
  const n = overview?.areas.withoutAdmin ?? 0;
  if (n === 0) return [];
  return [{
    key: "uncovered",
    severity: "review",
    icon: MapPinOff,
    title: `${plural(n, "area")} without an area admin`,
    detail: `Of ${overview?.areas.total ?? 0} areas — assign someone to run them`,
    count: n,
    cta: "Assign",
    to,
  }];
}

export function meetingItems(summary: DashboardSummary | undefined, to: string): ActionItem[] {
  return (summary?.upcomingMeetings ?? []).map((m) => ({
    key: `meeting-${m._id}`,
    severity: "upcoming" as const,
    icon: CalendarDays,
    title: m.title,
    detail: new Date(m.scheduledDate).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    cta: "Open",
    to,
  }));
}
