// Upload → serve from /cdn → delete, against a D1/R2-backed API (local or deployed).
//   node worker/dev/upload-flow.mjs <base>
const [base] = process.argv.slice(2);
const post = (url, body, token) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: JSON.stringify(body) }).then((r) => r.json());
const v = await post('/api/auth/login/verify-dob', { phone: '9876543210', dob: '0000-00-00' });
const acct = v.data.accounts.find((a) => a.role === 'state_admin');
const s = await post('/api/auth/login/select-account', { ticket: v.data.ticket, accountId: acct.id, accountType: acct.type });
const token = s.data.token;
const pdf = new Blob([`%PDF-1.4\n% D1 migration upload test ${Date.now()}\n%%EOF\n`], { type: 'application/pdf' });
const fd = new FormData();
fd.append('file', pdf, 'മലയാളം test.pdf');
fd.append('title', 'Migration upload test');
fd.append('category', 'document');
const up = await (await fetch(base + '/api/org-files', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })).json();
console.log('upload', up.success, up.data?.url, up.data?.originalName);
const nameOk = up.data?.originalName === 'മലയാളം test.pdf';
console.log('Malayalam file name kept', nameOk);
const file = await fetch(base + up.data.url);
const text = await file.text();
console.log('cdn GET', file.status, file.headers.get('content-type'), file.headers.get('cache-control'), text.startsWith('%PDF') ? 'bytes ok' : 'BAD BYTES');
const list = await (await fetch(base + '/api/org-files', { headers: { Authorization: `Bearer ${token}` } })).json();
console.log('listed', list.data.some((f) => f._id === up.data._id));
const del = await (await fetch(base + `/api/org-files/${up.data._id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).json();
console.log('delete', del.success);
console.log('cdn after delete', (await fetch(base + up.data.url)).status);
const ok = up.success && nameOk && file.status === 200 && text.startsWith('%PDF') && del.success;
console.log(ok ? 'upload flow passed' : 'upload flow FAILED');
process.exit(ok ? 0 : 1);
