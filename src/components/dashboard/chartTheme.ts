import type { ChartConfig } from "@/components/ui/chart";

/**
 * Validated categorical slots (dataviz reference palette), each stepped for its
 * own surface. Order is the CVD-safety mechanism — assign by entity, never cycle.
 * Slot 3 (aqua) is under 3:1 on the light surface, so anything using it also
 * prints the value as text.
 */
export const SERIES = {
  blue: { light: "#2a78d6", dark: "#3987e5" },
  orange: { light: "#eb6834", dark: "#d95926" },
  aqua: { light: "#1baf7a", dark: "#199e70" },
} as const;

export type MemberStatusKey = "active" | "abroad" | "other";

export const STATUS_LABEL: Record<MemberStatusKey, string> = { active: "Active", abroad: "Abroad", other: "Other" };

/** Fills for HTML bars and legend swatches (Tailwind needs the literal classes). */
export const STATUS_SWATCH: Record<MemberStatusKey, string> = {
  active: "bg-[#2a78d6] dark:bg-[#3987e5]",
  abroad: "bg-[#eb6834] dark:bg-[#d95926]",
  other: "bg-[#1baf7a] dark:bg-[#199e70]",
};

/** Single-series charts (one measure) all use slot 1. */
export const singleSeriesConfig = (label: string) =>
  ({ value: { label, theme: SERIES.blue } }) satisfies ChartConfig;

export const formatNumber = (n: number) => n.toLocaleString("en-IN");

export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** "8 reported since Aug" — fits a KPI tile; the chart card spells out the full window. */
export const reportingDetail = (reporting: number, window?: { from: string }) =>
  window ? `${reporting} reported since ${window.from.split(" ")[0]}` : `${reporting} reporting`;

/** The profile field most often left blank, or null when no profile is missing any. */
export const mostMissingField = (fields: { label: string; filled: number }[], total: number): string | null => {
  if (total === 0 || fields.length === 0) return null;
  const worst = fields.reduce((w, f) => (f.filled < w.filled ? f : w));
  return worst.filled < total ? worst.label : null;
};

/** KPI caption for the profiles tile. */
export const profilesDetail = (profiles?: { total: number; fields: { label: string; filled: number }[] }): string => {
  if (!profiles?.total) return "No members yet";
  const missing = mostMissingField(profiles.fields, profiles.total);
  return missing ? `Missing: ${missing}` : "All details on file";
};
