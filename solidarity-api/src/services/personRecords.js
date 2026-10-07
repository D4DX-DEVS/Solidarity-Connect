import mongoose from 'mongoose';
import User from '../models/User.js';
import Member from '../models/Member.js';
import Group from '../models/Group.js';
import { canManageLeaderTarget } from '../middleware/auth.js';
import {
  areaAccessTag,
  compareRecords,
  groupPeople,
  isAdminRecord,
  leaderRecordOf,
  phoneKey,
  phoneVariants,
  recordLabel,
  syncedLeaderFields,
} from './personLeaderRoles.js';

/**
 * Every admin login and member record on `target`'s phone, as documents (see
 * personLeaderRoles.js). `target` itself is always in the list, even when its
 * stored phone is in a form the lookup does not match.
 */
export async function loadPersonRecords(target) {
  const phones = phoneVariants(target.phone);
  const [users, members] = phones.length
    ? await Promise.all([User.find({ phone: { $in: phones } }), Member.find({ phone: { $in: phones } })])
    : [[], []];
  const records = [...users, ...members].filter((r) => String(r._id) !== String(target._id));
  return [target, ...records];
}

const brief = (r) => ({ _id: r._id, role: isAdminRecord(r) ? r.role : 'member', adminKind: r.adminKind || null });
// The record holding a person's roles, with those roles — a card shows them even when its own account can't hold them.
const holder = (r) => ({ ...brief(r), isLeader: !!r.isLeader, roleTag: r.roleTag, extraRoleTags: r.extraRoleTags || [] });
const where = (r) => `${recordLabel(r)}${isAdminRecord(r) ? ' account' : ''}`;

/**
 * Leader roles are edited on the record that holds them. Returns a 409 body naming
 * that record when `target` is another one, else null (also when nobody is a
 * leader yet — then any record may switch Leader on).
 */
export function leaderRecordError(target, records) {
  const leader = leaderRecordOf(records);
  if (!leader || String(leader._id) === String(target._id)) return null;
  return {
    status: 409,
    message: `${target.name}'s leader roles are edited on their ${where(leader)}. Edit them there.`,
    data: { leaderRecord: brief(leader) },
  };
}

/**
 * After `source` (the leader record) has been changed in memory: what each other
 * record of the person must become. Every record that would change must be one the
 * editor may change — hierarchy + the roles it holds, and inside their district or
 * area (`inScope`, from leaderEditScopeFor) — otherwise nothing is saved.
 */
export function planPersonSync(editor, source, records, inScope = () => true) {
  const changes = [];
  const updated = source.toObject();
  for (const record of records) {
    if (String(record._id) === String(source._id)) continue;
    const next = syncedLeaderFields(updated, record.toObject());
    if (!next) continue;
    if (!canManageLeaderTarget(editor, record)) {
      return {
        error: {
          status: 403,
          message: isAdminRecord(record)
            ? `${source.name} also has a ${where(record)}, which your level cannot change. Ask a State Admin.`
            : `${source.name}'s member record holds a role your level cannot change. Ask a State Admin.`,
        },
      };
    }
    if (!inScope(record)) {
      return {
        error: {
          status: 403,
          message: `${source.name}'s ${where(record)} is outside your district or area, and it would change too. Ask a State Admin.`,
        },
      };
    }
    changes.push({ record, next });
  }
  return { changes };
}

// Standalone dev databases have no transactions; Atlas (a replica set) does.
const noTransactions = (error) =>
  error?.code === 20 || /Transaction numbers are only allowed|replica set/i.test(error?.message || '');

/**
 * Saves the edited record and every planned copy together: all or nothing.
 * Everything is validated first, and every write is worked out before the
 * transaction: Mongo re-runs the transaction after a write conflict, and a
 * document's own save() does not survive that (the edited record lost its roles
 * while the copies kept them). Copies change only their leader fields.
 */
