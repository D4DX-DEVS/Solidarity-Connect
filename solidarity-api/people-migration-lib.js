/**
 * Shared parsing for the people migration (migrate-people.js / verify-people.js /
 * restore-statuses.js).
 *
 * Reads two source layouts and normalises both to the same row shape:
 *   - v2 (current) "MEMBERS_FINAL_FINAL 01 Oct 26.xlsx", Sheet1:
 *       SI:NO, NAME, MEMBERS GROUP, District, Unit, DOB, Is Leader, Role Type,
 *       Role Name, PHONE NUMBER, BLOOD GROUP, STATUS, Is Leader_1, Role Type_1,
 *       Role Name_1, Role Type_2, Role Name_2
 *   - v1 "people_properly_filtered_members_only.xlsx", "Filtered Members" sheet
 *       (Roles as one "area - Secretary; murabi" string)
 *
 * Hierarchy in the DB: District → Group (the "Area") → unit, which is plain text
 * on member.address. Districts and groups are master data and are never touched.
 */

import XLSX from 'xlsx';

export const DEFAULT_XLSX = 'C:\\Users\\moham\\Downloads\\MEMBERS_FINAL_FINAL 01 Oct 26.xlsx';

/** QA numbers: every record on these survives the wipe, untouched. */
export const TEST_PHONES = ['9876543210', '9995707129'];

/** Every stored spelling of a 10-digit Indian number. */
export const phoneVariants = (bare) => [bare, `+91${bare}`, `91${bare}`];
export const TEST_PHONE_VARIANTS = TEST_PHONES.flatMap(phoneVariants);

export const LEADER_MISMATCH = 'Leader column disagrees with Roles — roles win';

const BLOOD_GROUPS = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const STATUSES = new Map(
  ['Active', 'Inactive', 'Abroad', 'Applicant', 'Age over', 'Dismissed'].map((s) => [s.toLowerCase(), s])
);
// Gulf numbers in the sheet arrive without "+". Each country's mobile numbers
// have a fixed local length and leading digit — anything else is rejected
// rather than stored as a number nobody can reach.
const GULF = {
  971: { country: 'UAE', len: 9, mobile: /^5/ },
  966: { country: 'Saudi Arabia', len: 9, mobile: /^5/ },
  974: { country: 'Qatar', len: 8, mobile: /^[3567]/ },
  968: { country: 'Oman', len: 8, mobile: /^[79]/ },
  973: { country: 'Bahrain', len: 8, mobile: /^[36]/ },
  965: { country: 'Kuwait', len: 8, mobile: /^[569]/ },
};
const DOB_MIN_YEAR = 1950;
const DOB_MAX_YEAR = 2010;

// state > district > area > murabi > unit. Drives primary-role choice.
export const ROLE_RANK = { state: 0, district: 1, area: 2, murabi: 3, unit: 4 };

// Obvious typos in role titles, fixed and reported.
const TITLE_FIXES = [
  [/^presudent$/i, 'President'],
  [/^pr$/i, 'President'],
  [/secratary/i, 'Secretary'],
];

/**
 * Members store +91XXXXXXXXXX, admin Users store the bare 10 digits (existing
 * convention). International numbers keep their country code in both.
 * `key` is the dedupe identity. Returns null when the number is unusable.
 */
export function parsePhone(raw) {
  const text = String(raw ?? '').trim();
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;

  let bare = digits;
  if (bare.length === 12 && bare.startsWith('91')) bare = bare.slice(2);
  else if (bare.length === 11 && bare.startsWith('0')) bare = bare.slice(1);
  if (bare.length === 10) {
    return /^[6-9]/.test(bare) ? { key: bare, member: `+91${bare}`, user: bare, intl: false } : null;
  }

  const code = Object.keys(GULF).find((c) => digits.startsWith(c));
  if (code) {
    const { country, len, mobile } = GULF[code];
    const local = digits.slice(code.length);
    if (local.length !== len || !mobile.test(local)) return null;
    return { key: digits, member: `+${digits}`, user: `+${digits}`, intl: true, country, addedPlus: !text.startsWith('+') };
  }
  // Other countries only when explicitly "+"-prefixed.
  if (text.startsWith('+') && digits.length >= 11 && digits.length <= 15 && !digits.startsWith('91')) {
    return { key: digits, member: `+${digits}`, user: `+${digits}`, intl: true, country: 'other' };
  }
  return null;
}

