import { Query as MingoQuery, Aggregator, update as mingoUpdate } from 'mingo';
import { compare as mingoCompare, resolve as mingoResolve } from 'mingo/util';
import { ObjectId, idString } from './objectid.js';
import { isPOJO, resolvePath } from './schema.js';
import {
  CastError, ValidationError, getPath, setPath, isDocument, castValue, castObject, applyDefaults, cloneValue,
  toStorage, toQueryForm, minimize, hydrateInPlace, castFilter, castUpdate, validateObject,
} from './cast.js';
import {
  buildPrefilter, selectRows, countRows, insertDocs, replaceDoc, patchDoc, deleteDocs, sweepExpired,
  registerUniqueIndex, indexName, jsonExpr, isSafePath,
} from './store.js';

export const models = {};
const modelsByCollection = {};

// ---------------------------------------------------------------- hooks

async function runHooks(list, ctx, args = []) {
  for (const { fn } of list || []) {
    if (!fn) continue;
    if (fn.length > args.length) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const next = (err) => {
          if (settled) return;
          settled = true;
          if (err instanceof Error) reject(err);
          else resolve();
        };
        try {
          const ret = fn.call(ctx, ...args, next);
          if (ret && typeof ret.then === 'function') ret.then(() => next(), (e) => next(e instanceof Error ? e : new Error(String(e))));
        } catch (e) {
          next(e);
        }
      });
    } else {
      await fn.call(ctx, ...args);
    }
  }
}

const docHooks = (schema, kind, name) => (schema.hooks[kind][name] || []).filter((h) => h.opts.document !== false);
const queryHooks = (schema, kind, name) => (schema.hooks[kind][name] || []).filter((h) => h.opts.query !== false);

// ---------------------------------------------------------------- diffing

const stableJSON = (v) => JSON.stringify(v === undefined ? null : v);

/** Leaf paths that differ between two storage-form objects (arrays compared whole). */
function diffPaths(prev, curr, prefix = '', out = []) {
  const keys = new Set([...Object.keys(prev || {}), ...Object.keys(curr || {})]);
  for (const k of keys) {
    const a = prev?.[k];
    const b = curr?.[k];
    const path = prefix + k;
    if (isPOJO(a) && isPOJO(b)) diffPaths(a, b, `${path}.`, out);
    else if (stableJSON(a) !== stableJSON(b)) out.push(path);
  }
  return out;
}

const pathTouches = (paths, path) => paths.some((m) => m === path || path.startsWith(`${m}.`) || m.startsWith(`${path}.`));

// ---------------------------------------------------------------- projection

function parseSelect(arg, acc = { incl: new Set(), excl: new Set(), plus: new Set() }) {
  if (arg === undefined || arg === null || arg === '') return acc;
  if (typeof arg === 'string') arg = arg.split(/\s+/).filter(Boolean);
  if (Array.isArray(arg)) {
    for (const t of arg) {
      if (t.startsWith('-')) acc.excl.add(t.slice(1));
      else if (t.startsWith('+')) acc.plus.add(t.slice(1));
      else acc.incl.add(t);
    }
    return acc;
  }
  if (typeof arg === 'object') {
    for (const [k, v] of Object.entries(arg)) {
      if (v === 0 || v === false || v === '0') acc.excl.add(k);
      else if (typeof v === 'string' && v.startsWith('+')) acc.plus.add(k);
      else acc.incl.add(k);
    }
  }
  return acc;
}

function finalizeProjection(schema, sel) {
  const hidden = Object.entries(schema.paths).filter(([, st]) => st.options?.select === false).map(([p]) => p);
  const incl = [...(sel?.incl || [])].filter((p) => p !== '_id');
  if (incl.length) {
    return { mode: 'incl', paths: incl, noId: sel.excl.has('_id') };
  }
  const excl = [...(sel?.excl || [])];
  for (const h of hidden) if (!sel?.plus?.has(h) && !sel?.incl?.has(h)) excl.push(h);
  return excl.length ? { mode: 'excl', paths: excl } : null;
}

function projectInclude(src, dst, parts) {
  if (src === null || src === undefined) return;
  const [head, ...rest] = parts;
  if (!(head in src)) return;
  if (!rest.length) {
    dst[head] = src[head];
    return;
  }
  const v = src[head];
  if (Array.isArray(v)) {
    const prev = Array.isArray(dst[head]) ? dst[head] : v.map(() => ({}));
    v.forEach((el, i) => {
      if (el && typeof el === 'object') {
        prev[i] = prev[i] && typeof prev[i] === 'object' ? prev[i] : {};
        projectInclude(el, prev[i], rest);
      }
    });
    dst[head] = prev;
  } else if (v && typeof v === 'object') {
    dst[head] = dst[head] && typeof dst[head] === 'object' ? dst[head] : {};
    projectInclude(v, dst[head], rest);
  }
}

function projectExclude(obj, parts) {
  if (!obj || typeof obj !== 'object') return;
  const [head, ...rest] = parts;
  if (!rest.length) {
    delete obj[head];
    return;
  }
  const v = obj[head];
  if (Array.isArray(v)) v.forEach((el) => projectExclude(el, rest));
  else projectExclude(v, rest);
}

function applyProjection(raw, proj) {
  if (!proj) return raw;
  if (proj.mode === 'incl') {
    const out = {};
    if (!proj.noId && raw._id !== undefined) out._id = raw._id;
    for (const p of proj.paths) projectInclude(raw, out, p.split('.'));
    return out;
  }
  for (const p of proj.paths) projectExclude(raw, p.split('.'));
  return raw;
}

const selectedFn = (proj) => {
  if (!proj) return null;
  if (proj.mode === 'incl') return (path) => pathTouches(proj.paths, path);
  return (path) => !proj.paths.some((p) => p === path || path.startsWith(`${p}.`));
};

// ---------------------------------------------------------------- sorting

function parseSort(arg) {
  if (!arg) return null;
  const spec = {};
  if (typeof arg === 'string') {
    for (const t of arg.split(/\s+/).filter(Boolean)) {
      if (t.startsWith('-')) spec[t.slice(1)] = -1;
      else spec[t] = 1;
    }
  } else if (Array.isArray(arg)) {
    for (const [k, v] of arg) spec[k] = v;
  } else if (typeof arg === 'object') {
    for (const [k, v] of Object.entries(arg)) {
      spec[k] = v === -1 || v === '-1' || v === 'desc' || v === 'descending' ? -1 : (isPOJO(v) ? 1 : 1);
    }
  }
  return Object.keys(spec).length ? spec : null;
}

const sortValue = (doc, path, dir) => {
  const v = mingoResolve(doc, path);
  if (Array.isArray(v)) {
    if (!v.length) return undefined;
    return v.reduce((acc, x) => (acc === undefined ? x : (dir > 0 ? (mingoCompare(x, acc) < 0 ? x : acc) : (mingoCompare(x, acc) > 0 ? x : acc))), undefined);
  }
  return v;
};

function sortEntries(entries, spec) {
  const keys = Object.entries(spec);
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      for (const [path, dir] of keys) {
        const c = mingoCompare(sortValue(a.e.q, path, dir) ?? null, sortValue(b.e.q, path, dir) ?? null);
        if (c !== 0) return dir < 0 ? -c : c;
      }
      return a.i - b.i;
    })
    .map((x) => x.e);
}

const SQL_SORTABLE = new Set(['String', 'ObjectId', 'Boolean', 'Number', 'Date']);

