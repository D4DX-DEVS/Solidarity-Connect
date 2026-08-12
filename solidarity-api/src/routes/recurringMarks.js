import express from 'express';
import RecurringMark from '../models/RecurringMark.js';
import PersonalTarget from '../models/PersonalTarget.js';
import UserTargetProgress from '../models/UserTargetProgress.js';
import Member from '../models/Member.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { authenticate, isAreaLevelAdmin, adminKindQuery, adminKindOf } from '../middleware/auth.js';

const router = express.Router();

// Helper: is this user an area-level admin? (area proper, or murabi/coordinator —
// identical permissions by design; see middleware/auth.js)
const isAreaAdmin = (user) => isAreaLevelAdmin(user);

// Normalise the week value coming from clients.
// - weekly targets: 1..5 (defaults to 1 if missing / invalid)
// - non-weekly targets: always 0 (month-level mark)
const normaliseWeek = (target, rawWeek) => {
  const isWeekly = target.recurringFrequency === 'weekly';
  if (!isWeekly) return 0;
  const parsed = Number(rawWeek);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) return 1;
  return Math.trunc(parsed);
};

// Shape a RecurringMark document for client consumption.
const formatMark = (m) => ({
  targetId: m.personalTarget.toString(),
  year: m.year,
  month: m.month,
  week: m.week || 0,
  completed: m.completed,
  completionCount: m.completionCount || 0,
  markedAt: m.markedAt,
  attendance: m.attendance || []
});

// @route   GET /api/recurring-marks/my
// @desc    Get all recurring marks for the current (non-member) user
// @access  Authenticated users (non-member)
router.get('/my', authenticate, async (req, res) => {
  try {
    const marks = await RecurringMark.find({
      user: req.user._id,
      userType: 'User'
    }).select('personalTarget year month week completed completionCount markedAt attendance');

    res.status(200).json({ success: true, data: marks.map(formatMark) });
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

    // Also include area leader Users — every area-level admin in the same area+district,
    // Area / Murabi / Coordinator alike.
    const areaLeaderUsers = await User.find({
      ...adminKindQuery('area_level'),
      district: districtId,
      'roleTag.roleDescription': areaRegex,
      isActive: true
    }).select('name phone roleTag adminKind').lean();

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
// @desc    Get attendance data for a specific target/year/month (+ optional week for weekly targets)
// @access  Area admins only
router.get('/attendance/:targetId', authenticate, async (req, res) => {
  try {
    if (!isAreaAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only area admins can access this endpoint' });
    }

    const { targetId } = req.params;
    const { year, month, week } = req.query;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'year and month are required' });
    }

    const weekNum = week !== undefined && week !== '' ? Number(week) : 0;

    const mark = await RecurringMark.findOne({
      user: req.user._id,
      userType: 'User',
      personalTarget: targetId,
      year: Number(year),
      month: Number(month),
      week: Number.isFinite(weekNum) ? weekNum : 0
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
// @desc    Upsert a recurring mark for the current user
//          - weekly targets: one mark per week (body.week = 1..5)
//          - monthly targets: one mark per month; optional body.completionCount to track
//            additional completions beyond the first.
// @access  Authenticated users (non-member)
router.post('/', authenticate, async (req, res) => {
  try {
    const { targetId, year, month, completed, attendance, completionCount } = req.body;

    if (!targetId || !year || !month || completed === undefined) {
      return res.status(400).json({ success: false, message: 'targetId, year, month, and completed are required' });
    }

    const target = await PersonalTarget.findById(targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }
    if (!target.isRecurring) {
      return res.status(400).json({ success: false, message: 'Target is not recurring' });
    }

    const week = normaliseWeek(target, req.body.week);
    const isCompleted = Boolean(completed);

    // Resolve completionCount:
    //   - If the client sends an explicit numeric value, clamp it to 0..99 and use it.
    //   - Otherwise default to 1 when completed, 0 when unmarking.
    let nextCount;
    if (completionCount !== undefined && completionCount !== null) {
      const parsed = Number(completionCount);
      if (Number.isFinite(parsed)) {
        nextCount = Math.max(0, Math.min(99, Math.trunc(parsed)));
      }
    }
    if (nextCount === undefined) nextCount = isCompleted ? 1 : 0;

    const updatePayload = {
      completed: isCompleted,
      completionCount: nextCount,
      markedAt: new Date()
    };

    // Attendance only applies to area-admin-marked targets with attendanceNeeded
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
        month: Number(month),
        week
      },
      { $set: updatePayload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Sync UserTargetProgress for the current user.
    const syncUserTargetProgress = async (userId) => {
      const anyCompleted = await RecurringMark.exists({
        user: userId,
        userType: 'User',
        personalTarget: targetId,
        completed: true
      });
      await UserTargetProgress.findOneAndUpdate(
        { user: userId, personalTarget: targetId },
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
    };

    await syncUserTargetProgress(req.user._id);

    // If the acting user is a district_admin, propagate the same mark to all
    // co-admins in the same district so that shared district targets stay in sync.
    if (req.user.role === 'district_admin' && req.user.district) {
      const coAdmins = await User.find({
        _id: { $ne: req.user._id },
        role: 'district_admin',
        district: req.user.district,
        isActive: true
      }).select('_id').lean();

      await Promise.all(coAdmins.map(async (coAdmin) => {
        await RecurringMark.findOneAndUpdate(
          {
            user: coAdmin._id,
            userType: 'User',
            personalTarget: targetId,
            year: Number(year),
            month: Number(month),
            week
          },
          { $set: updatePayload },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        await syncUserTargetProgress(coAdmin._id);
      }));
    }

    // If the acting user is an area-level admin, propagate the mark to co-admins of the
    // SAME kind in the same area+district — Area to Area, Murabi to Murabi, Coordinator
    // to Coordinator. They share an area but not each other's target sheets.
    if (isAreaAdmin(req.user) && req.user.district && req.user.roleTag?.roleDescription) {
      const areaName = req.user.roleTag.roleDescription;
      const areaRegex = new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const coAreaAdmins = await User.find({
        ...adminKindQuery(adminKindOf(req.user)),
        _id: { $ne: req.user._id },
        'roleTag.roleDescription': areaRegex,
        district: req.user.district,
        isActive: true
      }).select('_id').lean();

      await Promise.all(coAreaAdmins.map(async (coAdmin) => {
        await RecurringMark.findOneAndUpdate(
          {
            user: coAdmin._id,
            userType: 'User',
            personalTarget: targetId,
            year: Number(year),
            month: Number(month),
            week
          },
          { $set: updatePayload },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        await syncUserTargetProgress(coAdmin._id);
      }));
    }

    res.status(200).json({
      success: true,
      message: 'Mark updated successfully',
      data: formatMark(mark)
    });
  } catch (error) {
    console.error('Upsert recurring mark error:', error);
    res.status(500).json({ success: false, message: 'Failed to update mark' });
  }
});

export default router;
