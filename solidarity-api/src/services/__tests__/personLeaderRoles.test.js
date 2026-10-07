import { areaAccessTag, compareRecords, groupPeople, leaderRecordOf, phoneKey, phoneVariants, recordLabel, syncedLeaderFields } from '../personLeaderRoles.js';
import { attachPersonLinks, planPersonSync, syncNewAccount } from '../personRecords.js';

// Shapes copied from a real person: District Admin + Murabi Admin login + member record.
const district = () => ({
  _id: 'd1', name: 'Rahim', phone: '+919800001179', role: 'district_admin', adminKind: 'area', isLeader: true,
  roleTag: { type: 'district', name: 'Organisation Secretary', roleDescription: 'MALAPPURAM WEST', listingOrder: null },
  extraRoleTags: [{ _id: 'x1', type: 'murabi', name: 'Murabi', listingOrder: null }],
});
const murabi = () => ({
  _id: 'u2', name: 'Rahim', phone: '9800001179', role: 'group_admin', adminKind: 'murabi', isLeader: true,
  roleTag: { type: 'murabi', name: 'Murabi', areaId: 'area77', roleDescription: 'PUTHANATHANI', listingOrder: null },
  extraRoleTags: [{ _id: 'x2', type: 'district', name: 'Organisation Secretary', listingOrder: null }],
});
const member = () => ({
  _id: 'm3', name: 'Rahim', phone: '9800001179', isLeader: true,
  roleTag: { type: 'district', name: 'Organisation Secretary', roleDescription: 'MALAPPURAM WEST', listingOrder: null },
  extraRoleTags: [{ _id: 'x3', type: 'murabi', name: 'Murabi', listingOrder: null }],
});

describe('phones', () => {
  test('Indian numbers match with or without +91', () => {
    expect(phoneKey('+919895283473')).toBe('9895283473');
    expect(phoneKey('9895283473')).toBe('9895283473');
    expect(phoneVariants('+919895283473')).toEqual(['9895283473', '+919895283473']);
  });
  test('international numbers keep their country code', () => {
    expect(phoneVariants('+971501234567')).toEqual(['971501234567', '+971501234567']);
  });
});

describe('leaderRecordOf', () => {
  test('most senior leader wins: district over murabi over member', () => {
    expect(leaderRecordOf([member(), murabi(), district()])._id).toBe('d1');
  });
  test('a non-leader senior login is skipped for a leader below it', () => {
    expect(leaderRecordOf([member(), murabi(), { ...district(), isLeader: false }])._id).toBe('u2');
  });
  test('nobody a leader yet: no record holds the roles, so none is locked', () => {
    const off = (r) => ({ ...r, isLeader: false });
    expect(leaderRecordOf([off(member()), off(murabi()), off(district())])).toBeNull();
  });
  test('area admin sorts before murabi before coordinator', () => {
    const ga = (id, kind) => ({ _id: id, role: 'group_admin', adminKind: kind, isLeader: true });
    expect([ga('c', 'coordinator'), ga('m', 'murabi'), ga('a', 'area')].sort(compareRecords).map((r) => r._id)).toEqual(['a', 'm', 'c']);
  });
  test('labels', () => {
    expect(recordLabel(murabi())).toBe('Area Admin');
    expect(recordLabel(district())).toBe('District Admin');
    expect(recordLabel(member())).toBe('member record');
  });
});

