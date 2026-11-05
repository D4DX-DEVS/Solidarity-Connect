// Verifies D1 holds exactly the exported MongoDB data: per collection, same _id set
// and every document deep-equal (canonical JSON) to the converted export.
//   node worker/scripts/verify-d1.mjs <exportDir> [--remote|--local]   (run from solidarity-app/)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [exportDir] = process.argv.slice(2);
const where = process.argv.includes('--local') ? '--local' : '--remote';
const expected = JSON.parse(fs.readFileSync(path.join(exportDir, 'storage-form.json'), 'utf8'));

const canonical = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
};

// Run wrangler's JS entry with node directly: no shell, so the SQL stays one argument.
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const query = (sql) => {
  const out = execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'solidarity', where, '--json', '--command', sql], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
};

let bad = 0;
for (const [name, docs] of Object.entries(expected)) {
  const rows = [];
  // Page through big tables to keep each response small.
  for (let offset = 0; ; offset += 500) {
    const page = query(`SELECT _id, doc FROM "${name}" ORDER BY rowid LIMIT 500 OFFSET ${offset}`);
    rows.push(...page);
    if (page.length < 500) break;
  }
  const parsed = new Map(rows.map((r) => [r._id, JSON.parse(r.doc)]));
  const actual = new Map([...parsed].map(([k, v]) => [k, canonical(v)]));
  const keys = new Set();
  let missing = 0;
  let different = 0;
  for (const d of docs) {
    const got = actual.get(String(d._id));
    if (got === undefined) missing++;
    else if (got !== canonical(d)) {
      different++;
      const a = parsed.get(String(d._id));
      for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) if (canonical(a[k]) !== canonical(d[k])) keys.add(k);
    }
  }
  const extra = rows.length - (docs.length - missing);
  const ok = !missing && !different && extra === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(22)} mongo ${String(docs.length).padStart(5)}  d1 ${String(rows.length).padStart(5)}  missing ${missing}  different ${different}  extra ${extra}${keys.size ? `  keys: ${[...keys].join(',')}` : ''}`);
}
console.log(bad ? `\n${bad} collection(s) differ` : '\nall collections identical');
process.exit(bad ? 1 : 0);
