// Repairs upload file names (`originalName`, at any depth) that were saved as Latin-1
// mojibake before the upload routes decoded them as UTF-8. Idempotent.
//   node solidarity-api/worker/scripts/repair-upload-names.mjs [--remote|--local] [--dry-run]
//   (run from solidarity-app/, where wrangler.jsonc is)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { decodeUploadName } from '../../src/utils/fileName.js';

const where = process.argv.includes('--local') ? '--local' : '--remote';
const dryRun = process.argv.includes('--dry-run');
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const run = (args) => execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'solidarity', where, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
const query = (sql) => {
  const out = run(['--json', '--command', sql]);
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
};

/** Returns a repaired copy of `value`, counting each name it changes. */
const repair = (value, changes) => {
  if (Array.isArray(value)) return value.map((v) => repair(v, changes));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const fixed = k === 'originalName' ? decodeUploadName(v) : repair(v, changes);
      if (k === 'originalName' && fixed !== v) changes.push(`${JSON.stringify(v).slice(0, 30)}… → ${fixed}`);
      out[k] = fixed;
    }
    return out;
  }
  return value;
};

const sqlString = (s) => `'${String(s).replace(/'/g, "''")}'`;
const tables = query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'd1_%' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
const updates = [];
for (const table of tables) {
  const rows = query(`SELECT _id, doc FROM "${table}" WHERE doc LIKE '%originalName%'`);
  for (const row of rows) {
    const changes = [];
    const fixed = repair(JSON.parse(row.doc), changes);
    if (!changes.length) continue;
    for (const c of changes) console.log(`${table} ${row._id}: ${c}`);
    updates.push(`UPDATE "${table}" SET doc = ${sqlString(JSON.stringify(fixed))} WHERE _id = ${sqlString(row._id)};`);
  }
}
console.log(`${updates.length} document(s) to repair${dryRun ? ' (dry run)' : ''}`);
if (updates.length && !dryRun) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'repair-')), 'repair.sql');
  fs.writeFileSync(file, updates.join('\n') + '\n');
  run(['--yes', '--file', file]);
  console.log('repaired');
}
