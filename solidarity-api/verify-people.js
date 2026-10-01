/**
 * Verify the people migration against the source Excel and the pre-migration
 * backup. Read-only.
 *
 * Usage: node verify-people.js <backupDir> [--file <path.xlsx>]
 *   backupDir = backups/people-migration-<stamp> written by migrate-people.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { EJSON } from 'bson';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import User from './src/models/User.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';
import { areaGroupIdsFor, isAreaLevelAdmin } from './src/middleware/auth.js';
import { listAccounts } from './src/services/loginService.js';
import {
  DEFAULT_XLSX, TEST_PHONE_VARIANTS, readRows, buildPeople, loginsFor, memberDocFor,
} from './people-migration-lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const backupDir = process.argv[2];
const fileIdx = process.argv.indexOf('--file');
const XLSX_PATH = fileIdx !== -1 ? process.argv[fileIdx + 1] : DEFAULT_XLSX;
if (!backupDir) throw new Error('Usage: node verify-people.js <backupDir>');

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); return ok; };
const id = (v) => String(v?._id ?? v ?? '');
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const loadBackup = (name) => EJSON.parse(readFileSync(join(backupDir, `${name}.json`), 'utf8'), { relaxed: false });

// Fields of a kept QA record that must be byte-for-byte unchanged.
const snapshot = (doc) => JSON.stringify({
  role: doc.role, adminKind: doc.adminKind, name: doc.name, phone: doc.phone, district: id(doc.district),
  group: id(doc.group), roleTag: doc.roleTag, extraRoleTags: doc.extraRoleTags, isActive: doc.isActive,
  status: doc.status, member: id(doc.member),
});

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(`Verifying ${db.databaseName} against ${XLSX_PATH}\n`);

  const districts = await District.find({}).lean();
  const groups = await Group.find({}).lean();
  const { people } = buildPeople(readRows(XLSX_PATH), districts, groups);
  const expectedLogins = people.flatMap(loginsFor);

  // 1. Master data untouched
  check(districts.length === loadBackup('districts').length, `district count changed: ${districts.length}`);
  check(groups.length === loadBackup('groups').length, `group count changed: ${groups.length}`);

  // 2. QA phones kept exactly
  for (const [name, Model] of [['users', User], ['members', Member], ['memberauths', MemberAuth]]) {
    const before = loadBackup(name).filter((d) => TEST_PHONE_VARIANTS.includes(d.phone));
    const after = await Model.find({ phone: { $in: TEST_PHONE_VARIANTS } }).lean();
    check(before.length === after.length, `${name}: QA rows ${before.length} → ${after.length}`);
    for (const b of before) {
      const a = after.find((x) => id(x._id) === id(b._id));
      check(a && snapshot(a) === snapshot(b), `${name}: QA row ${b._id} (${b.phone} ${b.role || ''}) changed or missing`);
    }
    console.log(`QA ${name}: ${after.length} kept`);
  }

  // 3. Totals
  const [memberCount, authCount, userCount] = await Promise.all([Member.countDocuments(), MemberAuth.countDocuments(), User.countDocuments()]);
  const qaUsers = await User.countDocuments({ phone: { $in: TEST_PHONE_VARIANTS } });
  const qaMembers = await Member.countDocuments({ phone: { $in: TEST_PHONE_VARIANTS } });
  check(memberCount === people.length + qaMembers, `members ${memberCount}, expected ${people.length} + ${qaMembers} QA`);
  check(authCount === memberCount, `member auths ${authCount} ≠ members ${memberCount}`);
  check(userCount === expectedLogins.length + qaUsers, `users ${userCount}, expected ${expectedLogins.length} + ${qaUsers} QA`);
  console.log(`Totals: members ${memberCount}, member auths ${authCount}, users ${userCount}`);

  // 4. Every Excel person, field by field
  const members = new Map((await Member.find({}).lean()).map((m) => [m.phone, m]));
  const auths = new Map((await MemberAuth.find({}).lean()).map((a) => [id(a.member), a]));
  for (const p of people) {
    const want = memberDocFor(p, null);
    const m = members.get(want.phone);
    if (!check(m, `member missing: row ${p.row} ${p.name} ${want.phone}`)) continue;
    const tag = `row ${p.row} ${p.name}`;
    check(m.name === want.name, `${tag}: name "${m.name}"`);
    check(id(m.district) === id(want.district) && id(m.group) === id(want.group), `${tag}: district/area wrong`);
    check((m.address || '') === (want.address || ''), `${tag}: unit "${m.address}" ≠ "${want.address}"`);
    check(m.status === want.status, `${tag}: status ${m.status} ≠ ${want.status}`);
    check((m.bloodGroup || '') === (want.bloodGroup || ''), `${tag}: blood ${m.bloodGroup} ≠ ${want.bloodGroup}`);
    check(ymd(m.dateOfBirth) === ymd(want.dateOfBirth), `${tag}: DOB ${ymd(m.dateOfBirth)} ≠ ${ymd(want.dateOfBirth)}`);
    check(!!m.isLeader === want.isLeader, `${tag}: isLeader ${m.isLeader}`);
    check((m.roleTag?.type || '') === (want.roleTag?.type || '') && (m.roleTag?.name || '') === (want.roleTag?.name || ''), `${tag}: roleTag ${JSON.stringify(m.roleTag)}`);
    check((m.extraRoleTags || []).length === want.extraRoleTags.length, `${tag}: extraRoleTags ${m.extraRoleTags?.length}`);
    check(m.isApproved === true, `${tag}: not approved`);
    const a = auths.get(id(m._id));
    check(a && a.phone === m.phone && a.isActive === (m.status === 'Active'), `${tag}: member auth missing/mismatched`);
  }
  console.log(`Members checked: ${people.length}`);

  // 5. Every expected admin login
  const users = await User.find({}).populate('district', 'name').populate('group', 'name').lean();
  const byKey = new Map(users.map((u) => [`${u.phone}|${u.role}|${u.adminKind}`, u]));
  let areaScoped = 0;
  for (const want of expectedLogins) {
    const u = byKey.get(`${want.phone}|${want.role}|${want.adminKind}`);
    const tag = `${want.name} ${want.phone} ${want.role}/${want.adminKind}`;
    if (!check(u, `login missing: ${tag}`)) continue;
    check(u.isActive && u.isLeader, `${tag}: inactive or not leader`);
    check(id(u.district) === id(want.district), `${tag}: district wrong`);
    check(want.role !== 'group_admin' || id(u.group) === id(want.group), `${tag}: group wrong`);
    check(u.roleTag?.type === want.roleTag.type && u.roleTag?.name === want.roleTag.name, `${tag}: roleTag ${JSON.stringify(u.roleTag)}`);
    check((u.extraRoleTags || []).length === want.extraRoleTags.length, `${tag}: extraRoleTags ${u.extraRoleTags?.length}`);
    check((u.permissions || []).length > 0, `${tag}: no permissions (pre-save hook skipped?)`);
    if (isAreaLevelAdmin(u)) {
      const ids = (await areaGroupIdsFor(u)).map(String);
      check(ids.includes(id(u.group)), `${tag}: area scope does not resolve to own area "${u.roleTag?.roleDescription}"`);
      areaScoped++;
    }
  }
  console.log(`Logins checked: ${expectedLogins.length} (area-level scope resolved: ${areaScoped})`);

  // 6. Referential integrity
  const districtIds = new Set(districts.map((d) => id(d._id)));
  const groupIds = new Set(groups.map((g) => id(g._id)));
  const userIds = new Set(users.map((u) => id(u._id)));
  for (const m of members.values()) {
    check(districtIds.has(id(m.district)) && groupIds.has(id(m.group)), `member ${m.name} ${m.phone}: dangling district/group`);
    check(userIds.has(id(m.createdBy)), `member ${m.name}: dangling createdBy`);
  }
  for (const u of users) {
    check(!u.district || u.district._id, `user ${u.name} ${u.role}: dangling district`);
    check(u.role !== 'group_admin' || u.group?._id, `user ${u.name} ${u.role}: dangling group`);
  }
  for (const a of auths.values()) check([...members.values()].some((m) => id(m._id) === id(a.member)), `member auth ${a.phone}: dangling member`);
  for (const d of [...districts, ...groups]) {
    check(userIds.has(id(d.createdBy)), `${d.name}: dangling createdBy`);
    check(!d.admin || userIds.has(id(d.admin)), `${d.name}: dangling admin`);
  }
  const statTotal = (await District.find({}).lean()).reduce((s, d) => s + (d.statistics?.totalMembers || 0), 0);
  check(statTotal === memberCount, `district statistics total ${statTotal} ≠ ${memberCount}`);
  console.log('Referential integrity checked');

  // 7. Activity collections empty
  for (const name of ['membertargetprogresses', 'usertargetprogresses', 'recurringmarks', 'personaltargets', 'meetings', 'baithulmaalpayments', 'transferrequests', 'notifications', 'orgfiles']) {
    const n = await db.collection(name).countDocuments();
    check(n === 0, `${name} still has ${n}`);
  }

  // 8. Login picker for sample numbers
  const samples = [
    '9876543210', '9995707129',
    ...['state', 'district', 'murabi', 'unit'].map((t) => people.find((p) => p.roles[0]?.type === t)?.phone.user),
    people.find((p) => p.roles.length >= 3)?.phone.user,
    people.find((p) => p.phone.intl && p.status === 'Active')?.phone.user,
    people.find((p) => !p.roles.length && p.status === 'Active')?.phone.user,
  ].filter(Boolean);
  console.log('\nLogin picker samples:');
  for (const phone of samples) {
    const accounts = await listAccounts(phone);
    check(accounts.length > 0, `listAccounts(${phone}) returned nothing`);
    console.log(`  ${phone}: ${accounts.map((a) => `${a.label}${a.scope ? ` [${a.scope}]` : ''}`).join(' | ') || '(none)'}`);
  }

  console.log(`\n${problems.length ? `FAILED — ${problems.length} problem(s):` : 'ALL CHECKS PASSED'}`);
  problems.slice(0, 100).forEach((p) => console.log(`  - ${p}`));
  if (problems.length) process.exitCode = 1;
}

run()
  .catch((err) => { console.error('VERIFY ERROR:', err); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
