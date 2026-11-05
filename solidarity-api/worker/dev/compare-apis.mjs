// Calls every read endpoint on two API instances with the same short-lived tokens and
// reports response differences. Tokens are minted in-process (never printed).
//   node worker/dev/compare-apis.mjs <baseA> <baseB> <exportDir> [--only=substr] [--show=N]
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const [baseA, baseB, exportDir] = process.argv.slice(2);
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const showN = Number(process.argv.find((a) => a.startsWith('--show='))?.slice(7) || 3);
const data = JSON.parse(fs.readFileSync(path.join(exportDir, 'storage-form.json'), 'utf8'));

const TEST_PHONE = '9876543210';
const users = data.users || [];
const pickUser = (role) => users.find((u) => u.phone === TEST_PHONE && u.role === role && u.isActive !== false) || users.find((u) => u.role === role && u.isActive !== false);
const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });
const adminToken = (u) => (u ? sign({ id: u._id, phone: u.phone, role: u.role }) : null);
const memberAuth = (data.memberauths || []).find((m) => m.phone === TEST_PHONE) || (data.memberauths || [])[0];

const roles = {
  state: adminToken(pickUser('state_admin')),
  district: adminToken(pickUser('district_admin')),
  area: adminToken(pickUser('group_admin')),
  member: memberAuth ? sign({ id: memberAuth._id, memberId: memberAuth.member, phone: memberAuth.phone, userType: 'member' }) : null,
};

