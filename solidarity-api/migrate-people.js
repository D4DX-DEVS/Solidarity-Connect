/**
 * People migration: replace every member and every admin/leader login with the
 * rows in people_properly_filtered_members_only.xlsx ("Filtered Members" sheet).
 *
 * KEEPS   districts + areas (groups) — master data, only re-pointed where they
 *         referenced deleted users — and every record on the QA phones
 *         9876543210 / 9995707129 (admin logins, member profile, member auth).
 * WIPES   all other members, member auths, users, and the activity data that
 *         points at people (targets, progress, recurring marks, meetings,
 *         attendance, payments, transfers, requests, notifications, org files,
 *         login OTPs). A JSON backup of every touched collection is written first.
 * CREATES one member (+ member auth) per phone, and admin logins for leaders —
 *         see loginsFor() in people-migration-lib.js for the role mapping.
 *
 * Usage:
 *   node migrate-people.js                     dry run (default, writes nothing)
 *   node migrate-people.js --execute           apply
 *   node migrate-people.js --file <path.xlsx>  other source file
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { EJSON } from 'bson';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import User from './src/models/User.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';
import {
  DEFAULT_XLSX, TEST_PHONE_VARIANTS, LEADER_MISMATCH, readRows, buildPeople, loginsFor, memberDocFor,
} from './people-migration-lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const EXECUTE = process.argv.includes('--execute');
const fileIdx = process.argv.indexOf('--file');
const XLSX_PATH = fileIdx !== -1 && process.argv[fileIdx + 1] ? process.argv[fileIdx + 1] : DEFAULT_XLSX;

// Activity collections that reference members/users. User chose to wipe them all.
const ACTIVITY_COLLECTIONS = [
  'membertargetprogresses', 'usertargetprogresses', 'recurringmarks', 'personaltargets',
  'meetings', 'meetingsessions', 'attendances', 'guestattendances', 'baithulmaalpayments',
  'transferrequests', 'requests', 'notifications', 'orgfiles', 'loginotps',
];
const PEOPLE_COLLECTIONS = ['members', 'memberauths', 'users'];
const BACKUP_COLLECTIONS = [...PEOPLE_COLLECTIONS, 'districts', 'groups', ...ACTIVITY_COLLECTIONS];

const keepFilter = { phone: { $in: TEST_PHONE_VARIANTS } };
const dropFilter = { phone: { $nin: TEST_PHONE_VARIANTS } };

/** Save docs through their model (hooks + validation) in small parallel batches. */
async function saveAll(Model, docs, label) {
  const saved = [];
  const failed = [];
  for (let i = 0; i < docs.length; i += 25) {
    const batch = docs.slice(i, i + 25);
    const results = await Promise.allSettled(batch.map((d) => new Model(d).save()));
    results.forEach((r, j) => (r.status === 'fulfilled'
      ? saved.push(r.value)
      : failed.push({ doc: batch[j], error: r.reason?.message })));
    process.stdout.write(`\r   ${label}: ${saved.length}/${docs.length}`);
  }
  process.stdout.write('\n');
  return { saved, failed };
}

async function backup(db, dir) {
  mkdirSync(dir, { recursive: true });
  for (const name of BACKUP_COLLECTIONS) {
    const docs = await db.collection(name).find({}).toArray();
    writeFileSync(join(dir, `${name}.json`), EJSON.stringify(docs, null, 1, { relaxed: false }));
    console.log(`   ${name}: ${docs.length}`);
  }
}

