import { ObjectId, isHex24, idString } from './objectid.js';
import { isPOJO, resolvePath } from './schema.js';

// ---------------------------------------------------------------- errors

export class CastError extends Error {
  constructor(kind, value, path, reason) {
    let shown;
    try {
      shown = typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      shown = String(value);
    }
    super(`Cast to ${kind} failed for value "${shown}" (type ${value === null ? 'null' : typeof value}) at path "${path}"`);
    this.name = 'CastError';
    this.kind = kind;
    this.value = value;
    this.path = path;
    this.stringValue = `"${shown}"`;
    this.valueType = typeof value;
    this.reason = reason;
  }
}

export class ValidatorError extends Error {
  constructor({ message, kind, path, value }) {
    super(message);
    this.name = 'ValidatorError';
    this.kind = kind;
    this.path = path;
    this.value = value;
    this.properties = { message, type: kind, path, value };
  }
}

export class ValidationError extends Error {
  constructor(modelName, errors = {}) {
    const base = `${modelName} validation failed`;
    const detail = Object.entries(errors).map(([p, e]) => `${p}: ${e.message}`).join(', ');
    super(detail ? `${base}: ${detail}` : base);
    this.name = 'ValidationError';
    this._message = base;
    this.errors = errors;
  }
}

// ---------------------------------------------------------------- path helpers

export const getPath = (obj, path) => {
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
};

export const setPath = (obj, path, value) => {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
};

export const isDocument = (v) => v !== null && typeof v === 'object' && v.$__ !== undefined && v._doc !== undefined;

// ---------------------------------------------------------------- value casting

const castObjectIdValue = (v, path, mode) => {
  if (isDocument(v)) return mode === 'doc' ? v : idString(v._id);
  if (v instanceof ObjectId) return mode === 'doc' ? v : v.toHexString();
  if (typeof v === 'string' && isHex24(v)) return mode === 'doc' ? new ObjectId(v) : v.toLowerCase();
  if (isPOJO(v) && v._id !== undefined && v._id !== v) {
    // Plain object carrying an _id (e.g. a lean populated doc) → the id.
    return castObjectIdValue(v._id, path, mode);
  }
  if (v && typeof v === 'object' && typeof v.toHexString === 'function') {
    const hex = String(v.toHexString());
    return mode === 'doc' ? new ObjectId(hex) : hex;
  }
  throw new CastError('ObjectId', v, path);
};

const TRUE = new Set([true, 'true', 1, '1', 'yes']);
const FALSE = new Set([false, 'false', 0, '0', 'no']);

/**
 * Casts a value for a schema type. mode 'doc' → in-memory document form
 * (ObjectId instances, populated docs kept); mode 'query' → query/storage form
 * (ObjectIds as hex strings). Dates are Date objects in both. Throws CastError.
 */
export function castValue(st, v, mode = 'doc', path = st.path) {
  if (v === null || v === undefined) return v;
  const o = st.options || {};
  switch (st.instance) {
    case 'String': {
      let s;
      if (typeof v === 'string') s = v;
      else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') s = String(v);
      else if (v instanceof ObjectId) s = v.toHexString();
      else if (v instanceof Date) s = v.toString();
      else if (Array.isArray(v) && v.length === 1 && typeof v[0] !== 'object') s = String(v[0]);
      else throw new CastError('string', v, path);
      if (o.trim) s = s.trim();
      if (o.lowercase) s = s.toLowerCase();
      if (o.uppercase) s = s.toUpperCase();
      return s;
    }
    case 'Number': {
      if (typeof v === 'number') {
        if (Number.isNaN(v)) throw new CastError('Number', v, path);
        return v;
      }
      if (typeof v === 'string') {
        if (v.trim() === '') return null;
        const n = Number(v);
        if (Number.isNaN(n)) throw new CastError('Number', v, path);
        return n;
      }
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (Array.isArray(v) && v.length === 1) return castValue(st, v[0], mode, path);
      if (v instanceof Number) return Number(v);
      throw new CastError('Number', v, path);
    }
    case 'Boolean': {
      if (TRUE.has(v)) return true;
      if (FALSE.has(v)) return false;
      throw new CastError('Boolean', v, path);
    }
    case 'Date': {
      let d;
      if (v instanceof Date) d = new Date(v.getTime());
      else if (typeof v === 'number') d = new Date(v);
      else if (typeof v === 'string') {
        if (v.trim() === '') return null;
        d = /^-?\d+$/.test(v.trim()) && v.trim().length > 8 ? new Date(Number(v)) : new Date(v);
      } else throw new CastError('date', v, path);
      if (Number.isNaN(d.getTime())) throw new CastError('date', v, path);
      return d;
    }
    case 'ObjectId':
      return castObjectIdValue(v, path, mode);
    case 'Array': {
      const arr = Array.isArray(v) ? v : [v];
      if (st.isDocArray) return arr.map((el, i) => castSubdoc(st.schema, el, mode, `${path}.${i}`));
      if (st.caster) return arr.map((el, i) => (el === undefined ? el : castValue(st.caster, el, mode, `${path}.${i}`)));
      return arr.slice();
    }
    case 'Embedded':
      return castSubdoc(st.schema, v, mode, path);
    default:
      return v;
  }
}

