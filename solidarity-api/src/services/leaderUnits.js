import Member from '../models/Member.js';

/**
 * Leader directory: which unit a unit leader belongs to. The org keeps a
 * person's unit as plain text in member.address; admin logins (User docs) have
 * no address, so theirs comes from the Member record with the same phone.
 */

// Indian numbers match with or without +91; anything else matches as stored.
const phoneVariants = (raw) => {
  const digits = (raw || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length === 10) return [local, `+91${local}`];
  return raw ? [raw] : [];
};

const holdsUnitRole = (l) =>
  l.roleTag?.type === 'unit' || (l.extraRoleTags || []).some((t) => t?.type === 'unit');

const findMembersByPhone = (phones) =>
  Member.find({ phone: { $in: phones } }).select('phone address').lean();

/**
 * Sets `unit` on every leader holding a unit role (primary or extra) and
 * strips `address` from all rows, so only unit leaders' unit names leave the
 * server. Mutates the lean rows in place, before multi-role fan-out.
 */
export async function attachLeaderUnits(leaders, findMembers = findMembersByPhone) {
  const unitLeaders = leaders.filter(holdsUnitRole);
  const needLookup = unitLeaders.filter((l) => !l.address?.trim());

  const addressByPhone = new Map();
  if (needLookup.length) {
    const members = await findMembers(needLookup.flatMap((l) => phoneVariants(l.phone)));
    for (const m of members) {
      if (m.address?.trim()) phoneVariants(m.phone).forEach((p) => addressByPhone.set(p, m.address));
    }
  }

  for (const l of unitLeaders) {
    const unit =
      l.address?.trim() ||
      phoneVariants(l.phone).map((p) => addressByPhone.get(p)).find(Boolean) ||
      (l.roleTag?.type === 'unit' ? l.roleTag.roleDescription : undefined);
    if (unit?.trim()) l.unit = unit.trim();
  }
  for (const l of leaders) delete l.address;
  return leaders;
}
