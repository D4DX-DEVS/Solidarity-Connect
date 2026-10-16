// Monthly report form definitions and answer checks on the client.
// isFieldVisible and validateAnswers mirror
// solidarity-api/src/services/monthlyReports/answers.js — keep them in step.
// The server re-validates every save; this copy only gives instant feedback.

export type ReportLevel = "state" | "district" | "area";

export type FieldType =
  | "text" | "textarea" | "number" | "date" | "time" | "phone" | "email"
  | "yesno" | "select" | "radio" | "checkbox" | "file" | "heading";

export type ConditionOperator = "equals" | "not_equals" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";

export interface FieldCondition {
  fieldId: number;
  operator: ConditionOperator;
  value?: string;
}

export interface ReportField {
  id: number;
  type: FieldType;
  label: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  allowDecimal?: boolean;
  maxLength?: number;
  /** Number fields: add up in consolidation and show to members. */
  sum?: boolean;
  condition?: FieldCondition;
  /** Headings: the questions under it are answered once per named entry (an area's units). */
  repeat?: boolean;
  /** Headings with repeat: what one entry is called ("Unit"). */
  itemLabel?: string;
}

export interface FileAnswer {
  url: string;
  name?: string;
  mimetype?: string;
  size?: number;
}

/** One named entry of a per-unit section: { name, f<id>: answer, … }. */
export interface RepeatEntry {
  name: string;
  [key: string]: AnswerValue;
}

export type AnswerValue = string | number | string[] | FileAnswer | RepeatEntry[] | null | undefined;
export type Answers = Record<string, AnswerValue>;
/** Keyed by errorKey(fieldId, entry). */
export type ReportErrors = Record<string, string>;

export const LEVEL_LABELS: Record<ReportLevel, string> = { state: "State", district: "District", area: "Area" };

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: "Number",
  text: "Short text",
  textarea: "Long text",
  date: "Date",
  time: "Time",
  phone: "Phone",
  email: "Email",
  yesno: "Yes / No",
  select: "Dropdown",
  radio: "Single choice",
  checkbox: "Checkboxes",
  file: "File / photo",
  heading: "Section heading",
};

export const CHOICE_TYPES: FieldType[] = ["select", "radio", "checkbox"];

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "is",
  not_equals: "is not",
  greater_than: "is more than",
  less_than: "is less than",
  is_empty: "is empty",
  is_not_empty: "has an answer",
};

export const VALUELESS_OPERATORS: ConditionOperator[] = ["is_empty", "is_not_empty"];

export const answerKey = (fieldId: number) => `f${fieldId}`;
/** Where a per-unit section keeps its entries (mirrors the server's entriesKeyOf). */
export const entriesKey = (headingId: number) => `g${headingId}`;
/** Error slot of a question, or of one entry's answer to it (heading id + entry = that entry's name). */
export const errorKey = (fieldId: number, entry?: number) => (entry === undefined ? String(fieldId) : `${fieldId}@${entry}`);

export const itemLabelOf = (heading: ReportField) => heading.itemLabel || "Unit";
/** Most entries a per-unit section takes (the server enforces the same). */
export const MAX_ENTRIES = 50;

export const isEmptyAnswer = (value: AnswerValue): boolean =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/** Whether a field is shown, given the answers to the fields before it. */
export function isFieldVisible(field: ReportField, answers: Answers): boolean {
  const condition = field.condition;
  if (!condition) return true;
  const value = answers[answerKey(condition.fieldId)];
  const empty = isEmptyAnswer(value);

  switch (condition.operator) {
    case "is_empty": return empty;
    case "is_not_empty": return !empty;
    case "equals":
    case "not_equals": {
      const equal = !empty && (Array.isArray(value)
        ? value.map(String).includes(String(condition.value))
        : String(value) === String(condition.value));
      return condition.operator === "equals" ? equal : !equal;
    }
    case "greater_than":
    case "less_than": {
      if (empty) return false;
      const n = Number(value);
      const target = Number(condition.value);
      if (!Number.isFinite(n) || !Number.isFinite(target)) return false;
      return condition.operator === "greater_than" ? n > target : n < target;
    }
    default: return true;
  }
}

/**
 * The fields shown for these answers, in order. A question whose trigger is
 * hidden is hidden too, because hidden answers are treated as empty.
 */