/** Casts a subdocument (array element or single nested); assigns _id and defaults. */
export function castSubdoc(schema, v, mode, path) {
  if (isDocument(v)) v = v.toObject({ depopulate: false });
  if (!isPOJO(v) && !(v && typeof v === 'object' && !Array.isArray(v))) throw new CastError('Embedded', v, path);
  const errors = {};
  const out = castObject(schema, v, { mode, errors, strict: schema.options.strict !== false, prefix: `${path}.` });
  const firstError = Object.values(errors)[0];
  if (firstError) throw firstError;
  if (schema.paths._id && out._id === undefined && schema.options._id !== false) {
    out._id = mode === 'doc' ? new ObjectId() : new ObjectId().toHexString();
  }
  applyDefaults(schema, out, { mode });
  return out;
}

/**
 * Builds a document-shaped object from input, keeping only schema paths when strict.
 * Cast failures are collected into `errors` (keyed by full path) and the raw value kept.
 */
export function castObject(schema, input, { mode = 'doc', errors = {}, strict = true, prefix = '', base = '' } = {}) {
  const out = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined) continue;
    const path = base + key;
    if (key.includes('.') && !schema.paths[path]) {
      const r = resolvePath(schema, path);
      if (r && r.st) {
        try {
          setPath(out, key, castValue(r.st, value, mode, prefix + path));
        } catch (e) {
          errors[prefix + path] = e;
          setPath(out, key, value);
        }
      } else if (!strict) setPath(out, key, value);
      continue;
    }
    const st = schema.paths[path];
    if (st) {
      try {
        out[key] = castValue(st, value, mode, prefix + path);
      } catch (e) {
        errors[prefix + path] = e;
        out[key] = value;
      }
    } else if (schema.nested[path]) {
      if (value === null) out[key] = null;
      else if (typeof value === 'object' && !Array.isArray(value)) {
        out[key] = castObject(schema, isDocument(value) ? value.toObject() : value, { mode, errors, strict, prefix, base: `${path}.` });
      } else if (strict) {
        errors[prefix + path] = new CastError('Object', value, prefix + path);
      }
    } else if (!strict || key === '_id') {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------- defaults

/**
 * Fills missing paths with schema defaults (arrays default to []). Returns the list of
 * paths it filled. `isSelected(path)` limits it to projected paths.
 */
export function applyDefaults(schema, doc, { mode = 'doc', isSelected = null, ctx = null, skip = null } = {}) {
  const filled = [];
  for (const [path, st] of Object.entries(schema.paths)) {
    if (path === '_id' || path === schema.options.versionKey) continue;
    if (skip && skip.has(path)) continue;
    if (isSelected && !isSelected(path)) continue;
    // Inside a nested object that was explicitly set to null → leave it.
    const parts = path.split('.');
    let parent = doc;
    let blocked = false;
    for (let i = 0; i < parts.length - 1; i++) {
      const next = parent?.[parts[i]];
      if (next === null) {
        blocked = true;
        break;
      }
      parent = next;
    }
    if (blocked) continue;
    if (getPath(doc, path) !== undefined) continue;
    const o = st.options || {};
    let value;
    if ('default' in o) {
      const def = o.default;
      if (def === undefined) continue;
      if (typeof def === 'function') value = def === Date.now ? new Date() : def.call(ctx ?? doc, ctx ?? doc);
      else value = cloneValue(def);
    } else if (st.instance === 'Array') {
      value = [];
    } else continue;
    if (value === undefined) continue;
    try {
      value = castValue(st, value, mode, path);
    } catch {
      /* keep raw default */
    }
    setPath(doc, path, value);
    filled.push(path);
  }
  return filled;
}

export function cloneValue(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof ObjectId) return v;
  if (isDocument(v)) return v;
  if (Array.isArray(v)) return v.map(cloneValue);
  if (v instanceof RegExp) return v;
  const out = {};
  for (const [k, val] of Object.entries(v)) out[k] = cloneValue(val);
  return out;
}