describe('syncedLeaderFields', () => {
  test('records already in step are left alone', () => {
    expect(syncedLeaderFields(district(), member())).toBeNull();
    expect(syncedLeaderFields(district(), murabi())).toBeNull();
  });

  test('renamed role reaches the member record and the other login', () => {
    const src = district();
    src.roleTag.name = 'General Secretary';
    src.roleTag.listingOrder = 3;
    expect(syncedLeaderFields(src, member())).toEqual({
      isLeader: true,
      roleTag: { type: 'district', name: 'General Secretary', listingOrder: 3, roleDescription: 'MALAPPURAM WEST' },
      extraRoleTags: [{ type: 'murabi', name: 'Murabi', listingOrder: null }],
    });
    // The Murabi login keeps Murabi as its primary (its access scope) with its areaId and area name.
    expect(syncedLeaderFields(src, murabi())).toEqual({
      isLeader: true,
      roleTag: { areaId: 'area77', roleDescription: 'PUTHANATHANI', type: 'murabi', name: 'Murabi', listingOrder: null },
      extraRoleTags: [{ type: 'district', name: 'General Secretary', listingOrder: 3 }],
    });
  });

  test('dropping the Murabi role stops listing the Murabi login but keeps its scope tag', () => {
    const src = { ...district(), extraRoleTags: [] };
    const next = syncedLeaderFields(src, murabi());
    expect(next.isLeader).toBe(false);
    expect(next.extraRoleTags).toEqual([]);
    expect(next.roleTag).toEqual(murabi().roleTag);
  });

  test('Leader off: member loses its roles (not its area name), admin login keeps its scope tag', () => {
    const src = { ...district(), isLeader: false, roleTag: undefined, extraRoleTags: [] };
    expect(syncedLeaderFields(src, member())).toEqual({ isLeader: false, roleTag: { roleDescription: 'MALAPPURAM WEST' }, extraRoleTags: [] });
    expect(syncedLeaderFields(src, murabi())).toEqual({ isLeader: false, roleTag: murabi().roleTag, extraRoleTags: [] });
  });

  test('an admin login without a tag takes the first role as primary', () => {
    const plainState = { _id: 's', role: 'state_admin', isLeader: false, roleTag: { listingOrder: null }, extraRoleTags: [] };
    expect(syncedLeaderFields(district(), plainState)).toEqual({
      isLeader: true,
      roleTag: { type: 'district', name: 'Organisation Secretary', listingOrder: null },
      extraRoleTags: [{ type: 'murabi', name: 'Murabi', listingOrder: null }],
    });
  });

  test('same roles listed in another order count as in step (real data: 11 member records)', () => {
    const flipped = { ...member(), roleTag: { type: 'murabi', name: 'Murabi', listingOrder: null }, extraRoleTags: [{ type: 'district', name: 'Organisation Secretary', listingOrder: null }] };
    expect(syncedLeaderFields(district(), flipped)).toBeNull();
  });

  test('a member keeps its own first role when another role changes', () => {
    const flipped = { ...member(), roleTag: { type: 'murabi', name: 'Murabi', listingOrder: null }, extraRoleTags: [{ type: 'district', name: 'Organisation Secretary', listingOrder: null }] };
    const src = district();
    src.roleTag.name = 'General Secretary';
    expect(syncedLeaderFields(src, flipped)).toEqual({
      isLeader: true,
      roleTag: { type: 'murabi', name: 'Murabi', listingOrder: null },
      extraRoleTags: [{ type: 'district', name: 'General Secretary', listingOrder: null }],
    });
  });

  test('a non-leader login with only an area name is left alone (real data)', () => {
    const src = { _id: 's', role: 'state_admin', isLeader: false, roleTag: { listingOrder: null }, extraRoleTags: [] };
    const login = { _id: 'dd', role: 'district_admin', isLeader: false, roleTag: { listingOrder: null, roleDescription: 'ALAPPUZHA' }, extraRoleTags: [] };
    expect(syncedLeaderFields(src, login)).toBeNull();
  });

  test('an empty tag on a non-leader counts as no tag', () => {
    const src = { ...district(), isLeader: false, roleTag: { listingOrder: null }, extraRoleTags: [] };
    expect(syncedLeaderFields(src, { ...member(), isLeader: false, roleTag: { listingOrder: null }, extraRoleTags: [] })).toBeNull();
  });

  test('a District/State login has no scope tag: Leader off clears it like the member record', () => {
    const plainDistrict = { _id: 'dd', role: 'district_admin', isLeader: true,
      roleTag: { type: 'state', name: 'Joint Secretary', listingOrder: null }, extraRoleTags: [] };
    const src = { ...district(), isLeader: false, roleTag: undefined, extraRoleTags: [] };
    expect(syncedLeaderFields(src, plainDistrict)).toEqual({ isLeader: false, roleTag: undefined, extraRoleTags: [] });
  });

  test('a District/State login is not "scoped" to the role it mirrors', () => {
    const plainDistrict = { _id: 'dd', role: 'district_admin', isLeader: true,
      roleTag: { type: 'state', name: 'Joint Secretary', listingOrder: null }, extraRoleTags: [] };
    const src = { ...district(), extraRoleTags: [] }; // person holds no state role any more
    expect(syncedLeaderFields(src, plainDistrict)).toEqual({
      isLeader: true,
      roleTag: { type: 'district', name: 'Organisation Secretary', listingOrder: null },
      extraRoleTags: [],
    });
  });

  test('an Area Admin login without a type never takes one (its access would change)', () => {
    const typeless = { _id: 'g', role: 'group_admin', adminKind: 'area', isLeader: false, roleTag: { listingOrder: null }, extraRoleTags: [] };
    const src = { ...member(), roleTag: { type: 'area', name: 'President', listingOrder: null }, extraRoleTags: [] };
    expect(syncedLeaderFields(src, typeless)).toBeNull(); // stays a non-leader, tag untouched
    const typelessLeader = { ...typeless, isLeader: true, extraRoleTags: [{ type: 'area', name: 'President', listingOrder: null }] };
    expect(syncedLeaderFields(src, typelessLeader)).toEqual({ isLeader: false, roleTag: { listingOrder: null }, extraRoleTags: [] });
  });

  test('a unit-scoped login keeps its unit tag', () => {
    const unit = { _id: 'un', role: 'group_admin', adminKind: 'area', isLeader: true,
      roleTag: { type: 'unit', name: 'President', roleDescription: 'Kollam Town', listingOrder: null }, extraRoleTags: [] };
    const src = { ...member(), roleTag: { type: 'unit', name: 'Secretary', listingOrder: 2 }, extraRoleTags: [] };
    expect(syncedLeaderFields(src, unit)).toEqual({
      isLeader: true,
      roleTag: { roleDescription: 'Kollam Town', type: 'unit', name: 'Secretary', listingOrder: 2 },
      extraRoleTags: [],
    });
  });

  test('a District/State login keeps its areaId', () => {
    const login = { _id: 'dd', role: 'district_admin', isLeader: true,
      roleTag: { type: 'district', name: 'Organisation Secretary', areaId: 'area5', listingOrder: null },
      extraRoleTags: [{ type: 'murabi', name: 'Murabi', listingOrder: null }] };
    const src = district();
    src.roleTag.name = 'President';
    expect(syncedLeaderFields(src, login).roleTag).toEqual({ areaId: 'area5', type: 'district', name: 'President', listingOrder: null });
  });

  test('a new extra role is added everywhere', () => {
    const src = district();
    src.extraRoleTags.push({ type: 'state', name: 'Committee Member', listingOrder: 9 });
    expect(syncedLeaderFields(src, member()).extraRoleTags).toEqual([
      { type: 'murabi', name: 'Murabi', listingOrder: null },
      { type: 'state', name: 'Committee Member', listingOrder: 9 },
    ]);
    expect(syncedLeaderFields(src, murabi()).extraRoleTags).toEqual([
      { type: 'district', name: 'Organisation Secretary', listingOrder: null },
      { type: 'state', name: 'Committee Member', listingOrder: 9 },
    ]);
  });
});

