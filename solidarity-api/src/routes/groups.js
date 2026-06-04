import express from 'express';
import Group from '../models/Group.js';
import District from '../models/District.js';
import Member from '../models/Member.js';
import { authenticate, requireRole, requireGroupAccess } from '../middleware/auth.js';
import { 
  createGroupValidation,
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// @route   GET /api/groups
// @desc    Get all groups
// @access  Private
router.get('/', authenticate, paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = 'name',
      district,
      isActive,
      search
    } = req.query;

    let filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      // Area admins only see their own group(s)
      if (req.user.roleTag?.type === 'area' && req.user.district) {
        const areaName = req.user.roleTag.roleDescription;
        if (areaName) {
          const areaRegex = new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const areaGroups = await Group.find({ district: req.user.district._id, name: areaRegex }).select('_id').lean();
          const groupIds = areaGroups.map(g => g._id);
          filter._id = groupIds.length > 0 ? { $in: groupIds } : (req.user.group?._id || null);
        } else {
          filter._id = req.user.group?._id || null;
        }
      } else if (req.user.group) {
        filter._id = req.user.group._id;
      } else {
        filter._id = null;
      }
    } else if (req.user.role === 'district_admin') {
      // District admins see groups in their district
      if (req.user.district) {
        filter.district = req.user.district._id;
      }
    }

    // Apply additional district filter if provided (for state_admin selecting a district)
    if (district && req.user.role === 'state_admin') {
      filter.district = district;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'district', select: 'name code' },
        { path: 'admin', select: 'name phone email' },
        { path: 'createdBy', select: 'name phone' }
      ]
    };

    const result = await Group.paginate(filter, options);

    res.status(200).json({
      success: true,
      data: result.docs,
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
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch groups'
    });
  }
});

// @route   GET /api/groups/:id
// @desc    Get single group by ID
// @access  Private
router.get('/:id', authenticate, requireGroupAccess, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('district', 'name code')
      .populate('admin', 'name phone email')
      .populate('createdBy', 'name phone');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check district access for district admin
    if (req.user.role === 'district_admin' && 
        group.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Group not in your district.'
      });
    }

    // Update statistics
    await group.updateStatistics();

    // Get recent members
    const recentMembers = await Member.find({ group: group._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name phone status createdAt isApproved');

    res.status(200).json({
      success: true,
      data: {
        ...group.toObject(),
        recentMembers
      }
    });

  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group'
    });
  }
});

// @route   POST /api/groups
// @desc    Create new group
// @access  Private (State Admin and District Admin)
router.post('/', authenticate, requireRole(['state_admin', 'district_admin']), createGroupValidation, async (req, res) => {
  try {
    const groupData = req.body;

    // Validate district
    const district = await District.findById(groupData.district);
    if (!district) {
      return res.status(400).json({
        success: false,
        message: 'Invalid district ID'
      });
    }

    // District admin can only create groups in their district
    if (req.user.role === 'district_admin' && 
        groupData.district !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only create groups in your assigned district'
      });
    }

    // Check if group with same code already exists in the district
    const existingGroup = await Group.findOne({
      code: groupData.code,
      district: groupData.district
    });

    if (existingGroup) {
      return res.status(400).json({
        success: false,
        message: 'Group with this code already exists in the district'
      });
    }

    // Create group
    const group = new Group({
      ...groupData,
      createdBy: req.user._id
    });

    await group.save();

    // Populate the created group
    await group.populate([
      { path: 'district', select: 'name code' },
      { path: 'admin', select: 'name phone email' },
      { path: 'createdBy', select: 'name phone' }
    ]);

    // Update district statistics
    await district.updateStatistics();

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: group
    });

  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create group'
    });
  }
});