function sqlOrderBy(schema, spec) {
  const parts = [];
  for (const [path, dir] of Object.entries(spec)) {
    if (path === '_id') {
      parts.push(`_id ${dir < 0 ? 'DESC' : 'ASC'}`);
      continue;
    }
    const r = resolvePath(schema, path);
    if (!r?.st || r.inArray || r.mixed || !SQL_SORTABLE.has(r.st.instance) || !isSafePath(path)) return null;
    parts.push(`${jsonExpr(path)} ${dir < 0 ? 'DESC' : 'ASC'}`);
  }
  parts.push('rowid ASC');
  return parts.join(', ');
}

// ---------------------------------------------------------------- loading

async function loadMatches(Model, filter, { sort, skip, limit, needAll = false } = {}) {
  const schema = Model.schema;
  if (schema.ttl) await sweepExpired(Model.collection.name, schema.ttl);
  const casted = castFilter(schema, filter);
  const pre = buildPrefilter(schema, casted);
  const spec = parseSort(sort);
  const orderBy = spec ? sqlOrderBy(schema, spec) : '';
  // Push sort/skip/limit down to SQL only when SQL alone decides the match set.
  const pushDown = pre.exact && !needAll && (!spec || orderBy);
  const rows = await selectRows(Model.collection.name, {
    where: pre.where,
    params: pre.params,
    orderBy: pushDown && orderBy ? orderBy : '',
    limit: pushDown ? limit : undefined,
    offset: pushDown ? skip : undefined,
  });
  let entries = rows.map((text) => ({ text, q: hydrateInPlace(schema, JSON.parse(text), false) }));
  if (!pre.exact) {
    const mq = new MingoQuery(casted);
    entries = entries.filter((e) => mq.test(e.q));
  }
  if (!pushDown) {
    if (spec) entries = sortEntries(entries, spec);
    if (skip) entries = entries.slice(skip);
    if (limit !== undefined && limit !== null && limit > 0) entries = entries.slice(0, limit);
  }
  return entries;
}

// ---------------------------------------------------------------- document

const STATE = Symbol('mongoose-d1-state');

