import express from 'express';
import Member from '../models/Member.js';
import Group from '../models/Group.js';
import District from '../models/District.js';
import User from '../models/User.js';
import Request from '../models/Request.js';
import Meeting from '../models/Meeting.js';
import Notification from '../models/Notification.js';
import BaithulMaalPayment from '../models/BaithulMaalPayment.js';
import TransferRequest from '../models/TransferRequest.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.js';

const router = express.Router();

// @route   GET /api/reports/dashboard
// @desc    Get dashboard overview report
// @access  Private
router.get('/dashboard', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    let memberFilter = {};
    let groupFilter = {};
    let districtFilter = {};

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      // Area admins (roleTag.type === 'area') manage multiple groups in their area
      const isArea = req.user.roleTag?.type === 'area';
      const areaName = req.user.roleTag?.roleDescription;

      if (isArea && areaName && req.user.district) {
        // Find all groups in this district matching the area name
        const areaRegex = new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const areaGroups = await Group.find({
          district: req.user.district._id,
          name: areaRegex
        }).select('_id').lean();
        const groupIds = areaGroups.map(g => g._id);

        if (groupIds.length > 0) {
          memberFilter.group = { $in: groupIds };
          groupFilter._id = { $in: groupIds };
        } else {
          // Fallback to single group
          memberFilter.group = req.user.group?._id || null;
          groupFilter._id = req.user.group?._id || null;
        }
      } else if (req.user.group) {
        memberFilter.group = req.user.group._id;
        groupFilter._id = req.user.group._id;
      } else {
        // Safety: group_admin with no resolvable group/district — return empty, not all data
        memberFilter._id = null;
      }
    } else if (req.user.role === 'district_admin') {
      if (!req.user.district) {
        return res.status(500).json({ success: false, message: 'User account misconfigured: no district assigned' });
      }
      memberFilter.district = req.user.district._id;
      groupFilter.district = req.user.district._id;
      districtFilter._id = req.user.district._id;
    }

    // Member statistics
    const memberStats = await Member.aggregate([
      { $match: memberFilter },
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

    // Group statistics (if applicable)
    let groupStats = null;
    if (req.user.role !== 'group_admin') {
      groupStats = await Group.aggregate([
        { $match: groupFilter },
        {
          $group: {
            _id: null,
            totalGroups: { $sum: 1 },
            activeGroups: { $sum: { $cond: ['$isActive', 1, 0] } }
          }
        }
      ]);
    }

    // District statistics (if applicable)
    let districtStats = null;
    if (req.user.role === 'state_admin') {
      districtStats = await District.aggregate([
        { $match: districtFilter },
        {
          $group: {
            _id: null,
            totalDistricts: { $sum: 1 },
            activeDistricts: { $sum: { $cond: ['$isActive', 1, 0] } }
          }
        }
      ]);
    }

    // Recent activity
    const recentMembers = await Member.find(memberFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('district', 'name')
      .populate('group', 'name')
      .select('name phone status createdAt isApproved');

    // Upcoming meetings — filtered by role
    let meetingFilter = {
      scheduledDate: { $gte: new Date() },
      status: 'scheduled'
    };
    if (req.user.role === 'group_admin') {
      const groupId = req.user.group?._id;
      const groupIdsForMeeting = memberFilter.group?.$in || (groupId ? [groupId] : []);
      meetingFilter.$or = [
        { targetAudience: 'all' },
        { targetAudience: 'group_admins' },
        ...(groupIdsForMeeting.length > 0
          ? [{ targetAudience: 'specific_groups', targetGroups: { $in: groupIdsForMeeting } }]
          : [])
      ];
    } else if (req.user.role === 'district_admin') {
      meetingFilter.$or = [
        { targetAudience: 'all' },
        { targetAudience: 'district_admins' },
        { targetAudience: 'specific_groups', targetDistricts: req.user.district._id }
      ];
    }
    const upcomingMeetings = await Meeting.find(meetingFilter)
    .sort({ scheduledDate: 1 })
    .limit(3)
    .select('title scheduledDate meetingType');

    // Pending requests count
    let pendingRequestsCount = 0;
    if (req.user.role === 'state_admin') {
      pendingRequestsCount = await Request.countDocuments({ status: 'pending' });
    } else if (req.user.role === 'district_admin') {
      pendingRequestsCount = await Request.countDocuments({ 
        status: 'pending',
        approvalLevel: 'district_admin'
      });
    } else if (req.user.role === 'group_admin') {
      const groupId = req.user.group?._id;
      const scopeGroupIds = memberFilter.group?.$in || (groupId ? [groupId] : []);
      const requestFilter = { status: 'pending', approvalLevel: 'group_admin' };
      if (scopeGroupIds.length > 0) {
        requestFilter.group = { $in: scopeGroupIds };
      }
      pendingRequestsCount = await Request.countDocuments(requestFilter);
    }

    res.status(200).json({
      success: true,
      data: {
        memberStatistics: memberStats[0] || {
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
        groupStatistics: groupStats?.[0] || null,
        districtStatistics: districtStats?.[0] || null,
        recentMembers,
        upcomingMeetings,
        pendingRequestsCount
      }
    });

  } catch (error) {
    console.error('Get dashboard report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard report'
    });
  }
});

