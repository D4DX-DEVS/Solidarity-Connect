import express from 'express';
import mongoose from 'mongoose';
import otpService from '../services/otpService.js';
import Member from '../models/Member.js';
import Group from '../models/Group.js';
import District from '../models/District.js';
import TransferRequest from '../models/TransferRequest.js';
import { authenticate, requireRole, isAreaLevelAdmin, areaGroupIdsFor, leaderEditScopeFor, leaderEditError } from '../middleware/auth.js';
import {
  createMemberValidation,
  updateMemberValidation,
  paginationValidation,
  searchValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body, query } from 'express-validator';
import { AGE_OVER_STATUS, ageCutoff, ageOn, ageOverCutoff, ageOverMatch, agedOutSince, currentMemberMatch, hiddenAsArchived, isAgeOver, notAgeOverMatch } from '../utils/ageOver.js';
import { attachPersonLinks, leaderRecordError, loadPersonRecords, planPersonSync, savePersonEdit } from '../services/personRecords.js';

const router = express.Router();

// Archived (age over) members, when ARCHIVE_RESTRICTED, belong to the state admin
// alone; every other role is answered as if the record were not there.
const hiddenFrom = (user, member) => hiddenAsArchived(user, member);
const ARCHIVED_NOT_FOUND = { success: false, message: 'Member not found' };

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ARCHIVE_SORTS = { name: { name: 1 }, oldest: { dateOfBirth: 1, name: 1 }, youngest: { dateOfBirth: -1, name: 1 } };
// Archives filters. Role: any leader, non-leaders, or one role type (primary or extra).
const ARCHIVE_ROLES = ['leader', 'none', 'state', 'district', 'area', 'unit', 'murabi', 'coordinator'];
const ARCHIVE_AGES = ['38', '39', '40', '41', '42plus'];
const ARCHIVE_PERIODS = ['month', 'year']; // aged out this month / this year

function archiveRoleMatch(role) {
  if (role === 'leader') return { isLeader: true };
  if (role === 'none') return { isLeader: { $ne: true } };
  return { isLeader: true, $or: [{ 'roleTag.type': role }, { 'extraRoleTags.type': role }] };
}

function archiveAgeMatch(age, now) {
  if (age === '42plus') return { dateOfBirth: { $lte: ageCutoff(42, now) } };
  const years = Number(age);
  return { dateOfBirth: { $lte: ageCutoff(years, now), $gt: ageCutoff(years + 1, now) } };
}

