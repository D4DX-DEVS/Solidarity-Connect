import { FEATURES } from "@/lib/features";
import { ArrowRightLeft, CalendarDays, ClipboardList, FileCheck, FileClock, MapPinOff } from "lucide-react";
import type { DashboardOverview, DashboardSummary, HierarchyRow } from "@/hooks/useDashboardOverview";
import type { ActionItem } from "./ActionQueue";
import { daysLeft, deadlineLabel, reportLink, reportMonthName } from "./reportStatus";

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

/**
 * The due month's report: the viewer's own, then who below hasn't submitted. Only once
 * the month is over and its report is due (1st to the deadline): mid-month an unsent
 * report is normal, and the toolbar already shows the month and its deadline. The own
 * item goes once its deadline passes (the page may stay open past it): it is locked then.
 * `onViewRows` opens the scorecard; without it the item opens the consolidated report.
 */
export function reportItems(overview: DashboardOverview | undefined, onViewRows?: () => void): ActionItem[] {
  const report = overview?.report;
  if (!report?.closing) return [];
  const month = reportMonthName(report);
  const due = `Due ${deadlineLabel(report.deadline)}`;
  const days = daysLeft(report.deadline);
  const items: ActionItem[] = [];

  const { own } = report;
  if (own && !own.submitted && days >= 0) {
    items.push(own.canFill
      ? {
        key: "own-report",
        severity: days <= 3 ? "urgent" : "review",
        icon: ClipboardList,
        title: `Your ${month} ${own.level} report is pending`,
        detail: `${due} · it locks after that`,
        cta: "Fill now",
        to: reportLink(report, "mine"),
      }
      : {
        // Murabi and Coordinators see the area report but the area admin fills it.
        key: "own-report",
        severity: "review",
        icon: ClipboardList,
        title: `The ${month} ${own.level} report isn't in yet`,
        detail: `Your ${own.level} admin fills it · ${due}`,
        cta: "View",
        to: reportLink(report, "mine"),
      });
  }

  // Rows are districts on the state view and areas on the district view.
  const pendingRows = overview.children.rows.filter((r) => r.report && !r.report.submitted);
  const toRows = onViewRows ?? reportLink(report, "consolidated");
  if (report.districts && report.districts.submitted < report.districts.total) {
    const n = report.districts.total - report.districts.submitted;
    items.push({
      key: "district-reports",
      severity: "review",
      icon: FileClock,
      title: `${plural(n, "district")} yet to submit the ${month} report`,
      detail: listNames(pendingRows),
      count: n,
      cta: "View",
      to: toRows,
    });
  }
  if (report.areas && report.areas.submitted < report.areas.total) {
    const n = report.areas.total - report.areas.submitted;
    // State view: areas sit a level below the rows, so show the total and open the consolidated report.
    const stateView = overview.children.level === "district";
    items.push({
      key: "area-reports",
      severity: "review",
      icon: FileClock,
      title: `${plural(n, "area")} yet to submit the ${month} report`,
      detail: stateView ? `${report.areas.submitted} of ${report.areas.total} submitted` : listNames(pendingRows),
      count: n,
      cta: "View",
      to: stateView ? reportLink(report, "consolidated") : toRows,
    });
  }
  return items;
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
  if (!FEATURES.meetings) return [];
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