// @route   GET /api/reports/members
// @desc    Get detailed member report
// @access  Private
router.get('/members', 
  authenticate, 
  authorize(['view_reports']),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('district').optional().isMongoId(),
    query('group').optional().isMongoId(),
    query('status').optional().isIn(['Active', 'Inactive', 'Abroad', 'Applicant', 'Age over', 'Dismissed']),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { startDate, endDate, district, group, status, page = 1, limit = 10 } = req.query;

      let filter = {};

      // Apply role-based filtering
      if (req.user.role === 'group_admin') {
        filter.group = req.user.group._id;
      } else if (req.user.role === 'district_admin') {
        filter.district = req.user.district._id;
      } else if (req.user.role === 'state_admin') {
        if (district) filter.district = district;
        if (group) filter.group = group;
      }

      // Apply additional filters
      if (status) filter.status = status;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Pagination parameters
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Member statistics by status
      const statusStats = await Member.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalBaithulMaal: { $sum: '$baithulMaal.monthlyAmount' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      // Age distribution
      const ageDistribution = await Member.aggregate([
        { $match: { ...filter, age: { $exists: true } } },
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

      // Monthly registration trend (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const registrationTrend = await Member.aggregate([
        { 
          $match: { 
            ...filter,
            createdAt: { $gte: twelveMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Group-wise statistics with status breakdown and pagination
      const groupStatsAggregation = [
        { $match: filter },
        {
          $lookup: {
            from: 'groups',
            localField: 'group',
            foreignField: '_id',
            as: 'groupInfo'
          }
        },
        { $unwind: '$groupInfo' },
        {
          $group: {
            _id: '$group',
            groupName: { $first: '$groupInfo.name' },
            groupCode: { $first: '$groupInfo.code' },
            totalMembers: { $sum: 1 },
            activeMembers: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
            inactiveMembers: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } },
            abroadMembers: { $sum: { $cond: [{ $eq: ['$status', 'Abroad'] }, 1, 0] } },
            applicantMembers: { $sum: { $cond: [{ $eq: ['$status', 'Applicant'] }, 1, 0] } },
            totalBaithulMaal: { $sum: '$baithulMaal.monthlyAmount' }
          }
        },
        { $sort: { totalMembers: -1 } }
      ];

      // Get total count for pagination
      const totalGroupsResult = await Member.aggregate([
        ...groupStatsAggregation,
        { $count: 'total' }
      ]);
      const totalGroups = totalGroupsResult[0]?.total || 0;

      // Get paginated results
      const groupStats = await Member.aggregate([
        ...groupStatsAggregation,
        { $skip: skip },
        { $limit: limitNum }
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalGroups / limitNum);
      const pagination = {
        currentPage: pageNum,
        totalPages,
        totalDocs: totalGroups,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      };

      res.status(200).json({
        success: true,
        data: {
          statusStatistics: statusStats,
          ageDistribution,
          registrationTrend,
          groupStatistics: groupStats,
          filters: { startDate, endDate, district, group, status }
        },
        pagination
      });

    } catch (error) {
      console.error('Get member report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch member report'
      });
    }
  }
);

// @route   GET /api/reports/baithul-maal
// @desc    Get Baithul Maal report
// @access  Private
router.get('/baithul-maal', authenticate, authorize(['view_reports', 'manage_baithul_maal']), async (req, res) => {
  try {
    let filter = { 
      status: 'Active', 
      isApproved: true 
    };

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      filter.group = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      filter.district = req.user.district._id;
    }

    // Overall collection statistics
    const collectionStats = await Member.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          contributingMembers: { 
            $sum: { 
              $cond: [{ $gt: ['$baithulMaal.monthlyAmount', 0] }, 1, 0] 
            } 
          },
          totalMonthlyCollection: { $sum: '$baithulMaal.monthlyAmount' },
          totalCollected: { $sum: '$baithulMaal.totalPaid' },
          averageContribution: { $avg: '$baithulMaal.monthlyAmount' }
        }
      }
    ]);

    // Collection by amount ranges
    const amountRanges = await Member.aggregate([
      { 
        $match: { 
          ...filter, 
          'baithulMaal.monthlyAmount': { $gt: 0 } 
        } 
      },
      {
        $bucket: {
          groupBy: '$baithulMaal.monthlyAmount',
          boundaries: [1, 25, 50, 100, 200, 500, 1000, 10000],
          default: 'Above 1000',
          output: {
            count: { $sum: 1 },
            totalAmount: { $sum: '$baithulMaal.monthlyAmount' }
          }
        }
      }
    ]);

    // Top contributing groups
    const topGroups = await Member.aggregate([
      { 
        $match: { 
          ...filter, 
          'baithulMaal.monthlyAmount': { $gt: 0 } 
        } 
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'group',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      { $unwind: '$groupInfo' },
      {
        $group: {
          _id: '$group',
          groupName: { $first: '$groupInfo.name' },
          groupCode: { $first: '$groupInfo.code' },
          memberCount: { $sum: 1 },
          totalMonthlyAmount: { $sum: '$baithulMaal.monthlyAmount' },
          totalCollected: { $sum: '$baithulMaal.totalPaid' },
          averageContribution: { $avg: '$baithulMaal.monthlyAmount' }
        }
      },
      { $sort: { totalMonthlyAmount: -1 } },
      { $limit: 10 }
    ]);

    // Payment trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const paymentTrends = await Member.aggregate([
      { 
        $match: { 
          ...filter,
          'baithulMaal.lastPaymentDate': { $gte: sixMonthsAgo }
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$baithulMaal.lastPaymentDate' },
            month: { $month: '$baithulMaal.lastPaymentDate' }
          },
          paymentCount: { $sum: 1 },
          totalAmount: { $sum: '$baithulMaal.monthlyAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        collectionStatistics: collectionStats[0] || {
          totalMembers: 0,
          contributingMembers: 0,
          totalMonthlyCollection: 0,
          totalCollected: 0,
          averageContribution: 0
        },
        amountRanges,
        topContributingGroups: topGroups,
        paymentTrends
      }
    });

  } catch (error) {
    console.error('Get Baithul Maal report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Baithul Maal report'
    });
  }
});

