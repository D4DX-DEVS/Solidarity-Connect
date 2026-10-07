import Member from '../models/Member.js';
import Group from '../models/Group.js';
import District from '../models/District.js';
import User from '../models/User.js';
import MonthlyReport from '../models/MonthlyReport.js';
import ReportForm from '../models/ReportForm.js';
import { ensureForms, reportScopeFor } from './monthlyReports/store.js';
import { dueReportMonth, reportProgress } from './dashboardReports.js';
import { deadlineFor } from './monthlyReports/period.js';
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
 * `report` = the monthly report that is due now (last month until its deadline, then
 * this month): the viewer's own report and who below them has submitted it.
 * "Complete profile" = DOB, blood group, profession and education all filled in.
 */

// Growth badges compare against the trailing 30 days ("from last month").
// Counts reuse the exact scope filters as the totals they sit under, so a
// badge of 0% is a real measured zero, never a placeholder.
const DELTA_WINDOW_DAYS = 30;

const PROFILE_FIELDS = [
  { field: 'dateOfBirth', label: 'Date of birth' },
  { field: 'bloodGroup', label: 'Blood group' },
  { field: 'profession', label: 'Profession' },
  { field: 'education', label: 'Education' },
];

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
    districtId: district._id,
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

const activeAdmins = (scope) =>
  User.find({ ...scope.adminFilter, isActive: true }).select('_id role district group').lean();

// Report levels each dashboard counts: its own and every level below it.
const REPORT_LEVELS = { state: ['state', 'district', 'area'], district: ['district', 'area'], area: ['area'] };

/**
 * The due month's reports for this dashboard: the viewer's own (state → state report,
 * district view → that district's, area → the admin's area) and those submitted below.
 * Each level's form sets its own deadline day: the dashboard stays on last month while
 * any level it counts can still file it, and `deadline` is the viewer's own level's.
 */
async function monthlyReportStatus(user, scope, now) {
  await ensureForms();
  const levels = REPORT_LEVELS[scope.level];
  const [forms, mine] = await Promise.all([
    ReportForm.find({ level: { $in: levels } }).select('level deadlineDay').lean(),
    scope.level === 'area' ? reportScopeFor(user) : null,
  ]);
  const dayOf = (level) => forms.find((f) => f.level === level)?.deadlineDay ?? 10;
  const due = dueReportMonth(now, Math.max(...levels.map(dayOf)));
  const period = { year: due.year, month: due.month };

  let own = null;
  if (scope.level === 'state') {
    own = { scopeKey: 'state', label: 'State', canFill: user.role === 'state_admin' };
  } else if (scope.level === 'district') {
    own = { scopeKey: `district:${scope.districtId}`, label: scope.name, canFill: user.role === 'district_admin' };
  } else if (mine) {
    own = { scopeKey: mine.scopeKey, label: mine.label, canFill: mine.canFill };
  }

  const [ownReport, reports] = await Promise.all([
    own ? MonthlyReport.findOne({ scopeKey: own.scopeKey, ...period }).select('submittedAt').lean() : null,
    // An area dashboard only has its own report; others count the reports below them.
    scope.level === 'area'
      ? []
      : MonthlyReport.find({ ...scope.reportFilter, ...period, level: { $in: ['district', 'area'] }, submittedAt: { $ne: null } })
        .select('level district area').lean(),
  ]);

  return {
    period,
    deadline: deadlineFor(due.year, due.month, dayOf(scope.level)),
    closing: due.closing,
    own: own && {
      level: scope.level,
      label: own.label,
      canFill: own.canFill,
      submitted: Boolean(ownReport?.submittedAt),
      submittedAt: ownReport?.submittedAt || null,
    },
    reports,
  };
}

/**
 * Admin headcount per child. District rows count district + area admins; area
 * rows count only that area's admins.
 */
export function adminsByChild(childKey, admins) {
  const byChild = new Map();
  if (!childKey) return byChild;
  for (const admin of admins) {
    if (childKey === 'group' && admin.role !== 'group_admin') continue;
    const key = admin[childKey] ? String(admin[childKey]) : null;
    if (!key) continue;
    byChild.set(key, { admins: (byChild.get(key)?.admins || 0) + 1 });
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
  const [facets, scopeGroups, districts, admins, report, membersAdded, areasAdded, adminsAdded, archived] = await Promise.all([
    memberFacets(scope, memberMatch),
    // Deactivated units drop out, as in the district/group listings.
    Group.find({ ...scope.groupFilter, isActive: { $ne: false } }).select('name district').lean(),
    scope.childKey === 'district' ? District.find({ isActive: { $ne: false } }).select('name').lean() : Promise.resolve([]),
    activeAdmins(scope),
    monthlyReportStatus(user, scope, now),
    // Same scope filters as the totals above, plus the trailing window.
    Member.countDocuments({ ...memberMatch, createdAt: { $gte: since } }),
    Group.countDocuments({ ...scope.groupFilter, isActive: { $ne: false }, createdAt: { $gte: since } }),
    User.countDocuments({ ...scope.adminFilter, isActive: true, createdAt: { $gte: since } }),
    showArchived ? Member.countDocuments({ ...scope.memberFilter, ...ageOverMatch(now) }) : Promise.resolve(null),
  ]);

  // State view: a deactivated district's areas drop out with it, as on Reports → Consolidated.
  const activeDistricts = new Set(districts.map((d) => String(d._id)));
  const groups = scope.childKey === 'district'
    ? scopeGroups.filter((g) => activeDistricts.has(String(g.district)))
    : scopeGroups;

  const totals = facets.totals[0] || { total: 0, active: 0, abroad: 0, complete: 0 };
  const coverage = areaCoverage(groups, admins);
  const memberRows = new Map(facets.children.map((c) => [String(c._id), c]));
  const adminRows = adminsByChild(scope.childKey, admins);
  const progress = reportProgress({ districts: scope.level === 'state' ? districts : null, groups, reports: report.reports });

  const children = scope.childKey === 'district' ? districts : scope.childKey === 'group' ? groups : [];
  const childRows = children
    .map((c) => {
      const id = String(c._id);
      const m = memberRows.get(id) || { total: 0, active: 0, abroad: 0, complete: 0 };
      const a = adminRows.get(id) || { admins: 0 };
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
        // District rows: its report and its areas'; area rows: the area's. An area
        // dashboard's groups share one area report, so they carry none.
        report: scope.childKey === 'district'
          ? progress.district(id)
          : scope.level === 'district' ? progress.area(id) : undefined,
      };
    })
    .sort((x, y) => y.total - x.total || x.name.localeCompare(y.name));

  const districtAdmins = admins.filter((admin) => admin.role === 'district_admin').length;

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
    admins: { district: districtAdmins, area: admins.length - districtAdmins, total: admins.length },
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
    report: {
      year: report.period.year,
      month: report.period.month,
      deadline: report.deadline.toISOString(),
      closing: report.closing,
      own: report.own,
      districts: progress.districts,
      areas: scope.level === 'area' ? null : progress.areas,
    },
    deltas: {
      windowDays: DELTA_WINDOW_DAYS,
      members: { added: membersAdded, pct: growthPct(membersAdded, totals.total) },
      areas: { added: areasAdded, pct: growthPct(areasAdded, coverage.total) },
      admins: { added: adminsAdded, pct: growthPct(adminsAdded, admins.length) },
    },
  };
}