function initState(doc, isNew) {
  Object.defineProperty(doc, '$__', {
    value: { isNew, snapshot: {}, castErrors: {}, populated: {}, populatedVirtuals: {}, forced: new Set(), selected: null },
    enumerable: false,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(doc, '_doc', { value: {}, enumerable: false, configurable: true, writable: true });
  Object.defineProperty(doc, '$locals', { value: {}, enumerable: false, configurable: true, writable: true });
  Object.defineProperty(doc, 'errors', { value: undefined, enumerable: false, configurable: true, writable: true });
}

const decorateArray = (arr, st) => {
  if (!Array.isArray(arr) || arr[STATE]) return arr;
  Object.defineProperty(arr, STATE, { value: true, enumerable: false });
  const castEl = (el) => {
    try {
      if (st.isDocArray) return castValue({ ...st, instance: 'Array' }, [el], 'doc')[0];
      if (st.caster) return castValue(st.caster, el, 'doc');
    } catch {
      /* keep raw */
    }
    return el;
  };
  const defs = {
    id(id) {
      const hex = idString(id);
      return this.find((el) => el && idString(el._id) === hex) || null;
    },
    push(...items) {
      return Array.prototype.push.apply(this, items.map(castEl));
    },
    unshift(...items) {
      return Array.prototype.unshift.apply(this, items.map(castEl));
    },
    addToSet(...items) {
      const added = [];
      for (const item of items.map(castEl)) {
        const key = stableJSON(toStorage(item));
        if (!this.some((el) => stableJSON(toStorage(el)) === key)) {
          Array.prototype.push.call(this, item);
          added.push(item);
        }
      }
      return added;
    },
    pull(...items) {
      for (const item of items) {
        const hex = idString(item);
        const key = stableJSON(toStorage(item));
        for (let i = this.length - 1; i >= 0; i--) {
          const el = this[i];
          const match = (el && typeof el === 'object' && el._id !== undefined && idString(el._id) === hex) || stableJSON(toStorage(el)) === key;
          if (match) this.splice(i, 1);
        }
      }
      return this;
    },
    remove(...items) {
      return defs.pull.apply(this, items);
    },
    toObject() {
      return this.map((el) => cloneValue(el));
    },
    isMongooseArray: true,
  };
  for (const [k, v] of Object.entries(defs)) Object.defineProperty(arr, k, { value: v, enumerable: false, configurable: true, writable: true });
  return arr;
};

function decorateArrays(schema, obj) {
  for (const [path, st] of Object.entries(schema.paths)) {
    if (st.instance !== 'Array') continue;
    const v = getPath(obj, path);
    if (Array.isArray(v)) {
      decorateArray(v, st);
      if (st.isDocArray) for (const el of v) if (isPOJO(el)) decorateArrays(st.schema, el);
    }
  }
}

function plainify(v, opts, kind = 'toObject') {
  if (v === null || v === undefined) return v;
  if (isDocument(v)) return v._toPlain(opts, kind);
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof ObjectId) return v;
  if (Array.isArray(v)) return v.map((el) => plainify(el, opts, kind));
  if (isPOJO(v)) {
    const out = {};
    for (const [k, val] of Object.entries(v)) if (val !== undefined) out[k] = plainify(val, opts, kind);
    return out;
  }
  return v;
}

export class Document {
  constructor(obj, fields, skipId) {
    initState(this, true);
    const schema = this.constructor.schema;
    if (!schema) return;
    const errors = {};
    const src = isDocument(obj) ? obj.toObject() : obj || {};
    this._doc = castObject(schema, src, { mode: 'doc', errors, strict: schema.options.strict !== false });
    this.$__.castErrors = errors;
    let generatedId = false;
    if (schema.paths._id && this._doc._id === undefined && schema.paths._id.options.auto && !skipId) {
      this._doc._id = new ObjectId();
      generatedId = true;
    }
    const filled = applyDefaults(schema, this._doc, { mode: 'doc', ctx: this });
    decorateArrays(schema, this._doc);
    // Baseline for isModified on a new doc: defaults and the generated _id only.
    const baseline = {};
    if (generatedId) baseline._id = toStorage(this._doc._id);
    for (const p of filled) setPath(baseline, p, toStorage(getPath(this._doc, p)));
    this.$__.snapshot = baseline;
  }

  get isNew() {
    return this.$__.isNew;
  }

  set isNew(v) {
    this.$__.isNew = Boolean(v);
  }

  get $isNew() {
    return this.$__.isNew;
  }

  get schema() {
    return this.constructor.schema;
  }

  get $isDeleted() {
    return Boolean(this.$__.deleted);
  }

  get(path) {
    const schema = this.constructor.schema;
    if (schema.virtuals[path]) return this[path];
    if (!path.includes('.')) return this[path];
    return getPath(this._doc, path);
  }

  set(path, value) {
    if (isPOJO(path)) {
      for (const [k, v] of Object.entries(path)) this.set(k, v);
      return this;
    }
    const schema = this.constructor.schema;
    if (!path.includes('.')) {
      if (schema.topKeys().includes(path)) this[path] = value;
      else this._doc[path] = value;
      return this;
    }
    const r = resolvePath(schema, path);
    let v = value;
    if (r?.st && !r.mixed) {
      try {
        v = castValue(r.st, value, 'doc', path);
        delete this.$__.castErrors[path];
      } catch (e) {
        this.$__.castErrors[path] = e;
      }
    }
    setPath(this._doc, path, v);
    return this;
  }

  $set(path, value) {
    return this.set(path, value);
  }

  toObject(options = {}) {
    return this._toPlain(options, 'toObject');
  }

  toJSON(options = {}) {
    return this._toPlain(options, 'toJSON');
  }

  _toPlain(options, kind) {
    const schema = this.constructor.schema;
    const opts = { ...(schema.options[kind] || {}), ...options };
    const childOpts = { ...options };
    const out = plainify(this._doc, childOpts, kind);
    if (opts.depopulate) {
      for (const p of Object.keys(this.$__.populated)) {
        const v = getPath(out, p);
        if (Array.isArray(v)) setPath(out, p, v.map((x) => (x && x._id !== undefined ? x._id : x)));
        else if (v && typeof v === 'object' && v._id !== undefined) setPath(out, p, v._id);
      }
    }
    const shouldMinimize = opts.minimize !== undefined ? opts.minimize : schema.options.minimize !== false;
    if (shouldMinimize) minimize(out);
    if (opts.virtuals) {
      for (const [name, vt] of Object.entries(schema.virtuals)) {
        if (name === 'id' && opts.virtuals !== true && !Array.isArray(opts.virtuals)) continue;
        if (Array.isArray(opts.virtuals) && !opts.virtuals.includes(name)) continue;
        if (vt.options?.ref) {
          if (name in this.$__.populatedVirtuals) out[name] = plainify(this.$__.populatedVirtuals[name], childOpts, kind);
          continue;
        }
        if (!vt.getters.length) continue;
        try {
          const val = this[name];
          if (val !== undefined) out[name] = plainify(val, childOpts, kind);
        } catch {
          /* virtual getter failed on partial doc */
        }
      }
    }
    if (opts.versionKey === false && schema.options.versionKey) delete out[schema.options.versionKey];
    if (typeof opts.transform === 'function') {
      const res = opts.transform(this, out, opts);
      if (res !== undefined) return res;
    }
    return out;
  }

  inspect() {
    return this.toObject();
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.toObject();
  }

  _storageForm() {
    const schema = this.constructor.schema;
    const s = toStorage(this._doc);
    if (schema.options.minimize !== false) minimize(s);
    return s;
  }

  modifiedPaths() {
    const curr = this._storageForm();
    const paths = diffPaths(this.$__.snapshot, curr);
    for (const f of this.$__.forced) if (!paths.includes(f)) paths.push(f);
    return paths;
  }

  directModifiedPaths() {
    return this.modifiedPaths();
  }

  isModified(path) {
    const paths = this.modifiedPaths();
    if (path === undefined) return paths.length > 0;
    const list = Array.isArray(path) ? path : String(path).split(' ');
    return list.some((p) => pathTouches(paths, p));
  }

  isDirectModified(path) {
    return this.isModified(path);
  }

  isInit(path) {
    return !this.$__.isNew && getPath(this._doc, path) !== undefined;
  }

  isSelected(path) {
    const fn = this.$__.selected;
    return fn ? fn(path) : true;
  }

  markModified(path) {
    this.$__.forced.add(path);
  }

  unmarkModified(path) {
    this.$__.forced.delete(path);
  }

  getChanges() {
    const curr = this._storageForm();
    const prev = this.$__.snapshot || {};
    const $set = {};
    const $unset = {};
    const keys = new Set([...Object.keys(prev), ...Object.keys(curr), ...[...this.$__.forced].map((f) => f.split('.')[0])]);
    for (const k of keys) {
      const changed = stableJSON(prev[k]) !== stableJSON(curr[k]) || [...this.$__.forced].some((f) => f.split('.')[0] === k);
      if (!changed) continue;
      if (curr[k] === undefined) $unset[k] = 1;
      else $set[k] = getPath(this._doc, k);
    }
    const out = {};
    if (Object.keys($set).length) out.$set = $set;
    if (Object.keys($unset).length) out.$unset = $unset;
    return out;
  }

  equals(other) {
    if (!other) return false;
    return idString(this._doc._id) === idString(isDocument(other) ? other._doc._id : other._id ?? other);
  }

  populated(path) {
    if (!(path in this.$__.populated)) return undefined;
    const v = getPath(this._doc, path);
    if (Array.isArray(v)) return v.map((x) => (isDocument(x) ? x._doc._id : x?._id ?? x));
    return isDocument(v) ? v._doc._id : v?._id ?? v;
  }

  depopulate(path) {
    const paths = path ? [path] : Object.keys(this.$__.populated);
    for (const p of paths) {
      const v = getPath(this._doc, p);
      if (Array.isArray(v)) setPath(this._doc, p, v.map((x) => (isDocument(x) ? x._doc._id : x)));
      else if (isDocument(v)) setPath(this._doc, p, v._doc._id);
      delete this.$__.populated[p];
    }
    return this;
  }

  async populate(...args) {
    const specs = normalizePopulate(args);
    await populateDocs(this.constructor, [this], specs, false);
    return this;
  }

  ownerDocument() {
    return this;
  }

  async validate(pathsToValidate, options = {}) {
    if (isPOJO(pathsToValidate)) {
      options = pathsToValidate;
      pathsToValidate = undefined;
    }
    const Model = this.constructor;
    const schema = Model.schema;
    await runHooks(docHooks(schema, 'pre', 'validate'), this);
    let shouldValidate = null;
    if (options.validateModifiedOnly && !this.$__.isNew) {
      const modified = this.modifiedPaths();
      shouldValidate = (p) => pathTouches(modified, p);
    } else if (pathsToValidate) {
      const list = Array.isArray(pathsToValidate) ? pathsToValidate : String(pathsToValidate).split(' ');
      shouldValidate = (p) => pathTouches(list, p);
    }
    const selected = this.$__.selected;
    const errors = {};
    for (const [p, e] of Object.entries(this.$__.castErrors)) if (!shouldValidate || shouldValidate(p)) errors[p] = e;
    await validateObject(schema, this._doc, {
      ctx: this,
      shouldValidate: (p) => (!shouldValidate || shouldValidate(p)) && (!selected || selected(p)) && !(p in errors),
      errors,
    });
    if (Object.keys(errors).length) {
      const err = new ValidationError(Model.modelName, errors);
      this.errors = errors;
      throw err;
    }
    this.errors = undefined;
    await runHooks(docHooks(schema, 'post', 'validate'), this, [this]);
  }

  validateSync() {
    return undefined;
  }

  async save(options = {}) {
    const Model = this.constructor;
    const schema = Model.schema;
    const table = Model.collection.name;
    if (options.validateBeforeSave !== false && schema.options.validateBeforeSave !== false) {
      await this.validate({ validateModifiedOnly: options.validateModifiedOnly });
    }
    await runHooks(docHooks(schema, 'pre', 'save'), this);
    const ts = schema.timestampPaths;
    const now = new Date();
    if (this.$__.isNew) {
      if (ts?.createdAt && this._doc[ts.createdAt] === undefined) this._doc[ts.createdAt] = now;
      if (ts?.updatedAt && this._doc[ts.updatedAt] === undefined) this._doc[ts.updatedAt] = now;
      if (schema.options.versionKey && this._doc[schema.options.versionKey] === undefined) this._doc[schema.options.versionKey] = 0;
      const stored = this._storageForm();
      await insertDocs(table, [stored]);
      this.$__.isNew = false;
      this.$__.snapshot = stored;
    } else {
      const changes = this.modifiedPaths();
      if (changes.length || this.$__.forced.size) {
        if (ts?.updatedAt && options.timestamps !== false && !changes.includes(ts.updatedAt)) this._doc[ts.updatedAt] = now;
        const stored = this._storageForm();
        const prev = this.$__.snapshot || {};
        const sets = {};
        const unsets = [];
        const keys = new Set([...Object.keys(prev), ...Object.keys(stored)]);
        const forcedTop = new Set([...this.$__.forced].map((f) => f.split('.')[0]));
        for (const k of keys) {
          if (stored[k] === undefined) {
            if (prev[k] !== undefined && (this.$__.selected ? this.$__.selected(k) : true)) unsets.push(k);
          } else if (stableJSON(prev[k]) !== stableJSON(stored[k]) || forcedTop.has(k)) {
            sets[k] = stored[k];
          }
        }
        // Like mongoose, bump the version key when an array changed.
        const vk = schema.options.versionKey;
        if (vk && Object.keys(sets).some((k) => schema.paths[k]?.instance === 'Array')) {
          this._doc[vk] = (Number(this._doc[vk]) || 0) + 1;
          sets[vk] = this._doc[vk];
          stored[vk] = this._doc[vk];
        }
        await patchDoc(table, this._doc._id, sets, unsets, stored);
        this.$__.snapshot = stored;
        this.$__.forced.clear();
      }
    }
    await runHooks(docHooks(schema, 'post', 'save'), this, [this]);
    return this;
  }

  async deleteOne() {
    const Model = this.constructor;
    await runHooks(docHooks(Model.schema, 'pre', 'deleteOne'), this);
    await deleteDocs(Model.collection.name, [idString(this._doc._id)]);
    this.$__.deleted = true;
    await runHooks(docHooks(Model.schema, 'post', 'deleteOne'), this, [this]);
    return this;
  }

  async remove() {
    return this.deleteOne();
  }

  increment() {
    return this;
  }
}

/** Builds a Document from a storage-form JSON row. */
function hydrateDocument(Model, raw, proj) {
  const schema = Model.schema;
  const doc = Object.create(Model.prototype);
  initState(doc, false);
  doc._doc = hydrateInPlace(schema, raw, true);
  const isSelected = selectedFn(proj);
  doc.$__.selected = isSelected;
  applyDefaults(schema, doc._doc, { mode: 'doc', isSelected, ctx: doc });
  decorateArrays(schema, doc._doc);
  doc.$__.snapshot = doc._storageForm();
  return doc;
}

// ---------------------------------------------------------------- populate

function normalizePopulate(args) {
  const out = [];
  const push = (spec) => {
    if (!spec) return;
    if (typeof spec === 'string') {
      for (const p of spec.split(/\s+/).filter(Boolean)) out.push({ path: p });
      return;
    }
    if (Array.isArray(spec)) {
      spec.forEach(push);
      return;
    }
    if (typeof spec === 'object' && spec.path) {
      for (const p of String(spec.path).split(/\s+/).filter(Boolean)) out.push({ ...spec, path: p });
    }
  };
  if (typeof args[0] === 'string' && args.length > 1 && (typeof args[1] === 'string' || isPOJO(args[1]) || args[1] === null)) {
    const [path, select, model, match, options] = args;
    for (const p of path.split(/\s+/).filter(Boolean)) out.push({ path: p, select: select ?? undefined, model, match, options });
    return out;
  }
  args.forEach(push);
  return out;
}

const resolveModel = (ref, ctxDoc) => {
  if (!ref) return null;
  if (typeof ref === 'function' && ref.modelName) return ref;
  if (typeof ref === 'function') return resolveModel(ref.call(ctxDoc, ctxDoc), ctxDoc);
  return models[ref] || null;
};

const containerOf = (d) => (isDocument(d) ? d._doc : d);

/** Collects values at a dotted path, flattening arrays along the way. */
function valuesAt(obj, parts) {
  if (obj === null || obj === undefined) return [];
  if (!parts.length) return Array.isArray(obj) ? obj.flat(Infinity) : [obj];
  if (Array.isArray(obj)) return obj.flatMap((el) => valuesAt(el, parts));
  const target = isDocument(obj) ? obj._doc : obj;
  return valuesAt(target[parts[0]], parts.slice(1));
}

/** Replaces id values at a dotted path using `replace(value) → newValue | undefined (drop)`. */
function replaceAt(obj, parts, replace) {
  if (obj === null || obj === undefined) return;
  const target = isDocument(obj) ? obj._doc : obj;
  if (Array.isArray(target)) {
    target.forEach((el) => replaceAt(el, parts, replace));
    return;
  }
  const [head, ...rest] = parts;
  if (!(head in target)) return;
  if (rest.length) {
    replaceAt(target[head], rest, replace);
    return;
  }
  const v = target[head];
  if (Array.isArray(v)) {
    const next = [];
    for (const el of v) {
      const r = replace(el);
      if (r !== undefined && r !== null) next.push(r);
    }
    v.length = 0;
    Array.prototype.push.apply(v, next);
  } else if (v !== undefined) {
    const r = replace(v);
    target[head] = r === undefined ? null : r;
  }
}

async function populateDocs(Model, docs, specs, lean) {
  const list = docs.filter(Boolean);
  if (!list.length) return;
  for (const spec of specs) {
    const schema = Model.schema;
    const virtual = schema.virtuals[spec.path];
    if (virtual?.options?.ref) {
      const vo = virtual.options;
      const Ref = resolveModel(spec.model || vo.ref, list[0]);
      if (!Ref) continue;
      const localParts = String(vo.localField).split('.');
      const foreignField = String(vo.foreignField);
      const localValues = [...new Set(list.flatMap((d) => valuesAt(containerOf(d), localParts)).map((v) => String(idString(v))))];
      const filter = { ...(vo.match || {}), ...(spec.match || {}), [foreignField]: { $in: localValues } };
      if (vo.count) {
        const found = await Ref.find(filter).select(foreignField).lean();
        for (const d of list) {
          const mine = new Set(valuesAt(containerOf(d), localParts).map((v) => String(idString(v))));
          const n = found.filter((f) => valuesAt(f, foreignField.split('.')).some((v) => mine.has(String(idString(v))))).length;
          if (lean || !isDocument(d)) d[spec.path] = n;
          else d.$__.populatedVirtuals[spec.path] = n;
        }
        continue;
      }
      let sel = spec.select;
      const q = Ref.find(filter);
      if (sel) {
        q.select(sel);
        const parsed = parseSelect(sel);
        if (parsed.incl.size) q.select(foreignField);
      }
      if (spec.options?.sort || vo.options?.sort) q.sort(spec.options?.sort || vo.options?.sort);
      if (spec.populate) q.populate(spec.populate);
      if (lean) q.lean();
      const found = await q.exec();
      for (const d of list) {
        const mine = new Set(valuesAt(containerOf(d), localParts).map((v) => String(idString(v))));
        const matches = found.filter((f) => valuesAt(containerOf(f), foreignField.split('.')).some((v) => mine.has(String(idString(v)))));
        const value = vo.justOne ? matches[0] ?? null : matches;
        if (lean || !isDocument(d)) d[spec.path] = value;
        else d.$__.populatedVirtuals[spec.path] = value;
      }
      continue;
    }

    const r = resolvePath(schema, spec.path);
    const st = r?.st;
    const ref = spec.model || st?.options?.ref || st?.caster?.options?.ref;
    const Ref = resolveModel(ref, list[0]);
    if (!Ref) continue;
    const parts = spec.path.split('.');
    const ids = [...new Set(list.flatMap((d) => valuesAt(containerOf(d), parts)).map((v) => (v == null ? null : String(idString(v)))).filter((v) => v && /^[0-9a-f]{24}$/i.test(v)))];
    let byId = new Map();
    if (ids.length) {
      const q = Ref.find({ ...(spec.match || {}), _id: { $in: ids } });
      if (spec.select) q.select(spec.select);
      if (spec.options?.sort) q.sort(spec.options.sort);
      if (spec.populate) q.populate(spec.populate);
      if (lean) q.lean();
      const found = await q.exec();
      byId = new Map(found.map((f) => [String(idString(containerOf(f)._id)), f]));
    }
    for (const d of list) {
      replaceAt(containerOf(d), parts, (v) => {
        if (v === null || v === undefined) return v;
        const key = String(idString(v));
        return byId.has(key) ? byId.get(key) : null;
      });
      if (isDocument(d)) d.$__.populated[spec.path] = true;
    }
  }
}

// ---------------------------------------------------------------- query

const QUERY_OPS_RETURNING_DOC = new Set(['findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace']);

export class Query {
  constructor(Model, op, filter, extra = {}) {
    this.model = Model;
    this.op = op;
    this._conditions = { ...(filter || {}) };
    this._select = null;
    this._sort = undefined;
    this._skip = undefined;
    this._limit = undefined;
    this._lean = false;
    this._populate = [];
    this._update = extra.update;
    this._distinct = extra.distinct;
    this.options = { ...(extra.options || {}) };
    for (const [name, fn] of Object.entries(Model.schema.query || {})) {
      if (typeof fn === 'function' && !(name in this)) this[name] = fn.bind(this);
    }
    if (this.options.sort) this._sort = this.options.sort;
    if (this.options.lean) this._lean = true;
    if (this.options.populate) this._populate.push(...normalizePopulate([this.options.populate]));
    if (this.options.skip) this._skip = this.options.skip;
    if (this.options.limit) this._limit = this.options.limit;
    if (this.options.projection || this.options.fields || this.options.select) this.select(this.options.projection || this.options.fields || this.options.select);
  }

  find(filter) {
    this.op = 'find';
    if (filter) Object.assign(this._conditions, filter);
    return this;
  }

  findOne(filter) {
    this.op = 'findOne';
    if (filter) Object.assign(this._conditions, filter);
    return this;
  }

  where(path, value) {
    if (isPOJO(path)) Object.assign(this._conditions, path);
    else if (value !== undefined) this._conditions[path] = value;
    return this;
  }

  select(arg) {
    if (arg === undefined || arg === null || arg === '') return this;
    this._select = parseSelect(arg, this._select || undefined);
    return this;
  }

  projection(arg) {
    return this.select(arg);
  }

  sort(arg) {
    if (!arg) return this;
    const prev = parseSort(this._sort) || {};
    this._sort = { ...prev, ...parseSort(arg) };
    return this;
  }

  skip(n) {
    this._skip = Number(n) || 0;
    return this;
  }

  limit(n) {
    this._limit = Number(n) || 0;
    return this;
  }

  lean(v = true) {
    this._lean = Boolean(v);
    return this;
  }

  populate(...args) {
    this._populate.push(...normalizePopulate(args));
    return this;
  }

  setOptions(opts = {}) {
    Object.assign(this.options, opts);
    if (opts.lean !== undefined) this._lean = Boolean(opts.lean);
    if (opts.sort) this.sort(opts.sort);
    if (opts.skip !== undefined) this.skip(opts.skip);
    if (opts.limit !== undefined) this.limit(opts.limit);
    if (opts.populate) this.populate(opts.populate);
    return this;
  }

  setQuery(filter) {
    this._conditions = { ...(filter || {}) };
    return this;
  }

  setUpdate(update) {
    this._update = update;
    return this;
  }

  getFilter() {
    return this._conditions;
  }

  getQuery() {
    return this._conditions;
  }

  getUpdate() {
    return this._update;
  }

  getOptions() {
    return this.options;
  }

  countDocuments(filter) {
    this.op = 'countDocuments';
    if (filter) Object.assign(this._conditions, filter);
    return this;
  }

  distinct(field, filter) {
    this.op = 'distinct';
    this._distinct = field;
    if (filter) Object.assign(this._conditions, filter);
    return this;
  }

  orFail(err) {
    this._orFail = err || true;
    return this;
  }

  session() { return this; }
  collation() { return this; }
  hint() { return this; }
  maxTimeMS() { return this; }
  read() { return this; }
  allowDiskUse() { return this; }
  batchSize() { return this; }
  comment() { return this; }
  tailable() { return this; }
  j() { return this; }
  w() { return this; }
  wtimeout() { return this; }

  async exec() {
    const schema = this.model.schema;
    await runHooks(queryHooks(schema, 'pre', this.op), this);
    let result = await this._run();
    if (this._orFail && (result === null || (this.op.startsWith('update') && result?.matchedCount === 0) || (this.op.startsWith('delete') && result?.deletedCount === 0))) {
      const err = this._orFail === true ? Object.assign(new Error(`No document found for query "${JSON.stringify(this._conditions)}" on model "${this.model.modelName}"`), { name: 'DocumentNotFoundError' }) : (typeof this._orFail === 'function' ? this._orFail() : this._orFail);
      throw err;
    }
    for (const { fn } of queryHooks(schema, 'post', this.op)) {
      if (fn) await (fn.length > 1 ? new Promise((res, rej) => fn.call(this, result, (e) => (e ? rej(e) : res()))) : fn.call(this, result));
    }
    return result;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(fn) {
    return this.exec().finally(fn);
  }

  get [Symbol.toStringTag]() {
    return 'Query';
  }

  /** Final projection; like mongoose, an inclusive select also keeps every populated path. */
  _projection() {
    const schema = this.model.schema;
    const proj = finalizeProjection(schema, this._select);
    if (proj?.mode === 'incl' && this._populate.length) {
      for (const spec of this._populate) {
        const virtual = schema.virtuals[spec.path];
        const path = virtual?.options?.ref ? String(virtual.options.localField) : spec.path;
        if (path !== '_id' && !pathTouches(proj.paths, path)) proj.paths.push(path);
      }
    }
    return proj;
  }

  async _findDocs({ single = false } = {}) {
    const Model = this.model;
    const proj = this._projection();
    const entries = await loadMatches(Model, this._conditions, { sort: this._sort, skip: this._skip, limit: single ? 1 : this._limit });
    const docs = entries.map((e) => {
      const raw = applyProjection(JSON.parse(e.text), proj);
      if (this._lean) return hydrateInPlace(Model.schema, raw, true);
      return hydrateDocument(Model, raw, proj);
    });
    if (this._populate.length) await populateDocs(Model, docs, this._populate, this._lean);
    return docs;
  }

  async _run() {
    const Model = this.model;
    const schema = Model.schema;
    const table = Model.collection.name;
    switch (this.op) {
      case 'find':
        return this._findDocs();
      case 'findOne': {
        const docs = await this._findDocs({ single: true });
        return docs[0] ?? null;
      }
      case 'countDocuments':
      case 'estimatedDocumentCount': {
        const casted = castFilter(schema, this._conditions);
        const pre = buildPrefilter(schema, casted);
        if (pre.exact && !schema.ttl) return countRows(table, pre);
        return (await loadMatches(Model, this._conditions)).length;
      }
      case 'distinct': {
        const entries = await loadMatches(Model, this._conditions);
        const field = this._distinct;
        const r = resolvePath(schema, field);
        const seen = new Map();
        for (const e of entries) {
          for (const v of valuesAt(e.q, field.split('.'))) {
            if (v === undefined) continue;
            const key = stableJSON(toStorage(v));
            if (!seen.has(key)) seen.set(key, v);
          }
        }
        const isOid = r?.st?.instance === 'ObjectId' || r?.st?.caster?.instance === 'ObjectId';
        return [...seen.values()].map((v) => (isOid && typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v) ? new ObjectId(v) : v));
      }
      case 'updateOne':
      case 'updateMany':
      case 'findOneAndUpdate':
      case 'replaceOne':
      case 'findOneAndReplace':
        return this._runUpdate();
      case 'deleteOne':
      case 'deleteMany':
      case 'findOneAndDelete': {
        const many = this.op === 'deleteMany';
        const entries = await loadMatches(Model, this._conditions, { sort: this._sort, limit: many ? undefined : 1 });
        if (!entries.length) return this.op === 'findOneAndDelete' ? null : { acknowledged: true, deletedCount: 0 };
        const ids = entries.map((e) => e.q._id);
        let out;
        if (this.op === 'findOneAndDelete') {
          const proj = this._projection();
          const raw = applyProjection(JSON.parse(entries[0].text), proj);
          out = this._lean ? hydrateInPlace(schema, raw, true) : hydrateDocument(Model, raw, proj);
          if (this._populate.length) await populateDocs(Model, [out], this._populate, this._lean);
        }
        const deletedCount = await deleteDocs(table, ids);
        return out ?? { acknowledged: true, deletedCount };
      }
      default:
        throw new Error(`Unsupported query op ${this.op}`);
    }
  }

  async _runUpdate() {
    const Model = this.model;
    const schema = Model.schema;
    const table = Model.collection.name;
    const opts = this.options;
    const many = this.op === 'updateMany';
    const isReplace = this.op === 'replaceOne' || this.op === 'findOneAndReplace' || opts.overwrite;
    const entries = await loadMatches(Model, this._conditions, { sort: this._sort, limit: many ? undefined : 1 });
    const ts = schema.timestampPaths;
    const now = new Date();
    const update = isReplace ? null : castUpdate(schema, this._update || {});
    if (update && ts?.updatedAt && opts.timestamps !== false) {
      const setsUpdatedAt = Object.values(update).some((f) => f && typeof f === 'object' && ts.updatedAt in f);
      if (!setsUpdatedAt) (update.$set ||= {})[ts.updatedAt] = now;
    }
    const setOnInsert = update?.$setOnInsert;
    if (update) delete update.$setOnInsert;

    const validateTouched = async (qDoc, touched) => {
      if (!opts.runValidators) return;
      const docForm = hydrateInPlace(schema, toStorage(qDoc), true);
      const errors = {};
      await validateObject(schema, docForm, { ctx: null, shouldValidate: (p) => pathTouches(touched, p), errors });
      const required = Object.entries(errors).filter(([, e]) => e.kind === 'required' && !touched.includes(e.path));
      for (const [p] of required) delete errors[p];
      if (Object.keys(errors).length) throw new ValidationError(Model.modelName, errors);
    };
    const touchedPaths = update ? Object.values(update).flatMap((f) => (f && typeof f === 'object' ? Object.keys(f) : [])) : [];

    let upsertedId = null;
    let before = null;
    let afterRaw = null;
    let modified = 0;

    if (!entries.length) {
      if (!opts.upsert) {
        return QUERY_OPS_RETURNING_DOC.has(this.op) ? null : { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0, upsertedId: null };
      }
      // Upsert: seed from equality conditions of the filter, then apply the update.
      const seed = {};
      const casted = castFilter(schema, this._conditions);
      const collect = (f) => {
        for (const [k, v] of Object.entries(f)) {
          if (k === '$and' && Array.isArray(v)) v.forEach(collect);
          else if (!k.startsWith('$') && !(isPOJO(v) && Object.keys(v).some((x) => x.startsWith('$')))) setPath(seed, k, v);
          else if (!k.startsWith('$') && isPOJO(v) && '$eq' in v) setPath(seed, k, v.$eq);
        }
      };
      collect(casted);
      let qDoc;
      if (isReplace) qDoc = { ...seed, ...toQueryForm(castObject(schema, this._update || {}, { mode: 'query', strict: true })) };
      else {
        qDoc = seed;
        mingoUpdate(qDoc, { ...update, ...(setOnInsert ? { $set: { ...(update.$set || {}), ...setOnInsert } } : {}) }, opts.arrayFilters, undefined, { cloneMode: 'deep' });
      }
      if (qDoc._id === undefined) qDoc._id = new ObjectId().toHexString();
      if (opts.setDefaultsOnInsert !== false) applyDefaults(schema, qDoc, { mode: 'query' });
      if (ts?.createdAt && qDoc[ts.createdAt] === undefined) qDoc[ts.createdAt] = now;
      if (ts?.updatedAt && qDoc[ts.updatedAt] === undefined) qDoc[ts.updatedAt] = now;
      if (schema.options.versionKey && qDoc[schema.options.versionKey] === undefined) qDoc[schema.options.versionKey] = 0;
      await validateTouched(qDoc, touchedPaths);
      const stored = toStorage(qDoc);
      await insertDocs(table, [stored]);
      upsertedId = new ObjectId(stored._id);
      afterRaw = JSON.stringify(stored);
    } else {
      for (const e of entries) {
        const qDoc = e.q;
        let next;
        if (isReplace) {
          const replacement = castObject(schema, this._update || {}, { mode: 'query', strict: true });
          next = { ...toQueryForm(replacement), _id: qDoc._id };
          if (ts?.createdAt && qDoc[ts.createdAt] !== undefined) next[ts.createdAt] = qDoc[ts.createdAt];
          if (ts?.updatedAt) next[ts.updatedAt] = now;
        } else {
          next = qDoc;
          mingoUpdate(next, update, opts.arrayFilters, undefined, { cloneMode: 'deep' });
        }
        await validateTouched(next, touchedPaths);
        const stored = toStorage(next);
        const changed = stableJSON(stored) !== e.text && JSON.stringify(stored) !== e.text;
        if (changed) {
          await replaceDoc(table, stored);
          modified++;
        }
        if (!before) {
          before = e.text;
          afterRaw = JSON.stringify(stored);
        }
      }
    }

    if (QUERY_OPS_RETURNING_DOC.has(this.op)) {
      const returnNew = opts.new === true || opts.returnDocument === 'after' || opts.returnOriginal === false;
      let text = returnNew ? afterRaw : before;
      if (!text) return null;
      const proj = this._projection();
      const raw = applyProjection(JSON.parse(text), proj);
      const out = this._lean ? hydrateInPlace(schema, raw, true) : hydrateDocument(Model, raw, proj);
      if (this._populate.length) await populateDocs(Model, [out], this._populate, this._lean);
      if (opts.rawResult || opts.includeResultMetadata) return { value: out, ok: 1, lastErrorObject: { updatedExisting: !upsertedId, upserted: upsertedId } };
      return out;
    }
    return {
      acknowledged: true,
      matchedCount: entries.length,
      modifiedCount: modified,
      upsertedCount: upsertedId ? 1 : 0,
      upsertedId,
    };
  }
}

// ---------------------------------------------------------------- aggregate

function normalizeAggValue(v) {
  if (v === null || v === undefined) return v;
  if (v instanceof ObjectId) return v.toHexString();
  if (isDocument(v)) return idString(v._doc._id);
  if (v instanceof Date || v instanceof RegExp) return v;
  if (Array.isArray(v)) return v.map(normalizeAggValue);
  if (typeof v === 'object') {
    if (v._bsontype === 'ObjectId' && typeof v.toHexString === 'function') return String(v.toHexString());
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = normalizeAggValue(val);
    return out;
  }
  return v;
}

/**
 * MongoDB's $bucket emits only buckets that received documents; mingo's emits every
 * boundary. Rewrite it to the equivalent $group over a $switch (sorted by bucket).
 */
function rewriteBuckets(pipeline) {
  if (!Array.isArray(pipeline)) return pipeline;
  return pipeline.flatMap((stage) => {
    if (!stage || typeof stage !== 'object') return [stage];
    if (stage.$facet) {
      return [{ $facet: Object.fromEntries(Object.entries(stage.$facet).map(([k, p]) => [k, rewriteBuckets(p)])) }];
    }
    if (stage.$lookup?.pipeline) return [{ $lookup: { ...stage.$lookup, pipeline: rewriteBuckets(stage.$lookup.pipeline) } }];
    if (stage.$unionWith?.pipeline) return [{ $unionWith: { ...stage.$unionWith, pipeline: rewriteBuckets(stage.$unionWith.pipeline) } }];
    if (!stage.$bucket) return [stage];
    const { groupBy, boundaries = [], default: fallback, output } = stage.$bucket;
    const branches = boundaries.slice(0, -1).map((b, i) => ({
      case: { $and: [{ $gte: [groupBy, b] }, { $lt: [groupBy, boundaries[i + 1]] }] },
      then: b,
    }));
    const bucketOf = { $switch: { branches, ...(fallback !== undefined ? { default: fallback } : {}) } };
    return [{ $group: { _id: bucketOf, ...(output || { count: { $sum: 1 } }) } }, { $sort: { _id: 1 } }];
  });
}

function collectLookups(pipeline, names = new Set()) {
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if ((k === '$lookup' || k === '$graphLookup') && v && typeof v.from === 'string') names.add(v.from);
      if (k === '$unionWith') names.add(typeof v === 'string' ? v : v?.coll);
      visit(v);
    }
  };
  visit(pipeline);
  return names;
}

