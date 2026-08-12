import express from 'express';
import PersonalTarget from '../models/PersonalTarget.js';
import MemberTargetProgress from '../models/MemberTargetProgress.js';
import UserTargetProgress from '../models/UserTargetProgress.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import { authenticate, requireRole, isAreaLevelAdmin, adminKindQuery, targetAudiencesFor } from '../middleware/auth.js';
import { body, validationResult, query } from 'express-validator';

const router = express.Router();

// Validation middleware
const createTargetValidation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Description is required and must be less than 1000 characters'),
  body('category').isIn(['quran', 'hadith', 'prayer', 'charity', 'knowledge', 'community', 'other']).withMessage('Invalid category'),
  body('targetType').isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid target type'),
  body('targetValue').isInt({ min: 1 }).withMessage('Target value must be a positive integer'),
  body('unit').trim().isLength({ min: 1, max: 50 }).withMessage('Unit is required and must be less than 50 characters'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('targetAudience').isIn(['all_users', 'members_only', 'group_admins', 'area_admins', 'group_and_area_admins', 'district_admins', 'state_admins']).withMessage('Invalid target audience')
];

// @route   POST /api/personal-targets
// @desc    Create a new personal target
// @access  Private (State Admin only)
router.post('/', authenticate, requireRole('state_admin'), createTargetValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const targetData = {
      ...req.body,
      createdBy: req.user._id
    };

    // Validate date range
    if (new Date(targetData.startDate) >= new Date(targetData.endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Save as a single target record (recurring flag is just metadata)
    targetData.isTemplate = false;
    const personalTarget = new PersonalTarget(targetData);
    await personalTarget.save();

    // Populate the created target
    await personalTarget.populate('createdBy', 'name role');

    // Create progress records for all eligible members
    await createProgressRecords(personalTarget);

    res.status(201).json({
      success: true,
      message: 'Personal target created successfully',
      data: personalTarget
    });

  } catch (error) {
    console.error('Create personal target error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create personal target'
    });
  }
});

// @route   GET /api/personal-targets
// @desc    Get all personal targets with filtering
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      status,
      targetAudience,
      search,
      isRecurring
    } = req.query;

    const now = new Date();
    let filter = {};

    // Apply filters based on user role. Non-state admins only ever see the
    // audiences they belong to (district admins must not get area/unit targets).
    if (req.user.role !== 'state_admin') {
      filter.$and = [
        { targetAudience: { $in: targetAudiencesFor(req.user) } },
        // Only show active targets within date range (or those without dates set)
        { $or: [
          { startDate: { $lte: now }, endDate: { $gte: now } },
          { startDate: { $exists: false } },
          { startDate: null }
        ]}
      ];
      filter.status = 'active';
    }

    // Add additional filters
    if (isRecurring !== undefined) filter.isRecurring = isRecurring === 'true';
    if (category) filter.category = category;
    // state_admin can filter by status; other roles already have status locked to 'active'
    if (status && req.user.role === 'state_admin') filter.status = status;
    if (targetAudience) {
      let audiences;
      if (targetAudience === 'group_and_area_admins') {
        audiences = ['group_admins', 'area_admins', 'group_and_area_admins'];
      } else {
        audiences = typeof targetAudience === 'string'
          ? targetAudience.split(',').map(s => s.trim()).filter(Boolean)
          : [targetAudience];
      }
      filter.targetAudience = audiences.length > 1 ? { $in: audiences } : audiences[0];
    }

    // Search filter
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      const searchCondition = { $or: [{ title: searchRegex }, { description: searchRegex }] };
      if (filter.$and) {
        filter.$and.push(searchCondition);
      } else {
        filter.$and = [searchCondition];
      }
    }

    // Never show template documents
    if (!filter.$and) filter.$and = [];
    filter.$and.push({ $or: [{ isTemplate: false }, { isTemplate: { $exists: false } }] });

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'createdBy', select: 'name role' }
      ]
    };

    const result = await PersonalTarget.paginate(filter, options);

    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalItems: result.totalDocs,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get personal targets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch personal targets'
    });
  }
});

// @route   GET /api/personal-targets/:id
// @desc    Get a specific personal target
// @access  Private
router.get('/:id', authenticate, async (req, res) => {
  try {
    const personalTarget = await PersonalTarget.findById(req.params.id)
      .populate('createdBy', 'name role');

    if (!personalTarget) {
      return res.status(404).json({
        success: false,
        message: 'Personal target not found'
      });
    }

    // Check if user has access to this target
    const hasAccess = await checkTargetAccess(personalTarget, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this target'
      });
    }

    res.status(200).json({
      success: true,
      data: personalTarget
    });

  } catch (error) {
    console.error('Get personal target error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch personal target'
    });
  }
});