// @route   PUT /api/groups/:id
// @desc    Update group
// @access  Private (State Admin and District Admin)
router.put('/:id', 
  authenticate, 
  requireRole(['state_admin', 'district_admin']), 
  objectIdValidation('id'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('code').optional().trim().isLength({ min: 2, max: 10 }).isAlphanumeric(),
    body('admin').optional().isMongoId(),
    body('isActive').optional().isBoolean(),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const group = await Group.findById(req.params.id).populate('district');
      
      if (!group) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      // District admin can only update groups in their district
      if (req.user.role === 'district_admin' && 
          group.district._id.toString() !== req.user.district._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Group not in your district.'
        });
      }

      const updateData = req.body;

      // Check for duplicate code if being updated
      if (updateData.code) {
        const existingGroup = await Group.findOne({
          code: updateData.code,
          district: group.district._id,
          _id: { $ne: group._id }
        });

        if (existingGroup) {
          return res.status(400).json({
            success: false,
            message: 'Another group with this code already exists in the district'
          });
        }
      }

      // Update group
      Object.assign(group, updateData);
      await group.save();

      // Populate the updated group
      await group.populate([
        { path: 'district', select: 'name code' },
        { path: 'admin', select: 'name phone email' },
        { path: 'createdBy', select: 'name phone' }
      ]);

      res.status(200).json({
        success: true,
        message: 'Group updated successfully',
        data: group
      });

    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update group'
      });
    }
  }
);

// @route   DELETE /api/groups/:id
// @desc    Delete group
// @access  Private (State Admin and District Admin)
router.delete('/:id', authenticate, requireRole(['state_admin', 'district_admin']), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('district');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // District admin can only delete groups in their district
    if (req.user.role === 'district_admin' && 
        group.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Group not in your district.'
      });
    }

    // Check if group has members
    const memberCount = await Member.countDocuments({ group: group._id });
    if (memberCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete group. It has ${memberCount} members.`
      });
    }

    await Group.findByIdAndDelete(req.params.id);

    // Update district statistics
    await group.district.updateStatistics();

    res.status(200).json({
      success: true,
      message: 'Group deleted successfully'
    });

  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete group'
    });
  }
});

// @route   GET /api/groups/:id/members
// @desc    Get all members in a group
// @access  Private
router.get('/:id/members', authenticate, requireGroupAccess, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sort = '-createdAt',
      status,
      isApproved,
      search
    } = req.query;

    let filter = { group: req.params.id };
    if (status) filter.status = status;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' },
        { path: 'createdBy', select: 'name phone' }
      ]
    };

    const result = await Member.paginate(filter, options);

    res.status(200).json({
      success: true,
      data: result.docs,
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
    console.error('Get group members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group members'
    });
  }
});

// @route   GET /api/groups/:id/stats
// @desc    Get group statistics
// @access  Private
router.get('/:id/stats', authenticate, requireGroupAccess, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('district', 'name code');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Get detailed statistics
    const stats = await Member.aggregate([
      { $match: { group: group._id } },
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
          totalPaid: { $sum: '$baithulMaal.totalPaid' },
          averageAge: { $avg: '$age' }
        }
      }
    ]);

    // Get age distribution
    const ageDistribution = await Member.aggregate([
      { $match: { group: group._id, age: { $exists: true } } },
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [0, 18, 25, 35, 45, 55, 65, 100],
          default: 'Unknown',
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]);

    // Get status distribution over time (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const membershipTrend = await Member.aggregate([
      { 
        $match: { 
          group: group._id,
          createdAt: { $gte: twelveMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          newMembers: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        group: {
          id: group._id,
          name: group.name,
          code: group.code,
          district: group.district
        },
        statistics: stats[0] || {
          totalMembers: 0,
          activeMembers: 0,
          inactiveMembers: 0,
          abroadMembers: 0,
          applicantMembers: 0,
          approvedMembers: 0,
          pendingMembers: 0,
          totalBaithulMaal: 0,
          totalPaid: 0,
          averageAge: 0
        },
        ageDistribution,
        membershipTrend
      }
    });

  } catch (error) {
    console.error('Get group stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group statistics'
    });
  }
});

export default router;