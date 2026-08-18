// Self-check for the census role scope. Run: node src/routes/census-scope.check.mjs
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { censusScopeFor } from './reports.js';

const id = (h) => new mongoose.Types.ObjectId(h);
const DIST = id('aaaaaaaaaaaaaaaaaaaaaaa1');
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbb2';
const GROUP = id('ccccccccccccccccccccccc3');

// state admin: honours both filters
let f = await censusScopeFor({ role: 'state_admin' }, { district: OTHER });
assert.equal(String(f.district), OTHER);

// state admin: no filter -> no scope
f = await censusScopeFor({ role: 'state_admin' }, {});
assert.deepEqual(f, {});

// district admin: pinned to own district, cannot widen to another
f = await censusScopeFor({ role: 'district_admin', district: { _id: DIST } }, { district: OTHER });
assert.equal(String(f.district), String(DIST));

// unit group admin: pinned to own group
f = await censusScopeFor({ role: 'group_admin', group: { _id: GROUP } }, { district: OTHER });
assert.equal(String(f.group), String(GROUP));
assert.equal(f.district, undefined);

// injection: object params are dropped, not passed to Mongo
f = await censusScopeFor({ role: 'state_admin' }, { district: { $ne: null }, group: 'not-an-id' });
assert.deepEqual(f, {});

console.log('census-scope check: OK');
process.exit(0);
