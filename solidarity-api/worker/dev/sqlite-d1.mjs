// D1-compatible wrapper over node:sqlite, for running the shim and the API in Node.
import { DatabaseSync } from 'node:sqlite';

export function createD1(file) {
  const db = new DatabaseSync(file);
  const statement = (sql, params = []) => ({
    bind: (...p) => statement(sql, p),
    async all() {
      return { results: db.prepare(sql).all(...params), success: true, meta: {} };
    },
    async first(col) {
      const row = db.prepare(sql).get(...params);
      if (!row) return null;
      return col ? row[col] ?? null : row;
    },
    async run() {
      const r = db.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return {
    prepare: (sql) => statement(sql),
    async batch(stmts) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql) {
      db.exec(sql);
    },
    raw: db,
  };
}
