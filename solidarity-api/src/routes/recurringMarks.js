import express from 'express';
import RecurringMark from '../models/RecurringMark.js';
import PersonalTarget from '../models/PersonalTarget.js';
import UserTargetProgress from '../models/UserTargetProgress.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/recurring-marks/my
// @desc    Get all recurring marks for the current (non-member) user
// @access  Authenticated users (non-member)
router.get('/my', authenticate, async (req, res) => {
  try {
    const marks = await RecurringMark.find({
      user: req.user._id,
      userType: 'User'
    }).select('personalTarget year month completed markedAt');

    const formatted = marks.map(m => ({
      targetId: m.personalTarget.toString(),
      year: m.year,
      month: m.month,
      completed: m.completed,
      markedAt: m.markedAt
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Get recurring marks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recurring marks' });
  }
});

// @route   POST /api/recurring-marks
// @desc    Upsert a recurring mark for the current user (toggle month completion)
// @access  Authenticated users (non-member)
router.post('/', authenticate, async (req, res) => {
  try {
    const { targetId, year, month, completed } = req.body;

    if (!targetId || !year || !month || completed === undefined) {
      return res.status(400).json({ success: false, message: 'targetId, year, month, and completed are required' });
    }

    // Verify target exists and is recurring
    const target = await PersonalTarget.findById(targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }
    if (!target.isRecurring) {
      return res.status(400).json({ success: false, message: 'Target is not recurring' });
    }

    const mark = await RecurringMark.findOneAndUpdate(
      {
        user: req.user._id,
        userType: 'User',
        personalTarget: targetId,
        year: Number(year),
        month: Number(month)
      },
      {
        $set: {
          completed: Boolean(completed),
          markedAt: new Date()
        }
      },
      { new: true, upsert: true }
    );

    // Sync UserTargetProgress: completed if any mark for this target is completed
    const anyCompleted = await RecurringMark.exists({
      user: req.user._id,
      userType: 'User',
      personalTarget: targetId,
      completed: true
    });
    await UserTargetProgress.findOneAndUpdate(
      { user: req.user._id, personalTarget: targetId },
      {
        $set: {
          status: anyCompleted ? 'completed' : 'not_started',
          targetValue: target.targetValue,
          currentProgress: anyCompleted ? target.targetValue : 0,
          progressPercentage: anyCompleted ? 100 : 0,
          ...(anyCompleted ? { completedAt: new Date() } : { completedAt: null })
        }
      },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Mark updated successfully',
      data: {
        targetId: mark.personalTarget.toString(),
        year: mark.year,
        month: mark.month,
        completed: mark.completed,
        markedAt: mark.markedAt
      }
    });
  } catch (error) {
    console.error('Upsert recurring mark error:', error);
    res.status(500).json({ success: false, message: 'Failed to update mark' });
  }
});

export default router;
