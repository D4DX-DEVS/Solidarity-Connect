import express from 'express';
import PersonalTarget from '../models/PersonalTarget.js';
import UserTargetProgress from '../models/UserTargetProgress.js';
import MemberTargetProgress from '../models/MemberTargetProgress.js';
import RecurringMark from '../models/RecurringMark.js';
import User from '../models/User.js';
import Member from '../models/Member.js';
import Group from '../models/Group.js';
import District from '../models/District.js';
import { authenticate, authorize } from '../middleware/auth.js';

// Cache all district names (id -> name) for fallback when populate fails due to stale refs
let districtNameCache = null;
let districtNameCacheExpiry = 0;
async function getDistrictNameMap() {
  const now = Date.now();
  if (districtNameCache && now < districtNameCacheExpiry) return districtNameCache;

  districtNameCache = {};

  // Primary: live district documents
  const districts = await District.find({}).select('name').lean();
  for (const d of districts) {
    districtNameCache[d._id.toString()] = d.name;
  }

  // Secondary: resolve stale/orphan IDs by finding users named "X District Admin"
  // whose district field references an ID not in the live districts collection
  const daUsers = await User.find({
    role: 'district_admin'
  }).select('name district').lean();

  for (const u of daUsers) {
    if (u.district) {
      const id = u.district.toString();
      if (!districtNameCache[id]) {
        const match = u.name.match(/^(.+?)\s+District Admin$/i);
        if (match) districtNameCache[id] = match[1];
      }
    }
  }

  // Tertiary: for any remaining unresolved IDs, try to find the district name
  // by looking at groups that reference this district, or other lookup methods
  const unresolvedIds = [];
  for (const u of daUsers) {
    if (u.district) {
      const id = u.district.toString();
      if (!districtNameCache[id]) unresolvedIds.push(id);
    }
  }
  if (unresolvedIds.length > 0) {
    const uniqueUnresolved = [...new Set(unresolvedIds)];
    // Try groups collection
    const groups = await Group.find({ district: { $in: uniqueUnresolved } })
      .select('district')
      .populate('district', 'name')
      .limit(50)
      .lean();
    for (const g of groups) {
      if (g.district?.name) {
        const id = g.district._id.toString();
        if (!districtNameCache[id]) districtNameCache[id] = g.district.name;
      }
    }
    // If still unresolved, try matching by finding group_admins with same district who have a populated group
    for (const uid of uniqueUnresolved) {
      if (districtNameCache[uid]) continue;
      const groupAdmin = await User.findOne({ district: uid, role: 'group_admin' })
        .select('group')
        .populate({ path: 'group', select: 'name district', populate: { path: 'district', select: 'name' } })
        .lean();
      if (groupAdmin?.group?.district?.name) {
        districtNameCache[uid] = groupAdmin.group.district.name;
      }
    }
  }

  districtNameCacheExpiry = now + 5 * 60 * 1000; // 5 min cache
  return districtNameCache;
}

// Resolve district name from populated object, group's district, or cached fallback
function resolveDistrictName(entity, districtMap) {
  // If district was populated (has .name), use it
  if (entity.district?.name) return entity.district.name;
  // If group has populated district
  if (entity.group?.district?.name) return entity.group.district.name;
  // Fallback: resolve raw ObjectId via cached map (handles stale refs)
  const rawId = entity.district?.toString?.();
  if (rawId && districtMap[rawId]) return districtMap[rawId];
  // Last resort: for district_admin users, extract from their name pattern
  if (entity.role === 'district_admin' && entity.name) {
    const match = entity.name.match(/^(.+?)\s+District Admin$/i);
    if (match) return match[1];
  }
  // If user has a district ID but it can't be resolved, label it
  if (rawId) return 'Unknown District';
  return '';
}

const router = express.Router();

// Map frontend userType to targetAudience values
const USER_TYPE_TO_AUDIENCES = {
  state_admin: ['state_admins', 'all_users'],
  district_admin: ['district_admins', 'all_users'],
  area_admin: ['area_admins', 'group_and_area_admins', 'all_users'],
  unit_admin: ['group_admins', 'group_and_area_admins', 'all_users'],
  members: ['members_only', 'all_users']
};

// @route   GET /api/consolidation/targets
// @desc    Get targets available for a specific user type
// @access  state_admin, district_admin, group_admin with view_reports
router.get('/targets', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    const { userType } = req.query;

    if (!userType || !USER_TYPE_TO_AUDIENCES[userType]) {
      return res.status(400).json({
        success: false,
        message: 'Valid userType is required: state_admin, district_admin, area_admin, unit_admin, members'
      });
    }

    const audiences = USER_TYPE_TO_AUDIENCES[userType];

    const targets = await PersonalTarget.find({
      targetAudience: { $in: audiences },
      status: 'active'
    })
      .select('title category isRecurring recurringFrequency targetValue unit startDate endDate targetAudience')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: targets });
  } catch (error) {
    console.error('Consolidation targets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch targets' });
  }
});

