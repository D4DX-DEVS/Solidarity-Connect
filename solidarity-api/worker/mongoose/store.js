// D1 storage: one table per collection — (_id TEXT PRIMARY KEY, doc TEXT JSON).
import { isPOJO, resolvePath } from './schema.js';

let override = null;

/** Lets tests / Node scripts plug in a D1-compatible database. */
export const setDatabase = (db) => {
  override = db;
};

export const getDatabase = () => {
  const db = override ?? globalThis.__CF_ENV?.DB;
  if (!db) throw new Error('D1 database binding "DB" is not available');
  return db;
};

export const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

const SAFE_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
/** SQL expression for a JSON path; must match the expression used in CREATE INDEX. */
export const jsonExpr = (path) => `json_extract(doc, '$.${path}')`;
export const isSafePath = (path) => SAFE_PATH.test(path);

export const indexName = (table, fields, unique) => `${unique ? 'ux' : 'ix'}_${table}_${Object.keys(fields).join('_').replace(/\./g, '_')}`;

const MAX_PARAMS = 90;

// ---------------------------------------------------------------- errors

export class MongoServerError extends Error {
  constructor(message, extra = {}) {
    super(message);
    this.name = 'MongoServerError';
    Object.assign(this, extra);
  }
}

const uniqueIndexes = new Map(); // table → Map(indexName → fields[])

export const registerUniqueIndex = (table, name, fields) => {
  if (!uniqueIndexes.has(table)) uniqueIndexes.set(table, new Map());
  uniqueIndexes.get(table).set(name, fields);
};

const getPathValue = (obj, path) => path.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);

/** Maps a SQLite UNIQUE failure to the shape of a Mongo E11000 duplicate-key error. */
export function mapWriteError(error, table, doc) {
  const msg = String(error?.message || error);
  if (!/UNIQUE constraint failed/i.test(msg)) return error;
  let fields = ['_id'];
  let idx = '_id_';
  const named = msg.match(/index '([^']+)'/);
  if (named && uniqueIndexes.get(table)?.has(named[1])) {
    idx = named[1];
    fields = uniqueIndexes.get(table).get(idx);
  }
  const keyValue = {};
  const keyPattern = {};
  for (const f of fields) {
    keyValue[f] = doc ? getPathValue(doc, f) : undefined;
    keyPattern[f] = 1;
  }
  return new MongoServerError(`E11000 duplicate key error collection: ${table} index: ${idx} dup key: ${JSON.stringify(keyValue)}`, {
    code: 11000,
    keyValue,
    keyPattern,
    index: 0,
  });
}

// ---------------------------------------------------------------- reads

/**
 * Translates the SQL-expressible part of a (cast) filter into a WHERE clause. The
 * clause is always a superset of the real match: callers still run the full filter
 * in memory. `exact` is true when every condition was translated.
 */
export function buildPrefilter(schema, filter) {
  const clauses = [];
  const params = [];
  let exact = true;
  const scalarOk = (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
  const bindable = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v);

  const translate = (key, value) => {
    const isId = key === '_id';
    let expr;
    if (isId) expr = '_id';
    else {
      if (!isSafePath(key)) return false;
      const r = resolvePath(schema, key);
      const st = r?.st;
      if (!st || r.inArray || r.mixed || r.subdoc || !['String', 'ObjectId', 'Boolean', 'Number'].includes(st.instance)) return false;
      expr = jsonExpr(key);
    }
    if (scalarOk(value)) {
      if (params.length + 1 > MAX_PARAMS) return false;
      if (isId && typeof value !== 'string') return false;
      clauses.push(`${expr} = ?`);
      params.push(bindable(value));
      return true;
    }
    if (isPOJO(value)) {
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0] === '$eq' && scalarOk(value.$eq)) return translate(key, value.$eq);
      if (keys.length === 1 && keys[0] === '$in' && Array.isArray(value.$in)) {
        const list = value.$in;
        if (!list.every((v) => typeof v === 'string' || typeof v === 'number')) return false;
        if (list.length === 0) {
          clauses.push('0');
          return true;
        }
        if (params.length + list.length > MAX_PARAMS) return false;
        clauses.push(`${expr} IN (${list.map(() => '?').join(', ')})`);
        params.push(...list);
        return true;
      }
    }
    return false;
  };

  const walk = (f) => {
    for (const [key, value] of Object.entries(f || {})) {
      if (key === '$and' && Array.isArray(value)) {
        for (const sub of value) walk(sub);
        continue;
      }
      if (key.startsWith('$')) {
        exact = false;
        continue;
      }
      if (!translate(key, value)) exact = false;
    }
  };
  walk(filter);
  return { where: clauses.join(' AND '), params, exact };
}

