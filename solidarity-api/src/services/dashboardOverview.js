import Member from '../models/Member.js';
import Group from '../models/Group.js';
import District from '../models/District.js';
import User from '../models/User.js';
import MonthlyReport from '../models/MonthlyReport.js';
import ReportForm from '../models/ReportForm.js';
import { ensureForms } from './monthlyReports/store.js';
import { orgYearMonth } from '../utils/orgTime.js';
import { isAreaLevelAdmin, areaGroupIdsFor } from '../middleware/auth.js';
import { ageOverMatch, currentMemberMatch } from '../utils/ageOver.js';

/**
 * Data for the three admin dashboards, scoped down the hierarchy:
 *
 *   state    → every member; children are districts
 *   district → one district; children are its areas (groups)
 *   area     → the admin's area groups; children only when the area spans >1 group
 *
 * A state admin may drill into one district (`districtId`) and gets exactly the
 * district-level view. Other roles can never widen their scope.
 *
 * "Reporting" = the admin's district or area submitted its monthly report. "Complete profile" = DOB, blood group, profession and
 * education all filled in.
 */

const ACTIVITY_MONTHS = 6;
// An admin counts as "reporting" if their scope submitted a report this month or last.
const REPORTING_MONTHS = 2;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PROFILE_FIELDS = [
  { field: 'dateOfBirth', label: 'Date of birth' },
  { field: 'bloodGroup', label: 'Blood group' },
  { field: 'profession', label: 'Profession' },
  { field: 'education', label: 'Education' },
];

/** The last `count` calendar months ending with `now`'s (IST) month, oldest first. */
export function lastMonths(now, count) {
  const { year: nowYear, month: nowMonth } = orgYearMonth(now);
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(nowYear, nowMonth - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    months.push({
      key: `${year}-${String(month).padStart(2, '0')}`,
      // Full year — "Sep 26" reads as 26 September.
      label: `${MONTH_LABELS[month - 1]} ${year}`,
      year,
      month,
    });
  }
  return months;
}

/** Month series zero-filled from aggregate rows shaped { _id: { year, month }, count }. */
export function fillMonthSeries(months, rows) {
  const byKey = new Map(rows.map((r) => [`${r._id.year}-${r._id.month}`, r.count]));
  return months.map(({ key, label, year, month }) => ({ key, label, completed: byKey.get(`${year}-${month}`) || 0 }));
}

// Growth badges compare against the trailing 30 days ("from last month").
// Counts reuse the exact scope filters as the totals they sit under, so a
// badge of 0% is a real measured zero, never a placeholder.
const DELTA_WINDOW_DAYS = 30;

/**
 * Month-over-month growth percent: added-in-window over the prior total.
 * 0 added → 0 (genuine "No change"); no prior total to compare against →
 * null (badge hidden, never a fake number).
 */
export function growthPct(added, total) {
  if (added === 0) return 0;
  const prior = total - added;
  if (prior <= 0) return null;
  return Math.round((added / prior) * 100);
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** Bad drill-down request; `status` is the HTTP code to answer with. */
export class ScopeError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function districtScope(district) {
  return {
    level: 'district',
    name: district.name,
    parentName: null,
    memberFilter: { district: district._id },
    adminFilter: { district: district._id, role: { $in: ['district_admin', 'group_admin'] } },
    groupFilter: { district: district._id },
    reportFilter: { district: district._id },
    childKey: 'group',
  };
}

/** Where this admin sits in the hierarchy and which Mongo filters that implies. */
export async function resolveScope(user, { districtId } = {}) {
  if (user.role === 'state_admin') {
    if (districtId !== undefined) {
      // Only a plain 24-hex string — query params can arrive as objects ({$ne: null}).
      if (typeof districtId !== 'string' || !OBJECT_ID.test(districtId)) throw new ScopeError('Invalid district', 400);
      const district = await District.findById(districtId).select('name').lean();
      if (!district) throw new ScopeError('District not found', 404);
      return districtScope(district);
    }
    return {
      level: 'state',
      name: 'State',
      parentName: null,
      memberFilter: {},
      adminFilter: { role: { $in: ['district_admin', 'group_admin'] } },
      groupFilter: {},
      reportFilter: {},
      childKey: 'district',
    };
  }

  if (user.role === 'district_admin') {
    return districtScope(user.district);
  }

  const areaIds = isAreaLevelAdmin(user) ? await areaGroupIdsFor(user) : [];
  const groupIds = areaIds.length > 0 ? areaIds : [user.group._id];
  return {
    level: 'area',
    name: user.roleTag?.roleDescription || user.group.name,
    parentName: user.district?.name || null,
    memberFilter: { group: { $in: groupIds } },
    adminFilter: { group: { $in: groupIds }, role: 'group_admin' },
    groupFilter: { _id: { $in: groupIds } },
    reportFilter: { area: { $in: groupIds } },
    childKey: groupIds.length > 1 ? 'group' : null,
  };
}

const countWhen = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });
const isFilled = (field) => ({ $gt: [{ $strLenCP: { $trim: { input: { $toString: { $ifNull: [`$${field}`, ''] } } } } }, 0] });
const hasDob = { $eq: [{ $type: '$dateOfBirth' }, 'date'] };
const IS_COMPLETE = { $and: [hasDob, isFilled('bloodGroup'), isFilled('profession'), isFilled('education')] };