// @route   GET /api/consolidation/report
// @desc    Get consolidation report for selected filters
// @access  state_admin, district_admin, group_admin with view_reports
router.get('/report', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    const { userType, targetId, districtId, groupId, dateFrom, dateTo } = req.query;

    if (!userType || !targetId) {
      return res.status(400).json({
        success: false,
        message: 'userType and targetId are required'
      });
    }

    // Fetch the target
    const target = await PersonalTarget.findById(targetId)
      .select('title category isRecurring recurringFrequency targetValue unit startDate endDate targetAudience')
      .lean();

    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    // Apply role-based access restrictions
    const accessFilter = buildAccessFilter(req.user, districtId, groupId);

    let result;
    if (target.isRecurring) {
      result = await getRecurringConsolidation(target, userType, accessFilter, dateFrom, dateTo);
    } else {
      result = await getRegularConsolidation(target, userType, accessFilter, dateFrom, dateTo);
    }

    res.status(200).json({
      success: true,
      data: {
        target: {
          _id: target._id,
          title: target.title,
          category: target.category,
          isRecurring: target.isRecurring,
          recurringFrequency: target.recurringFrequency,
          targetValue: target.targetValue,
          unit: target.unit
        },
        ...result
      }
    });
  } catch (error) {
    console.error('Consolidation report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate consolidation report' });
  }
});

// Build access filter based on the logged-in user's role
function buildAccessFilter(user, districtId, groupId) {
  const filter = {};

  // state_admin can see everything, optionally filter by district/group
  if (user.role === 'state_admin') {
    if (districtId && districtId !== 'all') filter.district = districtId;
    if (groupId && groupId !== 'all') filter.group = groupId;
    return filter;
  }

  // district_admin limited to own district
  if (user.role === 'district_admin') {
    filter.district = user.district?._id || user.district;
    if (groupId && groupId !== 'all') filter.group = groupId;
    return filter;
  }

  // group_admin limited to own group scope
  if (user.role === 'group_admin') {
    const districtFromGroup = user.group?.district?._id || user.group?.district;
    filter.district = districtFromGroup || user.district?._id || user.district;
    filter.group = user.group?._id || user.group;
    return filter;
  }

  return filter;
}

// Handle regular (non-recurring) target consolidation
async function getRegularConsolidation(target, userType, accessFilter, dateFrom, dateTo) {
  const isMembers = userType === 'members';

  if (isMembers) {
    return getRegularMemberConsolidation(target, accessFilter, dateFrom, dateTo);
  }
  return getRegularAdminConsolidation(target, userType, accessFilter, dateFrom, dateTo);
}

