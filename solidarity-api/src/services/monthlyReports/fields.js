// Report form field definitions: the types a state admin can add and the rules a
// saved form must satisfy. Pure — shared by the routes and the tests.

export const REPORT_LEVELS = ['state', 'district', 'area'];

export const FIELD_TYPES = [
  'text', 'textarea', 'number', 'date', 'time', 'phone', 'email',
  'yesno', 'select', 'radio', 'checkbox', 'file', 'heading',
];

/** Types answered by picking from `options`. */
export const CHOICE_TYPES = ['select', 'radio', 'checkbox'];

export const CONDITION_OPERATORS = ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'];
const VALUELESS_OPERATORS = ['is_empty', 'is_not_empty'];
const NUMERIC_OPERATORS = ['greater_than', 'less_than'];

const MAX_FIELDS = 100;
const MAX_OPTIONS = 50;
const LIMITS = { label: 300, helpText: 500, placeholder: 200, option: 200, conditionValue: 200 };
export const MAX_TEXT_LENGTH = { text: 500, textarea: 5000 };

const trimmed = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const finiteOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

function cleanCondition(raw, field, earlier) {
  if (!raw || raw.fieldId === undefined || raw.fieldId === null || raw.fieldId === '') return { condition: null };
  const fieldId = Number(raw.fieldId);
  const target = earlier.get(fieldId);
  if (!target || target.type === 'heading') {
    return { error: `"${field.label}": a show/hide rule can only use an earlier question` };
  }
  if (!CONDITION_OPERATORS.includes(raw.operator)) {
    return { error: `"${field.label}": unknown show/hide operator` };
  }
  if (VALUELESS_OPERATORS.includes(raw.operator)) return { condition: { fieldId, operator: raw.operator } };

  const value = trimmed(String(raw.value ?? ''), LIMITS.conditionValue);
  if (value === '') return { error: `"${field.label}": the show/hide rule needs a value` };
  if (NUMERIC_OPERATORS.includes(raw.operator) && !Number.isFinite(Number(value))) {
    return { error: `"${field.label}": greater/less than needs a number` };
  }
  return { condition: { fieldId, operator: raw.operator, value } };
}

function cleanField(raw, earlier) {
  const id = Number(raw?.id);
  const type = raw?.type;
  if (!FIELD_TYPES.includes(type)) return { error: `Unknown field type "${type}"` };
  const label = trimmed(raw.label, LIMITS.label);
  if (!label) return { error: 'Every field needs a label' };

  const field = { id, type, label };
  if (type === 'heading') {
    const helpText = trimmed(raw.helpText, LIMITS.helpText);
    if (helpText) field.helpText = helpText;
    return { field };
  }

  field.required = raw.required === true;
  const helpText = trimmed(raw.helpText, LIMITS.helpText);
  if (helpText) field.helpText = helpText;
  const placeholder = trimmed(raw.placeholder, LIMITS.placeholder);
  if (placeholder) field.placeholder = placeholder;

  if (CHOICE_TYPES.includes(type)) {
    const options = [...new Set((Array.isArray(raw.options) ? raw.options : [])
      .map(o => trimmed(String(o ?? ''), LIMITS.option))
      .filter(Boolean))];
    if (options.length === 0) return { error: `"${label}" needs at least one option` };
    if (options.length > MAX_OPTIONS) return { error: `"${label}" has more than ${MAX_OPTIONS} options` };
    field.options = options;
  }

  if (type === 'number') {
    const min = finiteOrNull(raw.min);
    const max = finiteOrNull(raw.max);
    if (Number.isNaN(min) || Number.isNaN(max)) return { error: `"${label}": min and max must be numbers` };
    if (min !== null && max !== null && min > max) return { error: `"${label}": min is greater than max` };
    if (min !== null) field.min = min;
    if (max !== null) field.max = max;
    field.allowDecimal = raw.allowDecimal === true;
    // Add up defaults on: counts are the point of a monthly report.
    field.sum = raw.sum !== false;
  }

  if (type === 'text' || type === 'textarea') {
    const maxLength = finiteOrNull(raw.maxLength);
    if (maxLength !== null) {
      if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > MAX_TEXT_LENGTH[type]) {
        return { error: `"${label}": max length must be 1–${MAX_TEXT_LENGTH[type]}` };
      }
      field.maxLength = maxLength;
    }
  }

  const { condition, error } = cleanCondition(raw.condition, field, earlier);
  if (error) return { error };
  if (condition) field.condition = condition;
  return { field };
}

/**
 * Validate and clean a form's field list as sent by the builder.
 *
 * Field ids are never reused: an id must either belong to a field already saved
 * on this form, or come from the form's `nextFieldId` counter onwards. Otherwise a
 * deleted field's old answers would show up under a new question.
 *
 * @param {unknown[]} rawFields
 * @param {{ savedIds: number[], nextFieldId: number }} state
 * @returns {{ fields?: object[], nextFieldId?: number, error?: string }}
 */
export function normaliseFormFields(rawFields, { savedIds, nextFieldId }) {
  if (!Array.isArray(rawFields)) return { error: 'fields must be a list' };
  if (rawFields.length > MAX_FIELDS) return { error: `A form can have at most ${MAX_FIELDS} fields` };

  const saved = new Set(savedIds.map(Number));
  const earlier = new Map();
  const fields = [];
  let maxId = 0;

  for (const raw of rawFields) {
    const id = Number(raw?.id);
    if (!Number.isInteger(id) || id < 1) return { error: 'Every field needs a whole-number id' };
    if (earlier.has(id)) return { error: `Duplicate field id ${id}` };
    if (!saved.has(id) && id < nextFieldId) return { error: `Field id ${id} was used before and cannot be reused` };

    const { field, error } = cleanField(raw, earlier);
    if (error) return { error };
    fields.push(field);
    earlier.set(id, field);
    maxId = Math.max(maxId, id);
  }

  return { fields, nextFieldId: Math.max(nextFieldId, maxId + 1) };
}

/**
 * The add-up number fields of a form, each with the heading it sits under, so
 * totals and member views can tell "യൂത്ത് മീറ്റ്" in two sections apart.
 * parentId is the question a shown-when rule hangs it from (the attendee count
 * under Members Meet), so views can show it as part of that item.
 */
export function sumColumns(fields) {
  let section = null;
  const columns = [];
  for (const f of fields || []) {
    if (f.type === 'heading') section = f.label;
    else if (f.type === 'number' && f.sum) columns.push({ id: f.id, label: f.label, section, parentId: f.condition?.fieldId ?? null });
  }
  return columns;
}
