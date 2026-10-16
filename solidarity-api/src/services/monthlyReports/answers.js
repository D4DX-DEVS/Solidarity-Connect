// Answer validation for a monthly report. Mirrors src/lib/reportForm.ts on the
// client (isFieldVisible must match exactly), but the server is the authority:
// it drops unknown keys and answers to hidden questions before saving.
import { MAX_TEXT_LENGTH } from './fields.js';

const keyOf = (fieldId) => `f${fieldId}`;

export const isEmptyAnswer = (value) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

/**
 * Whether a field is shown, given the answers to the fields before it.
 * A field without a condition is always shown.
 */
export function isFieldVisible(field, answers) {
  const condition = field.condition;
  if (!condition) return true;
  const value = answers?.[keyOf(condition.fieldId)];
  const empty = isEmptyAnswer(value);

  switch (condition.operator) {
    case 'is_empty': return empty;
    case 'is_not_empty': return !empty;
    case 'equals':
    case 'not_equals': {
      const equal = !empty && (Array.isArray(value)
        ? value.map(String).includes(String(condition.value))
        : String(value) === String(condition.value));
      return condition.operator === 'equals' ? equal : !equal;
    }
    case 'greater_than':
    case 'less_than': {
      if (empty) return false;
      const n = Number(value);
      const target = Number(condition.value);
      if (!Number.isFinite(n) || !Number.isFinite(target)) return false;
      return condition.operator === 'greater_than' ? n > target : n < target;
    }
    default: return true;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDate(value) {
  const m = DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

/** Coerce one raw answer to its stored shape. Returns { value } or { error }. */
function coerce(field, raw, { isAllowedFileUrl }) {
  if (isEmptyAnswer(raw)) return { value: null };

  switch (field.type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
      if (!Number.isFinite(n)) return { error: 'must be a number' };
      if (!field.allowDecimal && !Number.isInteger(n)) return { error: 'must be a whole number' };
      if (field.min !== undefined && n < field.min) return { error: `must be at least ${field.min}` };
      if (field.max !== undefined && n > field.max) return { error: `must be at most ${field.max}` };
      return { value: n };
    }
    case 'text':
    case 'textarea': {
      if (typeof raw !== 'string') return { error: 'must be text' };
      const value = raw.trim();
      const max = field.maxLength || MAX_TEXT_LENGTH[field.type];
      if (value.length > max) return { error: `must be at most ${max} characters` };
      return { value };
    }
    case 'email': {
      const value = typeof raw === 'string' ? raw.trim() : '';
      return EMAIL.test(value) && value.length <= 254 ? { value } : { error: 'must be a valid email' };
    }
    case 'phone': {
      const value = typeof raw === 'string' ? raw.trim() : '';
      return PHONE.test(value) ? { value } : { error: 'must be a valid phone number' };
    }
    case 'date':
      return typeof raw === 'string' && validDate(raw) ? { value: raw } : { error: 'must be a valid date' };
    case 'time':
      return typeof raw === 'string' && TIME.test(raw) ? { value: raw } : { error: 'must be a valid time' };
    case 'yesno':
      return raw === 'yes' || raw === 'no' ? { value: raw } : { error: 'must be yes or no' };
    case 'select':
    case 'radio':
      return typeof raw === 'string' && field.options.includes(raw) ? { value: raw } : { error: 'is not one of the options' };
    case 'checkbox': {
      if (!Array.isArray(raw)) return { error: 'must be a list of options' };
      const picked = [...new Set(raw)];
      if (!picked.every(v => typeof v === 'string' && field.options.includes(v))) return { error: 'is not one of the options' };
      return { value: picked };
    }
    case 'file': {
      const url = typeof raw === 'object' && raw !== null && typeof raw.url === 'string' ? raw.url : '';
      if (!/^https?:\/\//i.test(url) || (isAllowedFileUrl && !isAllowedFileUrl(url))) return { error: 'must be an uploaded file' };
      const value = { url };
      if (typeof raw.name === 'string') value.name = raw.name.slice(0, 255);
      if (typeof raw.mimetype === 'string') value.mimetype = raw.mimetype.slice(0, 100);
      if (Number.isFinite(raw.size)) value.size = raw.size;
      return { value };
    }
    default:
      return { value: null };
  }
}

/**
 * Validate answers against a form's fields, in order.
 *
 * Conditions are evaluated against the answers already accepted, so a question
 * whose trigger is hidden is hidden too. Hidden and unknown answers are dropped.
 *
 * A heading with `repeat` (the area form's units) is answered once per entry:
 * `g<headingId>` holds [{ name, f<id>: value, … }] and each number question in
 * that section is stored as the entries' total under its own `f<id>`, so totals,
 * consolidation and member views read it like any other answer.
 *
 * @returns {{ answers: Record<string, unknown>, numbers: {fieldId: number, value: number}[],
 *   errors: {fieldId: number, entry?: number, message: string}[] }}
 */
export function validateAnswers(fields, rawAnswers, { isAllowedFileUrl } = {}) {
  const raw = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {};
  const answers = {};
  const numbers = [];
  const errors = [];
  const repeated = repeatedFieldIds(fields);

  for (const field of fields) {
    if (field.type === 'heading') {
      if (field.repeat) {
        const section = fields.filter(f => repeated.get(f.id) === field.id);
        validateEntries(field, section, raw, { answers, numbers, errors }, { isAllowedFileUrl });
      }
      continue;
    }
    if (repeated.has(field.id) || !isFieldVisible(field, answers)) continue;
    const key = keyOf(field.id);
    const { value, error } = coerce(field, raw[key], { isAllowedFileUrl });
    if (error) {
      errors.push({ fieldId: field.id, message: `${field.label} ${error}` });
      continue;
    }
    if (isEmptyAnswer(value)) {
      if (field.required) errors.push({ fieldId: field.id, message: `${field.label} is required` });
      continue;
    }
    answers[key] = value;
    if (field.type === 'number' && field.sum) numbers.push({ fieldId: field.id, value });
  }

  return { answers, numbers, errors };
}

export const entriesKeyOf = (headingId) => `g${headingId}`;
export const MAX_ENTRIES = 50;
const MAX_ENTRY_NAME = 100;

/** Question id → id of the repeating heading it sits under (only questions in repeating sections). */
export function repeatedFieldIds(fields) {
  const map = new Map();
  let current = null;
  for (const f of fields || []) {
    if (f.type === 'heading') current = f.repeat ? f.id : null;
    else if (current !== null) map.set(f.id, current);
  }
  return map;
}

/**
 * One repeating section: every entry needs a unique name and answers its section's
 * questions (shown-when rules see the earlier answers plus that entry's own).
 * Writes the entries and the number totals into `out`.
 */
function validateEntries(heading, section, raw, out, options) {
  const itemLabel = heading.itemLabel || 'Unit';
  const list = Array.isArray(raw[entriesKeyOf(heading.id)]) ? raw[entriesKeyOf(heading.id)] : [];
  if (list.length === 0) {
    out.errors.push({ fieldId: heading.id, message: `${heading.label}: add at least one ${itemLabel.toLowerCase()}` });
    return;
  }
  if (list.length > MAX_ENTRIES) {
    out.errors.push({ fieldId: heading.id, message: `${heading.label}: at most ${MAX_ENTRIES} entries` });
    return;
  }

  const entries = [];
  const totals = new Map();
  const seen = new Set();
  list.forEach((rawEntry, index) => {
    const entryRaw = rawEntry && typeof rawEntry === 'object' && !Array.isArray(rawEntry) ? rawEntry : {};
    const name = typeof entryRaw.name === 'string' ? entryRaw.name.trim().replace(/\s+/g, ' ') : '';
    const who = name || `${itemLabel} ${index + 1}`;
    if (!name) out.errors.push({ fieldId: heading.id, entry: index, message: `${itemLabel} ${index + 1} needs a name` });
    else if (name.length > MAX_ENTRY_NAME) out.errors.push({ fieldId: heading.id, entry: index, message: `${who}: name is too long` });
    else if (seen.has(name.toLowerCase())) out.errors.push({ fieldId: heading.id, entry: index, message: `${who} is listed twice` });
    seen.add(name.toLowerCase());

    const entry = { name };
    for (const field of section) {
      if (!isFieldVisible(field, { ...out.answers, ...entry })) continue;
      const key = keyOf(field.id);
      const { value, error } = coerce(field, entryRaw[key], options);
      if (error) {
        out.errors.push({ fieldId: field.id, entry: index, message: `${who}: ${field.label} ${error}` });
        continue;
      }
      if (isEmptyAnswer(value)) {
        if (field.required) out.errors.push({ fieldId: field.id, entry: index, message: `${who}: ${field.label} is required` });
        continue;
      }
      entry[key] = value;
      if (field.type === 'number') totals.set(field.id, (totals.get(field.id) || 0) + value);
    }
    entries.push(entry);
  });

  out.answers[entriesKeyOf(heading.id)] = entries;
  for (const field of section) {
    if (field.type !== 'number' || !totals.has(field.id)) continue;
    const value = totals.get(field.id);
    out.answers[keyOf(field.id)] = value;
    if (field.sum) out.numbers.push({ fieldId: field.id, value });
  }
}

/**
 * Whether a submitted report can move to a newer form version when edited:
 * every question it was filled on is still there with the same type, so no
 * answer is dropped. (A newer version that only adds questions or turns on
 * per-unit entry qualifies.)
 */
export function canUpgradeForm(fromFields, toFields) {
  const next = new Map((toFields || []).map(f => [f.id, f.type]));
  return (fromFields || []).every(f => f.type === 'heading' || next.get(f.id) === f.type);
}

/** Field ids whose stored answer differs between two answer maps, ascending. */
export function changedFieldIds(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys]
    .filter(k => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
    .map(k => Number(k.slice(1)))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
}
