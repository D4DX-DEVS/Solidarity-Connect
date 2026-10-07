/**
 * Add people from a top-up sheet WITHOUT wiping anything (e.g. "To D4DX 07 Oct
 * 26.xlsx"). Same parsing and login rules as migrate-people.js — an admin login
 * only for a role whose own "Is Leader" flag is TRUE. A row whose phone already
 * belongs to a member or an admin login is skipped and reported, never changed.
 *
 * Usage:
 *   node add-people.js <path.xlsx>              dry run
 *   node add-people.js <path.xlsx> --execute    apply
 * Rollback: backups/add-people-<stamp>/added.json lists every created _id.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import Member from './src/models/Member.js';
import MemberAuth from './src/models/MemberAuth.js';
import User from './src/models/User.js';
import District from './src/models/District.js';
import Group from './src/models/Group.js';
import { listAccounts } from './src/services/loginService.js';
import { readRows, buildPeople, loginsFor, memberDocFor } from './people-migration-lib.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const EXECUTE = process.argv.includes('--execute');
const XLSX_PATH = process.argv.slice(2).find((a) => a.toLowerCase().endsWith('.xlsx'));
if (!XLSX_PATH) throw new Error('Usage: node add-people.js <path.xlsx> [--execute]');

const variantsOf = (phone) => (phone.intl ? [phone.member, phone.key] : [phone.key, phone.member, `91${phone.key}`]);
const ymd = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

async function saveAll(Model, docs) {
  const saved = [];
  const failed = [];
  for (const doc of docs) {
    try { saved.push(await new Model(doc).save()); } catch (err) { failed.push({ doc, error: err.message }); }
  }
  return { saved, failed };
}

async function run() {
  console.log(`\n=== ADD PEOPLE — ${EXECUTE ? 'EXECUTE (live writes)' : 'DRY RUN (no writes)'} ===`);
  console.log(`Source: ${XLSX_PATH}`);
  await mongoose.connect(process.env.MONGODB_URI);

  const rows = readRows(XLSX_PATH);
  const { people, skipped, warnings } = buildPeople(rows, await District.find({}).lean(), await Group.find({}).lean());

  // Never touch anyone already in the system.
  const toAdd = [];
  for (const p of people) {
    const phones = { $in: variantsOf(p.phone) };
    const [m, u] = await Promise.all([Member.findOne({ phone: phones }).lean(), User.findOne({ phone: phones }).lean()]);
    if (m || u) skipped.push({ row: p.row, name: p.name, phone: p.phone.member, reason: `already in the system (${m ? `member ${m.name}` : ''}${m && u ? ', ' : ''}${u ? `${u.role} ${u.name}` : ''}) — left unchanged` });
    else toAdd.push(p);
  }
  const logins = toAdd.flatMap(loginsFor);

  const placeholder = new mongoose.Types.ObjectId();
  const invalid = [
    ...toAdd.map((p) => ({ who: p.name, err: new Member(memberDocFor(p, placeholder)).validateSync() })),
    ...logins.map((l) => ({ who: `${l.name} ${l.role}`, err: new User(l).validateSync() })),
  ].filter((x) => x.err);

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 38);
  const byRole = logins.reduce((a, l) => ({ ...a, [`${l.role}/${l.adminKind}`]: (a[`${l.role}/${l.adminKind}`] || 0) + 1 }), {});
  console.log(`\nRows in sheet: ${rows.length}`);
  console.log(`Members to add: ${toAdd.length} (leaders ${toAdd.filter((p) => p.roles.length).length}, intl phones ${toAdd.filter((p) => p.phone.intl).length}, no DOB ${toAdd.filter((p) => !p.dateOfBirth).length}, aged 38+ ${toAdd.filter((p) => p.dateOfBirth && p.dateOfBirth <= cutoff).length})`);
  console.log(`Admin logins to add: ${logins.length} ${JSON.stringify(byRole)}`);
  logins.forEach((l) => console.log(`   + ${l.role}/${l.adminKind} ${l.name} — ${l.roleTag.type} ${l.roleTag.name}${l.roleTag.roleDescription ? ` (${l.roleTag.roleDescription})` : ''}`));
  console.log(`Leaders without admin login (flag FALSE): ${toAdd.filter((p) => p.roles.length && !p.roles.some((r) => r.admin)).map((p) => `${p.name} [${p.roles.map((r) => `${r.type} ${r.title}`).join(', ')}]`).join('; ') || 'none'}`);
  console.log(`Skipped: ${skipped.length}`);
  skipped.forEach((s) => console.log(`   ${s.row} ${s.name} (${s.phone}) — ${s.reason}`));
  console.log(`Warnings: ${warnings.length}`);
  warnings.forEach((w) => console.log(`   ${w.row} ${w.name} — ${w.warning}`));
  console.log(`Schema-invalid: ${invalid.length}`);
  invalid.forEach((x) => console.log(`   ${x.who} — ${x.err.message}`));

  if (invalid.length) throw new Error('Fix schema-invalid rows first. Nothing was changed.');
  if (!EXECUTE) { console.log('\nDry run only. Re-run with --execute to apply.'); return; }

  const approver =
    (await User.findOne({ role: 'state_admin', 'roleTag.type': 'state', 'roleTag.name': /^president$/i })) ||
    (await User.findOne({ role: 'state_admin', isActive: true }).sort({ createdAt: 1 }));
  const users = await saveAll(User, logins);
  const members = await saveAll(Member, toAdd.map((p) => memberDocFor(p, approver._id)));
  const auths = await saveAll(MemberAuth, members.saved.map((m) => ({ member: m._id, phone: m.phone, isActive: m.status === 'Active' && m.isApproved })));

  for (const id of new Set(members.saved.map((m) => String(m.district)))) await (await District.findById(id))?.updateStatistics();
  for (const id of new Set(members.saved.map((m) => String(m.group)))) await (await Group.findById(id))?.updateStatistics();

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(__dirname, 'backups', `add-people-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const failures = [...users.failed, ...members.failed, ...auths.failed].map((f) => ({ name: f.doc.name, phone: f.doc.phone, error: f.error }));
  writeFileSync(join(dir, 'added.json'), JSON.stringify({
    source: XLSX_PATH,
    users: users.saved.map((u) => String(u._id)),
    members: members.saved.map((m) => String(m._id)),
    memberAuths: auths.saved.map((a) => String(a._id)),
    skipped, warnings, failures,
  }, null, 2));
  console.log(`\nAdded: users ${users.saved.length}/${logins.length}, members ${members.saved.length}/${toAdd.length}, member auth ${auths.saved.length}/${members.saved.length}`);
  console.log(`Failures: ${failures.length}`);
  failures.forEach((f) => console.log(`   ${f.name} ${f.phone} — ${f.error}`));

  // Re-read and compare what was written.
  const problems = [];
  for (const p of toAdd) {
    const want = memberDocFor(p, null);
    const m = await Member.findOne({ phone: want.phone }).lean();
    if (!m) { problems.push(`${p.name}: member missing`); continue; }
    const diff = [
      ['name', m.name, want.name], ['district', String(m.district), String(want.district)], ['area', String(m.group), String(want.group)],
      ['unit', m.address || '', want.address || ''], ['status', m.status, want.status], ['blood', m.bloodGroup || '', want.bloodGroup || ''],
      ['dob', ymd(m.dateOfBirth), ymd(want.dateOfBirth)], ['leader', !!m.isLeader, want.isLeader],
    ].filter(([, a, b]) => a !== b);
    diff.forEach(([f, a, b]) => problems.push(`${p.name}: ${f} ${a} ≠ ${b}`));
    if (!(await MemberAuth.exists({ member: m._id }))) problems.push(`${p.name}: no member auth`);
  }
  for (const l of logins) if (!(await User.exists({ phone: l.phone, role: l.role, adminKind: l.adminKind }))) problems.push(`${l.name}: ${l.role} login missing`);
  console.log(`Post-check: ${problems.length ? `${problems.length} problem(s)` : 'all added records match the sheet'}`);
  problems.forEach((x) => console.log(`   ${x}`));
  for (const p of toAdd.filter((x) => x.roles.length)) {
    console.log(`   login picker ${p.name}: ${(await listAccounts(p.phone.user)).map((a) => a.label).join(' | ')}`);
  }
  console.log(`Rollback list: ${join(dir, 'added.json')}`);
}

run()
  .catch((err) => { console.error('\nFAILED:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