async function loadCollectionQueryForm(name) {
  const Model = modelsByCollection[name];
  const rows = await selectRows(name).catch((e) => {
    if (/no such table/i.test(String(e?.message))) return [];
    throw e;
  });
  return rows.map((text) => (Model ? hydrateInPlace(Model.schema, JSON.parse(text), false) : JSON.parse(text)));
}

export class Aggregate {
  constructor(Model, pipeline = []) {
    this._model = Model;
    this._pipeline = Array.isArray(pipeline) ? [...pipeline] : [pipeline];
    this.options = {};
  }

  append(...stages) {
    this._pipeline.push(...stages.flat());
    return this;
  }

  match(m) { return this.append({ $match: m }); }
  group(g) { return this.append({ $group: g }); }
  sort(s) { return this.append({ $sort: parseSort(s) }); }
  project(p) { return this.append({ $project: p }); }
  limit(n) { return this.append({ $limit: n }); }
  skip(n) { return this.append({ $skip: n }); }
  unwind(u) { return this.append({ $unwind: typeof u === 'string' && !u.startsWith('$') ? `$${u}` : u }); }
  lookup(l) { return this.append({ $lookup: l }); }
  addFields(a) { return this.append({ $addFields: a }); }
  count(c) { return this.append({ $count: c }); }
  facet(f) { return this.append({ $facet: f }); }
  pipeline() { return this._pipeline; }
  allowDiskUse() { return this; }
  option(o) { Object.assign(this.options, o || {}); return this; }
  session() { return this; }
  collation() { return this; }
  hint() { return this; }
  read() { return this; }

