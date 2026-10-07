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

/** KPI caption for the admins tile: district vs area admins. An area dashboard has only area admins. */
export const adminsDetail = (
  overview: { admins: { district: number; area: number } } | undefined,
  level: "state" | "district" | "area",
): string =>
  level === "area"
    ? "In this area"
    : `${formatNumber(overview?.admins.district ?? 0)} district · ${formatNumber(overview?.admins.area ?? 0)} area`;