export async function savePersonEdit(source, changes) {
  await source.validate();
  for (const { record, next } of changes) {
    record.isLeader = next.isLeader;
    record.roleTag = next.roleTag;
    record.extraRoleTags = next.extraRoleTags;
    await record.validate({ validateModifiedOnly: true });
  }
  if (!changes.length) return source.save();
  const leaderUpdate = (next) => {
    const set = { isLeader: next.isLeader, extraRoleTags: next.extraRoleTags };
    return next.roleTag === undefined ? { $set: set, $unset: { roleTag: 1 } } : { $set: { ...set, roleTag: next.roleTag } };
  };
  const writes = [
    { Model: source.constructor, _id: source._id, update: source.getChanges() },
    ...changes.map(({ record, next }) => ({ Model: record.constructor, _id: record._id, update: leaderUpdate(next) })),
  ].filter((w) => Object.keys(w.update).length);
  const write = async (session) => {
    for (const { Model, _id, update } of writes) await Model.updateOne({ _id }, update, { session });
  };
  try {
    await mongoose.connection.transaction(write);
  } catch (error) {
    if (!noTransactions(error)) throw error;
    await write(undefined);
  }
  return changes.length;
}

const findRecordsByPhones = async (phones) => {
  const [users, members] = await Promise.all([
    User.find({ phone: { $in: phones } }).select('_id phone role adminKind isLeader roleTag extraRoleTags').lean(),
    Member.find({ phone: { $in: phones } }).select('_id phone isLeader roleTag extraRoleTags').lean(),
  ]);
  return [...users, ...members];
};

/**
 * Role Management rows: `linkedAccounts` = the person's other admin logins, and
 * `leaderRecord` = the record holding their leader roles when that is not this row
 * (null when it is, or when nobody is a leader yet). Mutates plain rows in place.
 */
export async function attachPersonLinks(rows, find = findRecordsByPhones) {
  const phones = [...new Set(rows.flatMap((r) => phoneVariants(r.phone)))];
  const all = phones.length ? await find(phones) : [];
  const byPhone = new Map();
  for (const r of all) {
    const key = phoneKey(r.phone);
    if (!byPhone.has(key)) byPhone.set(key, []);
    byPhone.get(key).push(r);
  }
  for (const row of rows) {
    const same = byPhone.get(phoneKey(row.phone)) || [];
    row.linkedAccounts = same
      .filter((r) => String(r._id) !== String(row._id) && isAdminRecord(r))
      .sort(compareRecords)
      .map(brief);
    const leader = leaderRecordOf(same.some((r) => String(r._id) === String(row._id)) ? same : [row, ...same]);
    row.leaderRecord = leader && String(leader._id) !== String(row._id) ? holder(leader) : null;
  }
  return rows;
}

const PLACES = [{ path: 'district', select: 'name code' }, { path: 'group', select: 'name code' }];
const place = (p) => (p ? { _id: p._id, name: p.name } : null);
const accountOf = (l) => ({
  _id: l._id,
  role: l.role,
  adminKind: l.adminKind || null,
  isLeader: !!l.isLeader,
  district: place(l.district),
  group: place(l.group),
});
// Stable pages: logins created together (imports) share createdAt.
const sortWithTiebreak = (sort) => {
  const spec = typeof sort === 'string' && sort.trim() ? sort.trim() : '-createdAt';
  return /(^|\s)-?_id(\s|$)/.test(spec) ? spec : `${spec} _id`;
};

/**
 * Role Management "All Roles": one row per person instead of one per admin login.
 * A person is listed when any of their logins matches `match`; `isLeader` (true/false)
 * is their own Leader status, checked on the login that holds their leader roles, and
 * `severalAccounts` keeps only people with more than one admin login.
 * Each row is that login (the server decides which — see groupPeople) with
 * `accounts` = every login of theirs the viewer may see (`access`), each marked
 * `managesLeaderRoles` when it is where their roles are edited. Pages count people.
 */