  async exec() {
    const Model = this._model;
    const schema = Model.schema;
    const pipeline = rewriteBuckets(normalizeAggValue(this._pipeline));
    let where = '';
    let params = [];
    if (pipeline[0]?.$match) {
      const pre = buildPrefilter(schema, pipeline[0].$match);
      where = pre.where;
      params = pre.params;
    }
    if (schema.ttl) await sweepExpired(Model.collection.name, schema.ttl);
    const rows = await selectRows(Model.collection.name, { where, params });
    const docs = rows.map((text) => hydrateInPlace(schema, JSON.parse(text), false));
    const collections = {};
    for (const name of collectLookups(pipeline)) collections[name] = await loadCollectionQueryForm(name);
    const agg = new Aggregator(pipeline, { collectionResolver: (name) => collections[name] || [], idKey: '_id' });
    return agg.run(docs);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }

  finally(fn) {
    return this.exec().finally(fn);
  }

  get [Symbol.toStringTag]() {
    return 'Aggregate';
  }
}

// ---------------------------------------------------------------- model factory

const pluralize = (name) => {
  const lower = name.toLowerCase();
  if (/(s|x|z|ch|sh)$/.test(lower)) return lower.endsWith('s') ? lower : `${lower}es`;
  if (/[^aeiou]y$/.test(lower)) return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
};