export function visibleFields(fields: ReportField[], answers: Answers): ReportField[] {
  const shown: Answers = {};
  const out: ReportField[] = [];
  for (const field of fields) {
    if (!isFieldVisible(field, shown)) continue;
    out.push(field);
    if (field.type !== "heading") shown[answerKey(field.id)] = answers[answerKey(field.id)];
  }
  return out;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** First problem with one shown field's answer, or null. */
export function fieldError(field: ReportField, value: AnswerValue): string | null {
  if (field.type === "heading") return null;
  if (isEmptyAnswer(value)) return field.required ? "This is required" : null;

  switch (field.type) {
    case "number": {
      const n = Number(value);
      if (!Number.isFinite(n)) return "Enter a number";
      if (!field.allowDecimal && !Number.isInteger(n)) return "Enter a whole number";
      if (field.min !== undefined && n < field.min) return `Must be at least ${field.min}`;
      if (field.max !== undefined && n > field.max) return `Must be at most ${field.max}`;
      return null;
    }
    case "text":
    case "textarea": {
      const max = field.maxLength ?? (field.type === "text" ? 500 : 5000);
      return String(value).trim().length > max ? `At most ${max} characters` : null;
    }
    case "email": return EMAIL.test(String(value).trim()) ? null : "Enter a valid email";
    case "phone": return PHONE.test(String(value).trim()) ? null : "Enter a valid phone number";
    case "date": return DATE.test(String(value)) ? null : "Enter a valid date";
    case "time": return TIME.test(String(value)) ? null : "Enter a valid time";
    default: return null;
  }
}

/** Question id → id of the repeating heading it sits under (only questions in per-unit sections). */
export function repeatedFieldIds(fields: ReportField[]): Map<number, number> {
  const map = new Map<number, number>();
  let current: number | null = null;
  for (const f of fields) {
    if (f.type === "heading") current = f.repeat ? f.id : null;
    else if (current !== null) map.set(f.id, current);
  }
  return map;
}

/** The questions of one per-unit section, in order. */
export const sectionFields = (fields: ReportField[], headingId: number): ReportField[] => {
  const repeated = repeatedFieldIds(fields);
  return fields.filter(f => repeated.get(f.id) === headingId);
};

export function entriesOf(answers: Answers, headingId: number): RepeatEntry[] {
  const value = answers[entriesKey(headingId)];
  return Array.isArray(value) && value.every(v => typeof v === "object" && v !== null) ? (value as RepeatEntry[]) : [];
}

/** Whether a question of a per-unit section shows for this entry (rules see the other answers plus the entry). */
export const isEntryFieldVisible = (field: ReportField, answers: Answers, entry: RepeatEntry) =>
  isFieldVisible(field, { ...answers, ...entry });

/** Sum of each number question over the entries, for the entries that answered it. */
export function entryTotals(section: ReportField[], answers: Answers, entries: RepeatEntry[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const entry of entries) {
    for (const field of section) {
      if (field.type !== "number" || !isEntryFieldVisible(field, answers, entry)) continue;
      const raw = entry[answerKey(field.id)];
      const n = Number(raw);
      if (isEmptyAnswer(raw) || !Number.isFinite(n)) continue;
      totals.set(field.id, (totals.get(field.id) ?? 0) + n);
    }
  }
  return totals;
}

/** Copy each per-unit number total into its own answer, as the server stores it, so later rules see it. */
export function syncEntryTotals(fields: ReportField[], answers: Answers): Answers {
  const out: Answers = { ...answers };
  for (const heading of fields.filter(f => f.type === "heading" && f.repeat)) {
    const section = sectionFields(fields, heading.id);
    const totals = entryTotals(section, out, entriesOf(out, heading.id));
    for (const field of section) {
      if (field.type !== "number") continue;
      if (totals.has(field.id)) out[answerKey(field.id)] = totals.get(field.id);
      else delete out[answerKey(field.id)];
    }
  }
  return out;
}

/**
 * Start every per-unit section with entries: last month's unit names when there are
 * some, else one empty unit. A report filled before the section went per-unit
 * becomes one unnamed unit holding its totals.
 */
export function withEntries(fields: ReportField[], answers: Answers, previous: Record<string, string[]> = {}): Answers {
  const out: Answers = { ...answers };
  for (const heading of fields.filter(f => f.type === "heading" && f.repeat)) {
    if (entriesOf(out, heading.id).length > 0) continue;
    const section = sectionFields(fields, heading.id);
    const legacy: RepeatEntry = { name: "" };
    for (const field of section) {
      const value = out[answerKey(field.id)];
      if (!isEmptyAnswer(value)) legacy[answerKey(field.id)] = value;
    }
    const names = previous[String(heading.id)] ?? [];
    out[entriesKey(heading.id)] = Object.keys(legacy).length > 1 || names.length === 0
      ? [legacy]
      : names.map(name => ({ name }));
  }
  return out;
}

/** Errors for every shown field (and every unit's answers), keyed by errorKey. */
export function validateReport(fields: ReportField[], answers: Answers): ReportErrors {
  const errors: ReportErrors = {};
  const repeated = repeatedFieldIds(fields);
  for (const field of visibleFields(fields, answers)) {
    if (field.type === "heading") {
      if (field.repeat) validateEntries(field, sectionFields(fields, field.id), answers, errors);
      continue;
    }
    if (repeated.has(field.id)) continue;
    const error = fieldError(field, answers[answerKey(field.id)]);
    if (error) errors[errorKey(field.id)] = error;
  }
  return errors;
}

function validateEntries(heading: ReportField, section: ReportField[], answers: Answers, errors: ReportErrors) {
  const entries = entriesOf(answers, heading.id);
  if (entries.length === 0) {
    errors[errorKey(heading.id)] = `Add at least one ${itemLabelOf(heading).toLowerCase()}`;
    return;
  }
  const seen = new Set<string>();
  entries.forEach((entry, i) => {
    const name = String(entry.name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    if (!name) errors[errorKey(heading.id, i)] = "Enter a name";
    else if (seen.has(name)) errors[errorKey(heading.id, i)] = "This name is already listed";
    seen.add(name);
    for (const field of section) {
      if (!isEntryFieldVisible(field, answers, entry)) continue;
      const error = fieldError(field, entry[answerKey(field.id)]);
      if (error) errors[errorKey(field.id, i)] = error;
    }
  });
}

function submitValue(field: ReportField, value: AnswerValue): AnswerValue {
  return field.type === "number" ? Number(value) : typeof value === "string" ? value.trim() : value;
}

/** Answers ready to send: only shown fields, numbers as numbers, text trimmed. Per-unit totals are the server's to work out. */
export function answersForSubmit(fields: ReportField[], answers: Answers): Answers {
  const out: Answers = {};
  const repeated = repeatedFieldIds(fields);
  for (const field of visibleFields(fields, answers)) {
    if (field.type === "heading") {
      if (!field.repeat) continue;
      const section = sectionFields(fields, field.id);
      out[entriesKey(field.id)] = entriesOf(answers, field.id).map((entry) => {
        const sent: RepeatEntry = { name: String(entry.name ?? "").trim().replace(/\s+/g, " ") };
        for (const f of section) {
          const value = entry[answerKey(f.id)];
          if (isEntryFieldVisible(f, answers, entry) && !isEmptyAnswer(value)) sent[answerKey(f.id)] = submitValue(f, value);
        }
        return sent;
      });
      continue;
    }
    if (repeated.has(field.id)) continue;
    const value = answers[answerKey(field.id)];
    if (isEmptyAnswer(value)) continue;
    out[answerKey(field.id)] = submitValue(field, value);
  }
  return out;
}

/** An answer as display text (files and lists flattened). */
export function formatAnswer(field: ReportField, value: AnswerValue): string {
  if (isEmptyAnswer(value)) return "—";
  if (Array.isArray(value)) return value.map(v => (typeof v === "string" ? v : v.name)).join(", ");
  if (typeof value === "object" && value) return value.name || "File";
  if (field.type === "yesno") return value === "yes" ? "Yes" : "No";
  return String(value);
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const periodLabel = (year: number, month: number) => `${MONTH_NAMES[month - 1]} ${year}`;

/** "Jan – Oct 2026": the months a year view adds up (all twelve once the year is over). */
export const yearSpanLabel = (year: number, months: number) =>
  months > 0 ? `${MONTH_NAMES[0].slice(0, 3)} – ${MONTH_NAMES[months - 1].slice(0, 3)} ${year}` : String(year);

/** "YYYY-MM" for the MonthPicker. */
export const toMonthValue = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export function fromMonthValue(value: string): { year: number; month: number } {
  const [y, m] = value.split("-").map(Number);
  return { year: y, month: m };
}

/** Current month in IST — reports follow Kerala time. */
export function currentIstPeriod(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "numeric" }).formatToParts(now);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

export const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "";

interface SectionedColumn {
  label: string;
  section?: string | null;
}

/** "Section · Label" for flat places, such as Excel headers, that cannot show the heading. */
export const columnLabel = (c: SectionedColumn): string => (c.section ? `${c.section} · ${c.label}` : c.label);

/** Runs of consecutive columns under the same section heading. */
export function groupBySection<T extends SectionedColumn>(columns: T[]): { section: string | null; items: T[] }[] {
  const groups: { section: string | null; items: T[] }[] = [];
  for (const c of columns) {
    const section = c.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.items.push(c);
    else groups.push({ section, items: [c] });
  }
  return groups;
}
