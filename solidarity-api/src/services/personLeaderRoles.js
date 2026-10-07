/**
 * One person, several records on one phone: a Member record plus one admin login
 * per role (every admin is also a member). Leader roles belong to the person, so
 * they are edited on ONE record — the one the leader directory shows — and copied
 * to the others. Each admin account keeps its own primary roleTag type, because
 * that tag is also its access scope (isAreaLevelAdmin, areaGroupIdsFor).
 *
 * Pure functions only; the routes load and save the documents.
 */

/** Indian numbers compare without +91; anything else by its digits. */
export const phoneKey = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

/** Every stored form of a phone, for `{ phone: { $in } }` lookups. */
export const phoneVariants = (raw) => {
  const key = phoneKey(raw);
  if (!key) return [];
  return key.length === 10 ? [key, `+91${key}`] : [key, `+${key}`];
};

export const isAdminRecord = (r) => !!r?.role && r.role !== 'member';

const ROLE_RANK = { state_admin: 0, district_admin: 1, group_admin: 2 };
const KIND_RANK = { area: 0, murabi: 1, coordinator: 2 };

/** Most senior first: state, district, area, murabi, coordinator admin, then the member record. */
export const compareRecords = (a, b) => {
  const rank = (r) => (isAdminRecord(r) ? ROLE_RANK[r.role] ?? 8 : 9);
  const kind = (r) => KIND_RANK[r.adminKind || 'area'] ?? 3;
  return rank(a) - rank(b) || kind(a) - kind(b) || String(a._id).localeCompare(String(b._id));
};

/**
 * The record that holds the person's leader roles — the most senior leader, which is
 * also the one the directory shows. null while nobody on the phone is a leader: then
 * any record may be switched on, and the sync carries it to the rest.
 */
export const leaderRecordOf = (records) => [...records].sort(compareRecords).find((r) => r.isLeader) || null;

/**
 * Admin logins grouped per person (phone), in the order each person first appears.
 * `primary` is the login their leader roles are edited on — the most senior leader,
 * else the most senior login — and `accounts` are all their logins, most senior first.
 */
export const groupPeople = (logins) => {
  const byPhone = new Map();
  for (const login of logins) {
    const key = phoneKey(login.phone);
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key).push(login);
  }
  return [...byPhone.values()].map((group) => {
    const accounts = [...group].sort(compareRecords);
    return { primary: leaderRecordOf(accounts) || accounts[0], accounts };
  });
};

// Same wording as the app (src/lib/adminKinds.ts): every area-level login is an "Area Admin".
const ADMIN_LABELS = { state_admin: 'State Admin', district_admin: 'District Admin', group_admin: 'Area Admin' };

export const recordLabel = (r) => (isAdminRecord(r) ? ADMIN_LABELS[r.role] || r.role : 'member record');

const toOrder = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const roleOf = (t) => ({ type: t.type || undefined, name: t.name || undefined, listingOrder: toOrder(t.listingOrder) });

/** Every role the record holds, primary first, blanks dropped. */
const roleList = (r) => [r.roleTag, ...(r.extraRoleTags || [])].filter((t) => t && (t.type || t.name)).map(roleOf);

const withoutUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

const AREA_ACCESS_TYPES = ['area', 'murabi', 'coordinator'];

/**
 * An Area Admin account's access lives on its roleTag: type (area / murabi /
 * coordinator) plus its area (areaId + roleDescription = the area's name) — see
 * isAreaLevelAdmin / areaGroupIdsFor. Returns { tag, typeChanged } for `area`
 * (a Group): the account keeps its type and its leader name/order, so only the
 * area moves. An account with no area-level type yet gets one from adminKind;
 * then `typeChanged` is true and its old name/order no longer apply. A unit-typed
 * account returns null: its tag is left as it is.
 */
export const areaAccessTag = (roleTag, adminKind, area) => {
  const current = roleTag?.type;
  if (current === 'unit') return null;
  const type = AREA_ACCESS_TYPES.includes(current) ? current : AREA_ACCESS_TYPES.includes(adminKind) ? adminKind : 'area';
  const typeChanged = current !== type;
  const tag = withoutUndefined({
    type,
    name: typeChanged ? undefined : roleTag?.name || undefined,
    listingOrder: typeChanged ? null : toOrder(roleTag?.listingOrder),
    areaId: area._id,
    roleDescription: area.name,
  });
  return { tag, typeChanged };
};

const roleKey = (t) => JSON.stringify([t.type || null, t.name || null, t.listingOrder]);

// Comparable form, so records already in step are left alone. Extra roles compare as a
// set, and a tag holding nothing but an empty listing order counts as no tag.
const snapshot = (r) => {
  const tag = r.roleTag;
  const hasTag = !!tag && !!(tag.type || tag.name || tag.areaId || tag.roleDescription);
  return JSON.stringify({
    isLeader: !!r.isLeader,
    roleTag: hasTag ? withoutUndefined({ ...roleOf(tag), areaId: tag.areaId ? String(tag.areaId) : undefined, roleDescription: tag.roleDescription }) : null,
    extraRoleTags: (r.extraRoleTags || []).filter((t) => t && (t.type || t.name)).map(roleOf).map(roleKey).sort(),
  });
};

/** Where `record`'s own primary role sits in `roles`: same type and name, else same type. */
const ownRoleIndex = (record, roles) => {
  const own = record.roleTag;
  if (!own?.type) return -1;
  const exact = roles.findIndex((t) => t.type === own.type && (t.name || '') === (own.name || ''));
  return exact >= 0 ? exact : roles.findIndex((t) => t.type === own.type);
};

/**
 * Leader fields `record` should hold once `source` (the person's leader record,
 * already updated) changed. Plain objects in, plain objects out; null when the
 * record is already in step.
 */
export const syncedLeaderFields = (source, record) => {
  // Descriptive fields every record keeps: the area link and area name.
  const kept = record.roleTag
    ? withoutUndefined({ areaId: record.roleTag.areaId, roleDescription: record.roleTag.roleDescription })
    : {};
  const keptTag = Object.keys(kept).length ? kept : undefined;
  // Area/unit logins (group_admin) are scoped by their tag — its type, areaId and area
  // name decide their access (isAreaLevelAdmin, areaGroupIdsFor) — so the sync never
  // changes it. Leader off keeps it whole, the same rule the leader routes use.
  const scoped = record.role === 'group_admin';
  const leaderOff = () => ({ isLeader: false, roleTag: scoped ? record.roleTag : keptTag, extraRoleTags: [] });

  const roles = source.isLeader ? roleList(source) : [];
  let idx = ownRoleIndex(record, roles);
  let next;
  if (!source.isLeader) {
    next = leaderOff();
  } else if (scoped && idx < 0) {
    // A scoped login is listed only while the person holds the role it is scoped to.
    // One with no type never takes one from here: that would change its access.
    next = leaderOff();
  } else if (roles.length === 0) {
    next = { isLeader: true, roleTag: scoped ? record.roleTag : keptTag, extraRoleTags: [] };
  } else {
    // Keep its own first role while the person still holds it, else lead with the leader record's.
    if (idx < 0) idx = 0;
    next = {
      isLeader: true,
      roleTag: withoutUndefined({ ...kept, ...roles[idx] }),
      extraRoleTags: roles.filter((_, i) => i !== idx),
    };
  }
  return snapshot(next) === snapshot(record) ? null : next;
};
