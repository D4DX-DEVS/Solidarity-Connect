import Group from '../models/Group.js';
import District from '../models/District.js';
import Member from '../models/Member.js';

const idOf = (value) => (value && typeof value === 'object' && value._id !== undefined ? value._id : value);

/**
 * Recomputes the stored member counts (Group and District `statistics`) for every area
 * and district the given locations touch. Area and district listings show these stored
 * counts, so call this after any change that adds or removes a member or changes a
 * member's area, district, status, approval or Baithul Maal amount. Pass the member's
 * location before and after the change so a move updates both sides. Never throws: a
 * failed refresh is logged and must not fail the change that triggered it, and one
 * failing area or district does not stop the others.
 * @param {...({ group?: unknown, district?: unknown } | null | undefined)} locations
 *   member documents or `{ group, district }`, with ids or populated documents
 * @returns {Promise<void>}
 */
export async function refreshMemberStats(...locations) {
  const groupIds = new Set();
  const districtIds = new Set();
  for (const location of locations) {
    if (!location) continue;
    const group = idOf(location.group);
    const district = idOf(location.district);
    if (group) groupIds.add(String(group));
    if (district) districtIds.add(String(district));
  }
  let docs;
  try {
    const [groups, districts] = await Promise.all([
      groupIds.size ? Group.find({ _id: { $in: [...groupIds] } }) : [],
      districtIds.size ? District.find({ _id: { $in: [...districtIds] } }) : []
    ]);
    docs = [...groups, ...districts];
  } catch (error) {
    console.error('Member statistics refresh failed:', error);
    return;
  }
  for (const doc of docs) {
    try {
      await doc.updateStatistics();
    } catch (error) {
      console.error(`Member statistics refresh failed for ${doc.name || doc._id}:`, error);
    }
  }
}

/**
 * The area and district a member is in, from the given record.
 * @param {{ group?: unknown, district?: unknown } | null | undefined} member
 * @returns {{ group: string | undefined, district: string | undefined } | null}
 */
export function locationOf(member) {
  if (!member) return null;
  const group = idOf(member.group);
  const district = idOf(member.district);
  return { group: group ? String(group) : undefined, district: district ? String(district) : undefined };
}

/**
 * The area and district a member is in right now, read from the database. Returns null
 * (and logs) when the member is gone or the read fails, so callers that have already
 * committed a change can still answer the request.
 * @param {unknown} memberId
 * @returns {Promise<{ group: string | undefined, district: string | undefined } | null>}
 */
export async function currentLocation(memberId) {
  const id = idOf(memberId);
  if (!id) return null;
  try {
    return locationOf(await Member.findById(id).select('group district').lean());
  } catch (error) {
    console.error('Member location lookup failed:', error);
    return null;
  }
}