describe('planPersonSync', () => {
  const doc = (r) => ({ ...r, toObject: () => r });
  test('plans copies for out-of-step records only', () => {
    const src = district();
    src.roleTag.name = 'General Secretary';
    const plan = planPersonSync({ role: 'state_admin' }, doc(src), [doc(src), doc(murabi()), doc(member())]);
    expect(plan.error).toBeUndefined();
    expect(plan.changes.map((c) => c.record._id)).toEqual(['u2', 'm3']);
  });
  test('refuses when the member record holds a role the editor cannot change', () => {
    const area = { _id: 'a1', name: 'Rahim', phone: '9800001179', role: 'group_admin', adminKind: 'area', isLeader: true,
      roleTag: { type: 'area', name: 'President' }, extraRoleTags: [] };
    const stale = { _id: 'm1', name: 'Rahim', phone: '9800001179', isLeader: true, roleTag: { type: 'area', name: 'President' },
      extraRoleTags: [{ type: 'state', name: 'Committee' }] };
    const plan = planPersonSync({ role: 'district_admin', district: 'D' }, doc(area), [doc(area), doc(stale)]);
    expect(plan.error.status).toBe(403);
    expect(plan.error.message).toMatch(/member record holds a role/);
  });

  test('refuses when a record that would change is outside the district or area of the editor', () => {
    const src = district();
    src.roleTag.name = 'General Secretary';
    const elsewhere = (r) => r._id !== 'u2'; // the Murabi account sits in another area
    const plan = planPersonSync({ role: 'state_admin' }, doc(src), [doc(src), doc(murabi()), doc(member())], elsewhere);
    expect(plan.error.status).toBe(403);
    expect(plan.error.message).toMatch(/Area Admin account is outside your district or area/);
  });

  test('scope is only checked on records that would change', () => {
    const plan = planPersonSync({ role: 'state_admin' }, doc(district()), [doc(district()), doc(murabi()), doc(member())], () => false);
    expect(plan).toEqual({ changes: [] });
  });

  test('refuses before saving when another login is above the editor', () => {
    const area = { _id: 'a1', name: 'Rahim', phone: '9800001179', role: 'group_admin', adminKind: 'area', isLeader: true,
      roleTag: { type: 'area', name: 'President' }, extraRoleTags: [] };
    const state = { _id: 's1', name: 'Rahim', phone: '9800001179', role: 'state_admin', isLeader: false, roleTag: {}, extraRoleTags: [] };
    const editor = { role: 'district_admin', district: 'D' };
    const plan = planPersonSync(editor, doc(area), [doc(area), doc(state)]);
    expect(plan.error.status).toBe(403);
    expect(plan.error.message).toMatch(/State Admin account/);
  });
});

