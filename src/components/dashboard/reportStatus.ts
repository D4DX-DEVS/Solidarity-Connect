import type { DashboardReport } from "@/hooks/useDashboardOverview";
import { MONTH_NAMES, toMonthValue } from "@/lib/reportForm";

type ReportMonth = Pick<DashboardReport, "year" | "month">;

const DAY_MS = 86_400_000;

/** "September" */
export const reportMonthName = (report: ReportMonth): string => MONTH_NAMES[report.month - 1];

/** "Sep" */
export const reportMonthShort = (report: ReportMonth): string => reportMonthName(report).slice(0, 3);

/** "10 Oct", in IST like every report deadline. */
export const deadlineLabel = (deadline: string): string =>
  new Date(deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/** Whole days left. The deadline is the end of an IST day, so 0 means due today; negative once it has passed. */
export const daysLeft = (deadline: string, now = Date.now()): number =>
  Math.floor((new Date(deadline).getTime() - now) / DAY_MS);

export function timeLeftLabel(deadline: string): string {
  const days = daysLeft(deadline);
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

/** The Reports page on that month: "mine" for the viewer's own report, "consolidated" for everyone below. */
export const reportLink = (report: ReportMonth, tab: "mine" | "consolidated"): string =>
  `/reports?tab=${tab}&month=${toMonthValue(report.year, report.month)}`;
