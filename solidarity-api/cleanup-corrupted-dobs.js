/**
 * Cleanup Script: Null out corrupted Member.dateOfBirth and Member.age values
 *
 * Background:
 *   The legacy migration scripts (migrate-full-data.js, migrate-new-members.js)
 *   wrote ~492 `Member.dateOfBirth` values as `Date` objects with absurd years
 *   (e.g. year 33331). Root cause: `new Date("33331")` is parsed by JS as
 *   "year 33331 AD" rather than failing, and the xlsx reader returned DOB cells
 *   as raw serial-number strings. Those stored dates serialise to extended-ISO
 *   like "+033331-12-31T18:30:00.000Z" which `validator.isISO8601()` rejects,
 *   breaking ALL edits on those members (including innocent district/group
 *   transfers).
 *
 *   The Member schema has a `pre('save')` hook that auto-computes `age` from
 *   `dateOfBirth`, so those same 492 records also have garbage `age` values
 *   (e.g. age=-31305). `age` has `min: 0, max: 120` validators, so any
 *   `save()` on those records (e.g. editing a member through the UI) fails
 *   with `Member validation failed: age: Age cannot be negative` → 500.
 *
 *   Note: this save-time error fires even AFTER the DOB has been unset,
 *   because Mongoose re-validates all existing fields on every save().
 *
 * What this script does:
 *   - Pass 1 (dateOfBirth): finds every member whose `dateOfBirth` ISO form
 *     does NOT start with `YYYY-MM-DD` (extended-year `+YYYYYY-…` or NaN) and
 *     `$unset`s `dateOfBirth`.
 *   - Pass 2 (age): finds every member whose `age` is outside the 0-120 schema
 *     range and `$unset`s `age`. (`age` is a derived field; the pre-save hook
 *     recomputes it the next time a DOB is added through the UI.)
 *   - Touches NOTHING else: no other field is read or written, no `$set`, no
 *     save() (uses raw updateOne with $unset so Mongoose validators/middleware
 *     don't fire on unrelated paths).
 *
 * What this script does NOT do:
 *   - It does NOT touch members with a valid 4-digit-year DOB or a 0-120 age.
 *   - It does NOT recover the original birth dates (the user explicitly chose
 *     to discard them — DOB can be re-entered later through the UI).
 *   - It does NOT modify name, phone, district, group, status, baithulMaal,
 *     roleTag, isLeader, or any other field.
 *
 * Usage:
 *   node cleanup-corrupted-dobs.js            (dry run — no writes)
 *   node cleanup-corrupted-dobs.js --execute  (apply changes)
 *   node cleanup-corrupted-dobs.js --execute --limit 5   (execute on first 5 only, for smoke test)
 *
 * Re-run safety:
 *   Idempotent. Already-clean records will be reported as "0 to clean" on
 *   subsequent runs and skipped. Safe to re-run after partial failures.
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

  // Load candidate records. We pull only `dateOfBirth` and `age` (and
  // name/phone for reporting clarity) to keep the read cheap and to make it
  // obvious that we are not touching any other field.
  const candidates = await Member.find(
    {
      $or: [
        { dateOfBirth: { $exists: true, $ne: null } },
        { age: { $exists: true } },
      ],
    },
    'name phone dateOfBirth age'
  ).lean();

  console.log(`📊 Members with a dateOfBirth or age field set: ${candidates.length}`);

  // ── Bucket every record by DOB classification ─────────────────────────────
  const dobBuckets = { good: [], corrupted: [], invalid: [] };
  for (const m of candidates) {
    const c = classify(m.dateOfBirth);
    if (c === 'good') dobBuckets.good.push(m);
    else if (c === 'corrupted') dobBuckets.corrupted.push(m);
    else if (c === 'invalid') dobBuckets.invalid.push(m); // 'invalid' Date — also worth cleaning
  }

  console.log(`\n── dateOfBirth pass ──`);
  console.log(`   ✓ Valid (YYYY-MM-DD)        : ${dobBuckets.good.length}  → will NOT be touched`);
  console.log(`   ✗ Corrupted (+YYYYYY-…)     : ${dobBuckets.corrupted.length}  → will be $unset`);
  console.log(`   ✗ Invalid Date              : ${dobBuckets.invalid.length}  → will be $unset`);

  const dobToClean = [...dobBuckets.corrupted, ...dobBuckets.invalid];

  // ── Bucket every record by age validity (schema: 0..120) ──────────────────
  // `age` is auto-derived from DOB by the pre-save hook. A record with a
  // corrupted DOB will have a garbage age (e.g. -31305). Even after the DOB
  // is unset, the stale `age` lingers in the document and trips Mongoose's
  // min/max validators on the next `save()`, so we must also $unset it.
  const ageBuckets = { good: [], corrupted: [] };
  for (const m of candidates) {
    if (m.age === undefined || m.age === null) continue;
    if (typeof m.age === 'number' && m.age >= 0 && m.age <= 120) {
      ageBuckets.good.push(m);
    } else {
      ageBuckets.corrupted.push(m);
    }
  }

  console.log(`\n── age pass ──`);
  console.log(`   ✓ Valid age (0-120)          : ${ageBuckets.good.length}  → will NOT be touched`);
  console.log(`   ✗ Corrupted age (<0 or >120) : ${ageBuckets.corrupted.length}  → will be $unset`);

  const ageToClean = ageBuckets.corrupted;

  if (dobToClean.length === 0 && ageToClean.length === 0) {
    console.log('\nℹ️  No corrupted DOB or age records found. Nothing to do.');
    return;
  }

  // Show samples so the operator can sanity-check before committing.
  if (dobToClean.length > 0) {
    console.log('\n--- Sample of DOB-corrupted records to be cleaned (first 10) ---');
    for (const m of dobToClean.slice(0, 10)) {
      const iso = (() => {
        try { return new Date(m.dateOfBirth).toISOString(); }
        catch { return String(m.dateOfBirth); }
      })();
      console.log(`  ${m._id} | ${m.name} | ${m.phone} | dob=${iso}`);
    }
    if (dobToClean.length > 10) console.log(`  … and ${dobToClean.length - 10} more`);
  }

  if (ageToClean.length > 0) {
    console.log('\n--- Sample of age-corrupted records to be cleaned (first 10) ---');
    for (const m of ageToClean.slice(0, 10)) {
      console.log(`  ${m._id} | ${m.name} | ${m.phone} | age=${m.age}`);
    }
    if (ageToClean.length > 10) console.log(`  … and ${ageToClean.length - 10} more`);
  }
  console.log();

  if (DRY_RUN) {
    console.log(`⚡ DRY RUN: would $unset dateOfBirth on ${dobToClean.length} record(s) and age on ${ageToClean.length} record(s).`);
    console.log(`   Re-run with --execute to apply.`);
    return;
  }

  // ─── EXECUTE ──────────────────────────────────────────────────────────────
  // Apply the slice if --limit was given (for a smoke test on a small batch).
  // The limit applies to EACH pass independently.
  const sliceTargets = (arr) => LIMIT ? arr.slice(0, LIMIT) : arr;
  const dobTargets = sliceTargets(dobToClean);
  const ageTargets = sliceTargets(ageToClean);

  // Build a single bulk-write batch. Each op is a `updateOne` with `$unset`
  // on exactly ONE field. We do NOT combine the two $unsets into one op per
  // record (even though that would be more efficient) — keeping them separate
  // makes the dry-run/execute counts and chunked progress output clearer and
  // avoids accidentally writing an unchanged field.
  const CHUNK_SIZE = 500;

  const runPass = async (label, targets, field) => {
    if (targets.length === 0) {
      console.log(`✍️  ${label}: nothing to do (0 records).`);
      return 0;
    }
    console.log(`✍️  ${label}: $unset-ing \`${field}\` on ${targets.length} record(s)…`);
    const ops = targets.map(m => ({
      updateOne: {
        filter: { _id: m._id },
        update: { $unset: { [field]: '' } },
      },
    }));
    let totalModified = 0;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const chunk = ops.slice(i, i + CHUNK_SIZE);
      const result = await Member.bulkWrite(chunk, { ordered: false });
      totalModified += result.modifiedCount || 0;
      console.log(`   chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(ops.length / CHUNK_SIZE)} → modified ${result.modifiedCount || 0}`);
    }
    console.log(`   ${label} done — ${totalModified} of ${targets.length} record(s) updated.`);
    return totalModified;
  };

  const dobModified = await runPass('dateOfBirth pass', dobTargets, 'dateOfBirth');
  const ageModified = await runPass('age pass', ageTargets, 'age');

  console.log();
  console.log(`✅ Done.`);
  console.log(`   dateOfBirth $unset on ${dobModified} record(s).`);
  console.log(`   age          $unset on ${ageModified} record(s).`);

  const noteLimitHtml = (label, total, executed) => {
    if (LIMIT && total > LIMIT) {
      console.log(`⚠️  Note: ${total - LIMIT} ${label}-corrupted record(s) were NOT updated because --limit=${LIMIT} was set.`);
    }
  };
  noteLimitHtml('DOB', dobToClean.length, dobModified);
  noteLimitHtml('age', ageToClean.length, ageModified);
  if (LIMIT && (dobToClean.length > LIMIT || ageToClean.length > LIMIT)) {
    console.log(`   Re-run without --limit to clean the rest.`);
  }

  // ─── VERIFY ───────────────────────────────────────────────────────────────
  console.log('\n--- Post-cleanup verification ---');

  const remainingDob = await Member.countDocuments({
    dateOfBirth: { $exists: true, $ne: null },
    $expr: { $not: { $regexMatch: {
      input: { $dateToString: { date: '$dateOfBirth', format: '%Y-%m-%dT%H:%M:%S.%LZ' } },
      regex: /^\d{4}-\d{2}-\d{2}/,
    } } },
  }).catch(() => null);
  if (remainingDob !== null) {
    console.log(`🔍 Corrupted DOB record(s) still remaining: ${remainingDob}`);
  }

  const remainingAge = await Member.countDocuments({
    age: { $exists: true },
    $or: [{ age: { $lt: 0 } }, { age: { $gt: 120 } }],
  }).catch(() => null);
  if (remainingAge !== null) {
    console.log(`🔍 Corrupted age record(s) still remaining: ${remainingAge}`);
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  mongoose.disconnect();
  process.exit(1);
}).finally(() => mongoose.disconnect());