const splitArgs = (args) => {
  // (filter, projection, options) with optional trailing callback (unsupported).
  const [filter, projection, options] = args;
  return { filter, projection, options };
};

class ModelBase extends Document {
  static find(...args) {
    const { filter, projection, options } = splitArgs(args);
    const q = new Query(this, 'find', filter, { options });
    if (projection) q.select(projection);
    return q;
  }

  static findOne(...args) {
    const { filter, projection, options } = splitArgs(args);
    const q = new Query(this, 'findOne', filter, { options });
    if (projection) q.select(projection);
    return q;
  }

  static findById(id, projection, options) {
    return this.findOne({ _id: id === undefined ? null : id }, projection, options);
  }

  static countDocuments(filter) {
    return new Query(this, 'countDocuments', filter);
  }

  static count(filter) {
    return this.countDocuments(filter);
  }

  static estimatedDocumentCount() {
    return new Query(this, 'estimatedDocumentCount', {});
  }

  static distinct(field, filter) {
    return new Query(this, 'distinct', filter, { distinct: field });
  }

  static exists(filter) {
    return this.findOne(filter).select('_id').lean();
  }

  static where(path, value) {
    return new Query(this, 'find', {}).where(path, value);
  }

  static updateOne(filter, update, options) {
    return new Query(this, 'updateOne', filter, { update, options });
  }

