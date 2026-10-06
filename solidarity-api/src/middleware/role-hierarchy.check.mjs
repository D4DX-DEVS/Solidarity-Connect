// Self-check for the leader-role hierarchy. Run: node src/middleware/role-hierarchy.check.mjs
import assert from 'node:assert/strict';
import { canManageRoleType, canManageLeaderTarget, leaderEditScopeFor, leaderEditError } from './auth.js';
import { pickMemberEditFields } from '../models/Request.js';

const STATE = { role: 'state_admin' };
const DISTRICT = { role: 'district_admin' };
const AREA = { role: 'group_admin', roleTag: { type: 'area' } };
const MURABI = { role: 'group_admin', adminKind: 'murabi' };
const UNIT = { role: 'group_admin', adminKind: 'area', roleTag: { type: 'unit' } };

const leader = (type, ...extras) => ({
  role: 'member',
  isLeader: true,
  roleTag: { type },
  extraRoleTags: extras.map((t) => ({ type: t })),
});

// Assignable types: state admin everything; district admin area-level only;
// area-level admins area-level + unit; unit admins unit.
const types = ['state', 'district', 'area', 'murabi', 'coordinator', 'unit'];
const assignable = (u) => types.filter((t) => canManageRoleType(u, t));
assert.deepEqual(assignable(STATE), types);
assert.deepEqual(assignable(DISTRICT), ['area', 'murabi', 'coordinator']);
assert.deepEqual(assignable(AREA), ['area', 'murabi', 'coordinator', 'unit']);
assert.deepEqual(assignable(MURABI), ['area', 'murabi', 'coordinator', 'unit']);
assert.deepEqual(assignable(UNIT), ['unit']);
assert.equal(canManageRoleType(DISTRICT, 'bogus'), false);

// District admin: area-level leaders only — not state, district or unit, even via an extra role.
assert.equal(canManageLeaderTarget(DISTRICT, leader('state')), false);
assert.equal(canManageLeaderTarget(DISTRICT, leader('district')), false);
assert.equal(canManageLeaderTarget(DISTRICT, leader('area', 'district')), false);
assert.equal(canManageLeaderTarget(DISTRICT, leader('area', 'murabi')), true);
assert.equal(canManageLeaderTarget(DISTRICT, leader('unit')), false);
assert.equal(canManageLeaderTarget(DISTRICT, leader('area', 'unit')), false);
assert.equal(canManageLeaderTarget(DISTRICT, { role: 'member', isLeader: false }), true);

// Area admin: area-level and unit leaders (own area scope is enforced by the routes).
assert.equal(canManageLeaderTarget(AREA, leader('state')), false);
assert.equal(canManageLeaderTarget(AREA, leader('district')), false);
assert.equal(canManageLeaderTarget(AREA, leader('area')), true);
assert.equal(canManageLeaderTarget(AREA, leader('murabi', 'unit')), true);
assert.equal(canManageLeaderTarget(AREA, leader('unit', 'district')), false);
assert.equal(canManageLeaderTarget(AREA, leader('unit')), true);
assert.equal(canManageLeaderTarget(AREA, { role: 'member', isLeader: false }), true);

// Unit admin: unit leaders only.
assert.equal(canManageLeaderTarget(UNIT, { role: 'member', isLeader: false }), true);
assert.equal(canManageLeaderTarget(UNIT, leader('unit')), true);
assert.equal(canManageLeaderTarget(UNIT, leader('area')), false);

// Admin accounts: peers and seniors are off limits, juniors are fine.
assert.equal(canManageLeaderTarget(DISTRICT, { role: 'district_admin' }), false);
assert.equal(canManageLeaderTarget(DISTRICT, { role: 'state_admin' }), false);
assert.equal(canManageLeaderTarget(DISTRICT, { ...AREA, isLeader: true }), true);
assert.equal(canManageLeaderTarget(AREA, { ...MURABI }), false);

// Stale tags on a non-leader do not lock the row.
assert.equal(canManageLeaderTarget(DISTRICT, { role: 'member', isLeader: false, roleTag: { type: 'state' } }), true);

// State admin manages everyone.
assert.equal(canManageLeaderTarget(STATE, leader('state', 'district')), true);
assert.equal(canManageLeaderTarget(STATE, { role: 'state_admin' }), true);

// leaderEditError checks the role set AFTER the update, not just the payload.
const stale = { role: 'member', isLeader: false, roleTag: { type: 'state' }, extraRoleTags: [] };
assert.equal(leaderEditError(UNIT, stale, { isLeader: true })?.status, 403); // bare revive of stale state tag
assert.equal(leaderEditError(UNIT, stale, { isLeader: true, roleTag: { type: 'unit' } }), null);
assert.equal(leaderEditError(DISTRICT, leader('area'), { isLeader: true, extraRoles: [{ type: 'unit' }] })?.status, 403);
assert.equal(leaderEditError(DISTRICT, leader('area'), { isLeader: true, roleTag: { name: 'Secretary' } }), null);
assert.equal(leaderEditError(DISTRICT, leader('area', 'murabi'), { isLeader: false }), null);
assert.equal(leaderEditError(DISTRICT, leader('state'), { isLeader: false })?.status, 403);
assert.equal(leaderEditError(DISTRICT, leader('area'), { isLeader: 'false' })?.status, 400);
assert.equal(leaderEditError(DISTRICT, leader('area'), { isLeader: true, roleTag: { type: ['area'] } })?.status, 403);
// Admin accounts: primary type sets their scope — only state admin may change it.
const areaAccount = { role: 'group_admin', adminKind: 'area', isLeader: true, roleTag: { type: 'area' } };
assert.equal(leaderEditError(DISTRICT, areaAccount, { isLeader: true, roleTag: { type: 'coordinator' } })?.status, 403);
assert.equal(leaderEditError(DISTRICT, areaAccount, { isLeader: true, roleTag: { type: 'area', name: 'President' } }), null);
assert.equal(leaderEditError(STATE, areaAccount, { isLeader: true, roleTag: { type: 'coordinator' } }), null);

// Edit scope: district admin own district, unit admin own group, state everywhere.
const D1 = 'aaaaaaaaaaaaaaaaaaaaaaa1', D2 = 'aaaaaaaaaaaaaaaaaaaaaaa2', G1 = 'ccccccccccccccccccccccc1', G2 = 'ccccccccccccccccccccccc2';
let inScope = await leaderEditScopeFor({ role: 'district_admin', district: { _id: D1 } });
assert.equal(inScope({ district: D1 }), true);
assert.equal(inScope({ district: { _id: D2 } }), false);
assert.equal(inScope({}), false);
inScope = await leaderEditScopeFor({ role: 'group_admin', roleTag: { type: 'unit' }, group: { _id: G1 } });
assert.equal(inScope({ group: { _id: G1 } }), true);
assert.equal(inScope({ group: G2 }), false);
inScope = await leaderEditScopeFor({ role: 'district_admin' });
assert.equal(inScope({ district: undefined }), false); // no district on the admin fails closed
assert.equal((await leaderEditScopeFor(STATE))({}), true);

// member_edit requests can only carry plain profile fields.
assert.deepEqual(
  pickMemberEditFields({ name: 'A', status: 'Active', isLeader: true, roleTag: { type: 'state' }, extraRoleTags: [], district: D1 }),
  { name: 'A', status: 'Active' }
);
assert.deepEqual(pickMemberEditFields(undefined), {});

console.log('role-hierarchy check: OK');
process.exit(0);