export async function listPeople({ match, access = {}, sort, page = 1, limit = 20, isLeader, severalAccounts = false }) {
  // Who matches, and every login the viewer may see — only the fields grouping needs.
  const [matched, logins] = await Promise.all([
    User.find({ ...match, ...access }).select('phone').lean(),
    User.find(access).select('_id phone role adminKind isLeader').sort(sortWithTiebreak(sort)).lean(),
  ]);
  const keys = new Set(matched.map((m) => phoneKey(m.phone)));
  let people = groupPeople(logins.filter((l) => keys.has(phoneKey(l.phone))));
  if (isLeader !== undefined) people = people.filter((p) => !!p.primary.isLeader === isLeader);
  if (severalAccounts) people = people.filter((p) => p.accounts.length > 1);

  const totalDocs = people.length;
  const totalPages = Math.max(1, Math.ceil(totalDocs / limit));
  const onPage = people.slice((page - 1) * limit, page * limit);
  // Full records for this page only, alongside where each person's roles are edited.
  const links = onPage.map(({ primary }) => ({ _id: primary._id, phone: primary.phone }));
  const [full] = await Promise.all([
    User.find({ _id: { $in: onPage.flatMap((p) => p.accounts.map((a) => a._id)) } }).populate(PLACES),
    attachPersonLinks(links),
  ]);
  const byId = new Map(full.map((d) => [String(d._id), d.toJSON()]));
  // A login deleted between the reads simply drops out.
  const docs = onPage
    .map(({ primary, accounts }, i) => ({ primary, accounts, link: links[i] }))
    .filter(({ primary }) => byId.has(String(primary._id)))
    .map(({ primary, accounts, link }) => {
      const row = { ...byId.get(String(primary._id)), linkedAccounts: link.linkedAccounts, leaderRecord: link.leaderRecord };
      // null leaderRecord = this row holds the roles (or nobody does yet, and Leader goes on here).
      row.accounts = accounts
        .filter((a) => byId.has(String(a._id)))
        .map((a) => ({ ...accountOf(byId.get(String(a._id))), managesLeaderRoles: !row.leaderRecord && String(a._id) === String(row._id) }));
      return row;
    });
  return { docs, page, totalPages, totalDocs, limit, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

/**
 * An admin login just added to a person (new account, or one moved to their phone or
 * given another role) takes the leader roles they already hold, by the same rules as
 * a save (an Area Admin login keeps its own scope tag). Returns the fields written,
 * or null when there was nothing to copy.
 */
export async function syncNewAccount(record, records) {
  if (!records) records = await loadPersonRecords(record);
  const leader = leaderRecordOf(records);
  if (!leader || String(leader._id) === String(record._id)) return null;
  const next = syncedLeaderFields(leader.toObject(), record.toObject());
  if (!next) return null;
  record.isLeader = next.isLeader;
  record.roleTag = next.roleTag;
  record.extraRoleTags = next.extraRoleTags;
  await record.save();
  return next;
}

/**
 * Admins page: an Area Admin account's access comes from the area chosen there
 * (its `group`) — District → Area. Sets district + the access tag (areaAccessTag)
 * on `user` before it is saved; leader roles stay as they are. Only when the access
 * type itself is new on an account that is a leader are its roles taken again from
 * the person's other records afterwards (syncNewAccount) — refused when no other
 * record holds them, so nothing is lost. Returns { typeChanged } or { error }.
 */
export async function applyAreaAccess(user) {
  if (user.role !== 'group_admin') return { typeChanged: false };
  const area = user.group ? await Group.findById(user.group._id || user.group).select('name district').lean() : null;
  if (!area) return { error: { status: 400, message: 'Select the area this Area Admin manages.' } };
  const district = user.district?._id || user.district;
  if (district && String(district) !== String(area.district)) {
    return { error: { status: 400, message: "That area isn't in the selected district. Choose the district again, then its area." } };
  }
  user.district = area.district;
  const current = typeof user.roleTag?.toObject === 'function' ? user.roleTag.toObject() : user.roleTag;
  const access = areaAccessTag(current, user.adminKind, area);
  if (!access) return { typeChanged: false };
  if (access.typeChanged && user.isLeader) {
    const others = (await loadPersonRecords(user)).slice(1);
    if (!others.some((r) => r.isLeader)) {
      return { error: { status: 409, message: `${user.name}'s leader roles are only on this account, and Area Admin access would replace them. Remove their leader roles in Role Management first, then change the access.` } };
    }
    user.isLeader = false;
    user.extraRoleTags = [];
  }
  user.roleTag = access.tag;
  return { typeChanged: access.typeChanged };
}