async function run() {
  console.log(`\n=== PEOPLE MIGRATION — ${EXECUTE ? 'EXECUTE (live writes)' : 'DRY RUN (no writes)'} ===`);
  console.log(`Source: ${XLSX_PATH}`);
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing in .env');

  const rows = readRows(XLSX_PATH);
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(`DB: ${db.databaseName} @ ${mongoose.connection.host}\nRows in sheet: ${rows.length}\n`);

  const districts = await District.find({}).lean();
  const groups = await Group.find({}).lean();
  const { people, skipped, warnings } = buildPeople(rows, districts, groups);
  const logins = people.flatMap(loginsFor);

  // Validate every doc against the schemas before anything is deleted.
  const placeholder = new mongoose.Types.ObjectId();
  const invalid = [
    ...people.map((p) => ({ p, err: new Member(memberDocFor(p, placeholder)).validateSync() })),
    ...logins.map((l) => ({ p: l, err: new User(l).validateSync() })),
  ].filter((x) => x.err);

  const byRole = logins.reduce((acc, l) => ({ ...acc, [`${l.role}/${l.adminKind}`]: (acc[`${l.role}/${l.adminKind}`] || 0) + 1 }), {});
  console.log('PLAN');
  console.log(`  members to create      : ${people.length} (leaders: ${people.filter((p) => p.roles.length).length}, intl phones: ${people.filter((p) => p.phone.intl).length}, no DOB: ${people.filter((p) => !p.dateOfBirth).length})`);
  console.log(`  admin logins to create : ${logins.length} ${JSON.stringify(byRole)}`);
  console.log(`  rows skipped           : ${skipped.length}`);
  skipped.forEach((s) => console.log(`     row ${s.row} ${s.name} (${s.phone}) — ${s.reason}`));
  const mismatches = warnings.filter((w) => w.warning === LEADER_MISMATCH);
  console.log(`  warnings               : ${warnings.length}`);
  console.log(`     ${mismatches.length} rows — ${LEADER_MISMATCH}`);
  warnings.filter((w) => w.warning !== LEADER_MISMATCH).forEach((w) => console.log(`     row ${w.row} ${w.name} — ${w.warning}`));
  console.log(`  schema-invalid docs    : ${invalid.length}`);
  invalid.forEach(({ p, err }) => console.log(`     ${p.name} (${p.phone?.member || p.phone}) — ${err.message}`));

  console.log('\nWOULD DELETE');
  for (const name of PEOPLE_COLLECTIONS) {
    const [drop, keep] = await Promise.all([db.collection(name).countDocuments(dropFilter), db.collection(name).countDocuments(keepFilter)]);
    console.log(`  ${name.padEnd(24)} ${drop} (keeping ${keep} QA-phone rows)`);
  }
  for (const name of ACTIVITY_COLLECTIONS) console.log(`  ${name.padEnd(24)} ${await db.collection(name).countDocuments()}`);

  if (invalid.length) throw new Error('Schema-invalid documents — fix before executing. Nothing was changed.');
  if (!EXECUTE) {
    console.log('\nDry run only. Re-run with --execute to apply.');
    return;
  }

  // ── 1. Backup ────────────────────────────────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(__dirname, 'backups', `people-migration-${stamp}`);
  console.log(`\n1. Backup → ${backupDir}`);
  await backup(db, backupDir);

  // ── 2. Wipe ──────────────────────────────────────────────────────────────
  console.log('\n2. Wipe');
  for (const name of PEOPLE_COLLECTIONS) {
    const { deletedCount } = await db.collection(name).deleteMany(dropFilter);
    console.log(`   ${name}: -${deletedCount}`);
  }
  for (const name of ACTIVITY_COLLECTIONS) {
    const { deletedCount } = await db.collection(name).deleteMany({});
    console.log(`   ${name}: -${deletedCount}`);
  }

  // ── 3. Admin logins ──────────────────────────────────────────────────────
  console.log('\n3. Admin logins');
  const users = await saveAll(User, logins, 'users');

  // Real State President approves/creates the imported rows; QA state admin as fallback.
  const approver =
    (await User.findOne({ role: 'state_admin', 'roleTag.type': 'state', 'roleTag.name': /^president$/i, ...dropFilter })) ||
    (await User.findOne({ role: 'state_admin', ...keepFilter }));
  if (!approver) throw new Error('No state admin available as approver');
  console.log(`   approver: ${approver.name} (${approver._id})`);

  // ── 4. Members + member auth ─────────────────────────────────────────────
  console.log('\n4. Members');
  const members = await saveAll(Member, people.map((p) => memberDocFor(p, approver._id)), 'members');
  const auths = await saveAll(
    MemberAuth,
    members.saved.map((m) => ({ member: m._id, phone: m.phone, isActive: m.status === 'Active' && m.isApproved })),
    'member auth'
  );

  // ── 5. Re-point master data at surviving users ───────────────────────────
  console.log('\n5. Master data references');
  const liveIds = (await User.find({}).select('_id').lean()).map((u) => u._id);
  for (const Model of [District, Group]) {
    const unsetAdmin = await Model.updateMany({ admin: { $exists: true, $nin: liveIds } }, { $unset: { admin: 1 } });
    const creator = await Model.updateMany({ createdBy: { $nin: liveIds } }, { $set: { createdBy: approver._id } });
    console.log(`   ${Model.modelName}: admin unset ${unsetAdmin.modifiedCount}, createdBy re-pointed ${creator.modifiedCount}`);
  }
  for (const d of await District.find({})) await d.updateStatistics();
  for (const g of await Group.find({})) await g.updateStatistics();
  console.log('   statistics refreshed');

  // ── 6. Report ────────────────────────────────────────────────────────────
  const failures = [
    ...users.failed.map((f) => ({ kind: 'user', name: f.doc.name, phone: f.doc.phone, role: f.doc.role, error: f.error })),
    ...members.failed.map((f) => ({ kind: 'member', name: f.doc.name, phone: f.doc.phone, error: f.error })),
    ...auths.failed.map((f) => ({ kind: 'memberauth', phone: f.doc.phone, error: f.error })),
  ];
  const report = { source: XLSX_PATH, backupDir, created: { users: users.saved.length, members: members.saved.length, memberAuths: auths.saved.length }, skipped, warnings, failures };
  writeFileSync(join(backupDir, 'migration-report.json'), JSON.stringify(report, null, 2));

  console.log('\n=== DONE ===');
  console.log(`  users ${users.saved.length}/${logins.length}, members ${members.saved.length}/${people.length}, member auth ${auths.saved.length}/${members.saved.length}`);
  console.log(`  failures: ${failures.length}`);
  failures.forEach((f) => console.log(`     [${f.kind}] ${f.name || ''} ${f.phone} — ${f.error}`));
  console.log(`  report: ${join(backupDir, 'migration-report.json')}`);
}

run()
  .catch((err) => {
    console.error('\nMIGRATION FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