// ---------------------------------------------------------------- storage forms

/** In-memory value → JSON-safe storage value (ObjectId → hex, Date → ISO, docs → _id). */
export function toStorage(v) {
  if (v === null || v === undefined) return v;
  if (v instanceof ObjectId) return v.toHexString();
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  if (isDocument(v)) return toStorage(v._doc._id);
  if (Array.isArray(v)) return v.map((el) => (el === undefined ? null : toStorage(el)));
  if (typeof v === 'object') {
    if (typeof v.toHexString === 'function' && v._bsontype === 'ObjectId') return String(v.toHexString());
    if (v instanceof RegExp) return v.toString();
    if (typeof v.toJSON === 'function' && !isPOJO(v)) return v.toJSON();
    const out = {};
    for (const [k, val] of Object.entries(v)) if (val !== undefined) out[k] = toStorage(val);
    return out;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return v;
}

/** In-memory value → query form (ObjectId → hex, Dates kept, docs → _id). */
export function toQueryForm(v) {
  if (v === null || v === undefined) return v;
  if (v instanceof ObjectId) return v.toHexString();
  if (v instanceof Date || v instanceof RegExp) return v;
  if (isDocument(v)) return toQueryForm(v._doc._id);
  if (Array.isArray(v)) return v.map(toQueryForm);
  if (typeof v === 'object') {
    if (typeof v.toHexString === 'function' && v._bsontype === 'ObjectId') return String(v.toHexString());
    if (!isPOJO(v)) return v;
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = toQueryForm(val);
    return out;
  }
  return v;
}

/** Removes empty plain objects (mongoose `minimize`). Arrays are kept as-is. */
export function minimize(obj) {
  if (!isPOJO(obj)) return obj;
  for (const [k, v] of Object.entries(obj)) {
    if (isPOJO(v)) {
      minimize(v);
      if (Object.keys(v).length === 0) delete obj[k];
    } else if (v === undefined) delete obj[k];
  }
  return obj;
}

const convertTyped = (st, v, objectIds) => {
  if (v === null || v === undefined) return v;
  switch (st.instance) {
    case 'Date':
      if (typeof v === 'string' || typeof v === 'number') {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? v : d;
      }
      return v;
    case 'ObjectId':
      return objectIds && isHex24(v) ? new ObjectId(v) : v;
    case 'Array':
      if (!Array.isArray(v)) return v;
      if (st.isDocArray) {
        for (const el of v) if (isPOJO(el)) hydrateInPlace(st.schema, el, objectIds);
        return v;
      }
      if (st.caster) return v.map((el) => convertTyped(st.caster, el, objectIds));
      return v;
    case 'Embedded':
      if (isPOJO(v)) hydrateInPlace(st.schema, v, objectIds);
      return v;
    default:
      return v;
  }
};

const convertAt = (schema, container, key, path, objectIds) => {
  const v = container[key];
  if (v === null || v === undefined) return;
  const st = schema.paths[path];
  if (st) {
    container[key] = convertTyped(st, v, objectIds);
  } else if (schema.nested[path] && isPOJO(v)) {
    for (const k of Object.keys(v)) convertAt(schema, v, k, `${path}.${k}`, objectIds);
  }
};

/**
 * Storage form (parsed JSON) → typed form, in place. Dates become Date objects;
 * with objectIds, ObjectId paths become ObjectId instances (document/lean form),
 * otherwise they stay hex strings (query form used for matching).
 */
export function hydrateInPlace(schema, obj, objectIds) {
  for (const key of Object.keys(obj)) convertAt(schema, obj, key, key, objectIds);
  return obj;
}

// ---------------------------------------------------------------- filter casting

const QUERY_SELECTORS_PASSTHROUGH = new Set(['$exists', '$type', '$size', '$regex', '$options', '$mod', '$where', '$expr', '$text', '$comment', '$jsonSchema', '$bitsAllSet', '$bitsAnySet', '$bitsAllClear', '$bitsAnyClear']);

const castForQuery = (st, v, path) => {
  if (v === null || v === undefined || v instanceof RegExp) return v;
  if (st.instance === 'Array') {
    if (Array.isArray(v)) return castValue(st, v, 'query', path);
    if (st.caster) return castValue(st.caster, v, 'query', path);
    if (st.isDocArray && isPOJO(v)) return castFilter(st.schema, v);
    return toQueryForm(v);
  }
  if (st.instance === 'Embedded' && isPOJO(v)) return castSubdocLoose(st.schema, v);
  if (st.instance === 'Mixed') return toQueryForm(v);
  return castValue(st, v, 'query', path);
};

const castSubdocLoose = (schema, v) => {
  const errors = {};
  const out = castObject(schema, v, { mode: 'query', errors, strict: false });
  return out;
};

const castOperatorValue = (st, op, v, path) => {
  if (QUERY_SELECTORS_PASSTHROUGH.has(op)) return v;
  if (op === '$in' || op === '$nin' || op === '$all') {
    const arr = Array.isArray(v) ? v : [v];
    const elementType = st.instance === 'Array' ? st.caster || st : st;
    return arr.map((el) => (elementType === st && st.instance === 'Array' ? toQueryForm(el) : castForQuery(elementType, el, path)));
  }
  if (op === '$elemMatch') {
    if (st.isDocArray && isPOJO(v)) return castFilter(st.schema, v);
    if (st.caster && isPOJO(v)) return castCondition(st.caster, v, path);
    return toQueryForm(v);
  }
  if (op === '$not') return isPOJO(v) ? castCondition(st, v, path) : v;
  if (['$eq', '$ne', '$gt', '$gte', '$lt', '$lte'].includes(op)) {
    if (st.instance === 'Array' && st.caster && !Array.isArray(v)) return castForQuery(st.caster, v, path);
    return castForQuery(st, v, path);
  }
  return toQueryForm(v);
};

const castCondition = (st, cond, path) => {
  const out = {};
  for (const [op, v] of Object.entries(cond)) out[op] = castOperatorValue(st, op, v, path);
  return out;
};

const isOperatorObject = (v) => isPOJO(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => k.startsWith('$'));

/** Casts a mongo filter to query form against the schema; throws CastError for bad ids. */
export function castFilter(schema, filter) {
  if (!filter || typeof filter !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined) continue;
    if (key === '$and' || key === '$or' || key === '$nor') {
      out[key] = (Array.isArray(value) ? value : [value]).map((f) => castFilter(schema, f));
      continue;
    }
    if (key.startsWith('$')) {
      out[key] = toQueryForm(value);
      continue;
    }
    const r = resolvePath(schema, key);
    if (!r || r.mixed || r.nested || !r.st || r.subdoc) {
      out[key] = toQueryForm(value);
      continue;
    }
    out[key] = isOperatorObject(value) ? castCondition(r.st, value, key) : castForQuery(r.st, value, key);
  }
  return out;
}

