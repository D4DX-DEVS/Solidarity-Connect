// Recounts the stored member statistics of every area (group) and district through the
// app's own logic (GET /:id runs updateStatistics), and reports which ones were stale.
//   node worker/dev/recount-stats.mjs <base>
const [base] = process.argv.slice(2);

const call = async (method, url, { token, body } = {}) => {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    // 503 = Workers CPU limit on the Free plan; back off and retry.
    if (res.status === 503 && attempt < 6) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    return { status: res.status, json: await res.json().catch(() => null) };
  }
};

const v = await call('POST', '/api/auth/login/verify-dob', { body: { phone: '9876543210', dob: '0000-00-00' } });
const acct = v.json.data.accounts.find((a) => a.role === 'state_admin');
const s = await call('POST', '/api/auth/login/select-account', { body: { ticket: v.json.data.ticket, accountId: acct.id, accountType: acct.type } });
const token = s.json.data.token;

const statsOf = (doc) => JSON.stringify(doc?.statistics ?? null);
const listAll = async (url) => (await call('GET', url, { token })).json?.data ?? [];

for (const [label, listUrl, itemUrl, pick] of [
  ['area', '/api/groups?limit=500', '/api/groups/', (j) => j?.data?.group || j?.data],
  ['district', '/api/districts?limit=500', '/api/districts/', (j) => j?.data?.district || j?.data],
]) {
  const items = await listAll(listUrl);
  let stale = 0;
  let failed = 0;
  for (const item of items) {
    const r = await call('GET', itemUrl + item._id, { token });
    if (r.status !== 200) {
      failed++;
      console.log(`  FAIL ${label} ${item.name}: status ${r.status}`);
      continue;
    }
    const after = pick(r.json);
    if (statsOf(after) !== statsOf(item)) {
      stale++;
      console.log(`  fixed ${label} ${item.name}: ${statsOf(item)} → ${statsOf(after)}`);
    }
  }
  console.log(`${label}s: ${items.length} checked, ${stale} were stale and are now correct, ${failed} failed`);
}