/** Why a number was rejected, for the report. */
export function phoneProblem(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return 'no phone number';
  const code = Object.keys(GULF).find((c) => digits.startsWith(c));
  if (code) {
    const { country, len } = GULF[code];
    return `${country} number with ${digits.length - code.length} local digits (needs ${len}) or wrong mobile prefix`;
  }
  if (digits.length === 9 && digits.startsWith('5')) return '9 digits starting with 5 — looks like a UAE/Saudi mobile with no country code';
  if (digits.length < 10) return `only ${digits.length} digits — missing digit(s) or missing country code`;
  return `${digits.length} digits, no recognised country code`;
}

const utcDate = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
};

/**
 * DOB → UTC midnight (the edit form reads the stored ISO date part directly,
 * so IST midnight would show a day early). Accepts an Excel date serial,
 * "YYYY-MM-DD", "DD-MM-YYYY" (also / or .), and repairs separator typos when
 * exactly 8 digits remain (DDMMYYYY). Blank or unusable → undefined + warning.
 */
export function parseDob(raw) {
  if (raw === '' || raw === null || raw === undefined) return { value: undefined };

  if (typeof raw === 'number') {
    if (raw < 7306) return { value: undefined, warning: `DOB "${raw}" is not a full date (year only?) — left blank` };
    const p = XLSX.SSF.parse_date_code(raw);
    return checkRange(p && utcDate(p.y, p.m, p.d), String(raw));
  }

  const text = String(raw).trim();
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return checkRange(utcDate(+m[1], +m[2], +m[3]), text);
  m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return checkRange(utcDate(+m[3], +m[2], +m[1]), text);

  const digits = text.replace(/\D/g, '');
  if (digits.length === 8) {
    const date = utcDate(+digits.slice(4), +digits.slice(2, 4), +digits.slice(0, 2));
    const res = checkRange(date, text);
    if (res.value) res.warning = `DOB "${text}" malformed — read as ${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    return res;
  }
  return { value: undefined, warning: `DOB "${text}" unreadable — left blank` };
}

function checkRange(date, text) {
  if (!date) return { value: undefined, warning: `DOB "${text}" is not a real date — left blank` };
  const y = date.getUTCFullYear();
  if (y < DOB_MIN_YEAR || y > DOB_MAX_YEAR) return { value: undefined, warning: `DOB "${text}" gives year ${y} — left blank` };
  return { value: date };
}

export function normalizeBlood(raw) {
  const text = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/^0/, 'O');
  if (!text) return { value: undefined };
  if (BLOOD_GROUPS.has(text)) {
    return { value: text, warning: text !== String(raw).trim() ? `blood group "${raw}" read as ${text}` : undefined };
  }
  return { value: undefined, warning: `ambiguous blood group "${raw}" — left blank` };
}

/** Blank status imports as Active (user decision 2026-09-30). */
export function normalizeStatus(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { value: 'Active', blank: true };
  const known = STATUSES.get(text.toLowerCase());
  if (known) return { value: known };
  return { value: 'Active', warning: `unknown status "${text}" — imported as Active` };
}

/** [{ type, name }] raw role cells → [{ type, title }], typo-fixed, rank-sorted. */
export function parseRoles(rawRoles) {
  const roles = [];
  const invalid = [];
  const fixes = [];
  for (const { type: rawType, name: rawName } of rawRoles) {
    const type = String(rawType ?? '').trim().toLowerCase();
    let title = String(rawName ?? '').trim();
    if (!type && !title) continue;
    if (type === 'murabi') { roles.push({ type: 'murabi', title: 'Murabi' }); continue; }
    if (!(type in ROLE_RANK) || !title) { invalid.push(`${rawType || '?'} - ${rawName || '?'}`); continue; }
    for (const [re, fix] of TITLE_FIXES) {
      if (re.test(title)) {
        const fixed = title.replace(re, fix);
        fixes.push(`role "${rawType} - ${title}" read as "${fixed}"`);
        title = fixed;
      }
    }
    roles.push({ type, title: title.charAt(0).toUpperCase() + title.slice(1) });
  }
  // One role per type — a second of the same type would collide on the login key.
  const seen = new Set();
  const unique = roles.filter((r) => (seen.has(r.type) ? (invalid.push(`duplicate ${r.type} role "${r.title}"`), false) : seen.add(r.type)));
  unique.sort((a, b) => ROLE_RANK[a.type] - ROLE_RANK[b.type]);
  return { roles: unique, invalid, fixes };
}

/** v1 "area - Secretary; murabi" → raw role cells. */
const splitRoleText = (text) =>
  String(text ?? '').split(';').map((s) => s.trim()).filter(Boolean).map((part) => {
    const m = part.match(/^([^-]+?)\s*-\s*(.+)$/);
    return m ? { type: m[1], name: m[2] } : { type: part, name: '' };
  });

const isTrue = (v) => v === true || /^(yes|true)$/i.test(String(v ?? '').trim());

/** Read either layout into normalised rows. */
export function readRows(xlsxPath) {
  const workbook = XLSX.readFile(xlsxPath);
  if (workbook.Sheets['Filtered Members']) {
    return XLSX.utils.sheet_to_json(workbook.Sheets['Filtered Members'], { defval: '' }).map((r) => ({
      src: r['Source Excel Row'], name: r.Name, phone: r['Phone Number'], district: r.District,
      area: r['Area / Group'], unit: r.Unit, dob: r['Date of Birth'], blood: r['Blood Group'],
      status: r.Status, rawRoles: splitRoleText(r.Roles), leaderFlag: isTrue(r.Leader),
    }));
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
    .filter((r) => String(r.NAME ?? '').trim() || String(r['PHONE NUMBER'] ?? '').trim())
    .map((r) => ({
      src: r['SI:NO'], name: r.NAME, phone: r['PHONE NUMBER'], district: r.District,
      area: r['MEMBERS GROUP'], unit: r.Unit, dob: r.DOB, blood: r['BLOOD GROUP'], status: r.STATUS,
      rawRoles: [
        { type: r['Role Type'], name: r['Role Name'] },
        { type: r['Role Type_1'], name: r['Role Name_1'] },
        { type: r['Role Type_2'], name: r['Role Name_2'] },
      ],
      leaderFlag: isTrue(r['Is Leader']) || isTrue(r['Is Leader_1']),
    }));
}

/**
 * Full roleTag for one role. For area/murabi, roleDescription MUST equal the
 * group (area) name — isAreaLevelAdmin scoping matches groups by it.
 */
export function roleTagFor(role, person) {
  switch (role.type) {
    case 'area':
      return { type: 'area', name: role.title, roleDescription: person.groupName, areaId: person.groupId };
    case 'murabi':
      return { type: 'murabi', name: 'Murabi', roleDescription: person.groupName, areaId: person.groupId };
    case 'unit':
      return { type: 'unit', name: role.title, roleDescription: person.unit || undefined };
    case 'district':
      return { type: 'district', name: role.title, roleDescription: person.districtName };
    default:
      return { type: role.type, name: role.title };
  }
}

/**
 * Admin logins a leader gets — one per (role, adminKind), which is the users
 * collection's unique key:
 *   state → state_admin, district → district_admin,
 *   area / murabi / unit → ONE group_admin (area beats murabi beats unit; a
 *   murabi-only leader gets adminKind 'murabi' so isAreaLevelAdmin holds).
 * Every login carries ALL the person's roles (primary roleTag + extraRoleTags),
 * because the leaders directory shows only the first User row per phone.
 */
export function loginsFor(person) {
  const { roles } = person;
  const extrasExcept = (primary) =>
    roles.filter((r) => r !== primary).map((r) => ({ type: r.type, name: r.type === 'murabi' ? 'Murabi' : r.title }));

  const logins = [];
  const state = roles.find((r) => r.type === 'state');
  if (state) logins.push({ role: 'state_admin', adminKind: 'area', primary: state });
  const district = roles.find((r) => r.type === 'district');
  if (district) logins.push({ role: 'district_admin', adminKind: 'area', primary: district });
  const groupLevel = roles.find((r) => r.type === 'area') || roles.find((r) => r.type === 'murabi') || roles.find((r) => r.type === 'unit');
  if (groupLevel) {
    logins.push({ role: 'group_admin', adminKind: groupLevel.type === 'murabi' ? 'murabi' : 'area', primary: groupLevel });
  }

  return logins.map(({ role, adminKind, primary }) => ({
    name: person.name,
    phone: person.phone.user,
    role,
    adminKind,
    // District on every row so directory district filters and the member-side
    // "own district" filter still see this person whichever row is picked.
    district: person.districtId,
    group: role === 'group_admin' ? person.groupId : undefined,
    isActive: true,
    isLeader: true,
    roleTag: roleTagFor(primary, person),
    extraRoleTags: extrasExcept(primary),
  }));
}

/**
 * Normalised rows → people, resolved against DB districts/groups.
 * Returns { people, skipped, warnings }. Nothing is written.
 */
export function buildPeople(rows, districts, groups) {
  const districtByName = new Map(districts.map((d) => [d.name.trim().toUpperCase(), d]));
  const groupByKey = new Map(groups.map((g) => [`${g.district}|${g.name.trim().toUpperCase()}`, g]));
  const skipped = [];
  const warnings = [];
  const candidates = [];

  for (const row of rows) {
    const src = row.src;
    const name = String(row.name ?? '').trim().replace(/\s+/g, ' ');
    const skip = (reason) => skipped.push({ row: src, name, phone: row.phone, reason });
    const warn = (msg) => warnings.push({ row: src, name, warning: msg });

    if (!name) { skip('blank name'); continue; }
    const phone = parsePhone(row.phone);
    if (!phone) { skip(`invalid phone "${row.phone}": ${phoneProblem(row.phone)}`); continue; }
    if (TEST_PHONES.includes(phone.key)) { skip('QA test phone — existing records kept'); continue; }
    if (phone.addedPlus) warn(`${phone.country} number "${row.phone}" stored as ${phone.member}`);

    const districtName = String(row.district ?? '').trim();
    const district = districtByName.get(districtName.toUpperCase());
    if (!district) { skip(`district "${districtName}" not in master data`); continue; }
    const areaName = String(row.area ?? '').trim();
    const group = groupByKey.get(`${district._id}|${areaName.toUpperCase()}`);
    if (!group) { skip(`area "${areaName}" not in ${district.name}`); continue; }

    const dob = parseDob(row.dob);
    const blood = normalizeBlood(row.blood);
    const status = normalizeStatus(row.status);
    const { roles, invalid, fixes } = parseRoles(row.rawRoles);
    [dob, blood, status].forEach((r) => r.warning && warn(r.warning));
    if (status.blank) warn('blank status — imported as Active');
    fixes.forEach(warn);
    if (invalid.length) warn(`unrecognised role(s) ignored: ${invalid.join(', ')}`);
    // Source "Leader" is "No" for most unit office bearers; Roles is the real data.
    if (row.leaderFlag !== roles.length > 0) warn(LEADER_MISMATCH);
    if (/^name$/i.test(name)) warn('name is literally "Name" — check source');
    const unit = String(row.unit ?? '').trim();
    if (!unit) warn('no unit');
    else if (unit.length < 3) warn(`unit "${unit}" looks truncated`);

    candidates.push({
      row: src,
      name,
      phone,
      districtId: district._id,
      districtName: district.name,
      groupId: group._id,
      groupName: group.name,
      unit,
      dateOfBirth: dob.value,
      bloodGroup: blood.value,
      status: status.value,
      roles,
    });
  }

  // One person per phone: keep the row with the most roles, else the first.
  const byPhone = new Map();
  for (const c of candidates) {
    const seen = byPhone.get(c.phone.key);
    if (!seen) { byPhone.set(c.phone.key, c); continue; }
    const winner = c.roles.length > seen.roles.length ? c : seen;
    const loser = winner === c ? seen : c;
    byPhone.set(c.phone.key, winner);
    skipped.push({
      row: loser.row,
      name: loser.name,
      phone: loser.phone.member,
      reason: `duplicate phone — kept #${winner.row} ${winner.name} (${winner.districtName}/${winner.groupName}/${winner.unit}); dropped ${loser.districtName}/${loser.groupName}/${loser.unit}`,
    });
  }

  return { people: [...byPhone.values()], skipped, warnings };
}

/** Member document for a person (createdBy/approvedBy filled by caller). */
export function memberDocFor(person, approverId) {
  const [primary, ...rest] = person.roles;
  return {
    name: person.name,
    phone: person.phone.member,
    dateOfBirth: person.dateOfBirth,
    bloodGroup: person.bloodGroup,
    address: person.unit || undefined,
    district: person.districtId,
    group: person.groupId,
    status: person.status,
    isApproved: true,
    approvedBy: approverId,
    approvedAt: new Date(),
    createdBy: approverId,
    isLeader: person.roles.length > 0,
    roleTag: primary ? roleTagFor(primary, person) : undefined,
    extraRoleTags: rest.map((r) => ({ type: r.type, name: r.type === 'murabi' ? 'Murabi' : r.title })),
  };
}