// ---------------------------------------------------------------- update casting

const castUpdatePathValue = (schema, path, value, strict) => {
  const r = resolvePath(schema, path);
  if (r && r.st && !r.mixed && !r.subdoc) return { ok: true, value: castValue(r.st, value, 'query', path) };
  if (r && r.subdoc && r.st) {
    if (r.element) return { ok: true, value: castSubdoc(r.st.schema, value, 'query', path) };
    return { ok: true, value: castValue(r.st, value, 'query', path) };
  }
  if (r && r.nested) {
    if (value === null || !isPOJO(value)) return { ok: true, value: toQueryForm(value) };
    const errors = {};
    const out = castObject(schema, value, { mode: 'query', errors, strict, base: `${path}.` });
    const first = Object.values(errors)[0];
    if (first) throw first;
    return { ok: true, value: out };
  }
  if (r && r.mixed) return { ok: true, value: toQueryForm(value) };
  if (!strict) return { ok: true, value: toQueryForm(value) };
  return { ok: false };
};

const castArrayElement = (schema, path, value) => {
  const r = resolvePath(schema, path);
  const st = r?.st;
  if (!st || st.instance !== 'Array') return toQueryForm(value);
  if (st.isDocArray) return castSubdoc(st.schema, value, 'query', path);
  if (st.caster) return castValue(st.caster, value, 'query', path);
  return toQueryForm(value);
};

