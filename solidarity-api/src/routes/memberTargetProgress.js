import express from 'express';
import MemberTargetProgress from '../models/MemberTargetProgress.js';
import PersonalTarget from '../models/PersonalTarget.js';
import Member from '../models/Member.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware
const progressValidation = [
  body('value').isFloat({ min: 0 }).withMessage('Progress value must be a positive number'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
];

// @route   GET /api/member-target-progress/member/:memberId
// @desc    Get all target progress for a specific member
// @access  Private
router.get('/member/:memberId', authenticate, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { month, year, status } = req.query;

    // Check if user has access to this member's data
    const hasAccess = await checkMemberAccess(memberId, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this member data'
      });
    }

    let targetFilter = {};
    if (month) targetFilter.month = parseInt(month);
    if (year) targetFilter.year = parseInt(year);

    // Get active targets first
    const activeTargets = await PersonalTarget.find({
      ...targetFilter,
      status: 'active'
    });

    let progressFilter = { member: memberId };
    if (activeTargets.length > 0) {
      progressFilter.personalTarget = { $in: activeTargets.map(t => t._id) };
    }
    if (status) progressFilter.status = status;

    const memberProgress = await MemberTargetProgress.find(progressFilter)
      .populate('personalTarget', 'title description category targetValue unit month year startDate endDate')
      .populate('member', 'name phone')
      .sort({ 'personalTarget.month': -1, 'personalTarget.year': -1 });

    res.status(200).json({
      success: true,
      data: memberProgress
    });

  } catch (error) {
    console.error('Get member progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member progress'
    });
  }
});

// @route   GET /api/member-target-progress/:progressId
// @desc    Get specific target progress details
// @access  Private
router.get('/:progressId', authenticate, async (req, res) => {
  try {
    const progress = await MemberTargetProgress.findById(req.params.progressId)
      .populate('personalTarget', 'title description category targetValue unit month year startDate endDate')
      .populate('member', 'name phone group district');

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress record not found'
      });
    }

    // Check access
    const hasAccess = await checkMemberAccess(progress.member._id, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this progress data'
      });
    }

    res.status(200).json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('Get progress details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch progress details'
    });
  }
});

// @route   POST /api/member-target-progress/:progressId/daily
// @desc    Add daily progress for a target
// @access  Private
router.post('/:progressId/daily', authenticate, progressValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const progress = await MemberTargetProgress.findById(req.params.progressId)
      .populate('member', 'name phone');

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress record not found'
      });
    }

    // Check access
    const hasAccess = await checkMemberAccess(progress.member._id, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to update this progress'
      });
    }

    const { value, notes = '' } = req.body;

    await progress.addDailyProgress(value, notes);

    // Populate the updated progress
    await progress.populate('personalTarget', 'title description category targetValue unit');

    res.status(200).json({
      success: true,
      message: 'Daily progress updated successfully',
      data: progress
    });

  } catch (error) {
    console.error('Add daily progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update daily progress'
    });
  }
});

// @route   GET /api/member-target-progress/:progressId/daily
// @desc    Get daily progress for a target
// @access  Private
router.get('/:progressId/daily', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const progress = await MemberTargetProgress.findById(req.params.progressId)
      .populate('member', 'name phone');

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress record not found'
      });
    }

    // Check access
    const hasAccess = await checkMemberAccess(progress.member._id, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this progress data'
      });
    }

    let dailyProgress = progress.dailyProgress;

    // Filter by date range if provided
    if (startDate || endDate) {
      dailyProgress = dailyProgress.filter(dp => {
        const progressDate = new Date(dp.date);
        if (startDate && progressDate < new Date(startDate)) return false;
        if (endDate && progressDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Sort by date descending
    dailyProgress.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      data: {
        progressId: progress._id,
        member: progress.member,
        dailyProgress,
        summary: {
          totalDays: dailyProgress.length,
          totalProgress: dailyProgress.reduce((sum, dp) => sum + dp.value, 0),
          averageDaily: dailyProgress.length > 0 ? 
            dailyProgress.reduce((sum, dp) => sum + dp.value, 0) / dailyProgress.length : 0
        }
      }
    });

  } catch (error) {
    console.error('Get daily progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily progress'
    });
  }
});

// @route   GET /api/member-target-progress/:progressId/weekly
// @desc    Get weekly progress summary
// @access  Private
router.get('/:progressId/weekly', authenticate, async (req, res) => {
  try {
    const progress = await MemberTargetProgress.findById(req.params.progressId)
      .populate('member', 'name phone')
      .populate('personalTarget', 'title targetValue unit');

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress record not found'
      });
    }

    // Check access
    const hasAccess = await checkMemberAccess(progress.member._id, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this progress data'
      });
    }

    const weeklyProgress = progress.getWeeklyProgress();

    res.status(200).json({
      success: true,
      data: {
        member: progress.member,
        personalTarget: progress.personalTarget,
        weeklyProgress,
        overallProgress: {
          currentProgress: progress.currentProgress,
          targetValue: progress.targetValue,
          progressPercentage: progress.progressPercentage,
          status: progress.status
        }
      }
    });

  } catch (error) {
    console.error('Get weekly progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch weekly progress'
    });
  }
});

// @route   PUT /api/member-target-progress/:progressId/notes
// @desc    Update progress notes
// @access  Private
router.put('/:progressId/notes', authenticate, async (req, res) => {
  try {
    const { notes } = req.body;

    if (notes && notes.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Notes cannot exceed 1000 characters'
      });
    }

    const progress = await MemberTargetProgress.findById(req.params.progressId)
      .populate('member', 'name phone');

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Progress record not found'
      });
    }

    // Check access
    const hasAccess = await checkMemberAccess(progress.member._id, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to update this progress'
      });
    }

    progress.notes = notes || '';
    await progress.save();

    res.status(200).json({
      success: true,
      message: 'Progress notes updated successfully',
      data: progress
    });

  } catch (error) {
    console.error('Update progress notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update progress notes'
    });
  }
});

// @route   GET /api/member-target-progress/target/:targetId/members
// @desc    Get all member progress for a specific target
// @access  Private
router.get('/target/:targetId/members', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, sortBy = 'progressPercentage', sortOrder = 'desc' } = req.query;

    const personalTarget = await PersonalTarget.findById(req.params.targetId);
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
        message: 'Access denied to this target data'
      });
    }

    let filter = { personalTarget: req.params.targetId };
    if (status) filter.status = status;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: sortOptions,
      populate: [
        { path: 'member', select: 'name phone group district', populate: [
          { path: 'group', select: 'name' },
          { path: 'district', select: 'name' }
        ]}
      ]
    };

    const result = await MemberTargetProgress.paginate(filter, options);

    res.status(200).json({
      success: true,
      data: {
        target: personalTarget,
        memberProgress: result.docs,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalItems: result.totalDocs,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Get target member progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch target member progress'
    });
  }
});

// Helper function to check if user has access to member data
async function checkMemberAccess(memberId, user) {
  if (user.role === 'state_admin') {
    return true;
  }

  const member = await Member.findById(memberId);
  if (!member) return false;

  if (user.role === 'district_admin') {
    return member.district.toString() === user.district.toString();
  }

  if (user.role === 'group_admin') {
    return member.group.toString() === user.group.toString();
  }

  return false;
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
    return personalTarget.targetDistricts.some(d => d.toString() === user.district.toString());
  }

  if (personalTarget.targetAudience === 'specific_groups' && user.group) {
    return personalTarget.targetGroups.some(g => g.toString() === user.group.toString());
  }

  return false;
}

export default router;