// Regular targets for admin users (state_admin, district_admin, area_admin, unit_admin)
async function getRegularAdminConsolidation(target, userType, accessFilter, dateFrom, dateTo) {
  // Find users matching the user type
  const userQuery = buildUserQuery(userType, accessFilter);
  const users = await User.find(userQuery)
    .select('name phone role roleTag district group')
    .populate({ path: 'group', select: 'name district', populate: { path: 'district', select: 'name' } })
    .lean();

  if (users.length === 0) {
    return { summary: { totalUsers: 0, completed: 0, pending: 0, completionRate: 0 }, monthlyBreakdown: [], users: { completed: [], pending: [] } };
  }

  const districtMap = await getDistrictNameMap();
  const userIds = users.map(u => u._id);

  // Fetch progress records
  const progressQuery = { user: { $in: userIds }, personalTarget: target._id };
  if (dateFrom || dateTo) {
    progressQuery.updatedAt = {};
    if (dateFrom) progressQuery.updatedAt.$gte = new Date(dateFrom);
    if (dateTo) progressQuery.updatedAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  const progressRecords = await UserTargetProgress.find(progressQuery).lean();
  const progressMap = {};
  for (const p of progressRecords) {
    progressMap[p.user.toString()] = p;
  }

  // Categorize users
  const completed = [];
  const pending = [];

  for (const user of users) {
    const progress = progressMap[user._id.toString()];
    const userData = {
      userId: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      roleTag: user.roleTag?.type,
      district: resolveDistrictName(user, districtMap),
      group: user.group?.name || ''
    };

    if (progress && progress.status === 'completed') {
      completed.push({ ...userData, completedAt: progress.completedAt || progress.updatedAt });
    } else {
      pending.push({ ...userData, lastActivity: progress?.updatedAt || null, status: progress?.status || 'not_started' });
    }
  }

  // Monthly breakdown based on completion dates
  const monthlyBreakdown = buildMonthlyBreakdown(completed, pending, dateFrom, dateTo);

  return {
    summary: {
      totalUsers: users.length,
      completed: completed.length,
      pending: pending.length,
      completionRate: users.length > 0 ? Math.round((completed.length / users.length) * 100 * 10) / 10 : 0
    },
    monthlyBreakdown,
    users: { completed, pending }
  };
}

// Regular targets for members
async function getRegularMemberConsolidation(target, accessFilter, dateFrom, dateTo) {
  // Find members matching filters
  const memberQuery = { status: 'Active', isApproved: true };
  if (accessFilter.district) memberQuery.district = accessFilter.district;
  if (accessFilter.group) memberQuery.group = accessFilter.group;

  const members = await Member.find(memberQuery)
    .select('name phone district group')
    .populate('district', 'name')
    .populate('group', 'name')
    .lean();

  if (members.length === 0) {
    return { summary: { totalUsers: 0, completed: 0, pending: 0, completionRate: 0 }, monthlyBreakdown: [], users: { completed: [], pending: [] } };
  }

  const memberIds = members.map(m => m._id);

  // Fetch progress records
  const progressQuery = { member: { $in: memberIds }, personalTarget: target._id };
  if (dateFrom || dateTo) {
    progressQuery.updatedAt = {};
    if (dateFrom) progressQuery.updatedAt.$gte = new Date(dateFrom);
    if (dateTo) progressQuery.updatedAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
  }

  const progressRecords = await MemberTargetProgress.find(progressQuery).lean();
  const progressMap = {};
  for (const p of progressRecords) {
    progressMap[p.member.toString()] = p;
  }

  const completed = [];
  const pending = [];

  for (const member of members) {
    const progress = progressMap[member._id.toString()];
    const userData = {
      userId: member._id,
      name: member.name,
      phone: member.phone,
      district: member.district?.name || '',
      group: member.group?.name || ''
    };

    if (progress && progress.status === 'completed') {
      completed.push({ ...userData, completedAt: progress.completedAt || progress.updatedAt });
    } else {
      pending.push({
        ...userData,
        lastActivity: progress?.updatedAt || null,
        status: progress?.status || 'not_started',
        progressPercentage: progress?.progressPercentage || 0
      });
    }
  }

  const monthlyBreakdown = buildMonthlyBreakdown(completed, pending, dateFrom, dateTo);

  return {
    summary: {
      totalUsers: members.length,
      completed: completed.length,
      pending: pending.length,
      completionRate: members.length > 0 ? Math.round((completed.length / members.length) * 100 * 10) / 10 : 0
    },
    monthlyBreakdown,
    users: { completed, pending }
  };
}

// Handle recurring target consolidation
async function getRecurringConsolidation(target, userType, accessFilter, dateFrom, dateTo) {
  const isMembers = userType === 'members';

  // Determine date range for recurring marks
  let fromYear, fromMonth, toYear, toMonth;
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    fromYear = from.getFullYear();
    fromMonth = from.getMonth() + 1;
    toYear = to.getFullYear();
    toMonth = to.getMonth() + 1;
  } else {
    // All time: use target start date to current month (capped)
    const start = new Date(target.startDate);
    const now = new Date();
    const end = target.endDate ? new Date(target.endDate) : now;
    fromYear = start.getFullYear();
    fromMonth = start.getMonth() + 1;
    // Cap end date to current month so we don't show future months
    const cappedEnd = end > now ? now : end;
    toYear = cappedEnd.getFullYear();
    toMonth = cappedEnd.getMonth() + 1;
  }

  // Get total periods in range
  const periods = getPeriodsInRange(fromYear, fromMonth, toYear, toMonth);

  // Fetch users/members
  let entities;
  if (isMembers) {
    const memberQuery = { status: 'Active', isApproved: true };
    if (accessFilter.district) memberQuery.district = accessFilter.district;
    if (accessFilter.group) memberQuery.group = accessFilter.group;
    entities = await Member.find(memberQuery)
      .select('name phone district group')
      .populate('district', 'name')
      .populate('group', 'name')
      .lean();
  } else {
    const userQuery = buildUserQuery(userType, accessFilter);
    entities = await User.find(userQuery)
      .select('name phone role roleTag district group')
      .populate({ path: 'group', select: 'name district', populate: { path: 'district', select: 'name' } })
      .lean();
  }

  if (entities.length === 0) {
    return { summary: { totalUsers: 0, completed: 0, pending: 0, completionRate: 0 }, monthlyBreakdown: [], users: { completed: [], pending: [] } };
  }

  const districtMap = await getDistrictNameMap();
  const entityIds = entities.map(e => e._id);

  // Fetch recurring marks within date range
  const markQuery = {
    personalTarget: target._id,
    user: { $in: entityIds },
    completed: true
  };

  // Build period filter
  const periodConditions = [];
  for (const period of periods) {
    periodConditions.push({ year: period.year, month: period.month });
  }
  if (periodConditions.length > 0) {
    markQuery.$or = periodConditions;
  }

  const marks = await RecurringMark.find(markQuery).lean();

  // Group marks by user
  const marksByUser = {};
  for (const mark of marks) {
    const uid = mark.user.toString();
    if (!marksByUser[uid]) marksByUser[uid] = [];
    marksByUser[uid].push({ year: mark.year, month: mark.month });
  }

  // Categorize users
  const completed = [];
  const pending = [];
  const totalPeriods = periods.length;

  // Monthly breakdown data
  const monthlyData = {};
  for (const period of periods) {
    const key = `${period.year}-${period.month}`;
    monthlyData[key] = { month: period.month, year: period.year, total: entities.length, completed: 0, pending: entities.length };
  }

  for (const entity of entities) {
    const userMarks = marksByUser[entity._id.toString()] || [];
    const completedMonths = userMarks.map(m => `${m.year}-${m.month}`);

    // Update monthly data
    for (const cm of completedMonths) {
      if (monthlyData[cm]) {
        monthlyData[cm].completed++;
        monthlyData[cm].pending--;
      }
    }

    const userData = {
      userId: entity._id,
      name: entity.name,
      phone: entity.phone,
      role: entity.role || 'member',
      roleTag: entity.roleTag?.type,
      district: resolveDistrictName(entity, districtMap),
      group: entity.group?.name || '',
      completedMonths,
      completedCount: completedMonths.length,
      totalPeriods
    };

    // "Completed" means all periods in range are marked
    if (completedMonths.length >= totalPeriods) {
      completed.push({ ...userData, completedAt: null });
    } else {
      pending.push({ ...userData, lastActivity: null, status: completedMonths.length > 0 ? 'partial' : 'not_started' });
    }
  }

  // Build monthly breakdown
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthlyBreakdown = periods.map(p => {
    const key = `${p.year}-${p.month}`;
    const data = monthlyData[key];
    return {
      month: p.month,
      year: p.year,
      label: `${monthNames[p.month]} ${p.year}`,
      total: data.total,
      completed: data.completed,
      pending: data.pending,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100 * 10) / 10 : 0
    };
  });

  return {
    summary: {
      totalUsers: entities.length,
      completed: completed.length,
      pending: pending.length,
      completionRate: entities.length > 0 ? Math.round((completed.length / entities.length) * 100 * 10) / 10 : 0
    },
    monthlyBreakdown,
    users: { completed, pending }
  };
}

