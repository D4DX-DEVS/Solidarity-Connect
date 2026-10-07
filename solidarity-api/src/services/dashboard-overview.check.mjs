// Self-check for the dashboard overview helpers. Run: node src/services/dashboard-overview.check.mjs
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { resolveScope, areaCoverage, adminsByChild, growthPct, ScopeError } from './dashboardOverview.js';

const id = (h) => new mongoose.Types.ObjectId(h);

// resolveScope: state sees everything, children are districts
let scope = await resolveScope({ role: 'state_admin' });
assert.equal(scope.level, 'state');
assert.deepEqual(scope.memberFilter, {});
assert.equal(scope.childKey, 'district');

// resolveScope: state drill-down rejects anything but a plain id (no Mongo operator injection)
await assert.rejects(resolveScope({ role: 'state_admin' }, { districtId: { $ne: null } }), ScopeError);
await assert.rejects(resolveScope({ role: 'state_admin' }, { districtId: 'not-an-id' }), ScopeError);

// resolveScope: district admin pinned to own district and cannot drill elsewhere
const DIST = id('aaaaaaaaaaaaaaaaaaaaaaa1');
scope = await resolveScope({ role: 'district_admin', district: { _id: DIST, name: 'KOZHIKKODE' } }, { districtId: 'bbbbbbbbbbbbbbbbbbbbbbb2' });
assert.equal(scope.level, 'district');
assert.equal(String(scope.memberFilter.district), String(DIST));
assert.equal(scope.childKey, 'group');
assert.equal(scope.name, 'KOZHIKKODE');

// resolveScope: unit-scoped group admin pinned to own group, no children breakdown
const GROUP = id('ccccccccccccccccccccccc3');
scope = await resolveScope({ role: 'group_admin', group: { _id: GROUP, name: 'MEDICAL COLLEGE' }, district: { _id: DIST, name: 'KOZHIKKODE' } }, { districtId: String(DIST) });
assert.equal(scope.level, 'area');
assert.deepEqual(scope.memberFilter.group.$in.map(String), [String(GROUP)]);
assert.equal(scope.childKey, null);
assert.equal(scope.parentName, 'KOZHIKKODE');

// areaCoverage: an area is staffed only by an area-level (group) admin
const G2 = id('ccccccccccccccccccccccc4');
const D2 = id('aaaaaaaaaaaaaaaaaaaaaaa2');
const cov = areaCoverage(
  [{ _id: GROUP, district: DIST }, { _id: G2, district: D2 }],
  [{ _id: id('ddddddddddddddddddddddd1'), role: 'group_admin', group: GROUP }, { _id: id('ddddddddddddddddddddddd2'), role: 'district_admin', district: D2 }],
);
assert.equal(cov.total, 2);
assert.equal(cov.withoutAdmin, 1);
assert.deepEqual(cov.byDistrict.get(String(D2)), { areas: 1, withoutAdmin: 1 });

// areaCoverage: same-named groups in one district are one area — an admin on either staffs both
const G3 = id('ccccccccccccccccccccccc5');
const siblings = areaCoverage(
  [{ _id: GROUP, district: DIST, name: 'Vadakara' }, { _id: G3, district: DIST, name: 'VADAKARA ' }, { _id: G2, district: DIST, name: 'Nadapuram' }],
  [{ _id: id('ddddddddddddddddddddddd1'), role: 'group_admin', group: GROUP }],
);
assert.equal(siblings.withoutAdmin, 1);
assert.equal(siblings.isStaffed({ _id: G3, district: DIST, name: 'VADAKARA ' }), true);

// adminsByChild: area rows skip district admins
const byGroup = adminsByChild('group', [
  { _id: id('ddddddddddddddddddddddd1'), role: 'group_admin', group: GROUP },
  { _id: id('ddddddddddddddddddddddd3'), role: 'district_admin', group: GROUP },
]);
assert.deepEqual(byGroup.get(String(GROUP)), { admins: 1 });

// growthPct: no additions is a real 0%; nothing prior to compare → null
assert.equal(growthPct(0, 108), 0);
assert.equal(growthPct(8, 108), 8);
assert.equal(growthPct(1, 11), 10);
assert.equal(growthPct(3, 3), null);
assert.equal(growthPct(5, 0), null);

console.log('dashboard-overview check: OK');
process.exit(0);