  static updateMany(filter, update, options) {
    return new Query(this, 'updateMany', filter, { update, options });
  }

  static replaceOne(filter, replacement, options) {
    return new Query(this, 'replaceOne', filter, { update: replacement, options });
  }

  static findOneAndUpdate(filter, update, options = {}) {
    const q = new Query(this, 'findOneAndUpdate', filter, { update, options });
    if (options.projection || options.select || options.fields) q.select(options.projection || options.select || options.fields);
    return q;
  }

  static findByIdAndUpdate(id, update, options = {}) {
    return this.findOneAndUpdate({ _id: id === undefined ? null : id }, update, options);
  }

  static findOneAndReplace(filter, replacement, options = {}) {
    return new Query(this, 'findOneAndReplace', filter, { update: replacement, options });
  }

  static findOneAndDelete(filter, options = {}) {
    return new Query(this, 'findOneAndDelete', filter, { options });
  }

  static findByIdAndDelete(id, options = {}) {
    return this.findOneAndDelete({ _id: id === undefined ? null : id }, options);
  }

  static findOneAndRemove(filter, options) {
    return this.findOneAndDelete(filter, options);
  }

  static findByIdAndRemove(id, options) {
    return this.findByIdAndDelete(id, options);
  }

  static deleteOne(filter, options) {
    return new Query(this, 'deleteOne', filter, { options });
  }

  static deleteMany(filter, options) {
    return new Query(this, 'deleteMany', filter, { options });
  }

  static aggregate(pipeline) {
    return new Aggregate(this, pipeline);
  }

  static async create(docs, options) {
    const single = !Array.isArray(docs);
    const list = single ? [docs] : docs;
    const out = [];
    for (const d of list) out.push(await new this(d).save(isPOJO(options) ? options : {}));
    return single ? out[0] : out;
  }