// @route   GET /api/members
// @desc    Get all members with filtering and pagination
// @access  Private
router.get('/', authenticate, paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      status,
      district,
      group,
      search,
      isApproved,
      includeStats = 'true',
      forLeaderAssignment,
      isLeader,
      withLinks
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100); // Between 1 and 100

    // Build base filter based on user role
    // When forLeaderAssignment=true, only state_admin skips scope restriction
    let baseFilter = {};
    const skipScope = forLeaderAssignment === 'true' && req.user.role === 'state_admin';
    
    if (!skipScope) {
      if (req.user.role === 'group_admin') {
        // Area-level admins (area/murabi/coordinator) manage multiple groups in their area
        const isArea = isAreaLevelAdmin(req.user);
        const areaName = req.user.roleTag?.roleDescription;

        if (isArea && areaName && req.user.district) {
          // Anchored — "ALAPPUZHA" must not match "AMBALAPPUZHA".
          const areaRegex = new RegExp(`^${areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
          const areaGroups = await Group.find({
            district: req.user.district._id,
            name: areaRegex
          }).select('_id').lean();
          const groupIds = areaGroups.map(g => g._id);

          if (groupIds.length > 0) {
            baseFilter.group = { $in: groupIds };
          } else if (req.user.group) {
            baseFilter.group = req.user.group._id;
          } else {
            return res.status(500).json({ success: false, message: 'User account misconfigured: no group assigned' });
          }
        } else if (req.user.group) {
          baseFilter.group = req.user.group._id;
        } else {
          return res.status(500).json({ success: false, message: 'User account misconfigured: no group assigned' });
        }
      } else if (req.user.role === 'district_admin') {
        // District admin can only see their district members
        if (!req.user.district) {
          return res.status(500).json({ success: false, message: 'User account misconfigured: no district assigned' });
        }
        baseFilter.district = req.user.district._id;
      }
      // State admin can see all members (no additional filter)
    }

    // Archived (age over) members show here flagged ageOver (also on the Archives
    // page); with ARCHIVE_RESTRICTED only the state admin's list keeps them.
    if (!skipScope && req.user.role !== 'state_admin') Object.assign(baseFilter, currentMemberMatch());
    const now = new Date();

    // Build query filter (includes all filters for member list)
    let filter = { ...baseFilter };

    // Apply additional filters for member list. "Age over" = computed archive rule;
    // any other status lists current members only.
    // $and keeps the archive $or clear of the search $or below.
    if (status === 'Age over') filter.$and = [ageOverMatch(now)];
    else if (status) Object.assign(filter, { status }, notAgeOverMatch(now));
    if (district && req.user.role === 'state_admin') filter.district = district;
    if (group && ['state_admin', 'district_admin'].includes(req.user.role)) filter.group = group;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    // Role Management's leader-status filter; $ne keeps records that never had the field.
    if (isLeader === 'true') filter.isLeader = true;
    if (isLeader === 'false') filter.isLeader = { $ne: true };

    // Build statistics filter (excludes search and status, but includes district/group filters)
    let statsFilter = { ...baseFilter };
    if (district && req.user.role === 'state_admin') {
      statsFilter.district = mongoose.Types.ObjectId.isValid(district) 
        ? new mongoose.Types.ObjectId(district) 
        : district;
    }
    if (group && ['state_admin', 'district_admin'].includes(req.user.role)) {
      statsFilter.group = mongoose.Types.ObjectId.isValid(group) 
        ? new mongoose.Types.ObjectId(group) 
        : group;
    }

    // Search functionality - optimized for better performance
    if (search) {
      const searchTerm = search.trim();
      if (searchTerm.length >= 2) { // Only search if at least 2 characters
        // Use text index if available, otherwise use regex
        if (searchTerm.match(/^\+?[0-9]+$/)) {
          // If search looks like a phone number, search phone field specifically
          filter.phone = { $regex: searchTerm, $options: 'i' };
        } else {
          // For text search, use $or with regex
          filter.$or = [
            { name: { $regex: searchTerm, $options: 'i' } },
            { phone: { $regex: searchTerm, $options: 'i' } },
            { email: { $regex: searchTerm, $options: 'i' } }
          ];
        }
      }
    }

    const options = {
      page: pageNum,
      limit: limitNum,
      sort,
      // Only fields the list consumers render (Members card + Excel/PDF export,
      // UserManagement, RoleManagement, BaithulEnrollDialog) — keeps DB reads and payloads small.
      // address = unit name.
      select: 'name phone email status district group address dateOfBirth bloodGroup isApproved createdAt isLeader roleTag extraRoleTags baithulMaal profession',
      populate: [
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' }
      ],
      lean: false, // Keep as false to maintain mongoose document methods
      leanWithId: false
    };

    const result = await Member.paginate(filter, options);

    // Get transfer request status for each member
    const memberIds = result.docs.map(member => member._id);
    const transferRequests = await TransferRequest.find({
      member: { $in: memberIds },
      status: { $in: ['pending', 'district_approved'] }
    }).select('member status targetDistrict targetGroup');

    // Create a map of member ID to transfer request
    const transferRequestMap = {};
    transferRequests.forEach(request => {
      transferRequestMap[request.member.toString()] = {
        status: request.status,
        targetDistrict: request.targetDistrict,
        targetGroup: request.targetGroup
      };
    });

    // Add transfer request status to each member
    const membersWithTransferStatus = result.docs.map(member => ({
      ...member.toObject(),
      ageOver: isAgeOver(member, now),
      transferRequest: transferRequestMap[member._id.toString()] || null
    }));
    // Role Management: admin logins on the same phone, and where the leader roles are edited.
    if (withLinks === 'true' && ['state_admin', 'district_admin', 'group_admin'].includes(req.user.role)) {
      await attachPersonLinks(membersWithTransferStatus);
    }

    // Calculate statistics only when requested (skip on pagination to improve speed)
    let stats = [];
    if (includeStats !== 'false') {
      // Per-status counts are current members only; archived ones count once, as ageOver.
      const cutoff = ageOverCutoff(now);
      const archived = { $or: [
        { $eq: ['$status', AGE_OVER_STATUS] },
        { $and: [{ $eq: [{ $type: '$dateOfBirth' }, 'date'] }, { $lte: ['$dateOfBirth', cutoff] }] }
      ] };
      const current = (s) => ({ $sum: { $cond: [{ $and: [{ $eq: ['$status', s] }, { $not: [archived] }] }, 1, 0] } });
      stats = await Member.aggregate([
        { $match: statsFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: current('Active'),
            inactive: current('Inactive'),
            abroad: current('Abroad'),
            applicant: current('Applicant'),
            dismissed: current('Dismissed'),
            ageOver: { $sum: { $cond: [archived, 1, 0] } },
            approved: { $sum: { $cond: ['$isApproved', 1, 0] } },
            pending: { $sum: { $cond: [{ $not: '$isApproved' }, 1, 0] } }
          }
        }
      ]);
    }

    // Disable caching to avoid stale approval/status state after updates
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Total-Count': result.totalDocs.toString(),
      'X-Page-Count': result.totalPages.toString(),
      'X-Current-Page': result.page.toString()
    });

    res.status(200).json({
      success: true,
      data: membersWithTransferStatus,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
        offset: (result.page - 1) * result.limit,
        nextPage: result.hasNextPage ? result.page + 1 : null,
        prevPage: result.hasPrevPage ? result.page - 1 : null
      },
      statistics: stats[0] || {
        total: 0, active: 0, inactive: 0, abroad: 0,
        applicant: 0, dismissed: 0, ageOver: 0, approved: 0, pending: 0
      }
    });

  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch members'
    });
  }
});

// @route   GET /api/members/archives
// @desc    Archived (age over) members — aged 38 and above, or status set to "Age over"
// @access  Private (state_admin)
router.get('/archives',
  authenticate,
  requireRole(['state_admin']),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sort').optional().isIn(Object.keys(ARCHIVE_SORTS)).withMessage('Invalid sort'),
  query('district').optional().isMongoId().withMessage('Invalid district'),
  query('group').optional().isMongoId().withMessage('Invalid area'),
  query('role').optional().isIn(ARCHIVE_ROLES).withMessage('Invalid role'),
  query('age').optional().isIn(ARCHIVE_AGES).withMessage('Invalid age'),
  query('period').optional().isIn(ARCHIVE_PERIODS).withMessage('Invalid period'),
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search is too long'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const now = new Date();
      const { district, group, role, age, period, search = '', sort = 'name' } = req.query;
      // ?district[]=a&district[]=b passes isMongoId per item — one value each
      if ([district, group, role, age, period].some((v) => v !== undefined && typeof v !== 'string')) {
        return res.status(400).json({ success: false, message: 'Invalid filter' });
      }
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;

      // Summary counts follow the place filters only, so the cards stay put while filtering further
      const scope = {};
      if (district) scope.district = new mongoose.Types.ObjectId(district);
      if (group) scope.group = new mongoose.Types.ObjectId(group);
      const and = [ageOverMatch(now)];
      if (role) and.push(archiveRoleMatch(role));
      if (age) and.push(archiveAgeMatch(age, now));
      if (period) and.push({ dateOfBirth: { $gte: agedOutSince(period, now) } });
      if (search.length >= 2) {
        const pattern = new RegExp(escapeRegex(search), 'i');
        and.push({ $or: [{ name: pattern }, { phone: pattern }] });
      }
      const filter = { ...scope, $and: and };

      const onOrAfter = (since) => ({ $cond: [{ $gte: ['$dateOfBirth', since] }, 1, 0] });
      const [result, [summary]] = await Promise.all([Member.paginate(filter, {
        page,
        limit,
        sort: ARCHIVE_SORTS[sort],
        select: 'name phone status district group address dateOfBirth isLeader roleTag extraRoleTags',
        populate: [
          { path: 'district', select: 'name code' },
          { path: 'group', select: 'name code' }
        ],
        lean: true
      }), Member.aggregate([
        { $match: { ...scope, ...ageOverMatch(now) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            leaders: { $sum: { $cond: ['$isLeader', 1, 0] } },
            // A missing DOB sorts below any date, so status-only archives never count here
            thisMonth: { $sum: onOrAfter(agedOutSince('month', now)) },
            thisYear: { $sum: onOrAfter(agedOutSince('year', now)) }
          }
        }
      ])]);

      res.set('Cache-Control', 'no-store');
      res.status(200).json({
        success: true,
        // Age from today's date — the stored `age` is only refreshed when the DOB is edited.
        data: result.docs.map((m) => ({ ...m, age: ageOn(m.dateOfBirth, now) })),
        summary: {
          total: summary?.total ?? 0,
          leaders: summary?.leaders ?? 0,
          thisMonth: summary?.thisMonth ?? 0,
          thisYear: summary?.thisYear ?? 0
        },
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalDocs: result.totalDocs,
          limit: result.limit,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        }
      });
    } catch (error) {
      console.error('Get archived members error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch archived members' });
    }
  }
);

// @route   GET /api/members/user-context
// @desc    Get user's district and group context for member creation
// @access  Private
router.get('/user-context', authenticate, async (req, res) => {
  try {
    const context = {
      userRole: req.user.role,
      canSelectDistrict: req.user.role === 'state_admin',
      canSelectGroup: ['state_admin', 'district_admin'].includes(req.user.role),
      showDistrictField: req.user.role !== 'group_admin',
      showGroupField: req.user.role !== 'group_admin'
    };

    // Add permissions for UI control. Adding and editing member records is
    // state-admin only; district and area admins get a read-only view.
    context.permissions = {
      canCreateMember: req.user.role === 'state_admin',
      canEditMember: req.user.role === 'state_admin',
      canDeleteMember: req.user.role === 'state_admin',
      canApproveMember: ['state_admin', 'district_admin'].includes(req.user.role),
      canViewReports: req.user.permissions.includes('view_reports')
    };

    // Orphaned admins (missing/dangling district or group ref) must not crash here —
    // report the gap so the UI can show a "contact admin" state instead of a 500.
    const scope = (doc) => doc ? { _id: doc._id, name: doc.name, code: doc.code } : null;

    if (req.user.role === 'group_admin') {
      context.assignedDistrict = scope(req.user.district);
      context.assignedGroup = scope(req.user.group);
      context.scopeMissing = !req.user.group || !req.user.district;
    } else if (req.user.role === 'district_admin') {
      context.assignedDistrict = scope(req.user.district);
      context.scopeMissing = !req.user.district;
    }

    res.status(200).json({
      success: true,
      data: context
    });

  } catch (error) {
    console.error('Get user context error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user context'
    });
  }
});

// @route   GET /api/members/:id
// @desc    Get single member by ID
// @access  Private
router.get('/:id', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id)
      .populate('district', 'name code')
      .populate('group', 'name code district')
      .populate('createdBy', 'name phone email')
      .populate('approvedBy', 'name phone email');

    if (!member || hiddenFrom(req.user, member)) {
      return res.status(404).json(ARCHIVED_NOT_FOUND);
    }

    // Check access permissions
    if (req.user.role === 'group_admin') {
      // Area-level admins cover every group in their area, not just their own group
      const areaName = isAreaLevelAdmin(req.user) ? req.user.roleTag?.roleDescription : null;
      let allowed = req.user.group && member.group?._id.toString() === req.user.group._id.toString();

      if (!allowed && areaName && req.user.district) {
        allowed = member.district?._id.toString() === req.user.district._id.toString()
          && (member.group?.name || '').toLowerCase() === areaName.toLowerCase();
      }

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only view members from your group.'
        });
      }
    }

    if (req.user.role === 'district_admin' && member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view members from your district.'
      });
    }

    res.status(200).json({
      success: true,
      data: { ...member.toObject(), ageOver: isAgeOver(member) }
    });

  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member'
    });
  }
});

// @route   POST /api/members
// @desc    Create new member
// @access  Private
// Custom middleware to auto-assign district/group for group admins
const autoAssignDistrictGroup = (req, res, next) => {
  // ponytail: creation only. On PUT this used to force every edited member into the
  // admin's own group — which silently transferred members out of the other groups
  // an area-level admin manages. Updates validate district/group explicitly instead.
  if (req.method === 'POST' && req.user && req.user.role === 'group_admin') {
    req.body.district = req.user.district._id.toString();
    req.body.group = req.user.group._id.toString();
  }
  next();
};

// Middleware to format phone number
const formatPhoneNumber = (req, res, next) => {
  console.log('formatPhoneNumber - Before:', req.body.phone);
  if (req.body.phone) {
    // If it's 10 digits, add +91
    if (req.body.phone.match(/^[6-9]\d{9}$/)) {
      req.body.phone = `+91${req.body.phone}`;
      console.log('formatPhoneNumber - After (added +91):', req.body.phone);
    }
    // If it already has +91, keep it as is
    else if (req.body.phone.match(/^\+91[6-9]\d{9}$/)) {
      console.log('formatPhoneNumber - Already formatted:', req.body.phone);
    }
  }
  next();
};

// Only state admins add members; district and area admins are view-only.
router.post('/', authenticate, requireRole(['state_admin']), autoAssignDistrictGroup, createMemberValidation, formatPhoneNumber, async (req, res) => {
  try {
    const memberData = req.body;

    // Validate district and group access
    const group = await Group.findById(memberData.group).populate('district');
    if (!group) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const district = await District.findById(memberData.district);
    if (!district) {
      return res.status(400).json({
        success: false,
        message: 'Invalid district ID'
      });
    }

    // Ensure group belongs to the specified district
    if (group.district._id.toString() !== district._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Group does not belong to the specified district'
      });
    }

    // Check if member with same phone already exists.
    // Match all stored formats (+91-prefixed and 10-digit) so the same person
    // can't be added twice with a different phone format.
    const existingMember = await Member.findOne({
      phone: { $in: otpService.getPhoneVariants(memberData.phone) }
    });
    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: `Member with this phone number already exists (${existingMember.name})`
      });
    }

    // Prepare member data with baithulMaal
    const { monthlyBaithulMaal, ...restMemberData } = memberData;
    
    const memberPayload = {
      ...restMemberData,
      createdBy: req.user._id,
      isApproved: true // Only state admins reach here, and they auto-approve
    };

    // Add baithulMaal if provided
    if (monthlyBaithulMaal && !isNaN(monthlyBaithulMaal) && Number(monthlyBaithulMaal) > 0) {
      memberPayload.baithulMaal = {
        monthlyAmount: Number(monthlyBaithulMaal),
        totalPaid: 0
      };
    }

    // Create member
    const member = new Member(memberPayload);

    await member.save();

    // Populate the created member
    await member.populate([
      { path: 'district', select: 'name code' },
      { path: 'group', select: 'name code' },
      { path: 'createdBy', select: 'name phone' }
    ]);

    // Update group and district statistics
    await group.updateStatistics();
    await district.updateStatistics();

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: member
    });

  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create member'
    });
  }
});

// @route   PUT /api/members/:id
// @desc    Update member
// @access  Private (state_admin only — district and area admins are view-only)
router.put('/:id', authenticate, requireRole(['state_admin']), autoAssignDistrictGroup, updateMemberValidation, formatPhoneNumber, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    const updateData = req.body;

    // If phone is being updated, check for duplicates (all stored formats)
    if (updateData.phone && updateData.phone !== member.phone) {
      const existingMember = await Member.findOne({
        phone: { $in: otpService.getPhoneVariants(updateData.phone) },
        _id: { $ne: member._id }
      });
      
      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Another member with this phone number already exists'
        });
      }
    }

    // Validate district and group if being updated
    if (updateData.district || updateData.group) {
      const newDistrict = updateData.district || member.district;
      const newGroup = updateData.group || member.group;

      const group = await Group.findById(newGroup).populate('district');
      if (!group || group.district._id.toString() !== newDistrict.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Group does not belong to the specified district'
        });
      }
    }

    // Handle baithulMaal update
    const { monthlyBaithulMaal, ...restUpdateData } = updateData;
    
    // Update member
    Object.assign(member, restUpdateData);
    member.updatedBy = req.user._id;

    // Update baithulMaal if provided
    if (monthlyBaithulMaal !== undefined) {
      if (!member.baithulMaal) {
        member.baithulMaal = { totalPaid: 0 };
      }
      member.baithulMaal.monthlyAmount = monthlyBaithulMaal && !isNaN(monthlyBaithulMaal) && Number(monthlyBaithulMaal) > 0 
        ? Number(monthlyBaithulMaal) 
        : 0;
    }

    await member.save();

    // Populate the updated member
    await member.populate([
      { path: 'district', select: 'name code' },
      { path: 'group', select: 'name code' },
      { path: 'updatedBy', select: 'name phone' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Member updated successfully',
      data: member
    });

  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update member'
    });
  }
});

// @route   PATCH /api/members/:id/move
// @desc    Move a member to another group (and optionally unit) inside the
//          district admin's own district. The one member change district admins
//          may make while member editing is otherwise state-admin only; moves to
//          another district go through POST /api/transfer-requests instead.
// @access  Private (district_admin)
router.patch('/:id/move',
  authenticate,
  requireRole(['district_admin']),
  objectIdValidation('id'),
  body('group').isMongoId().withMessage('Valid target group ID is required'),
  // Unit is stored in member.address; blank keeps the current one.
  body('unit').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Unit cannot exceed 100 characters'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const ownDistrictId = req.user.district?._id?.toString();
      if (!ownDistrictId) {
        return res.status(500).json({ success: false, message: 'User account misconfigured: no district assigned' });
      }

      const member = await Member.findById(req.params.id);
      if (!member || hiddenFrom(req.user, member)) {
        return res.status(404).json(ARCHIVED_NOT_FOUND);
      }
      if (member.district?.toString() !== ownDistrictId) {
        return res.status(403).json({ success: false, message: 'You can only move members from your district' });
      }

      const group = await Group.findById(req.body.group);
      if (!group || group.district?.toString() !== ownDistrictId) {
        return res.status(400).json({ success: false, message: 'Target group must be in your district' });
      }
      if (member.group?.toString() === group._id.toString()) {
        return res.status(400).json({ success: false, message: 'Member is already in the target group' });
      }

      // A move would leave an open request's "from" location stale.
      const openRequest = await TransferRequest.exists({
        member: member._id,
        status: { $in: ['pending', 'district_approved'] }
      });
      if (openRequest) {
        return res.status(400).json({ success: false, message: 'This member has an open transfer request — wait for the State Admin to decide it first' });
      }

      member.group = group._id;
      if (req.body.unit) member.address = req.body.unit;
      member.updatedBy = req.user._id;
      await member.save();

      await member.populate([
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' }
      ]);

      res.status(200).json({ success: true, message: 'Member moved successfully', data: member });
    } catch (error) {
      console.error('Move member error:', error);
      res.status(500).json({ success: false, message: 'Failed to move member' });
    }
  }
);

// @route   PATCH /api/members/:id/leader
// @desc    Update isLeader and roleTag for a member
// @access  Private (state_admin, district_admin, group_admin)
router.patch('/:id/leader',
  authenticate,
  requireRole(['state_admin', 'district_admin', 'group_admin']),
  objectIdValidation('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { isLeader, roleTag, extraRoles } = req.body;
      const member = await Member.findById(req.params.id);

      if (!member || hiddenFrom(req.user, member)) {
        return res.status(404).json(ARCHIVED_NOT_FOUND);
      }

      const inScope = await leaderEditScopeFor(req.user);
      if (!inScope(member)) {
        return res.status(403).json({ success: false, message: 'Access denied. This member is outside your district or area.' });
      }
      const denied = leaderEditError(req.user, member, req.body);
      if (denied) {
        return res.status(denied.status).json({ success: false, message: denied.message });
      }
      // Admins are members too: when this phone has an admin login, roles are edited there.
      const personRecords = await loadPersonRecords(member);
      const elsewhere = leaderRecordError(member, personRecords);
      if (elsewhere) {
        return res.status(elsewhere.status).json({ success: false, message: elsewhere.message, data: elsewhere.data });
      }

      member.isLeader = isLeader !== undefined ? isLeader : member.isLeader;

      const toOrder = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const parsed = Number(v);
        return Number.isFinite(parsed) ? parsed : null;
      };
      if (isLeader === false) {
        member.extraRoleTags = [];
      } else if (Array.isArray(extraRoles)) {
        // Full replace of additional roles (multi-role support).
        member.extraRoleTags = extraRoles
          .filter((r) => r && (r.type || r.name))
          .map((r) => ({ type: r.type || undefined, name: r.name || undefined, listingOrder: toOrder(r.listingOrder) }));
      }

      if (isLeader === false) {
        member.roleTag = undefined;
      } else if (roleTag) {
        // Normalise listingOrder: allow null/"" to clear it, cast strings to numbers.
        let nextListingOrder = member.roleTag && member.roleTag.listingOrder;
        if (roleTag.listingOrder !== undefined) {
          if (roleTag.listingOrder === null || roleTag.listingOrder === '') {
            nextListingOrder = null;
          } else {
            const parsed = Number(roleTag.listingOrder);
            nextListingOrder = Number.isFinite(parsed) ? parsed : null;
          }
        }

        member.roleTag = {
          type: roleTag.type || (member.roleTag && member.roleTag.type),
          name: roleTag.name || (member.roleTag && member.roleTag.name),
          // Only a state admin may set roleDescription; everyone else keeps what is there.
          roleDescription: roleTag.roleDescription !== undefined && req.user.role === 'state_admin' ? roleTag.roleDescription : (member.roleTag && member.roleTag.roleDescription),
          listingOrder: nextListingOrder
        };
      }

      // Copy the result to any other records on this phone.
      const sync = planPersonSync(req.user, member, personRecords, inScope);
      if (sync.error) {
        return res.status(sync.error.status).json({ success: false, message: sync.error.message });
      }

      try {
        await savePersonEdit(member, sync.changes);
      } catch (saveError) {
        if (saveError.name === 'ValidationError') {
          return res.status(400).json({ success: false, message: saveError.message });
        }
        console.error('Leader role save error:', saveError);
        return res.status(500).json({ success: false, message: "Couldn't save the leader roles. Nothing was changed — please try again." });
      }

      res.status(200).json({
        success: true,
        message: 'Member leader status updated successfully',
        data: member
      });
    } catch (error) {
      console.error('Update member leader error:', error);
      res.status(500).json({ success: false, message: 'Failed to update member leader status' });
    }
  }
);

// @route   DELETE /api/members/:id
// @desc    Delete member
// @access  Private
router.delete('/:id', authenticate, requireRole(['state_admin']), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Only state admin can delete members - no additional permission checks needed

    await Member.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Member deleted successfully'
    });

  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete member'
    });
  }
});

// @route   POST /api/members/:id/approve
// @desc    Approve member
// @access  Private
router.post('/:id/approve', authenticate, requireRole(['state_admin', 'district_admin']), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);

    if (!member || hiddenFrom(req.user, member)) {
      return res.status(404).json(ARCHIVED_NOT_FOUND);
    }

    if (member.isApproved) {
      return res.status(400).json({
        success: false,
        message: 'Member is already approved'
      });
    }

    // Check access permissions
    if (req.user.role === 'district_admin' && member.district.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only approve members from your district.'
      });
    }

    member.isApproved = true;
    member.approvedBy = req.user._id;
    member.approvedAt = new Date();
    if (member.status === 'Inactive' || member.status === 'Applicant') {
      member.status = 'Active';
    }

    await member.save();

    await member.populate([
      { path: 'district', select: 'name code' },
      { path: 'group', select: 'name code' },
      { path: 'approvedBy', select: 'name phone' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Member approved successfully',
      data: member
    });

  } catch (error) {
    console.error('Approve member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve member'
    });
  }
});

// @route   GET /api/members/stats/overview
// @desc    Get members overview statistics
// @access  Private
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    let matchFilter = currentMemberMatch();

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      matchFilter.group = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      matchFilter.district = req.user.district._id;
    }

    const stats = await Member.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          activeMembers: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          inactiveMembers: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } },
          abroadMembers: { $sum: { $cond: [{ $eq: ['$status', 'Abroad'] }, 1, 0] } },
          applicantMembers: { $sum: { $cond: [{ $eq: ['$status', 'Applicant'] }, 1, 0] } },
          approvedMembers: { $sum: { $cond: ['$isApproved', 1, 0] } },
          pendingMembers: { $sum: { $cond: [{ $not: '$isApproved' }, 1, 0] } },
          totalBaithulMaal: { $sum: '$baithulMaal.monthlyAmount' },
          averageAge: { $avg: '$age' }
        }
      }
    ]);

    // Get recent members
    const recentMembers = await Member.find(matchFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('district', 'name')
      .populate('group', 'name')
      .select('name phone status createdAt');

    res.status(200).json({
      success: true,
      data: {
        statistics: stats[0] || {
          totalMembers: 0,
          activeMembers: 0,
          inactiveMembers: 0,
          abroadMembers: 0,
          applicantMembers: 0,
          approvedMembers: 0,
          pendingMembers: 0,
          totalBaithulMaal: 0,
          averageAge: 0
        },
        recentMembers
      }
    });

  } catch (error) {
    console.error('Get members stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member statistics'
    });
  }
});

export default router;