describe('attachPersonLinks', () => {
  const lean = [district(), murabi(), member()].map(({ _id, phone, role, adminKind, isLeader }) => ({ _id, phone, role, adminKind, isLeader }));
  test('member row points at the District Admin login and lists both logins', async () => {
    const [row] = await attachPersonLinks([member()], async () => lean);
    expect(row.leaderRecord).toMatchObject({ _id: 'd1', role: 'district_admin', adminKind: 'area', isLeader: true });
    expect(row.linkedAccounts.map((a) => a._id)).toEqual(['d1', 'u2']);
  });
  test('the leader record itself is editable and lists the other login', async () => {
    const [row] = await attachPersonLinks([district()], async () => lean);
    expect(row.leaderRecord).toBeNull();
    expect(row.linkedAccounts).toEqual([{ _id: 'u2', role: 'group_admin', adminKind: 'murabi' }]);
  });
  test('nobody a leader yet: every record is editable', async () => {
    const off = [district(), murabi(), member()].map(({ _id, phone, role, adminKind }) => ({ _id, phone, role, adminKind, isLeader: false }));
    const rows = await attachPersonLinks([member(), murabi()].map((r) => ({ ...r, isLeader: false })), async () => off);
    expect(rows.map((r) => r.leaderRecord)).toEqual([null, null]);
  });

  test('a member with no admin login is untouched', async () => {
    const solo = { _id: 'm9', phone: '9000000009', isLeader: true };
    const [row] = await attachPersonLinks([solo], async () => [solo]);
    expect(row.leaderRecord).toBeNull();
    expect(row.linkedAccounts).toEqual([]);
  });
});

describe('groupPeople — All Roles lists one row per person', () => {
  const login = (id, phone, role, extra = {}) => ({ _id: id, phone, role, adminKind: 'area', isLeader: false, ...extra });

  test('logins on one phone (any format) are one person, in first-seen order', () => {
    const people = groupPeople([
      login('g1', '+919072287516', 'group_admin'),
      login('x1', '9800000001', 'district_admin'),
      login('s1', '9072287516', 'state_admin'),
    ]);
    expect(people.map((p) => p.accounts.map((a) => a._id))).toEqual([['s1', 'g1'], ['x1']]);
  });

  test('roles are managed on the senior leader login', () => {
    const [person] = groupPeople([
      login('s1', '9072287516', 'state_admin', { isLeader: true }),
      login('g1', '9072287516', 'group_admin', { isLeader: true }),
    ]);
    expect(person.primary._id).toBe('s1');
  });

  test('a leader below a non-leader senior login holds the roles', () => {
    const [person] = groupPeople([
      login('s1', '9072287516', 'state_admin'),
      login('g1', '9072287516', 'group_admin', { isLeader: true }),
    ]);
    expect(person.primary._id).toBe('g1');
  });

  test('nobody a leader yet: the most senior login', () => {
    const [person] = groupPeople([login('g1', '9072287516', 'group_admin'), login('d1', '9072287516', 'district_admin')]);
    expect(person.primary._id).toBe('d1');
  });
});