const member = (data.members || []).find((m) => m.phone === TEST_PHONE) || data.members[0];
const district = data.districts.find((d) => d._id === member.district) || data.districts[0];
const group = data.groups.find((g) => g._id === member.group) || data.groups[0];
const someUser = pickUser('district_admin') || users[0];
const report = (data.monthlyreports || [])[0];
const meeting = (data.meetings || [])[0];
const now = new Date();
const ym = `year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
const prevYm = `year=${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}&month=${now.getMonth() === 0 ? 12 : now.getMonth()}`;

const admin = ['state', 'district', 'area'];
const endpoints = [
  ['/api/auth/me', admin],
  ['/api/auth/accounts', admin],
  ['/api/districts', admin],
  ['/api/districts?includeStats=true', admin],
  [`/api/districts/${district._id}`, admin],
  [`/api/districts/${district._id}/groups`, admin],
  [`/api/districts/${district._id}/transfer-groups`, admin],
  [`/api/districts/${district._id}/members`, admin],
  [`/api/districts/${district._id}/stats`, admin],
  ['/api/groups', admin],
  ['/api/groups?limit=200', admin],
  [`/api/groups?district=${district._id}`, admin],
  [`/api/groups/${group._id}`, admin],
  [`/api/groups/${group._id}/members`, admin],
  [`/api/groups/${group._id}/stats`, admin],
  ['/api/members', admin],
  ['/api/members?page=2&limit=20', admin],
  ['/api/members?limit=50&sortBy=name&sortOrder=asc', admin],
  ['/api/members?search=abd', admin],
  ['/api/members?status=Active', admin],
  [`/api/members?district=${district._id}`, admin],
  [`/api/members?group=${group._id}`, admin],
  ['/api/members?isLeader=true', admin],
  ['/api/members/archives', admin],
  ['/api/members/user-context', admin],
  [`/api/members/${member._id}`, admin],
  ['/api/members/stats/overview', admin],
  [`/api/members/stats/overview?district=${district._id}`, admin],
  ['/api/users', admin],
  ['/api/users?limit=100', admin],
  ['/api/users?role=district_admin', admin],
  ['/api/users/leaders', admin],
  ['/api/users/stats/overview', admin],
  [`/api/users/${someUser._id}`, admin],
  ['/api/reports/dashboard', admin],
  ['/api/reports/overview', admin],
  ['/api/reports/members', admin],
  ['/api/reports/activity', admin],
  ['/api/reports/census/districts', admin],
  [`/api/reports/census/districts/${district._id}/units`, admin],
  ['/api/monthly-reports/forms', admin],
  ['/api/monthly-reports/mine', admin],
  [`/api/monthly-reports/mine?${prevYm}`, admin],
  [`/api/monthly-reports/status?${ym}`, admin],
  [`/api/monthly-reports/status?${prevYm}`, admin],
  [`/api/monthly-reports/consolidated?${prevYm}`, admin],
  [`/api/monthly-reports/consolidated?${prevYm}&district=${district._id}`, admin],
  ...(report ? [[`/api/monthly-reports/${report._id}`, admin]] : []),
  ['/api/org-files', admin],
  ['/api/requests', admin],
  ['/api/requests/pending', admin],
  ['/api/requests/stats', admin],
  ['/api/transfer-requests', admin],
  ['/api/transfer-requests/pending-count', admin],
  ['/api/notifications', admin],
  ['/api/notifications/stats', admin],
  ['/api/meetings', admin],
  ...(meeting ? [[`/api/meetings/${meeting._id}`, admin], [`/api/meetings/${meeting._id}/sessions`, admin], [`/api/meetings/${meeting._id}/attendance-summary`, admin]] : []),
  ['/api/meetings/admin/dashboard-stats', admin],
  ['/api/meetings/admin/overview', admin],
  ['/api/baithul-maal/stats', admin],
  ['/api/member-auth/profile', ['member']],
  ['/api/member-auth/leaders', ['member']],
  ['/api/member-auth/members', ['member']],
  ['/api/member-auth/members?page=2', ['member']],
  [`/api/member-auth/members?district=${district._id}`, ['member']],
  ['/api/member-auth/districts', ['member']],
  ['/api/member-auth/groups', ['member']],
  [`/api/member-auth/area-report?${prevYm}`, ['member']],
  ['/api/member-auth/area-report', ['member']],
  ['/api/member-auth/org-files', ['member']],
  ['/api/member-auth/notifications', ['member']],
  ['/api/member-auth/meetings', ['member']],
];

// Volatile values that legitimately differ between two live servers.
const VOLATILE_KEYS = new Set(['timestamp', 'uptime', 'generatedAt', 'serverTime', 'now', 'updatedAt']);

// Rows that tie on the sort key come back in arbitrary order from MongoDB; compare
// lists of documents order-insensitively (by _id) so only real differences show.
const byIdKey = (x) => (x && typeof x === 'object' && typeof x._id === 'string' ? x._id : null);
const sameIdSet = (a, b) => {
  if (a.length !== b.length || !a.every(byIdKey) || !b.every(byIdKey)) return false;
  const ids = new Set(a.map(byIdKey));
  return b.every((x) => ids.has(byIdKey(x)));
};

function diff(a, b, p = '', out = []) {
  if (out.length > 200) return out;
  if (a === b) return out;
  if (Array.isArray(a) && Array.isArray(b) && sameIdSet(a, b)) {
    const sortById = (arr) => [...arr].sort((x, y) => byIdKey(x).localeCompare(byIdKey(y)));
    a = sortById(a);
    b = sortById(b);
  }
  if (typeof a !== typeof b || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${p || '<root>'}: ${JSON.stringify(a)?.slice(0, 160)} ≠ ${JSON.stringify(b)?.slice(0, 160)}`);
    return out;
  }
  if (Array.isArray(a)) {
    if (a.length !== b.length) out.push(`${p}.length: ${a.length} ≠ ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${p}[${i}]`, out);
    return out;
  }
  if (typeof a === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (VOLATILE_KEYS.has(k)) continue;
      if (!(k in a)) out.push(`${p}.${k}: <missing> ≠ ${JSON.stringify(b[k])?.slice(0, 160)}`);
      else if (!(k in b)) out.push(`${p}.${k}: ${JSON.stringify(a[k])?.slice(0, 160)} ≠ <missing>`);
      else diff(a[k], b[k], `${p}.${k}`, out);
    }
    return out;
  }
  out.push(`${p}: ${JSON.stringify(a)?.slice(0, 160)} ≠ ${JSON.stringify(b)?.slice(0, 160)}`);
  return out;
}

const call = async (base, url, token) => {
  const res = await fetch(base + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const type = res.headers.get('content-type') || '';
  const body = type.includes('json') ? await res.json() : `<${type} ${(await res.arrayBuffer()).byteLength}b>`;
  return { status: res.status, body };
};

let same = 0;
let differ = 0;
for (const [url, roleList] of endpoints) {
  if (only && !url.includes(only)) continue;
  for (const role of roleList) {
    const token = roles[role];
    if (!token) continue;
    const [a, b] = await Promise.all([call(baseA, url, token), call(baseB, url, token)]);
    const d = a.status !== b.status ? [`status ${a.status} ≠ ${b.status}`, ...diff(a.body, b.body)] : diff(a.body, b.body);
    if (!d.length) {
      same++;
      console.log(`  ok   ${role.padEnd(8)} ${url}  [${a.status}]`);
    } else {
      differ++;
      console.log(`  DIFF ${role.padEnd(8)} ${url}  [${a.status}/${b.status}] ${d.length} diffs`);
      for (const line of d.slice(0, showN)) console.log(`         ${line}`);
    }
  }
}
console.log(`\n${same} identical, ${differ} different`);