// @route   PUT /api/personal-targets/:id
// @desc    Update a personal target
// @access  Private (State Admin only)
router.put('/:id', authenticate, requireRole('state_admin'), createTargetValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const personalTarget = await PersonalTarget.findById(req.params.id);
    if (!personalTarget) {
      return res.status(404).json({
        success: false,
        message: 'Personal target not found'
      });
    }

    // Validate date range
    if (new Date(req.body.startDate) >= new Date(req.body.endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const updatedTarget = await PersonalTarget.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name role');

    res.status(200).json({
      success: true,
      message: 'Personal target updated successfully',
      data: updatedTarget
    });

  } catch (error) {
    console.error('Update personal target error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update personal target'
    });
  }
});

// @route   DELETE /api/personal-targets/:id
// @desc    Delete a personal target
// @access  Private (State Admin only)
router.delete('/:id', authenticate, requireRole('state_admin'), async (req, res) => {
  try {
    const personalTarget = await PersonalTarget.findById(req.params.id);
    if (!personalTarget) {
      return res.status(404).json({
        success: false,
        message: 'Personal target not found'
      });
    }

    // Delete associated progress records
    await MemberTargetProgress.deleteMany({ personalTarget: req.params.id });

    // Delete the target
    await PersonalTarget.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Personal target deleted successfully'
    });

  } catch (error) {
    console.error('Delete personal target error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete personal target'
    });
  }
});

// @route   GET /api/personal-targets/:id/progress
// @desc    Get progress statistics for a target
// @access  Private
router.get('/:id/progress', authenticate, async (req, res) => {
  try {
    const personalTarget = await PersonalTarget.findById(req.params.id);
    if (!personalTarget) {
      return res.status(404).json({
        success: false,
        message: 'Personal target not found'
      });
    }

    // Check access
    const hasAccess = await checkTargetAccess(personalTarget, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this target'
      });
    }

    // Get progress statistics
    const stats = await MemberTargetProgress.getTargetStats(req.params.id);
    const leaderboard = await MemberTargetProgress.getLeaderboard(req.params.id, 10);

    res.status(200).json({
      success: true,
      data: {
        target: personalTarget,
        statistics: stats,
        leaderboard
      }
    });

  } catch (error) {
    console.error('Get target progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch target progress'
    });
  }
});

// Helper function to create progress records for eligible members AND users
async function createProgressRecords(personalTarget) {
  try {
    const audience = personalTarget.targetAudience;

    // Create MemberTargetProgress for members
    if (audience === 'all_users' || audience === 'members_only') {
      const members = await Member.find({ status: 'Active', isApproved: true });
      const memberRecords = members.map(m => ({
        member: m._id,
        personalTarget: personalTarget._id,
        targetValue: personalTarget.targetValue,
        currentProgress: 0,
        status: 'not_started'
      }));
      if (memberRecords.length > 0) {
        await MemberTargetProgress.insertMany(memberRecords, { ordered: false });
      }
    }

    // Create UserTargetProgress for admin users
    if (audience !== 'members_only') {
      let userFilter = { isActive: true };
      if (audience === 'state_admins') {
        userFilter.role = 'state_admin';
      } else if (audience === 'district_admins') {
        userFilter.role = 'district_admin';
      } else if (audience === 'area_admins') {
        Object.assign(userFilter, adminKindQuery('area_level'));
      } else if (audience === 'group_admins' || audience === 'group_and_area_admins') {
        userFilter.role = 'group_admin';
      }
      // 'all_users' → no extra filter, all active users

      const users = await User.find(userFilter);
      const userRecords = users.map(u => ({
        user: u._id,
        personalTarget: personalTarget._id,
        status: 'not_started'
      }));
      if (userRecords.length > 0) {
        await UserTargetProgress.insertMany(userRecords, { ordered: false });
      }
    }
  } catch (error) {
    console.error('Error creating progress records:', error);
  }
}

// Helper function to check if user has access to a target
async function checkTargetAccess(personalTarget, user) {
  if (user.role === 'state_admin') return true;

  const audience = personalTarget.targetAudience;
  if (audience === 'all_users') return true;
  if (audience === 'district_admins' && user.role === 'district_admin') return true;
  if (audience === 'area_admins' && isAreaLevelAdmin(user)) return true;
  if (audience === 'group_admins' && user.role === 'group_admin') return true;
  if (audience === 'group_and_area_admins' && user.role === 'group_admin') return true;

  return false;
}

export default router;