/** Casts an update document (implicit $set when it has no operators). */
export function castUpdate(schema, update) {
  const strict = schema.options.strict !== false;
  const hasOps = Object.keys(update || {}).some((k) => k.startsWith('$'));
  const src = hasOps ? update : { $set: update };
  const out = {};
  for (const [op, fields] of Object.entries(src)) {
    if (!op.startsWith('$')) {
      // Mixed top-level fields alongside operators → treat as $set.
      (out.$set ||= {})[op] = fields;
      continue;
    }
    if (!fields || typeof fields !== 'object') continue;
    const castedFields = {};
    for (const [path, value] of Object.entries(fields)) {
      if (path === '_id' && (op === '$set' || op === '$setOnInsert')) continue;
      if (value === undefined) continue;
      switch (op) {
        case '$set':
        case '$setOnInsert':
        case '$min':
        case '$max': {
          const res = castUpdatePathValue(schema, path, value, strict);
          if (res.ok) castedFields[path] = res.value;
          break;
        }
        case '$inc':
        case '$mul':
          castedFields[path] = Number(value);
          break;
        case '$push':
        case '$addToSet':
          if (isPOJO(value) && '$each' in value) {
            castedFields[path] = { ...value, $each: (value.$each || []).map((el) => castArrayElement(schema, path, el)) };
          } else castedFields[path] = castArrayElement(schema, path, value);
          break;
        case '$pull': {
          const r = resolvePath(schema, path);
          const st = r?.st;
          if (st?.isDocArray && isPOJO(value)) castedFields[path] = isOperatorObject(value) ? toQueryForm(value) : castFilter(st.schema, value);
          else if (st?.caster && !isPOJO(value)) castedFields[path] = castValue(st.caster, value, 'query', path);
          else castedFields[path] = toQueryForm(value);
          break;
        }
        case '$pullAll':
          castedFields[path] = (value || []).map((el) => castArrayElement(schema, path, el));
          break;
        default:
          castedFields[path] = toQueryForm(value);
      }
    }
    if (Object.keys(castedFields).length) out[op] = { ...(out[op] || {}), ...castedFields };
  }
  return out;
}

// ---------------------------------------------------------------- validation

const msgOf = (spec) => (Array.isArray(spec) ? spec[1] : isPOJO(spec) ? spec.message : undefined);
const valOf = (spec) => (Array.isArray(spec) ? spec[0] : isPOJO(spec) && 'value' in spec ? spec.value : spec);

const fmt = (template, props) => {
  if (typeof template === 'function') return template(props);
  return String(template).replace(/\{(PATH|VALUE|MIN|MAX|MINLENGTH|MAXLENGTH|ENUM)\}/g, (_, k) => {
    const map = { PATH: props.path, VALUE: props.value, MIN: props.min, MAX: props.max, MINLENGTH: props.minlength, MAXLENGTH: props.maxlength, ENUM: props.enumValues };
    return String(map[k]);
  });
};

const isEmptyRequired = (st, v) => v === null || v === undefined || (st.instance === 'String' && v === '');