const MEMBER_COUNTERS = {
  total: { $sum: 1 },
  active: countWhen({ $eq: ['$status', 'Active'] }),
  abroad: countWhen({ $eq: ['$status', 'Abroad'] }),
  complete: countWhen(IS_COMPLETE),
};

async function memberFacets(scope, memberMatch) {
  const [result] = await Member.aggregate([
    { $match: memberMatch },
    {
      $facet: {
        totals: [{
          $group: {
            _id: null,
            ...MEMBER_COUNTERS,
            dateOfBirth: countWhen(hasDob),
            bloodGroup: countWhen(isFilled('bloodGroup')),
            profession: countWhen(isFilled('profession')),
            education: countWhen(isFilled('education')),
          },
        }],
        children: scope.childKey
          ? [{ $group: { _id: `$${scope.childKey}`, ...MEMBER_COUNTERS } }]
          : [{ $match: { $expr: false } }],
      },
    },
  ]);
  return result;
}

async function adminActivity(scope, now) {
  const months = lastMonths(now, ACTIVITY_MONTHS);
  const reportingMonths = months.slice(-REPORTING_MONTHS);
  // District and area reports in scope; the state's own report is not an admin's.
  const submitted = { ...scope.reportFilter, level: { $in: ['district', 'area'] }, submittedAt: { $ne: null } };

  const [admins, groups, trendRows, recent] = await Promise.all([
    User.find({ ...scope.adminFilter, isActive: true }).select('_id role district group roleTag adminKind').lean(),
    Group.find(scope.groupFilter).select('name district').lean(),
    MonthlyReport.aggregate([
      { $match: { ...submitted, $or: months.map(({ year, month }) => ({ year, month })) } },
      { $group: { _id: { year: '$year', month: '$month' }, count: { $sum: 1 } } },
    ]),
    MonthlyReport.find({ ...submitted, $or: reportingMonths.map(({ year, month }) => ({ year, month })) })
      .select('level district area').lean(),
  ]);

  return {
    admins,
    reporting: reportingAdminIds(admins, groups, recent),
    trend: fillMonthSeries(months, trendRows),
    window: { from: reportingMonths[0].label, to: reportingMonths[reportingMonths.length - 1].label },
  };
}

/**
 * Admins whose scope has a submitted monthly report in the window: a district
 * admin when their district's report is in, a group admin when their area's is.
 * Same-named groups in one district are one area (see areaCoverage); area-level
 * admins name their area in the role tag, other group admins sit in its group.
 */
export function reportingAdminIds(admins, groups, reports) {
  const areaKey = (district, name) => `${district}|${String(name ?? '').trim().toLowerCase()}`;
  const keyOfGroup = new Map(groups.map((g) => [String(g._id), areaKey(g.district, g.name)]));
  const districts = new Set(reports.filter((r) => r.level === 'district').map((r) => String(r.district)));
  const areas = new Set(reports.filter((r) => r.level === 'area').map((r) => keyOfGroup.get(String(r.area))).filter(Boolean));

  const reporting = new Set();
  for (const admin of admins) {
    if (admin.role === 'district_admin') {
      if (districts.has(String(admin.district))) reporting.add(String(admin._id));
      continue;
    }
    const key = isAreaLevelAdmin(admin) && admin.roleTag?.roleDescription
      ? areaKey(admin.district, admin.roleTag.roleDescription)
      : keyOfGroup.get(String(admin.group));
    if (key && areas.has(key)) reporting.add(String(admin._id));
  }
  return reporting;
}

/**
 * Admin headcount per child. District rows count district + area admins; area
 * rows count only that area's admins.
 */
export function adminsByChild(childKey, admins, reporting) {
  const byChild = new Map();
  if (!childKey) return byChild;
  for (const admin of admins) {
    if (childKey === 'group' && admin.role !== 'group_admin') continue;
    const key = admin[childKey] ? String(admin[childKey]) : null;
    if (!key) continue;
    const entry = byChild.get(key) || { admins: 0, reporting: 0 };
    entry.admins += 1;
    if (reporting.has(String(admin._id))) entry.reporting += 1;
    byChild.set(key, entry);
  }
  return byChild;
}

/**
 * Areas (groups) in scope, and which of them have no active area admin. Same-named
 * groups in one district are one area (see areaGroupIdsFor), so an admin on any of
 * them staffs all of them.
 */
export function areaCoverage(groups, admins) {
  const areaKey = (g) => `${g.district}|${String(g.name ?? '').trim().toLowerCase()}`;
  const byId = new Map(groups.map((g) => [String(g._id), g]));
  const staffedAreas = new Set(
    admins
      .filter((a) => a.role === 'group_admin' && a.group && byId.has(String(a.group)))
      .map((a) => areaKey(byId.get(String(a.group)))),
  );
  const isStaffed = (g) => staffedAreas.has(areaKey(g));
  const byDistrict = new Map();
  let withoutAdmin = 0;
  for (const g of groups) {
    const key = String(g.district);
    const entry = byDistrict.get(key) || { areas: 0, withoutAdmin: 0 };
    entry.areas += 1;
    if (!isStaffed(g)) {
      entry.withoutAdmin += 1;
      withoutAdmin += 1;
    }
    byDistrict.set(key, entry);
  }
  return { total: groups.length, withoutAdmin, byDistrict, isStaffed };
}