describe('syncNewAccount — an admin account added to an existing leader', () => {
  const roleSet = (r) => [r.roleTag, ...(r.extraRoleTags || [])].filter((t) => t?.type).map((t) => `${t.type}·${t.name}·${t.listingOrder ?? ''}`).sort();
  const saved = (r) => {
    const rec = { ...r, saves: 0 };
    rec.toObject = () => ({ ...rec });
    rec.save = async () => { rec.saves += 1; };
    return rec;
  };

  test('a new State Admin account takes the roles held on the District Admin account', async () => {
    const fresh = saved({ _id: 'new', name: 'X', phone: '9800001179', role: 'state_admin', isLeader: false, extraRoleTags: [] });
    const next = await syncNewAccount(fresh, [fresh, saved(district()), saved(member())]);
    expect(next.isLeader).toBe(true);
    expect(fresh.isLeader).toBe(true);
    expect(roleSet(fresh)).toEqual(roleSet(district()));
    expect(fresh.saves).toBe(1);
  });

  test('a new Area Admin account without a matching role stays a non-leader, scope untouched', async () => {
    const scope = { type: 'area', areaId: 'a9', roleDescription: 'KUTTIADI' };
    const fresh = saved({ _id: 'new', phone: '9800001179', role: 'group_admin', adminKind: 'area', isLeader: false, roleTag: scope, extraRoleTags: [] });
    expect(await syncNewAccount(fresh, [fresh, saved(district())])).toBeNull();
    expect(fresh.roleTag).toEqual(scope);
    expect(fresh.saves).toBe(0);
  });

  test('nobody a leader: nothing to copy', async () => {
    const fresh = saved({ _id: 'new', phone: '9800001179', role: 'district_admin', isLeader: false, extraRoleTags: [] });
    expect(await syncNewAccount(fresh, [fresh, saved({ ...member(), isLeader: false })])).toBeNull();
    expect(fresh.saves).toBe(0);
  });
});

describe('areaAccessTag — Area Admin access set on the Admins page', () => {
  const kuttiadi = { _id: 'g2', name: 'KUTTIADI' };

  test('a new account gets area access for the chosen area', () => {
    expect(areaAccessTag(undefined, 'area', kuttiadi)).toEqual({
      tag: { type: 'area', listingOrder: null, areaId: 'g2', roleDescription: 'KUTTIADI' },
      typeChanged: true,
    });
  });

  test('moving to another area keeps the leader role name and order', () => {
    const tag = { type: 'area', name: 'President', listingOrder: 3, areaId: 'g1', roleDescription: 'MEDICAL COLLEGE' };
    expect(areaAccessTag(tag, 'area', kuttiadi)).toEqual({
      tag: { type: 'area', name: 'President', listingOrder: 3, areaId: 'g2', roleDescription: 'KUTTIADI' },
      typeChanged: false,
    });
  });

  test('a Murabi account stays Murabi', () => {
    const tag = { type: 'murabi', name: 'Murabi', listingOrder: null, areaId: 'g1', roleDescription: 'X' };
    expect(areaAccessTag(tag, 'murabi', kuttiadi).tag.type).toBe('murabi');
  });

  test('an account with no access type takes its kind', () => {
    expect(areaAccessTag({ listingOrder: null }, 'coordinator', kuttiadi)).toMatchObject({ tag: { type: 'coordinator' }, typeChanged: true });
  });

  test('another role tag (account converted to Area Admin) is replaced, name dropped', () => {
    const r = areaAccessTag({ type: 'district', name: 'President', listingOrder: 1 }, 'area', kuttiadi);
    expect(r).toEqual({ tag: { type: 'area', listingOrder: null, areaId: 'g2', roleDescription: 'KUTTIADI' }, typeChanged: true });
  });

  test('a unit-typed account is left alone', () => {
    expect(areaAccessTag({ type: 'unit', name: 'Secretary' }, 'area', kuttiadi)).toBeNull();
  });
});
