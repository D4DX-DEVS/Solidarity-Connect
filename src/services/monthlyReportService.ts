import { apiCall } from "@/utils/api";
import type { Answers, ReportField, ReportLevel } from "@/lib/reportForm";

export interface Person {
  _id: string;
  name: string;
  role?: string;
}

export interface HistoryEntry {
  by: Person | null;
  at: string;
  action: "submitted" | "edited" | "unlocked";
  changed: number[];
}

export interface MonthlyReport {
  id: string;
  level: ReportLevel;
  year: number;
  month: number;
  formVersion: number | null;
  answers: Answers;
  submitted: boolean;
  submittedBy: Person | null;
  submittedAt: string | null;
  lastEditedBy: Person | null;
  lastEditedAt: string | null;
  history: HistoryEntry[];
  unlockedUntil: string | null;
  unlockedBy: Person | null;
  updatedAt: string;
}

export interface PublishedForm {
  version: number;
  title: string;
  fields: ReportField[];
}

export interface MyReport {
  level: ReportLevel;
  scopeLabel: string;
  period: { year: number; month: number };
  canFill: boolean;
  canEdit: boolean;
  locked: boolean;
  future: boolean;
  deadline: string;
  editableUntil: string;
  form: PublishedForm | null;
  report: MonthlyReport | null;
}

export interface ReportFormDraft {
  level: ReportLevel;
  title: string;
  fields: ReportField[];
  nextFieldId: number;
  version: number;
  hasUnpublishedChanges: boolean;
  deadlineDay: number;
  publishedAt: string | null;
  updatedAt: string;
}

export interface ReportSummary {
  submitted: boolean;
  reportId: string | null;
  submittedAt?: string | null;
  lastEditedAt?: string | null;
  unlockedUntil?: string | null;
  /** Add-up numbers keyed by field id. */
  numbers: Record<string, number>;
  /** Year view: how many of the year's months this scope submitted. */
  monthsSubmitted?: number;
}

export interface AreaRow {
  id: string;
  name: string;
  report: ReportSummary;
}

export interface DistrictRow {
  id: string;
  name: string;
  report: ReportSummary;
  areas: AreaRow[];
  areasSubmitted: number;
  areaTotals: Record<string, number>;
  /** Year view: area reports submitted across all its areas and months. */
  areaMonthsSubmitted?: number;
}

export interface NumberColumn {
  id: number;
  label: string;
  /** The heading the question sits under, if any. */
  section?: string | null;
  /** The question it is shown under (attendee count under Members Meet). */
  parentId?: number | null;
  retired?: boolean;
}

export interface SubmittedCount {
  submitted: number;
  total: number;
}

export type ConsolidatedSpan = "month" | "year";

export interface Consolidated {
  span: ConsolidatedSpan;
  /** `month` is null for the year view. */
  period: { year: number; month: number | null };
  /** Months counted: 1 for a month, months started so far for a year. */
  months: number;
  current: { year: number; month: number };
  viewer: { level: ReportLevel; view: "all" | "district" | "area" };
  canUnlock: Record<ReportLevel, boolean>;
  columns: Record<ReportLevel, NumberColumn[]>;
  /** Empty for the year view — months are unlocked one at a time. */
  deadlines: Partial<Record<ReportLevel, string>>;
  state: ReportSummary | null;
  districts: DistrictRow[];
  totals: Record<ReportLevel, Record<string, number>>;
  counts: {
    districts: SubmittedCount;
    areas: SubmittedCount;
    /** Year view: monthly reports submitted out of those due so far. */
    months?: { district: SubmittedCount; area: SubmittedCount; state: SubmittedCount | null };
  };
}

export interface ReportDetail {
  scopeLabel: string;
  districtName: string | null;
  form: PublishedForm | null;
  report: MonthlyReport;
}

/** Error thrown by apiCall, with the server's per-field errors when it sent them. */
export type ReportApiError = Error & { status?: number; data?: { errors?: { fieldId: number; message: string }[] } };

const period = (year: number, month: number) => `year=${year}&month=${month}`;

export const monthlyReportService = {
  getForms: async () => (await apiCall("/monthly-reports/forms")).data as ReportFormDraft[],

  saveForm: async (level: ReportLevel, body: { fields: ReportField[]; deadlineDay: number; title: string; updatedAt: string }) =>
    (await apiCall(`/monthly-reports/forms/${level}`, { method: "PUT", body: JSON.stringify(body) })).data as ReportFormDraft,

  publishForm: async (level: ReportLevel) =>
    (await apiCall(`/monthly-reports/forms/${level}/publish`, { method: "POST" })).data as ReportFormDraft,

  getMine: async (year: number, month: number) =>
    (await apiCall(`/monthly-reports/mine?${period(year, month)}`)).data as MyReport,

  saveMine: async (year: number, month: number, answers: Answers, updatedAt?: string) =>
    (await apiCall(`/monthly-reports/mine?${period(year, month)}`, {
      method: "PUT",
      body: JSON.stringify({ answers, updatedAt }),
    })).data as MonthlyReport,

  getStatus: async (year: number) =>
    (await apiCall(`/monthly-reports/status?year=${year}`)).data as { month: number; submitted: boolean; submittedAt: string | null }[],

  getConsolidated: async (year: number, month: number, district?: string, span: ConsolidatedSpan = "month") =>
    (await apiCall(`/monthly-reports/consolidated?${span === "year" ? `year=${year}&period=year` : period(year, month)}${district && district !== "all" ? `&district=${district}` : ""}`)).data as Consolidated,

  getReport: async (id: string) => (await apiCall(`/monthly-reports/${id}`)).data as ReportDetail,

  unlock: async (body: { level: ReportLevel; scopeId?: string; year: number; month: number }) =>
    (await apiCall("/monthly-reports/unlock", { method: "POST", body: JSON.stringify(body) })).data as { unlockedUntil: string },
};