// @route   GET /api/reports/activity
// @desc    Get activity report
// @access  Private
router.get('/activity', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    let memberFilter = { createdAt: { $gte: startDate } };
    let requestFilter = { createdAt: { $gte: startDate } };

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      memberFilter.group = req.user.group._id;
      requestFilter.requestedBy = req.user._id;
    } else if (req.user.role === 'district_admin') {
      memberFilter.district = req.user.district._id;
      requestFilter.approvalLevel = 'district_admin';
    }

    // New member registrations
    const newMembers = await Member.aggregate([
      { $match: memberFilter },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Request activity
    const requestActivity = await Request.aggregate([
      { $match: requestFilter },
      {
        $group: {
          _id: {
            status: '$status',
            date: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date.year': 1, '_id.date.month': 1, '_id.date.day': 1 } }
    ]);

    // Meeting activity
    const meetingActivity = await Meeting.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: {
            status: '$status',
            date: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date.year': 1, '_id.date.month': 1, '_id.date.day': 1 } }
    ]);

    // Notification activity
    const notificationActivity = await Notification.aggregate([
      { 
        $match: { 
          createdAt: { $gte: startDate }
        } 
      },
      {
        $group: {
          _id: {
            status: '$status',
            date: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            }
          },
          count: { $sum: 1 },
          totalRecipients: { $sum: '$deliveryStats.total' }
        }
      },
      { $sort: { '_id.date.year': 1, '_id.date.month': 1, '_id.date.day': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        period: `Last ${days} days`,
        newMemberRegistrations: newMembers,
        requestActivity,
        meetingActivity,
        notificationActivity
      }
    });

  } catch (error) {
    console.error('Get activity report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity report'
    });
  }
});