export async function buildDashboardOverview(user, { districtId, now = new Date() } = {}) {
  const scope = await resolveScope(user, { districtId });
  const since = new Date(now.getTime() - DELTA_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  // Every member figure counts current members only; archived (age over) ones get
  // their own count, and only on the state admin's own state-wide view.
  const memberMatch = { ...scope.memberFilter, ...currentMemberMatch(now) };
  const showArchived = user.role === 'state_admin' && scope.level === 'state';
  const [facets, groups, districts, activity, membersAdded, areasAdded, adminsAdded, reportForms, archived] = await Promise.all([
    memberFacets(scope, memberMatch),
    // Deactivated units drop out, as in the district/group listings.
    Group.find({ ...scope.groupFilter, isActive: { $ne: false } }).select('name district').lean(),
    scope.childKey === 'district' ? District.find({ isActive: { $ne: false } }).select('name').lean() : Promise.resolve([]),
    adminActivity(scope, now),
    // Same scope filters as the totals above, plus the trailing window.
    Member.countDocuments({ ...memberMatch, createdAt: { $gte: since } }),
    Group.countDocuments({ ...scope.groupFilter, isActive: { $ne: false }, createdAt: { $gte: since } }),
    User.countDocuments({ ...scope.adminFilter, isActive: true, createdAt: { $gte: since } }),
    // Published district/area forms. With none, "0 reporting" means nothing was asked yet.
    ensureForms().then(() => ReportForm.countDocuments({ level: { $in: ['district', 'area'] }, version: { $gt: 0 } })),
    showArchived ? Member.countDocuments({ ...scope.memberFilter, ...ageOverMatch(now) }) : Promise.resolve(null),
  ]);

  const totals = facets.totals[0] || { total: 0, active: 0, abroad: 0, complete: 0 };
  const coverage = areaCoverage(groups, activity.admins);
  const memberRows = new Map(facets.children.map((c) => [String(c._id), c]));
  const adminRows = adminsByChild(scope.childKey, activity.admins, activity.reporting);

  const children = scope.childKey === 'district' ? districts : scope.childKey === 'group' ? groups : [];
  const childRows = children
    .map((c) => {
      const id = String(c._id);
      const m = memberRows.get(id) || { total: 0, active: 0, abroad: 0, complete: 0 };
      const a = adminRows.get(id) || { admins: 0, reporting: 0 };
      const areaStats = scope.childKey === 'district'
        ? coverage.byDistrict.get(id) || { areas: 0, withoutAdmin: 0 }
        : { areas: 1, withoutAdmin: coverage.isStaffed(c) ? 0 : 1 };
      return {
        id,
        name: c.name,
        total: m.total,
        active: m.active,
        abroad: m.abroad,
        other: m.total - m.active - m.abroad,
        completeProfiles: m.complete,
        areas: areaStats.areas,
        areasWithoutAdmin: areaStats.withoutAdmin,
        admins: a.admins,
        reportingAdmins: a.reporting,
      };
    })
    .sort((x, y) => y.total - x.total || x.name.localeCompare(y.name));

  const adminCounts = { district: 0, area: 0, reportingArea: 0 };
  for (const admin of activity.admins) {
    if (admin.role === 'district_admin') {
      adminCounts.district += 1;
    } else {
      adminCounts.area += 1;
      if (activity.reporting.has(String(admin._id))) adminCounts.reportingArea += 1;
    }
  }

  return {
    scope: { level: scope.level, name: scope.name, parentName: scope.parentName },
    generatedAt: now.toISOString(),
    members: {
      total: totals.total,
      active: totals.active,
      abroad: totals.abroad,
      other: totals.total - totals.active - totals.abroad,
      // null outside the state admin's state-wide view.
      archived,
    },
    admins: { ...adminCounts, total: activity.admins.length, reporting: activity.reporting.size },
    areas: { total: coverage.total, withoutAdmin: coverage.withoutAdmin },
    profiles: {
      total: totals.total,
      complete: totals.complete,
      fields: PROFILE_FIELDS.map(({ field, label }) => ({ field, label, filled: totals[field] || 0 })),
    },
    children: {
      level: scope.childKey === 'district' ? 'district' : scope.childKey === 'group' ? 'area' : null,
      rows: childRows,
    },
    activity: { months: activity.trend, reportingWindow: activity.window, reportForms },
    deltas: {
      windowDays: DELTA_WINDOW_DAYS,
      members: { added: membersAdded, pct: growthPct(membersAdded, totals.total) },
      areas: { added: areasAdded, pct: growthPct(areasAdded, coverage.total) },
      admins: { added: adminsAdded, pct: growthPct(adminsAdded, activity.admins.length) },
    },
  };
}
