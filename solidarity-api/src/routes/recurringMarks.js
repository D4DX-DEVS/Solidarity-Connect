import express from 'express';
import RecurringMark from '../models/RecurringMark.js';
import PersonalTarget from '../models/PersonalTarget.js';
import UserTargetProgress from '../models/UserTargetProgress.js';
import Member from '../models/Member.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Helper: is this user an area admin?
const isAreaAdmin = (user) =>
  user.role === 'group_admin' && user.roleTag?.type === 'area';

// @route   GET /api/recurring-marks/my
// @desc    Get all recurring marks for the current (non-member) user
// @access  Authenticated users (non-member)
router.get('/my', authenticate, async (req, res) => {
  try {
    const marks = await RecurringMark.find({
      user: req.user._id,
      userType: 'User'
    }).select('personalTarget year month completed markedAt attendance');

    const formatted = marks.map(m => ({
      targetId: m.personalTarget.toString(),
      year: m.year,
      month: m.month,
      completed: m.completed,
      markedAt: m.markedAt,
      attendance: m.attendance || []
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Get recurring marks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recurring marks' });
  }
});

// @route   GET /api/recurring-marks/area-members
// @desc    Get all members under the current area admin's area
// @access  Area admins only
router.get('/area-members', authenticate, async (req, res) => {
  try {
    if (!isAreaAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only area admins can access this endpoint' });
    }

    const areaName = req.user.roleTag?.roleDescription;
    const districtId = req.user.district;

    if (!areaName || !districtId) {
      return res.status(400).json({ success: false, message: 'Area admin must have roleDescription and district set' });
    }

    // Find all groups in this district whose name matches the area name
    const areaRegex = new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const groups = await Group.find({ district: districtId, name: areaRegex }).lean();
    const groupIds = groups.map(g => g._id);

    // Get all members in those groups
    const members = await Member.find({ group: { $in: groupIds } })
      .select('name phone group status isLeader roleTag')
      .populate('group', 'name')
      .sort({ name: 1 })
      .lean();

    // Also include area leader Users (other area admins in same area+district)
    const areaLeaderUsers = await User.find({
      district: districtId,
      'roleTag.type': 'area',
      'roleTag.roleDescription': areaRegex,
      isActive: true
    }).select('name phone roleTag').lean();

    res.status(200).json({
      success: true,
      data: {
        members,
        areaLeaders: areaLeaderUsers,
        areaName,
        groupCount: groups.length,
        memberCount: members.length
      }
    });
  } catch (error) {
    console.error('Get area members error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch area members' });
  }
});

// @route   GET /api/recurring-marks/attendance/:targetId
// @desc    Get attendance data for a specific target/year/month
// @access  Area admins only
router.get('/attendance/:targetId', authenticate, async (req, res) => {
  try {
    if (!isAreaAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only area admins can access this endpoint' });
    }

    const { targetId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'year and month are required' });
    }

    const mark = await RecurringMark.findOne({
      user: req.user._id,
      userType: 'User',
      personalTarget: targetId,
      year: Number(year),
      month: Number(month)
    }).populate('attendance.member', 'name phone');

    res.status(200).json({
      success: true,
      data: mark ? {
        completed: mark.completed,
        attendance: mark.attendance || []
      } : {
        completed: false,
        attendance: []
      }
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance' });
  }
});

// @route   POST /api/recurring-marks
// @desc    Upsert a recurring mark for the current user (toggle month completion)
// @access  Authenticated users (non-member)
router.post('/', authenticate, async (req, res) => {
  try {
    const { targetId, year, month, completed, attendance } = req.body;

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

    // Build the update payload
    const updatePayload = {
      completed: Boolean(completed),
      markedAt: new Date()
    };

    // If target has attendanceNeeded and user is area admin, include attendance
    if (target.attendanceNeeded && isAreaAdmin(req.user) && Array.isArray(attendance)) {
      updatePayload.attendance = attendance.map(a => ({
        member: a.memberId,
        present: Boolean(a.present)
      }));
    }

    const mark = await RecurringMark.findOneAndUpdate(
      {
        user: req.user._id,
        userType: 'User',
        personalTarget: targetId,
        year: Number(year),
        month: Number(month)
      },
      { $set: updatePayload },
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
        markedAt: mark.markedAt,
        attendance: mark.attendance || []
      }
    });
  } catch (error) {
    console.error('Upsert recurring mark error:', error);
    res.status(500).json({ success: false, message: 'Failed to update mark' });
  }
});

export default router;
