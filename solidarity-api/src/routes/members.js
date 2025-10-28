import express from 'express';
import mongoose from 'mongoose';
import Member from '../models/Member.js';
import Group from '../models/Group.js';
import District from '../models/District.js';
import TransferRequest from '../models/TransferRequest.js';
import { authenticate, authorize, requireRole } from '../middleware/auth.js';
import { 
  createMemberValidation, 
  updateMemberValidation, 
  paginationValidation,
  searchValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';

const router = express.Router();

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
      isApproved
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100); // Between 1 and 100

    // Build base filter based on user role
    let baseFilter = {};
    
    if (req.user.role === 'group_admin') {
      // Group admin can only see their group members
      baseFilter.group = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      // District admin can only see their district members
      baseFilter.district = req.user.district._id;
    }
    // State admin can see all members (no additional filter)

    // Build query filter (includes all filters for member list)
    let filter = { ...baseFilter };

    // Apply additional filters for member list
    if (status) filter.status = status;
    if (district && req.user.role === 'state_admin') filter.district = district;
    if (group && ['state_admin', 'district_admin'].includes(req.user.role)) filter.group = group;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';

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

    console.log('Statistics Filter:', JSON.stringify(statsFilter, null, 2));
    console.log('Query Filter:', JSON.stringify(filter, null, 2));

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
      populate: [
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' },
        { path: 'createdBy', select: 'name phone' },
        { path: 'approvedBy', select: 'name phone' }
      ],
      lean: false, // Keep as false to maintain mongoose document methods
      leanWithId: false
    };

    const result = await Member.paginate(filter, options);

    // Get transfer request status for each member
    const memberIds = result.docs.map(member => member._id);
    const transferRequests = await TransferRequest.find({
      member: { $in: memberIds },
      status: { $in: ['pending', 'approved'] }
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
      transferRequest: transferRequestMap[member._id.toString()] || null
    }));

    // Calculate statistics based on district/group filters (but not search/status)
    // This shows total counts for the selected district/group scope
    const stats = await Member.aggregate([
      { $match: statsFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } },
          abroad: { $sum: { $cond: [{ $eq: ['$status', 'Abroad'] }, 1, 0] } },
          applicant: { $sum: { $cond: [{ $eq: ['$status', 'Applicant'] }, 1, 0] } },
          ageOver: { $sum: { $cond: [{ $eq: ['$status', 'Age over'] }, 1, 0] } },
          dismissed: { $sum: { $cond: [{ $eq: ['$status', 'Dismissed'] }, 1, 0] } },
          approved: { $sum: { $cond: ['$isApproved', 1, 0] } },
          pending: { $sum: { $cond: [{ $not: '$isApproved' }, 1, 0] } }
        }
      }
    ]);

    console.log('Statistics Result:', stats);

    // Add cache headers for better performance
    res.set({
      'Cache-Control': 'private, max-age=60', // Cache for 1 minute
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
        applicant: 0, ageOver: 0, dismissed: 0, approved: 0, pending: 0
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

    // Add permissions for UI control
    context.permissions = {
      canCreateMember: req.user.permissions.includes('manage_members'),
      canEditMember: req.user.permissions.includes('manage_members'),
      canDeleteMember: req.user.role === 'state_admin',
      canApproveMember: ['state_admin', 'district_admin'].includes(req.user.role),
      canViewReports: req.user.permissions.includes('view_reports'),
      canBulkImport: req.user.permissions.includes('bulk_import')
    };

    if (req.user.role === 'group_admin') {
      // For group admin, provide their assigned district and group
      context.assignedDistrict = {
        _id: req.user.district._id,
        name: req.user.district.name,
        code: req.user.district.code
      };
      context.assignedGroup = {
        _id: req.user.group._id,
        name: req.user.group.name,
        code: req.user.group.code
      };
    } else if (req.user.role === 'district_admin') {
      // For district admin, provide their assigned district
      context.assignedDistrict = {
        _id: req.user.district._id,
        name: req.user.district.name,
        code: req.user.district.code
      };
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

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'group_admin' && member.group._id.toString() !== req.user.group._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view members from your group.'
      });
    }

    if (req.user.role === 'district_admin' && member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view members from your district.'
      });
    }

    res.status(200).json({
      success: true,
      data: member
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
  if (req.user && req.user.role === 'group_admin') {
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

router.post('/', authenticate, authorize(['manage_members']), autoAssignDistrictGroup, createMemberValidation, formatPhoneNumber, async (req, res) => {
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

    // Check user permissions
    if (req.user.role === 'group_admin') {
      // Group admin can only add to their assigned group (already enforced above)
      if (memberData.group !== req.user.group._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only add members to your assigned group'
        });
      }
    } else if (req.user.role === 'district_admin') {
      if (memberData.district !== req.user.district._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only add members to your assigned district'
        });
      }
    }

    // Check if member with same phone already exists
    const existingMember = await Member.findOne({ phone: memberData.phone });
    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'Member with this phone number already exists'
      });
    }

    // Prepare member data with baithulMaal
    const { monthlyBaithulMaal, ...restMemberData } = memberData;
    
    const memberPayload = {
      ...restMemberData,
      createdBy: req.user._id,
      isApproved: req.user.role === 'state_admin' // State admin can auto-approve
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
// @access  Private
router.put('/:id', authenticate, authorize(['manage_members']), autoAssignDistrictGroup, updateMemberValidation, formatPhoneNumber, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'group_admin' && member.group.toString() !== req.user.group._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update members from your group.'
      });
    }

    if (req.user.role === 'district_admin' && member.district.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update members from your district.'
      });
    }

    const updateData = req.body;

    // If phone is being updated, check for duplicates
    if (updateData.phone && updateData.phone !== member.phone) {
      const existingMember = await Member.findOne({ 
        phone: updateData.phone,
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

      // Check permissions for district/group changes
      if (req.user.role === 'group_admin') {
        // Group admins can only update members within their own group and district
        if (newGroup.toString() !== req.user.group._id.toString() || 
            newDistrict.toString() !== req.user.district._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Group admins can only update members within their own group and district'
          });
        }
      }

      if (req.user.role === 'district_admin' && newDistrict.toString() !== req.user.district._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only transfer members within your district'
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
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
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
    let matchFilter = {};
    
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