// @route   GET /api/reports/attendance
// @desc    Get comprehensive attendance report for state/district admins
// @access  Private (State Admin, District Admin)
router.get('/attendance', 
  authenticate, 
  authorize(['view_reports']),
  [
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('year').optional().isInt({ min: 2020, max: 2050 }),
    query('district').optional().isMongoId(),
    query('group').optional().isMongoId(),
    query('meetingType').optional().isIn(['monthly_series', 'general', 'special']),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { month, year, district, group, meetingType } = req.query;
      
      // Import attendance models
      const Attendance = (await import('../models/Attendance.js')).default;
      const GuestAttendance = (await import('../models/GuestAttendance.js')).default;
      const MeetingSession = (await import('../models/MeetingSession.js')).default;

      let attendanceFilter = {};
      let meetingFilter = {};

      // Apply role-based filtering
      if (req.user.role === 'district_admin') {
        attendanceFilter.district = req.user.district._id;
        meetingFilter.$or = [
          { targetAudience: 'all' },
          { targetAudience: 'district_admins' },
          { targetDistricts: req.user.district._id }
        ];
      } else if (req.user.role === 'state_admin') {
        // State admin can see all data
        if (district) attendanceFilter.district = district;
        if (group) attendanceFilter.group = group;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This report is only available to state and district admins.'
        });
      }

      // Apply date filters
      if (month && year) {
        attendanceFilter.meetingMonth = month;
        attendanceFilter.meetingYear = year;
      } else if (year) {
        attendanceFilter.meetingYear = year;
      }

      // Apply meeting type filter
      if (meetingType) {
        meetingFilter.meetingType = meetingType;
      }

      // Get meetings that match the criteria
      const meetings = await Meeting.find(meetingFilter)
        .populate('targetGroups', 'name code district')
        .populate('targetDistricts', 'name code')
        .populate('createdBy', 'name role')
        .sort({ scheduledDate: -1 });

      const attendanceReport = [];

      for (const meeting of meetings) {
        // Get member attendance for this meeting
        const memberAttendance = await Attendance.find({
          ...attendanceFilter,
          meeting: meeting._id
        })
        .populate('member', 'name phone status')
        .populate('group', 'name code')
        .populate('district', 'name code')
        .populate('markedBy', 'name role');

        // Get guest attendance for this meeting
        const guestAttendance = await GuestAttendance.find({
          ...attendanceFilter,
          meeting: meeting._id
        })
        .populate('group', 'name code')
        .populate('district', 'name code')
        .populate('addedBy', 'name role');

        // Get session data for monthly series meetings
        let sessionData = [];
        if (meeting.meetingType === 'monthly_series') {
          const sessions = await MeetingSession.find({ meeting: meeting._id })
            .sort({ sessionNumber: 1 })
            .populate('completedBy', 'name role')
            .select('sessionNumber title scheduledDate sessionStatus completedBy completedAt');
          
          sessionData = sessions.map(session => ({
            sessionId: session._id,
            sessionNumber: session.sessionNumber,
            title: session.title,
            scheduledDate: session.scheduledDate,
            status: session.sessionStatus,
            completedBy: session.completedBy,
            completedAt: session.completedAt
          }));
        }

        // Calculate statistics
        const memberStats = {
          total: memberAttendance.length,
          present: memberAttendance.filter(a => a.status === 'present').length,
          absent: memberAttendance.filter(a => a.status === 'absent').length,
          late: memberAttendance.filter(a => a.status === 'late').length,
          excused: memberAttendance.filter(a => a.status === 'excused').length
        };

        const guestStats = {
          total: guestAttendance.length,
          present: guestAttendance.filter(a => a.status === 'present').length,
          absent: guestAttendance.filter(a => a.status === 'absent').length,
          late: guestAttendance.filter(a => a.status === 'late').length
        };

        const overallStats = {
          totalParticipants: memberStats.total + guestStats.total,
          totalPresent: memberStats.present + memberStats.late + guestStats.present + guestStats.late,
          attendanceRate: (memberStats.total + guestStats.total) > 0 ? 
            (((memberStats.present + memberStats.late + guestStats.present + guestStats.late) / 
              (memberStats.total + guestStats.total)) * 100).toFixed(1) : 0
        };

        // Group attendance by group for better organization
        const attendanceByGroup = {};
        
        memberAttendance.forEach(record => {
          const groupId = record.group._id.toString();
          if (!attendanceByGroup[groupId]) {
            attendanceByGroup[groupId] = {
              group: record.group,
              district: record.district,
              members: [],
              guests: [],
              stats: { 
                members: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
                guests: { total: 0, present: 0, absent: 0, late: 0 }
              }
            };
          }
          
          attendanceByGroup[groupId].members.push(record);
          attendanceByGroup[groupId].stats.members.total++;
          attendanceByGroup[groupId].stats.members[record.status]++;
        });

        guestAttendance.forEach(record => {
          const groupId = record.group._id.toString();
          if (!attendanceByGroup[groupId]) {
            attendanceByGroup[groupId] = {
              group: record.group,
              district: record.district,
              members: [],
              guests: [],
              stats: { 
                members: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
                guests: { total: 0, present: 0, absent: 0, late: 0 }
              }
            };
          }
          
          attendanceByGroup[groupId].guests.push(record);
          attendanceByGroup[groupId].stats.guests.total++;
          attendanceByGroup[groupId].stats.guests[record.status]++;
        });

        attendanceReport.push({
          meeting: {
            id: meeting._id,
            title: meeting.title,
            meetingType: meeting.meetingType,
            scheduledDate: meeting.scheduledDate,
            status: meeting.status,
            createdBy: meeting.createdBy,
            targetAudience: meeting.targetAudience,
            monthlyDetails: meeting.monthlyDetails
          },
          sessions: sessionData,
          attendance: {
            byGroup: Object.values(attendanceByGroup),
            statistics: {
              members: memberStats,
              guests: guestStats,
              overall: overallStats
            }
          }
        });
      }

      // Calculate summary statistics
      const summaryStats = {
        totalMeetings: attendanceReport.length,
        totalSessions: attendanceReport.reduce((sum, report) => sum + report.sessions.length, 0),
        completedSessions: attendanceReport.reduce((sum, report) => 
          sum + report.sessions.filter(s => s.status === 'completed').length, 0),
        totalParticipants: attendanceReport.reduce((sum, report) => 
          sum + report.attendance.statistics.overall.totalParticipants, 0),
        totalPresent: attendanceReport.reduce((sum, report) => 
          sum + report.attendance.statistics.overall.totalPresent, 0),
        overallAttendanceRate: 0
      };

      if (summaryStats.totalParticipants > 0) {
        summaryStats.overallAttendanceRate = 
          ((summaryStats.totalPresent / summaryStats.totalParticipants) * 100).toFixed(1);
      }

      res.status(200).json({
        success: true,
        data: {
          summary: summaryStats,
          meetings: attendanceReport,
          filters: { month, year, district, group, meetingType },
          userRole: req.user.role
        }
      });

    } catch (error) {
      console.error('Get attendance report error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance report'
      });
    }
  }
);

