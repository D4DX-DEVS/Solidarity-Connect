import express from 'express';
import PersonalTarget from '../models/PersonalTarget.js';
import MemberTargetProgress from '../models/MemberTargetProgress.js';
import Member from '../models/Member.js';
import { authenticate, requireRole } from '../middleware/auth.js';
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
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2020, max: 2050 }).withMessage('Year must be between 2020 and 2050'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date'),
  body('endDate').isISO8601().withMessage('End date must be a valid date'),
  body('targetAudience').isIn(['all', 'specific_districts', 'specific_groups']).withMessage('Invalid target audience')
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

    const personalTarget = new PersonalTarget(targetData);
    await personalTarget.save();

    // Populate the created target
    await personalTarget.populate('createdBy', 'name role');
    await personalTarget.populate('targetDistricts', 'name');
    await personalTarget.populate('targetGroups', 'name');

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
      month,
      year,
      category,
      status,
      targetAudience
    } = req.query;

    let filter = {};

    // Apply filters based on user role
    if (req.user.role === 'district_admin') {
      filter = {
        $or: [
          { targetAudience: 'all' },
          { targetAudience: 'specific_districts', targetDistricts: req.user.district }
        ]
      };
    } else if (req.user.role === 'group_admin') {
      filter = {
        $or: [
          { targetAudience: 'all' },
          { targetAudience: 'specific_districts', targetDistricts: req.user.district },
          { targetAudience: 'specific_groups', targetGroups: req.user.group }
        ]
      };
    }

    // Add additional filters
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (targetAudience) filter.targetAudience = targetAudience;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'createdBy', select: 'name role' },
        { path: 'targetDistricts', select: 'name' },
        { path: 'targetGroups', select: 'name' }
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
      .populate('createdBy', 'name role')
      .populate('targetDistricts', 'name')
      .populate('targetGroups', 'name');

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
    ).populate('createdBy', 'name role')
     .populate('targetDistricts', 'name')
     .populate('targetGroups', 'name');

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

// Helper function to create progress records for eligible members
async function createProgressRecords(personalTarget) {
  try {
    let memberFilter = { status: 'Active', isApproved: true };

    // Filter members based on target audience
    if (personalTarget.targetAudience === 'specific_districts') {
      memberFilter.district = { $in: personalTarget.targetDistricts };
    } else if (personalTarget.targetAudience === 'specific_groups') {
      memberFilter.group = { $in: personalTarget.targetGroups };
    }

    const members = await Member.find(memberFilter);

    const progressRecords = members.map(member => ({
      member: member._id,
      personalTarget: personalTarget._id,
      targetValue: personalTarget.targetValue,
      currentProgress: 0,
      status: 'not_started'
    }));

    if (progressRecords.length > 0) {
      await MemberTargetProgress.insertMany(progressRecords, { ordered: false });
    }

  } catch (error) {
    console.error('Error creating progress records:', error);
  }
}

// Helper function to check if user has access to a target
async function checkTargetAccess(personalTarget, user) {
  if (user.role === 'state_admin') {
    return true;
  }

  if (personalTarget.targetAudience === 'all') {
    return true;
  }

  if (personalTarget.targetAudience === 'specific_districts' && user.district) {
    return personalTarget.targetDistricts.some(d => d._id.toString() === user.district.toString());
  }

  if (personalTarget.targetAudience === 'specific_groups' && user.group) {
    return personalTarget.targetGroups.some(g => g._id.toString() === user.group.toString());
  }

  return false;
}

export default router;