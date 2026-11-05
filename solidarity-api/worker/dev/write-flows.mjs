// End-to-end write flows against a D1-backed API (local shim server or the deployed
// Worker). NEVER point this at the Mongo/production API: it creates and deletes data.
//   node worker/dev/write-flows.mjs <base> <exportDir>
import fs from 'node:fs';
import path from 'node:path';
import { repeatedFieldIds } from '../../src/services/monthlyReports/answers.js';

const [base, exportDir] = process.argv.slice(2);
// --safe: production mode — only the test number logs in, and only throwaway records are written.
const SAFE = process.argv.includes('--safe');
const data = JSON.parse(fs.readFileSync(path.join(exportDir, 'storage-form.json'), 'utf8'));
let failures = 0;
const check = (label, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? `  ${extra}` : ''}`);
};

const api = async (method, url, { token, body } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
};

const login = async (phone, dob, pick) => {
  const v = await api('POST', '/api/auth/login/verify-dob', { body: { phone, dob } });
  if (!v.json?.success) return { v };
  const account = v.json.data.accounts.find(pick);
  if (!account) return { v };
  const s = await api('POST', '/api/auth/login/select-account', { body: { ticket: v.json.data.ticket, accountId: account.id ?? account._id, accountType: account.type ?? account.accountType } });
  return { v, s, token: s.json?.data?.token, account };
};

console.log('Auth (DOB login)');
const accounts = await api('POST', '/api/auth/login/verify-dob', { body: { phone: '9876543210', dob: '0000-00-00' } });
check('test number lists its accounts', accounts.json?.success && accounts.json.data.accounts.length >= 3, `${accounts.json?.data?.accounts?.length} accounts`);
const sample = accounts.json?.data?.accounts?.[0] || {};
const roleOf = (a) => a.role || a.label || a.kind || '';
const state = await login('9876543210', '0000-00-00', (a) => a.role === 'state_admin');
check('select State Admin account → token', Boolean(state.token), state.s ? `status ${state.s.status}` : JSON.stringify(sample).slice(0, 120));
const me = await api('GET', '/api/auth/me', { token: state.token });
check('/auth/me with fresh token', me.status === 200 && JSON.stringify(me.json).includes('state_admin'), `status ${me.status}`);

if (!SAFE) {
const real = data.members.find((m) => m.status === 'Active' && m.isApproved && m.dateOfBirth && m.phone !== '9876543210' && data.memberauths.some((a) => a.member === m._id));
const dob = real.dateOfBirth.slice(0, 10);
const wrong = await api('POST', '/api/auth/login/verify-dob', { body: { phone: real.phone, dob: '1901-01-01' } });
check('wrong DOB rejected with attempts left', wrong.status >= 400 && typeof wrong.json?.attemptsRemaining === 'number', `status ${wrong.status}, remaining ${wrong.json?.attemptsRemaining}`);
const memberLogin = await login(real.phone, dob, (a) => a.type === 'member');
check('real member signs in with DOB', Boolean(memberLogin.token), memberLogin.v?.json?.message);
const profile = await api('GET', '/api/member-auth/profile', { token: memberLogin.token });
check('member profile loads', profile.status === 200 && profile.json?.success === true, `status ${profile.status}`);
const after = await api('POST', '/api/auth/login/verify-dob', { body: { phone: real.phone, dob } });
check('successful login clears the failure counter', after.json?.success === true);
} else console.log('  skip real-member login (--safe)');

const token = state.token;
console.log('Members (state admin)');
// Work inside the test number's District Admin district, so that admin can move the member too.
const testDistrict = data.users.find((u) => u.role === 'district_admin' && ['9876543210', '+919876543210'].includes(u.phone))?.district;
const group = data.groups.find((g) => g.isActive !== false && (!testDistrict || g.district === testDistrict));
// A second active area in the same district, to move the test member into.
const otherGroup = data.groups.find((g) => g.isActive !== false && g.district === group.district && g._id !== group._id);
// Stored member counts (what area listings show; the list does not recompute them)
// must equal the real counts (GET /api/groups/:id recomputes and returns them).
const areaIds = [group._id, otherGroup?._id].filter(Boolean);
const actualCounts = async () => {
  const out = [];
  for (const gid of areaIds) {
    const r = await api('GET', `/api/groups/${gid}`, { token });
    out.push((r.json?.data?.group || r.json?.data)?.statistics?.totalMembers);
  }
  return out;
};
const countsCorrect = async (label) => {
  const list = await api('GET', `/api/groups?district=${group.district}&limit=200`, { token });
  const stored = areaIds.map((gid) => list.json?.data?.find((g) => g._id === gid)?.statistics?.totalMembers);
  const actual = await actualCounts();
  check(`stored area counts correct ${label}`, stored.every((v, i) => v === actual[i] && v !== undefined), `stored ${stored.join('/')} actual ${actual.join('/')}`);
  return actual;
};
const before = await actualCounts(); // also brings any stale stored count up to date
const phone = `9${String(Date.now()).slice(-9)}`;
const created = await api('POST', '/api/members', {
  token,
  body: { name: 'D1 Migration Test', phone, district: group.district, group: group._id, status: 'Active', dateOfBirth: '1995-06-15', address: 'Test Unit', bloodGroup: 'O+' },
});
check('create member', created.status === 201, `status ${created.status} ${created.json?.message || ''}`);
const id = created.json?.data?._id || created.json?.data?.member?._id;
const afterCreate = await countsCorrect('after create');
check('area count +1 after create', afterCreate[0] === before[0] + 1, `${before[0]} → ${afterCreate[0]}`);
const dup = await api('POST', '/api/members', { token, body: { name: 'Dup', phone, district: group.district, group: group._id } });
check('duplicate phone rejected', dup.status >= 400 && dup.status < 500, `status ${dup.status} ${dup.json?.message || ''}`);
const got = await api('GET', `/api/members/${id}`, { token });
check('read created member (age computed by pre-save hook)', got.status === 200 && (got.json?.data?.member?.age ?? got.json?.data?.age) > 0, `status ${got.status}`);
const upd = await api('PUT', `/api/members/${id}`, { token, body: { name: 'D1 Migration Test 2', profession: 'Tester' } });
check('update member', upd.status === 200, `status ${upd.status} ${upd.json?.message || ''}`);
const got2 = await api('GET', `/api/members/${id}`, { token });
const m2 = got2.json?.data?.member || got2.json?.data;
check('update persisted', m2?.name === 'D1 Migration Test 2' && m2?.profession === 'Tester');
const listed = await api('GET', `/api/members?search=${encodeURIComponent('D1 Migration')}`, { token });
check('search finds it', listed.json?.data?.some((m) => m._id === id));
const bad = await api('GET', '/api/members/not-an-id', { token });
check('bad id → 4xx/5xx handled, not crash', bad.status >= 400, `status ${bad.status}`);
if (otherGroup) {
  const moved = await api('PUT', `/api/members/${id}`, { token, body: { group: otherGroup._id, district: group.district } });
  check('move member to another area', moved.status === 200, `status ${moved.status} ${moved.json?.message || ''}`);
  const afterMove = await countsCorrect('after move (old and new area)');
  check('old area -1 and new area +1 after move', afterMove[0] === before[0] && afterMove[1] === before[1] + 1, `${before.join('/')} → ${afterMove.join('/')}`);

  const da = await login('9876543210', '0000-00-00', (a) => a.role === 'district_admin');
  if (da.token) {
    const back = await api('PATCH', `/api/members/${id}/move`, { token: da.token, body: { group: group._id } });
    check('district admin moves member back', back.status === 200, `status ${back.status} ${back.json?.message || ''}`);
    const afterDaMove = await countsCorrect('after district admin move');
    check('counts follow the district admin move', afterDaMove[0] === before[0] + 1 && afterDaMove[1] === before[1], `${before.join('/')} → ${afterDaMove.join('/')}`);
  }
}
const del = await api('DELETE', `/api/members/${id}`, { token });
check('delete member', del.status === 200, `status ${del.status} ${del.json?.message || ''}`);
const gone = await api('GET', `/api/members/${id}`, { token });
check('deleted member is gone', gone.status === 404, `status ${gone.status}`);
const afterDelete = await countsCorrect('after delete');
check('area counts back to where they started', afterDelete.every((v, i) => v === before[i]), `${before.join('/')} → ${afterDelete.join('/')}`);

console.log('Monthly reports (area admin)');
const area = await login('9876543210', '0000-00-00', (a) => a.role === 'group_admin');
check('select Area Admin account', Boolean(area.token));
const now = new Date();
const period = `year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
const mine = await api('GET', `/api/monthly-reports/mine?${period}`, { token: area.token });
check('load my report form', mine.status === 200, `status ${mine.status} ${mine.json?.message || ''}`);
const form = mine.json?.data?.form;
const sampleValue = (f) => {
  switch (f.type) {
    case 'number': return 1;
    case 'text': case 'textarea': return 'ok';
    case 'email': return 'test@example.com';
    case 'phone': return '9876543210';
    case 'date': return '2026-11-01';
    case 'time': return '10:00';
    case 'yesno': return 'yes';
    case 'select': case 'radio': return f.options?.[0];
    case 'checkbox': return f.options?.slice(0, 1);
    default: return undefined;
  }
};
const fields = form?.fields || [];
const repeated = repeatedFieldIds(fields); // fieldId → repeating heading id
const answers = {};
for (const f of fields) {
  if (f.type === 'heading' && f.repeat) {
    const entry = { name: 'Test Unit' };
    for (const sub of fields.filter((x) => repeated.get(x.id) === f.id)) {
      const v = sampleValue(sub);
      if (v !== undefined) entry[`f${sub.id}`] = v;
    }
    answers[`g${f.id}`] = [entry];
  } else if (f.type !== 'heading' && !repeated.has(f.id)) {
    const v = sampleValue(f);
    if (v !== undefined) answers[`f${f.id}`] = v;
  }
}
if (!SAFE) {
const saved = await api('PUT', `/api/monthly-reports/mine?${period}`, { token: area.token, body: { answers } });
check('save my report', saved.status === 200 || saved.status === 201, `status ${saved.status} ${saved.json?.message || ''}`);
const reread = await api('GET', `/api/monthly-reports/mine?${period}`, { token: area.token });
check('saved report reads back', reread.status === 200 && Boolean(reread.json?.data?.report), `status ${reread.status}`);
} else console.log('  skip report submission (--safe)');
const status = await api('GET', `/api/monthly-reports/status?${period}`, { token });
check('state sees report status', status.status === 200);

console.log(`\n${failures ? `${failures} FAILED` : 'all write flows passed'}`);
process.exit(failures ? 1 : 0);