export async function selectRows(table, { where = '', params = [], orderBy = '', limit, offset } = {}) {
  let sql = `SELECT doc FROM ${quoteIdent(table)}`;
  if (where) sql += ` WHERE ${where}`;
  sql += orderBy ? ` ORDER BY ${orderBy}` : ' ORDER BY rowid';
  if (limit !== undefined && limit !== null) sql += ` LIMIT ${Number(limit) | 0}`;
  if (offset) sql += `${limit === undefined || limit === null ? ' LIMIT -1' : ''} OFFSET ${Number(offset) | 0}`;
  const { results } = await getDatabase().prepare(sql).bind(...params).all();
  return results.map((r) => r.doc);
}

export async function countRows(table, { where = '', params = [] } = {}) {
  const sql = `SELECT COUNT(*) AS n FROM ${quoteIdent(table)}${where ? ` WHERE ${where}` : ''}`;
  const row = await getDatabase().prepare(sql).bind(...params).first();
  return Number(row?.n || 0);
}

// ---------------------------------------------------------------- writes

export async function insertDocs(table, docs) {
  if (!docs.length) return;
  const db = getDatabase();
  const stmts = docs.map((d) => db.prepare(`INSERT INTO ${quoteIdent(table)} (_id, doc) VALUES (?, ?)`).bind(String(d._id), JSON.stringify(d)));
  try {
    if (stmts.length === 1) await stmts[0].run();
    else await db.batch(stmts);
  } catch (error) {
    throw mapWriteError(error, table, docs[0]);
  }
}

export async function replaceDoc(table, doc) {
  try {
    await getDatabase().prepare(`UPDATE ${quoteIdent(table)} SET doc = ? WHERE _id = ?`).bind(JSON.stringify(doc), String(doc._id)).run();
  } catch (error) {
    throw mapWriteError(error, table, doc);
  }
}

const jsonKeyPath = (key) => `$."${String(key).replace(/"/g, '\\"')}"`;

/** Sets / removes top-level keys of one stored document without rewriting the rest. */
export async function patchDoc(table, id, sets, unsets, fullDoc) {
  if (!Object.keys(sets).length && !unsets.length) return;
  const params = [];
  let expr = 'doc';
  if (unsets.length) {
    expr = `json_remove(${expr}, ${unsets.map(() => '?').join(', ')})`;
    params.push(...unsets.map(jsonKeyPath));
  }
  const setKeys = Object.keys(sets);
  if (setKeys.length) {
    expr = `json_set(${expr}, ${setKeys.map(() => '?, json(?)').join(', ')})`;
    for (const k of setKeys) params.push(jsonKeyPath(k), JSON.stringify(sets[k] === undefined ? null : sets[k]));
  }
  if (params.length + 1 > MAX_PARAMS) return replaceDoc(table, fullDoc);
  params.push(String(id));
  try {
    await getDatabase().prepare(`UPDATE ${quoteIdent(table)} SET doc = ${expr} WHERE _id = ?`).bind(...params).run();
  } catch (error) {
    throw mapWriteError(error, table, fullDoc);
  }
}

export async function deleteDocs(table, ids) {
  let deleted = 0;
  const db = getDatabase();
  for (let i = 0; i < ids.length; i += MAX_PARAMS) {
    const chunk = ids.slice(i, i + MAX_PARAMS).map(String);
    const res = await db.prepare(`DELETE FROM ${quoteIdent(table)} WHERE _id IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).run();
    deleted += Number(res?.meta?.changes ?? chunk.length);
  }
  return deleted;
}

/** TTL index emulation: drop documents whose expiry path has passed. */
export async function sweepExpired(table, ttl) {
  if (!ttl || !isSafePath(ttl.path)) return;
  const cutoff = new Date(Date.now() - (ttl.seconds || 0) * 1000).toISOString();
  await getDatabase().prepare(`DELETE FROM ${quoteIdent(table)} WHERE ${jsonExpr(ttl.path)} IS NOT NULL AND ${jsonExpr(ttl.path)} <= ?`).bind(cutoff).run();
}
