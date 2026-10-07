/**
 * Remove admin logins that were created for roles whose own "Is Leader" flag is
 * FALSE in the source sheet (user rule 2026-10-07). Those people stay leaders —
 * member.isLeader / roleTag / extraRoleTags and the remaining logins' tags are
 * untouched — they just sign in as a member.
 *
 * Targeted on purpose: no re-import, so monthly reports, org files and every
 * other record created since the 2026-10-01 import survive. QA phones untouched.
 *
 * Usage:
 *   node fix-leader-logins.js                     dry run
 *   node fix-leader-logins.js --execute           apply
 *   node fix-leader-logins.js --file <path.xlsx>  other source
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { EJSON } from 'bson';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import User from './src/models/User.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';
import { DEFAULT_XLSX, TEST_PHONE_VARIANTS, readRows, buildPeople, loginsFor } from './people-migration-lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const EXECUTE = process.argv.includes('--execute');
const fileIdx = process.argv.indexOf('--file');
const XLSX_PATH = fileIdx !== -1 && process.argv[fileIdx + 1] ? process.argv[fileIdx + 1] : DEFAULT_XLSX;

const keyOf = (u) => `${u.phone}|${u.role}|${u.adminKind || 'area'}`;

// Old Targets module (routes removed 2026-10-06, replaced by Monthly Reports).
// Rows here pointing at a removed login are dropped with it (backed up first);
// a reference in any other collection blocks the run.
const DEAD_COLLECTIONS = new Map([['usertargetprogresses', 'user'], ['recurringmarks', 'user']]);
const tagText = (t) => (t ? `${t.type || '?'} - ${t.name || ''}` : '-');

async function run() {
  console.log(`\n=== FIX LEADER LOGINS — ${EXECUTE ? 'EXECUTE (live writes)' : 'DRY RUN (no writes)'} ===`);
  console.log(`Source: ${XLSX_PATH}`);
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const { people } = buildPeople(readRows(XLSX_PATH), await District.find({}).lean(), await Group.find({}).lean());
  const expected = new Map(people.flatMap(loginsFor).map((l) => [keyOf(l), l]));
  const users = await User.find({ phone: { $nin: TEST_PHONE_VARIANTS } }).populate('district', 'name').lean();

  const toDelete = users.filter((u) => !expected.has(keyOf(u)));
  const existingKeys = new Set(users.map(keyOf));
  const missing = [...expected.values()].filter((l) => !existingKeys.has(keyOf(l)));
  const kept = users.filter((u) => expected.has(keyOf(u)));
  const primaryDiffs = kept.filter((u) => u.roleTag?.type !== expected.get(keyOf(u)).roleTag.type);

  const byRole = (list) => list.reduce((a, u) => ({ ...a, [u.role]: (a[u.role] || 0) + 1 }), {});
  console.log(`\nAdmin logins now (excl. QA): ${users.length} ${JSON.stringify(byRole(users))}`);
  console.log(`Should exist per sheet flags: ${expected.size} ${JSON.stringify(byRole([...expected.values()]))}`);
  console.log(`To remove: ${toDelete.length} ${JSON.stringify(byRole(toDelete))}`);
  console.log(`Missing (would need creating): ${missing.length}`);
  missing.forEach((l) => console.log(`   + ${l.name} ${l.phone} ${l.role}/${l.adminKind}`));
  console.log(`Kept logins whose primary role differs from sheet: ${primaryDiffs.length}`);
  primaryDiffs.forEach((u) => console.log(`   ~ ${u.name} ${u.role}: DB ${tagText(u.roleTag)} vs sheet ${tagText(expected.get(keyOf(u)).roleTag)}`));

  // Anything else in the DB pointing at a login we'd remove?
  const ids = new Map(toDelete.map((u) => [String(u._id), u]));
  const refs = [];
  for (const { name } of await db.listCollections().toArray()) {
    if (name === 'users') continue;
    for (const doc of await db.collection(name).find({}).toArray()) {
      const text = EJSON.stringify(doc);
      for (const [id, u] of ids) if (text.includes(id)) refs.push({ collection: name, docId: String(doc._id), user: `${u.name} (${u.role})`, userId: id });
    }
  }
  const deadRefs = refs.filter((r) => DEAD_COLLECTIONS.has(r.collection));
  const liveRefs = refs.filter((r) => !DEAD_COLLECTIONS.has(r.collection));
  const perColl = deadRefs.reduce((a, r) => ({ ...a, [r.collection]: (a[r.collection] || 0) + 1 }), {});
  console.log(`\nOld Targets rows for these logins (removed with them): ${deadRefs.length} ${JSON.stringify(perColl)}`);
  console.log(`References in live data (block the run): ${liveRefs.length}`);
  liveRefs.forEach((r) => console.log(`   ${r.collection} ${r.docId} → ${r.user}`));
  const loggedIn = toDelete.filter((u) => u.lastLogin);
  console.log(`Logins to remove that have been used: ${loggedIn.length}`);
  loggedIn.forEach((u) => console.log(`   ${u.name} ${u.role} last ${u.lastLogin.toISOString()}`));

  console.log('\nTo remove:');
  for (const u of [...toDelete].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))) {
    console.log(`   ${u.role.padEnd(15)} ${u.name.padEnd(28)} ${String(u.phone).padEnd(14)} ${tagText(u.roleTag).padEnd(34)} ${u.district?.name || ''}`);
  }

  if (liveRefs.length) throw new Error('Live records reference these logins — resolve before executing. Nothing was changed.');
  if (!EXECUTE) { console.log('\nDry run only. Re-run with --execute to apply.'); return; }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(__dirname, 'backups', `fix-leader-logins-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const removedIds = toDelete.map((u) => u._id);
  writeFileSync(join(dir, 'users-before.json'), EJSON.stringify(await db.collection('users').find({}).toArray(), null, 1, { relaxed: false }));
  writeFileSync(join(dir, 'removed-users.json'), EJSON.stringify(toDelete, null, 1, { relaxed: false }));
  for (const [name, field] of DEAD_COLLECTIONS) {
    const filter = { [field]: { $in: removedIds } };
    writeFileSync(join(dir, `removed-${name}.json`), EJSON.stringify(await db.collection(name).find(filter).toArray(), null, 1, { relaxed: false }));
    const { deletedCount } = await db.collection(name).deleteMany(filter);
    console.log(`\nRemoved ${deletedCount} ${name} rows`);
  }
  const { deletedCount } = await User.deleteMany({ _id: { $in: removedIds } });
  console.log(`Removed ${deletedCount} admin logins. Backup: ${dir}`);
}

run()
  .catch((err) => { console.error('\nFAILED:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
