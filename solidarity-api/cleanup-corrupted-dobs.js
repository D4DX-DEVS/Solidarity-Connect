/**
 * Cleanup Script: Null out corrupted Member.dateOfBirth values
 *
 * Background:
 *   The legacy migration scripts (migrate-full-data.js, migrate-new-members.js)
 *   wrote ~492 `Member.dateOfBirth` values as `Date` objects with absurd years
 *   (e.g. year 33331). Root cause: `new Date("33331")` is parsed by JS as
 *   "year 33331 AD" rather than failing, and the xlsx reader returned DOB cells
 *   as raw serial-number strings. Those stored dates serialise to extended-ISO
 *   like "+033331-12-31T18:30:00.000Z" which `validator.isISO8601()` rejects,
 *   breaking ALL edits on those members (including innocent district/group
 *   transfers). DOB is optional in the schema, so nulling is safe.
 *
 * What this script does:
 *   - Finds every member whose `dateOfBirth` ISO-serialisation does NOT start
 *     with a 4-digit-year `YYYY-MM-DD` (i.e. extended-year `+YYYYYY-...` or any
 *     other non-standard form).
 *   - UNSETS the `dateOfBirth` field on those records only.
 *   - Touches NOTHING else: no other field is read or written, no timestamps
 *     manipulation, no population, no save() (uses updateOne with $unset so
 *     Mongoose middleware doesn't fire on unrelated paths).
 *
 * What this script does NOT do:
 *   - It does NOT touch members with a valid 4-digit-year DOB.
 *   - It does NOT recover the original birth dates (the user explicitly chose
 *     to discard them — DOB can be re-entered later through the UI).
 *   - It does NOT modify name, phone, district, group, status, baithulMaal,
 *     roleTag, isLeader, or any other field.
 *
 * Usage:
 *   node cleanup-corrupted-dobs.js            (dry run — no writes)
 *   node cleanup-corrupted-dobs.js --execute  (apply changes)
 *   node cleanup-corrupted-dobs.js --execute --limit 5   (execute on first 5 only, for smoke test)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const DRY_RUN = !process.argv.includes('--execute');
const LIMIT_ARG = process.argv.indexOf('--limit');
const LIMIT = LIMIT_ARG !== -1 && process.argv[LIMIT_ARG + 1]
  ? Number(process.argv[LIMIT_ARG + 1])
  : null;

// Member model — only used to build the query; we use a raw updateOne($unset)
// instead of doc.save() to guarantee we never trigger setters/validators on
// any other path.
import Member from './src/models/Member.js';

// A "good" DOB serialises to an ISO string starting with YYYY-MM-DD where
// YYYY is a 4-digit year. Anything else (extended ISO with a leading +/-,
// NaN-date "Invalid Date", etc.) is considered corrupted.
const GOOD_ISO = /^\d{4}-\d{2}-\d{2}/;

function classify(dob) {
  if (dob === undefined || dob === null) return 'absent';
  const d = dob instanceof Date ? dob : new Date(dob);
  if (isNaN(d.getTime())) return 'invalid';
  const iso = d.toISOString();
  return GOOD_ISO.test(iso) ? 'good' : 'corrupted';
}

async function run() {
  console.log('\n========================================================');
  console.log(DRY_RUN
    ? '  DRY RUN – no changes will be written'
    : '  EXECUTE MODE – changes WILL be written');
  if (LIMIT) console.log(`  LIMIT: only first ${LIMIT} corrupted records will be updated`);
  console.log('========================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // Load candidate records. We pull only `dateOfBirth` (and name/phone for
  // reporting clarity) to keep the read cheap and to make it obvious that we
  // are not touching any other field.
  const candidates = await Member.find(
    { dateOfBirth: { $exists: true, $ne: null } },
    'name phone dateOfBirth'
  ).lean();

  console.log(`📊 Members with a non-null dateOfBirth: ${candidates.length}`);

  // Bucket every record by DOB classification.
  const buckets = { good: [], corrupted: [], invalid: [] };
  for (const m of candidates) {
    const c = classify(m.dateOfBirth);
    if (c === 'good') buckets.good.push(m);
    else if (c === 'corrupted') buckets.corrupted.push(m);
    else buckets.invalid.push(m); // 'invalid' Date — also worth cleaning
  }

  console.log(`   ✓ Valid (YYYY-MM-DD)        : ${buckets.good.length}  → will NOT be touched`);
  console.log(`   ✗ Corrupted (+YYYYYY-…)     : ${buckets.corrupted.length}  → will be $unset`);
  console.log(`   ✗ Invalid Date              : ${buckets.invalid.length}  → will be $unset`);
  console.log();

  const toClean = [...buckets.corrupted, ...buckets.invalid];
  if (toClean.length === 0) {
    console.log('ℹ️  No corrupted DOB records found. Nothing to do.');
    return;
  }

  // Show a sample so the operator can sanity-check before committing.
  console.log('--- Sample of records to be cleaned (first 15) ---');
  for (const m of toClean.slice(0, 15)) {
    const iso = (() => {
      try { return new Date(m.dateOfBirth).toISOString(); }
      catch { return String(m.dateOfBirth); }
    })();
    console.log(`  ${m._id} | ${m.name} | ${m.phone} | dob=${iso}`);
  }
  if (toClean.length > 15) console.log(`  … and ${toClean.length - 15} more`);
  console.log();

  if (DRY_RUN) {
    console.log(`⚡ DRY RUN: would $unset dateOfBirth on ${toClean.length} record(s).`);
    console.log(`   Re-run with --execute to apply.`);
    return;
  }

  // ─── EXECUTE ──────────────────────────────────────────────────────────────
  // Apply the slice if --limit was given (for a smoke test on a small batch).
  const targets = LIMIT ? toClean.slice(0, LIMIT) : toClean;
  const ids = targets.map(m => m._id);

  console.log(`✍️  $unset-ing dateOfBirth on ${targets.length} record(s)…`);

  // Single bulk write: one updateOne per target id, each with `$unset` on
  // `dateOfBirth` ONLY. No `$set`, no other paths. This guarantees the only
  // field-level change is the removal of `dateOfBirth`.
  const ops = ids.map(_id => ({
    updateOne: {
      filter: { _id },
      update: { $unset: { dateOfBirth: '' } },
    },
  }));

  // Chunk to avoid the 100k-ops Mongo bulk-write limit per round-trip; 500
  // is well under and keeps memory predictable.
  const CHUNK_SIZE = 500;
  let totalModified = 0;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const result = await Member.bulkWrite(chunk, { ordered: false });
    totalModified += result.modifiedCount || 0;
    console.log(`   chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(ops.length / CHUNK_SIZE)} → modified ${result.modifiedCount || 0}`);
  }

  console.log();
  console.log(`✅ Done. ${totalModified} of ${targets.length} record(s) had dateOfBirth unset.`);

  if (LIMIT && toClean.length > LIMIT) {
    console.log(`⚠️  Note: ${toClean.length - LIMIT} corrupted record(s) were NOT updated because --limit=${LIMIT} was set.`);
    console.log(`   Re-run without --limit to clean the rest.`);
  }

  // ─── VERIFY ───────────────────────────────────────────────────────────────
  const remaining = await Member.countDocuments({
    dateOfBirth: { $exists: true, $ne: null },
    // any date whose ISO form doesn't start with YYYY-MM-DD
    $expr: { $not: { $regexMatch: {
      input: { $dateToString: { date: '$dateOfBirth', format: '%Y-%m-%dT%H:%M:%S.%LZ' } },
      regex: /^\d{4}-\d{2}-\d{2}/,
    } } },
  }).catch(() => null);

  if (remaining !== null) {
    console.log(`🔍 Post-cleanup verification: ${remaining} corrupted DOB record(s) still remain.`);
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
}).finally(() => mongoose.disconnect());