// @route   GET /api/reports/attendance/summary
// @desc    Get attendance summary statistics for dashboard
// @access  Private (State Admin, District Admin)
router.get('/attendance/summary', 
  authenticate, 
  authorize(['view_reports']),
  async (req, res) => {
    try {
      // Import attendance models
      const Attendance = (await import('../models/Attendance.js')).default;
      const GuestAttendance = (await import('../models/GuestAttendance.js')).default;
      const MeetingSession = (await import('../models/MeetingSession.js')).default;

      let attendanceFilter = {};
      let meetingFilter = {};

      // Apply role-based filtering
      if (req.user.role === 'district_admin') {
        attendanceFilter.district = req.user.district._id;
        meetingFilter.$or = [
          { targetAudience: 'all' },
          { targetAudience: 'district_admins' },
          { targetDistricts: req.user.district._id }
        ];
      } else if (req.user.role !== 'state_admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This report is only available to state and district admins.'
        });
      }

      // Get current month/year for recent data
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // This month's attendance statistics
      const thisMonthAttendance = await Attendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingMonth: currentMonth,
            meetingYear: currentYear
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const thisMonthGuests = await GuestAttendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingMonth: currentMonth,
            meetingYear: currentYear
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Overall attendance statistics (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const overallAttendance = await Attendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingDate: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
            absentCount: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } }
          }
        }
      ]);

      // Group-wise attendance rates
      const groupAttendanceRates = await Attendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingDate: { $gte: sixMonthsAgo }
          }
        },
        {
          $lookup: {
            from: 'groups',
            localField: 'group',
            foreignField: '_id',
            as: 'groupInfo'
          }
        },
        { $unwind: '$groupInfo' },
        {
          $group: {
            _id: '$group',
            groupName: { $first: '$groupInfo.name' },
            groupCode: { $first: '$groupInfo.code' },
            totalRecords: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
            attendanceRate: {
              $multiply: [
                {
                  $divide: [
                    { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
                    { $sum: 1 }
                  ]
                },
                100
              ]
            }
          }
        },
        { $sort: { attendanceRate: -1 } },
        { $limit: 10 }
      ]);

      // Monthly attendance trends (last 12 months)
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const monthlyTrends = await Attendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingDate: { $gte: twelveMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: '$meetingYear',
              month: '$meetingMonth'
            },
            totalRecords: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
            attendanceRate: {
              $multiply: [
                {
                  $divide: [
                    { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
                    { $sum: 1 }
                  ]
                },
                100
              ]
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      // Session completion statistics
      const sessionStats = await MeetingSession.aggregate([
        {
          $lookup: {
            from: 'meetings',
            localField: 'meeting',
            foreignField: '_id',
            as: 'meetingInfo'
          }
        },
        { $unwind: '$meetingInfo' },
        {
          $match: meetingFilter
        },
        {
          $group: {
            _id: '$sessionStatus',
            count: { $sum: 1 }
          }
        }
      ]);

      // Format the response
      const thisMonthStats = {
        members: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
        guests: { total: 0, present: 0, absent: 0, late: 0 }
      };

      thisMonthAttendance.forEach(stat => {
        thisMonthStats.members[stat._id] = stat.count;
        thisMonthStats.members.total += stat.count;
      });

      thisMonthGuests.forEach(stat => {
        thisMonthStats.guests[stat._id] = stat.count;
        thisMonthStats.guests.total += stat.count;
      });

      const overallStats = overallAttendance[0] || { totalRecords: 0, presentCount: 0, absentCount: 0 };
      overallStats.attendanceRate = overallStats.totalRecords > 0 ? 
        ((overallStats.presentCount / overallStats.totalRecords) * 100).toFixed(1) : 0;

      const sessionSummary = {
        total: 0,
        completed: 0,
        scheduled: 0,
        cancelled: 0
      };

      sessionStats.forEach(stat => {
        sessionSummary[stat._id] = stat.count;
        sessionSummary.total += stat.count;
      });

      res.status(200).json({
        success: true,
        data: {
          thisMonth: {
            period: `${currentMonth}/${currentYear}`,
            statistics: thisMonthStats,
            totalParticipants: thisMonthStats.members.total + thisMonthStats.guests.total,
            totalPresent: thisMonthStats.members.present + thisMonthStats.members.late + 
                         thisMonthStats.guests.present + thisMonthStats.guests.late
          },
          overall: {
            period: 'Last 6 months',
            ...overallStats
          },
          topPerformingGroups: groupAttendanceRates,
          monthlyTrends,
          sessionStatistics: sessionSummary,
          userRole: req.user.role
        }
      });

    } catch (error) {
      console.error('Get attendance summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance summary'
      });
    }
  }
);

