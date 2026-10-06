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
 * @returns {{ answers: Record<string, unknown>, numbers: {fieldId: number, value: number}[],
 *   errors: {fieldId: number, message: string}[] }}
 */
export function validateAnswers(fields, rawAnswers, { isAllowedFileUrl } = {}) {
  const raw = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {};
  const answers = {};
  const numbers = [];
  const errors = [];

  for (const field of fields) {
    if (field.type === 'heading' || !isFieldVisible(field, answers)) continue;
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

/** Field ids whose stored answer differs between two answer maps, ascending. */
export function changedFieldIds(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys]
    .filter(k => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]))
    .map(k => Number(k.slice(1)))
    .filter(Number.isInteger)
    .sort((a, b) => a - b);
}