// Build user query for admin user types
function buildUserQuery(userType, accessFilter) {
  const query = { isActive: true };

  switch (userType) {
    case 'state_admin':
      query.role = 'state_admin';
      break;
    case 'district_admin':
      query.role = 'district_admin';
      break;
    case 'area_admin':
      query.role = 'group_admin';
      query['roleTag.type'] = 'area';
      break;
    case 'unit_admin':
      query.role = 'group_admin';
      query['roleTag.type'] = 'unit';
      break;
    default:
      break;
  }

  if (accessFilter.district) query.district = accessFilter.district;
  if (accessFilter.group) query.group = accessFilter.group;

  return query;
}

// Generate month-year periods within a range
function getPeriodsInRange(fromYear, fromMonth, toYear, toMonth) {
  const periods = [];
  let year = fromYear;
  let month = fromMonth;

  while (year < toYear || (year === toYear && month <= toMonth)) {
    periods.push({ year, month });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return periods;
}

// Build monthly breakdown for regular targets
function buildMonthlyBreakdown(completed, pending, dateFrom, dateTo) {
  if (!dateFrom || !dateTo) return [];

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const fromYear = from.getFullYear();
  const fromMonth = from.getMonth() + 1;
  const toYear = to.getFullYear();
  const toMonth = to.getMonth() + 1;

  // Only show monthly breakdown if range spans more than 1 month
  const periods = getPeriodsInRange(fromYear, fromMonth, toYear, toMonth);
  if (periods.length <= 1) return [];

  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return periods.map(p => {
    const completedInMonth = completed.filter(u => {
      if (!u.completedAt) return false;
      const d = new Date(u.completedAt);
      return d.getFullYear() === p.year && (d.getMonth() + 1) === p.month;
    }).length;

    const total = completed.length + pending.length;
    return {
      month: p.month,
      year: p.year,
      label: `${monthNames[p.month]} ${p.year}`,
      total,
      completed: completedInMonth,
      pending: total - completedInMonth,
      completionRate: total > 0 ? Math.round((completedInMonth / total) * 100 * 10) / 10 : 0
    };
  });
}

export default router;
