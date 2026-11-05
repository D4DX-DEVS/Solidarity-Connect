import { ObjectId } from './objectid.js';

// Schema-type markers (mongoose.Schema.Types.*).
function ObjectIdType() {}
function Mixed() {}
function Decimal128() {}
function UUID() {}
Object.defineProperty(ObjectIdType, 'name', { value: 'ObjectId' });
Object.defineProperty(Mixed, 'name', { value: 'Mixed' });

export const SchemaTypes = {
  ObjectId: ObjectIdType,
  Mixed,
  String,
  Number,
  Date,
  Boolean,
  Buffer: Mixed,
  Map: Mixed,
  Array,
  Decimal128,
  UUID,
  Oid: ObjectIdType,
  Object: Mixed,
};

export const isPOJO = (value) => {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/** Mongoose rule: `{ type: X }` is a path spec unless `type` itself is `{ type: … }` (a nested field named "type"). */
export const isLeafSpec = (value) => isPOJO(value) && value.type != null && !(isPOJO(value.type) && value.type.type != null);

const typeName = (type) => {
  if (type === String || type === 'String' || type === 'string') return 'String';
  if (type === Number || type === 'Number' || type === 'number') return 'Number';
  if (type === Date || type === 'Date' || type === 'date') return 'Date';
  if (type === Boolean || type === 'Boolean' || type === 'boolean' || type === 'Bool') return 'Boolean';
  if (type === ObjectIdType || type === ObjectId || type === 'ObjectId' || type === 'ObjectID' || type === 'Oid') return 'ObjectId';
  if (type === Decimal128 || type === 'Decimal128') return 'Number';
  return 'Mixed';
};

export class SchemaType {
  constructor(path, instance, options = {}, extra = {}) {
    this.path = path;
    this.instance = instance;
    this.options = options;
    this.schema = extra.schema || null; // Embedded / document array
    this.caster = extra.caster || null; // primitive array element type
    this.isDocArray = Boolean(extra.isDocArray);
  }
}

class VirtualType {
  constructor(name, options = {}) {
    this.path = name;
    this.options = options;
    this.getters = [];
    this.setters = [];
  }

  get(fn) {
    this.getters.push(fn);
    return this;
  }

  set(fn) {
    this.setters.push(fn);
    return this;
  }
}

const HOOK_ALIASES = { remove: 'deleteOne' };

export class Schema {
  constructor(definition = {}, options = {}) {
    this.obj = definition;
    this.options = { minimize: true, _id: true, id: true, strict: true, versionKey: '__v', ...options };
    this.paths = {};
    this.nested = {};
    this.virtuals = {};
    this.methods = {};
    this.statics = {};
    this.query = {};
    this.hooks = { pre: {}, post: {} };
    this._indexes = [];
    this.ttl = null;
    this.timestampPaths = null;
    this.add(definition);

    if (this.options._id !== false && !this.paths._id) {
      this.paths._id = new SchemaType('_id', 'ObjectId', { auto: true });
    }
    if (this.options.versionKey && !this.paths[this.options.versionKey]) {
      this.paths[this.options.versionKey] = new SchemaType(this.options.versionKey, 'Number', {});
    }
    const ts = this.options.timestamps;
    if (ts) {
      const createdAt = typeof ts === 'object' ? (ts.createdAt === false ? null : (typeof ts.createdAt === 'string' ? ts.createdAt : 'createdAt')) : 'createdAt';
      const updatedAt = typeof ts === 'object' ? (ts.updatedAt === false ? null : (typeof ts.updatedAt === 'string' ? ts.updatedAt : 'updatedAt')) : 'updatedAt';
      this.timestampPaths = { createdAt, updatedAt };
      for (const p of [createdAt, updatedAt]) if (p && !this.paths[p]) this.paths[p] = new SchemaType(p, 'Date', {});
    }
    if (this.options.id !== false && !this.virtuals.id) {
      this.virtual('id').get(function () {
        return this._id == null ? null : String(this._id);
      });
    }
  }

  add(definition, prefix = '') {
    if (definition instanceof Schema) definition = definition.obj;
    for (const [key, value] of Object.entries(definition || {})) {
      if (value === undefined || value === null) continue;
      const path = prefix + key;
      if (isPOJO(value) && !isLeafSpec(value)) {
        if (Object.keys(value).length === 0) {
          this.path(path, Mixed);
        } else {
          this.nested[path] = true;
          this.add(value, `${path}.`);
        }
      } else {
        this.path(path, value);
      }
    }
    return this;
  }

  path(path, spec) {
    if (arguments.length === 1) return this.paths[path];
    const options = isLeafSpec(spec) ? { ...spec } : { type: spec };
    const type = options.type;
    let st;
    if (Array.isArray(type)) {
      const el = type.length ? type[0] : Mixed;
      if (el instanceof Schema) {
        st = new SchemaType(path, 'Array', options, { schema: el, isDocArray: true });
      } else if (isPOJO(el) && !isLeafSpec(el) && Object.keys(el).length) {
        const { _id, ...rest } = el;
        st = new SchemaType(path, 'Array', options, { schema: new Schema(rest, { _id: _id !== false, versionKey: false, id: false }), isDocArray: true });
      } else {
        const elSpec = isLeafSpec(el) ? el : { type: el };
        st = new SchemaType(path, 'Array', options, { caster: this._leaf(`${path}.$`, elSpec) });
      }
    } else if (type instanceof Schema) {
      st = new SchemaType(path, 'Embedded', options, { schema: type });
    } else if (isPOJO(type) && Object.keys(type).length) {
      st = new SchemaType(path, 'Embedded', options, { schema: new Schema(type, { versionKey: false, id: false }) });
    } else {
      st = this._leaf(path, options);
    }
    this.paths[path] = st;
    const parts = path.split('.');
    for (let i = 1; i < parts.length; i++) this.nested[parts.slice(0, i).join('.')] = true;

    if (options.unique) this._indexes.push([{ [path]: 1 }, { unique: true }]);
    else if (options.index) this._indexes.push([{ [path]: 1 }, typeof options.index === 'object' ? options.index : {}]);
    const expires = options.expires ?? (typeof options.index === 'object' ? options.index.expires : undefined);
    if (expires !== undefined) this.ttl = { path, seconds: Number(expires) || 0 };
    return this;
  }

  _leaf(path, options) {
    return new SchemaType(path, typeName(options.type), options);
  }

  virtual(name, options) {
    if (!this.virtuals[name]) this.virtuals[name] = new VirtualType(name, options);
    else if (options) this.virtuals[name].options = options;
    return this.virtuals[name];
  }

  pre(names, ...args) {
    const fn = args.find((a) => typeof a === 'function');
    const opts = args.find((a) => a && typeof a === 'object') || {};
    for (const n of [].concat(names)) {
      const key = HOOK_ALIASES[n] || n;
      (this.hooks.pre[key] ||= []).push({ fn, opts });
    }
    return this;
  }

  post(names, ...args) {
    const fn = args.find((a) => typeof a === 'function');
    const opts = args.find((a) => a && typeof a === 'object') || {};
    for (const n of [].concat(names)) {
      const key = HOOK_ALIASES[n] || n;
      (this.hooks.post[key] ||= []).push({ fn, opts });
    }
    return this;
  }

  index(fields, options = {}) {
    this._indexes.push([fields, options]);
    if (options.expires !== undefined || options.expireAfterSeconds !== undefined) {
      this.ttl = { path: Object.keys(fields)[0], seconds: Number(options.expireAfterSeconds ?? options.expires) || 0 };
    }
    return this;
  }

  indexes() {
    return this._indexes;
  }

  plugin(fn, opts) {
    fn(this, opts);
    return this;
  }

  method(name, fn) {
    if (typeof name === 'object') Object.assign(this.methods, name);
    else this.methods[name] = fn;
    return this;
  }

  static(name, fn) {
    if (typeof name === 'object') Object.assign(this.statics, name);
    else this.statics[name] = fn;
    return this;
  }

  set(key, value) {
    this.options[key] = value;
    return this;
  }

  get(key) {
    return this.options[key];
  }

  eachPath(fn) {
    for (const [p, st] of Object.entries(this.paths)) fn(p, st);
  }

  pathType(path) {
    if (this.paths[path]) return 'real';
    if (this.nested[path]) return 'nested';
    if (this.virtuals[path]) return 'virtual';
    return 'adhocOrUndefined';
  }

  /** Top-level keys a document of this schema exposes as properties. */
  topKeys() {
    const keys = new Set();
    for (const p of Object.keys(this.paths)) keys.add(p.split('.')[0]);
    for (const p of Object.keys(this.nested)) keys.add(p.split('.')[0]);
    return [...keys];
  }
}

Schema.Types = SchemaTypes;
Schema.ObjectId = ObjectIdType;

/**
 * Schema type behind a dotted path, walking nested objects, single subdocuments and
 * document arrays (numeric / positional segments skipped). Returns
 * `{ st, inArray }`, `{ nested: true }` for a nested object path, or null.
 */
export function resolvePath(schema, path) {
  if (schema.paths[path]) return { st: schema.paths[path], inArray: false };
  if (schema.nested[path]) return { nested: true, schema, path };
  const parts = path.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const head = parts.slice(0, i).join('.');
    const st = schema.paths[head];
    if (!st) continue;
    let rest = parts.slice(i);
    if (st.instance === 'Mixed') return { st, mixed: true, inArray: false };
    if (st.schema) {
      if (st.isDocArray && rest.length && (/^\d+$/.test(rest[0]) || rest[0] === '$' || /^\$\[.*\]$/.test(rest[0]))) rest = rest.slice(1);
      if (!rest.length) return { st, element: st.isDocArray, inArray: false, subdoc: true };
      const inner = resolvePath(st.schema, rest.join('.'));
      return inner && { ...inner, inArray: Boolean(inner.inArray || st.isDocArray) };
    }
    if (st.caster && rest.length === 1 && (/^\d+$/.test(rest[0]) || rest[0] === '$')) return { st: st.caster, inArray: false };
    return null;
  }
  return null;
}