  static async insertMany(docs, options = {}) {
    const list = (Array.isArray(docs) ? docs : [docs]).map((d) => (isDocument(d) ? d : new this(d)));
    const schema = this.schema;
    const now = new Date();
    for (const d of list) {
      await d.validate();
      const ts = schema.timestampPaths;
      if (ts?.createdAt && d._doc[ts.createdAt] === undefined) d._doc[ts.createdAt] = now;
      if (ts?.updatedAt && d._doc[ts.updatedAt] === undefined) d._doc[ts.updatedAt] = now;
      if (schema.options.versionKey && d._doc[schema.options.versionKey] === undefined) d._doc[schema.options.versionKey] = 0;
    }
    const stored = list.map((d) => d._storageForm());
    for (let i = 0; i < stored.length; i += 50) await insertDocs(this.collection.name, stored.slice(i, i + 50));
    list.forEach((d, i) => {
      d.$__.isNew = false;
      d.$__.snapshot = stored[i];
    });
    return options.lean ? list.map((d) => d.toObject()) : list;
  }

  static async populate(docs, options) {
    const single = !Array.isArray(docs);
    const list = single ? [docs] : docs;
    const lean = list.some((d) => d && !isDocument(d));
    await populateDocs(this, list, normalizePopulate([options]), lean);
    return single ? list[0] : list;
  }

  static hydrate(obj) {
    return hydrateDocument(this, toStorage(obj), null);
  }

  static async bulkWrite(ops = []) {
    const res = { insertedCount: 0, matchedCount: 0, modifiedCount: 0, deletedCount: 0, upsertedCount: 0 };
    for (const op of ops) {
      if (op.insertOne) {
        await this.create(op.insertOne.document);
        res.insertedCount++;
      } else if (op.updateOne) {
        const r = await this.updateOne(op.updateOne.filter, op.updateOne.update, { upsert: op.updateOne.upsert });
        res.matchedCount += r.matchedCount;
        res.modifiedCount += r.modifiedCount;
        res.upsertedCount += r.upsertedCount;
      } else if (op.updateMany) {
        const r = await this.updateMany(op.updateMany.filter, op.updateMany.update, { upsert: op.updateMany.upsert });
        res.matchedCount += r.matchedCount;
        res.modifiedCount += r.modifiedCount;
      } else if (op.deleteOne) {
        res.deletedCount += (await this.deleteOne(op.deleteOne.filter)).deletedCount;
      } else if (op.deleteMany) {
        res.deletedCount += (await this.deleteMany(op.deleteMany.filter)).deletedCount;
      }
    }
    return res;
  }

  static async syncIndexes() { return []; }
  static async createIndexes() { return undefined; }
  static async ensureIndexes() { return undefined; }
  static async init() { return undefined; }
  static async listIndexes() { return []; }
  static async cleanIndexes() { return []; }
  static async diffIndexes() { return { toDrop: [], toCreate: [] }; }
}

/** SQL statements (tables + indexes) for a model's collection. */
export function ddlFor(Model) {
  const table = Model.collection.name;
  const q = (n) => `"${n}"`;
  const out = [`CREATE TABLE IF NOT EXISTS ${q(table)} (_id TEXT PRIMARY KEY NOT NULL, doc TEXT NOT NULL CHECK (json_valid(doc)));`];
  const seen = new Set();
  for (const [fields, options] of Model.schema.indexes()) {
    const keys = Object.keys(fields).filter((k) => fields[k] !== 'text' && k !== '_id');
    if (!keys.length || !keys.every(isSafePath)) continue;
    const unique = Boolean(options?.unique);
    const name = indexName(table, Object.fromEntries(keys.map((k) => [k, 1])), unique);
    if (seen.has(name)) continue;
    seen.add(name);
    // partialFilterExpression with plain equalities → SQLite partial index.
    const partial = Object.entries(options?.partialFilterExpression || {})
      .filter(([k, v]) => isSafePath(k) && ['string', 'number', 'boolean'].includes(typeof v))
      .map(([k, v]) => `${jsonExpr(k)} = ${typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`}`);
    out.push(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${q(name)} ON ${q(table)} (${keys.map((k) => jsonExpr(k)).join(', ')})${partial.length ? ` WHERE ${partial.join(' AND ')}` : ''};`);
  }
  return out;
}

export function createModel(name, schema, collectionName) {
  if (models[name]) return models[name];
  const table = collectionName || schema.options.collection || pluralize(name);

  class Model extends ModelBase {}
  Object.defineProperty(Model, 'name', { value: name });
  Model.modelName = name;
  Model.schema = schema;
  Model.collection = {
    name: table,
    collectionName: table,
    async dropIndex() { return true; },
    async dropIndexes() { return true; },
    async createIndex() { return 'ok'; },
    async indexes() { return []; },
    async indexInformation() { return {}; },
  };

  const reserved = new Set(['isNew', 'errors', 'schema', '$locals', '$__', '_doc', 'get', 'set', 'save', 'validate', 'toObject', 'toJSON', 'populate', 'populated', 'remove', 'deleteOne', 'equals', 'collection', 'db', 'init', 'isModified', 'markModified']);
  for (const key of schema.topKeys()) {
    if (reserved.has(key)) continue;
    const st = schema.paths[key];
    Object.defineProperty(Model.prototype, key, {
      enumerable: true,
      configurable: true,
      get() {
        let v = this._doc[key];
        if (v === undefined && !st && schema.nested[key]) {
          v = {};
          this._doc[key] = v;
        }
        return v;
      },
      set(value) {
        if (st) {
          let v = value;
          try {
            v = castValue(st, value, 'doc', key);
            delete this.$__.castErrors[key];
          } catch (e) {
            this.$__.castErrors[key] = e;
          }
          if (Array.isArray(v) && st.instance === 'Array') {
            decorateArray(v, st);
            if (st.isDocArray) for (const el of v) if (isPOJO(el)) decorateArrays(st.schema, el);
          }
          this._doc[key] = v;
          return;
        }
        if (schema.nested[key]) {
          if (value === null || value === undefined) {
            this._doc[key] = value;
            return;
          }
          const errors = {};
          const src = isDocument(value) ? value.toObject() : value;
          this._doc[key] = castObject(schema, src, { mode: 'doc', errors, strict: schema.options.strict !== false, base: `${key}.` });
          Object.assign(this.$__.castErrors, errors);
          decorateArrays(schema, this._doc);
          return;
        }
        this._doc[key] = value;
      },
    });
  }

  for (const [vname, vt] of Object.entries(schema.virtuals)) {
    if (vname in Model.prototype && !vt.options?.ref && vname !== 'id') continue;
    Object.defineProperty(Model.prototype, vname, {
      enumerable: false,
      configurable: true,
      get() {
        if (vt.options?.ref) return this.$__.populatedVirtuals[vname];
        let v;
        for (const g of vt.getters) v = g.call(this, v, vt, this);
        return v;
      },
      set(value) {
        if (vt.options?.ref) {
          this.$__.populatedVirtuals[vname] = value;
          return;
        }
        for (const s of vt.setters) s.call(this, value, vt, this);
      },
    });
  }

  for (const [mname, fn] of Object.entries(schema.methods)) {
    Object.defineProperty(Model.prototype, mname, { value: fn, enumerable: false, configurable: true, writable: true });
  }
  for (const [sname, fn] of Object.entries(schema.statics)) {
    Model[sname] = fn;
  }

  for (const [fields, options] of schema.indexes()) {
    if (!options?.unique) continue;
    const keys = Object.keys(fields);
    registerUniqueIndex(table, indexName(table, Object.fromEntries(keys.map((k) => [k, 1])), true), keys);
  }

  models[name] = Model;
  modelsByCollection[table] = Model;
  return Model;
}

export { CastError, ValidationError };
