import express from 'express';
import UserTargetProgress from '../models/UserTargetProgress.js';
import PersonalTarget from '../models/PersonalTarget.js';
import { authenticate, targetAudiencesFor } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// @route   GET /api/user-target-progress
// @desc    Get all progress records for the current user (includes virtual not_started for untracked targets)
// @access  All authenticated users (non-member)
router.get('/', authenticate, async (req, res) => {
  try {
    // Only the audiences this user actually belongs to — a district admin must
    // not see (or mark) area/unit targets, and vice versa.
    const audienceFilter = targetAudiencesFor(req.user);

    // Fetch all active targets applicable to this user
    const activeTargets = await PersonalTarget.find({
      status: 'active',
      targetAudience: { $in: audienceFilter }
    }).populate('createdBy', 'name role');

    // Fetch existing progress records for the user
    const existingProgress = await UserTargetProgress.find({ user: req.user._id })
      .populate({
        path: 'personalTarget',
        populate: { path: 'createdBy', select: 'name role' }
      });

    // Only keep progress records where personalTarget populated successfully
    const validExisting = existingProgress.filter(p => p.personalTarget != null);
    const progressByTargetId = new Map(
      validExisting.map(p => [p.personalTarget._id.toString(), p])
    );

    // Merge: existing records + virtual not_started for untracked targets
    const merged = activeTargets.map(target => {
      const targetIdStr = target._id.toString();
      if (progressByTargetId.has(targetIdStr)) {
        return progressByTargetId.get(targetIdStr);
      }
      // Virtual record (not saved to DB)
      return {
        _id: `virtual_${targetIdStr}`,
        user: req.user._id,
        personalTarget: target,
        status: 'not_started',
        feedback: '',
        currentProgress: 0,
        targetValue: target.targetValue,
        progressPercentage: 0,
        updatedAt: target.updatedAt,
        createdAt: target.createdAt,
      };
    });

    res.status(200).json({ success: true, data: merged });
  } catch (error) {
    console.error('Get user target progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch progress' });
  }
});

// @route   POST /api/user-target-progress/:targetId
// @desc    Upsert progress + feedback for a specific target
// @access  All authenticated users (non-member)
router.post('/:targetId', authenticate, [
  body('status')
    .isIn(['not_started', 'in_progress', 'completed'])
    .withMessage('Invalid status'),
  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback cannot exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    // Verify the target exists and this user is eligible
    const target = await PersonalTarget.findById(req.params.targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }
    if (!targetAudiencesFor(req.user).includes(target.targetAudience)) {
      return res.status(403).json({ success: false, message: 'You are not eligible for this target' });
    }

    const { status, feedback, fileAttachment } = req.body;

    const updateData = {
      status,
      feedback: feedback || '',
      ...(fileAttachment ? { fileAttachment } : {}),
      ...(status === 'completed' ? { completedAt: new Date() } : {})
    };

    const progress = await UserTargetProgress.findOneAndUpdate(
      { user: req.user._id, personalTarget: req.params.targetId },
      { $set: updateData },
      { new: true, upsert: true }
    ).populate({
      path: 'personalTarget',
      populate: { path: 'createdBy', select: 'name role' }
    });

    res.status(200).json({ success: true, message: 'Progress updated successfully', data: progress });
  } catch (error) {
    console.error('Update user target progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to update progress' });
  }
});

// @route   GET /api/user-target-progress/target/:targetId
// @desc    Get all user progress for a specific target (state_admin view)
// @access  State Admin only
router.get('/target/:targetId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'state_admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const progress = await UserTargetProgress.find({ personalTarget: req.params.targetId })
      .populate('user', 'name role roleTag district group')
      .sort({ status: 1, updatedAt: -1 });

    const stats = {
      total: progress.length,
      not_started: progress.filter(p => p.status === 'not_started').length,
      in_progress: progress.filter(p => p.status === 'in_progress').length,
      completed: progress.filter(p => p.status === 'completed').length
    };

    res.status(200).json({ success: true, data: progress, stats });
  } catch (error) {
    console.error('Get target user progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch target progress' });
  }
});

export default router;
