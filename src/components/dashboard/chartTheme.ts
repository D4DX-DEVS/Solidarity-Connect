export type MemberStatusKey = "active" | "abroad" | "other";

export const STATUS_LABEL: Record<MemberStatusKey, string> = { active: "Active", abroad: "Abroad", other: "Other" };

/** One colour per member status everywhere — donut segments, scorecard bars, legends. */
export const STATUS_COLOR: Record<MemberStatusKey, string> = {
  active: "#1baf7a",
  abroad: "#2a78d6",
  other: "#94a3b8",
};

/** Same colours as STATUS_COLOR for HTML bars and legend swatches (Tailwind needs the literal classes). */
export const STATUS_SWATCH: Record<MemberStatusKey, string> = {
  active: "bg-[#1baf7a] dark:bg-[#199e70]",
  abroad: "bg-[#2a78d6] dark:bg-[#3987e5]",
  other: "bg-[#94a3b8] dark:bg-[#64748b]",
};

export const formatNumber = (n: number) => n.toLocaleString("en-IN");

export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** False only when no district/area report form is published — then nobody has been asked to report. */
export const reportingLive = (overview?: { activity: { reportForms?: number } }): boolean =>
  overview?.activity.reportForms !== 0;

/** KPI caption for the admins tile. */
export const adminsDetail = (overview?: { admins: { reporting: number }; activity: { reportForms?: number } }): string =>
  reportingLive(overview) ? `${overview?.admins.reporting ?? 0} reporting` : "No report form yet";