// @route   GET /api/reports/attendance/export
// @desc    Export attendance data as CSV
// @access  Private (State Admin, District Admin)
router.get('/attendance/export', 
  authenticate, 
  authorize(['view_reports']),
  [
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('year').optional().isInt({ min: 2020, max: 2050 }),
    query('district').optional().isMongoId(),
    query('group').optional().isMongoId(),
    query('format').optional().isIn(['csv', 'json']).withMessage('Format must be csv or json'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { month, year, district, group, format = 'csv' } = req.query;
      
      // Import attendance models
      const Attendance = (await import('../models/Attendance.js')).default;
      const GuestAttendance = (await import('../models/GuestAttendance.js')).default;

      let attendanceFilter = {};

      // Apply role-based filtering
      if (req.user.role === 'district_admin') {
        attendanceFilter.district = req.user.district._id;
      } else if (req.user.role === 'state_admin') {
        if (district) attendanceFilter.district = district;
        if (group) attendanceFilter.group = group;
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This export is only available to state and district admins.'
        });
      }

      // Apply date filters
      if (month && year) {
        attendanceFilter.meetingMonth = month;
        attendanceFilter.meetingYear = year;
      } else if (year) {
        attendanceFilter.meetingYear = year;
      }

      // Get member attendance data
      const memberAttendance = await Attendance.find(attendanceFilter)
        .populate('meeting', 'title meetingType scheduledDate')
        .populate('member', 'name phone status')
        .populate('group', 'name code')
        .populate('district', 'name code')
        .populate('markedBy', 'name role')
        .sort({ meetingDate: -1, 'group.name': 1, 'member.name': 1 });

      // Get guest attendance data
      const guestAttendance = await GuestAttendance.find(attendanceFilter)
        .populate('meeting', 'title meetingType scheduledDate')
        .populate('group', 'name code')
        .populate('district', 'name code')
        .populate('addedBy', 'name role')
        .sort({ meetingDate: -1, 'group.name': 1, name: 1 });

      if (format === 'json') {
        res.status(200).json({
          success: true,
          data: {
            memberAttendance,
            guestAttendance,
            exportDate: new Date().toISOString(),
            filters: { month, year, district, group }
          }
        });
        return;
      }

      // CSV Export
      const csvHeaders = [
        'Type', 'Meeting Title', 'Meeting Type', 'Meeting Date', 'Participant Name', 
        'Phone', 'Organization', 'Group', 'District', 'Status', 'Marked By', 'Marked Date', 'Notes'
      ];

      const csvRows = [];

      // Add member attendance rows
      memberAttendance.forEach(record => {
        csvRows.push([
          'Member',
          record.meeting.title,
          record.meeting.meetingType,
          record.meetingDate.toISOString().split('T')[0],
          record.member.name,
          record.member.phone,
          '', // No organization for members
          record.group.name,
          record.district.name,
          record.status,
          record.markedBy?.name || '',
          record.markedAt.toISOString().split('T')[0],
          record.notes || ''
        ]);
      });

      // Add guest attendance rows
      guestAttendance.forEach(record => {
        csvRows.push([
          'Guest',
          record.meeting.title,
          record.meeting.meetingType,
          record.meetingDate.toISOString().split('T')[0],
          record.name,
          record.phone || '',
          record.organization || '',
          record.group.name,
          record.district.name,
          record.status,
          record.addedBy?.name || '',
          record.addedAt.toISOString().split('T')[0],
          record.notes || ''
        ]);
      });

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      const filename = `attendance-export-${year || 'all'}-${month || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);

    } catch (error) {
      console.error('Export attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export attendance data'
      });
    }
  }
);

// @route   GET /api/reports/export/members
// @desc    Export members data as CSV
// @access  Private
router.get('/export/members', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    let filter = {};

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      filter.group = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      filter.district = req.user.district._id;
    }

    const members = await Member.find(filter)
      .populate('district', 'name code')
      .populate('group', 'name code')
      .select('name phone email dateOfBirth age bloodGroup profession education address status baithulMaal joinedDate isApproved')
      .sort({ name: 1 });

    // Convert to CSV format
    const csvHeaders = [
      'Name', 'Phone', 'Email', 'Date of Birth', 'Age', 'Blood Group',
      'Profession', 'Education', 'Address', 'District', 'Group', 'Status',
      'Monthly Baithul Maal', 'Total Paid', 'Joined Date', 'Approved'
    ];

    const csvRows = members.map(member => [
      member.name,
      member.phone,
      member.email || '',
      member.dateOfBirth ? member.dateOfBirth.toISOString().split('T')[0] : '',
      member.age || '',
      member.bloodGroup || '',
      member.profession || '',
      member.education || '',
      member.address || '',
      member.district?.name || '',
      member.group?.name || '',
      member.status,
      member.baithulMaal?.monthlyAmount || 0,
      member.baithulMaal?.totalPaid || 0,
      member.joinedDate ? member.joinedDate.toISOString().split('T')[0] : '',
      member.isApproved ? 'Yes' : 'No'
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="members-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export members data'
    });
  }
});

export default router;