async function validateLeaf(st, path, v, ctx, errors) {
  const o = st.options || {};
  if (o.required !== undefined && o.required !== false) {
    let flag = valOf(o.required);
    if (typeof flag === 'function') flag = flag.call(ctx, ctx);
    if (flag && isEmptyRequired(st, v)) {
      errors[path] = new ValidatorError({ message: fmt(msgOf(o.required) ?? 'Path `{PATH}` is required.', { path, value: v }), kind: 'required', path, value: v });
      return;
    }
  }
  if (v === null || v === undefined) return;
  const fail = (kind, message, extra = {}) => {
    errors[path] = new ValidatorError({ message: fmt(message, { path, value: v, ...extra }), kind, path, value: v });
  };
  if (st.instance === 'String' && typeof v === 'string') {
    if (o.enum) {
      const values = Array.isArray(o.enum) ? o.enum : o.enum.values || [];
      if (!values.includes(v)) return fail('enum', (!Array.isArray(o.enum) && o.enum.message) || '`{VALUE}` is not a valid enum value for path `{PATH}`.');
    }
    if (o.match) {
      const re = valOf(o.match);
      if (re instanceof RegExp && !re.test(v)) return fail('regexp', msgOf(o.match) ?? 'Path `{PATH}` is invalid ({VALUE}).');
    }
    if (o.minlength !== undefined && v.length < valOf(o.minlength)) {
      return fail('minlength', msgOf(o.minlength) ?? 'Path `{PATH}` (`{VALUE}`) is shorter than the minimum allowed length ({MINLENGTH}).', { minlength: valOf(o.minlength) });
    }
    if (o.maxlength !== undefined && v.length > valOf(o.maxlength)) {
      return fail('maxlength', msgOf(o.maxlength) ?? 'Path `{PATH}` (`{VALUE}`) is longer than the maximum allowed length ({MAXLENGTH}).', { maxlength: valOf(o.maxlength) });
    }
  }
  if ((st.instance === 'Number' && typeof v === 'number') || (st.instance === 'Date' && v instanceof Date)) {
    const num = v instanceof Date ? v.getTime() : v;
    const asNum = (x) => (x instanceof Date ? x.getTime() : typeof x === 'string' ? new Date(x).getTime() : x);
    if (o.min !== undefined && o.min !== null && valOf(o.min) !== null && num < asNum(valOf(o.min))) {
      return fail('min', msgOf(o.min) ?? 'Path `{PATH}` ({VALUE}) is less than minimum allowed value ({MIN}).', { min: valOf(o.min) });
    }
    if (o.max !== undefined && o.max !== null && valOf(o.max) !== null && num > asNum(valOf(o.max))) {
      return fail('max', msgOf(o.max) ?? 'Path `{PATH}` ({VALUE}) is more than maximum allowed value ({MAX}).', { max: valOf(o.max) });
    }
    if (st.instance === 'Number' && o.enum && Array.isArray(o.enum) && !o.enum.includes(v)) {
      return fail('enum', '`{VALUE}` is not a valid enum value for path `{PATH}`.');
    }
  }
  if (o.validate) {
    const validators = Array.isArray(o.validate) && (typeof o.validate[0] === 'function' || isPOJO(o.validate[0]))
      ? (typeof o.validate[0] === 'function' && typeof o.validate[1] === 'string' ? [{ validator: o.validate[0], message: o.validate[1] }] : o.validate)
      : [o.validate];
    for (const spec of validators) {
      const validator = typeof spec === 'function' ? spec : spec.validator;
      if (typeof validator !== 'function') continue;
      let ok;
      try {
        ok = await validator.call(ctx, v);
      } catch (e) {
        errors[path] = new ValidatorError({ message: e.message, kind: 'user defined', path, value: v });
        return;
      }
      if (ok === false) {
        const message = typeof spec === 'function' ? undefined : spec.message;
        return fail('user defined', message ?? 'Validator failed for path `{PATH}` with value `{VALUE}`');
      }
    }
  }
}

/**
 * Validates `doc` (document form) against the schema. `shouldValidate(path)` limits
 * which paths are checked (validateModifiedOnly). Returns errors keyed by path.
 */
export async function validateObject(schema, doc, { ctx, prefix = '', shouldValidate = null, errors = {} } = {}) {
  for (const [path, st] of Object.entries(schema.paths)) {
    if (path === '_id' && st.options.auto) continue;
    const full = prefix + path;
    if (shouldValidate && !shouldValidate(full)) continue;
    const v = getPath(doc, path);
    if (st.instance === 'Array') {
      await validateLeaf({ ...st, instance: 'Array' }, full, v, ctx, errors);
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          if (st.isDocArray && v[i] && typeof v[i] === 'object') {
            await validateObject(st.schema, v[i], { ctx, prefix: `${full}.${i}.`, errors });
          } else if (st.caster) {
            await validateLeaf(st.caster, `${full}.${i}`, v[i], ctx, errors);
          }
        }
      }
    } else if (st.instance === 'Embedded') {
      await validateLeaf(st, full, v, ctx, errors);
      if (v && typeof v === 'object') await validateObject(st.schema, v, { ctx, prefix: `${full}.`, errors });
    } else {
      await validateLeaf(st, full, v, ctx, errors);
    }
  }
  return errors;
}
