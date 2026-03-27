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
import PersonalTarget from '../models/PersonalTarget.js';
import UserTargetProgress from '../models/UserTargetProgress.js';
import MemberTargetProgress from '../models/MemberTargetProgress.js';
import RecurringMark from '../models/RecurringMark.js';
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
      memberFilter.group = req.user.group._id;
      groupFilter._id = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
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

    // Upcoming meetings
    const upcomingMeetings = await Meeting.find({
      scheduledDate: { $gte: new Date() },
      status: 'scheduled'
    })
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
      pendingRequestsCount = await Request.countDocuments({ 
        status: 'pending',
        approvalLevel: 'group_admin'
      });
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

const getRoleScope = (user) => {
  const districtFromGroup = user?.group?.district?._id || user?.group?.district;
  const districtId = user?.district?._id || districtFromGroup || null;
  const groupId = user?.group?._id || null;

  if (user.role === 'district_admin') {
    return { districtId, groupId: null };
  }
  if (user.role === 'group_admin') {
    return { districtId, groupId };
  }
  return { districtId: null, groupId: null };
};

const getAllowedTargetAudiences = (user) => {
  if (user.role === 'state_admin') return null;
  if (user.role === 'district_admin') return ['all_users', 'members_only', 'district_admins'];
  if (user.role === 'group_admin') {
    const roleAudience = user.roleTag?.type === 'area' ? 'area_admins' : 'group_admins';
    return ['all_users', 'members_only', roleAudience, 'group_and_area_admins'];
  }
  return ['all_users'];
};

// @route   GET /api/reports/consolidation
// @desc    Get filtered list of users for consolidation
// @access  Admins with view_reports
router.get('/consolidation', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    if (!['state_admin', 'district_admin', 'group_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied for this role' });
    }

    const { districtId, groupId, roleFilter, consolidationType, targetId, targetStatus } = req.query;
    const mongoose = (await import('mongoose')).default;
    const roleScope = getRoleScope(req.user);

    if (req.user.role === 'district_admin' && !roleScope.districtId) {
      return res.status(403).json({ success: false, message: 'District access not configured for this user' });
    }
    if (req.user.role === 'group_admin' && !roleScope.groupId) {
      return res.status(403).json({ success: false, message: 'Group access not configured for this user' });
    }

    const effectiveDistrictId = req.user.role === 'state_admin' ? districtId : roleScope.districtId;
    const effectiveGroupId = req.user.role === 'state_admin' ? groupId : roleScope.groupId;

    // Build user filter
    const userFilter = { isActive: true };
    if (effectiveDistrictId) userFilter.district = new mongoose.Types.ObjectId(effectiveDistrictId);
    if (effectiveGroupId) userFilter.group = new mongoose.Types.ObjectId(effectiveGroupId);

    if (roleFilter === 'district_admin') {
      userFilter.role = 'district_admin';
    } else if (roleFilter === 'area_admin') {
      userFilter.role = 'group_admin';
      userFilter['roleTag.type'] = 'area';
    } else if (roleFilter === 'unit_admin') {
      userFilter.role = 'group_admin';
      userFilter['roleTag.type'] = 'unit';
    } else if (roleFilter === 'group_admin') {
      userFilter.role = 'group_admin';
      // include all group_admin subtypes
    }

    let users = await User.find(userFilter)
      .populate('district', 'name code')
      .populate('group', 'name code')
      .select('name role roleTag district group phone createdAt')
      .sort({ name: 1 });

    // Personal target filtering
    let targetMeta = null;
    const progressMap = {};

    if (consolidationType === 'personal_target' && targetId) {
      targetMeta = await PersonalTarget.findById(new mongoose.Types.ObjectId(targetId))
        .select('title category targetAudience');

      const progressQuery = { personalTarget: new mongoose.Types.ObjectId(targetId) };
      if (targetStatus && targetStatus !== 'all') progressQuery.status = targetStatus;

      const progressRecords = await UserTargetProgress.find(progressQuery)
        .select('user status completedAt feedback');
      progressRecords.forEach(p => {
        progressMap[p.user.toString()] = p;
      });

      // Filter to only users with a matching progress record
      if (targetStatus && targetStatus !== 'all') {
        users = users.filter(u => !!progressMap[u._id.toString()]);
      }
    }

    const data = users.map(u => ({
      _id: u._id,
      name: u.name,
      role: u.role,
      roleTag: u.roleTag,
      district: u.district,
      group: u.group,
      phone: u.phone,
      progress: progressMap[u._id.toString()] || null
    }));

    res.status(200).json({
      success: true,
      data,
      meta: {
        count: data.length,
        target: targetMeta,
        filters: {
          districtId: effectiveDistrictId || null,
          groupId: effectiveGroupId || null,
          roleFilter,
          consolidationType,
          targetId,
          targetStatus
        }
      }
    });
  } catch (error) {
    console.error('Consolidation report error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate consolidation report' });
  }
});

// @route   GET /api/reports/org-stats
// @desc    Get org-wide stats: user role breakdown, target counts, leaders
// @access  Admins with view_reports
router.get('/org-stats', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    if (!['state_admin', 'district_admin', 'group_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied for this role' });
    }

    const now = new Date();
    const roleScope = getRoleScope(req.user);
    const targetAudiences = getAllowedTargetAudiences(req.user);

    if (req.user.role === 'district_admin' && !roleScope.districtId) {
      return res.status(403).json({ success: false, message: 'District access not configured for this user' });
    }
    if (req.user.role === 'group_admin' && !roleScope.groupId) {
      return res.status(403).json({ success: false, message: 'Group access not configured for this user' });
    }

    const scopedUserMatch = { isActive: true };
    if (roleScope.districtId) scopedUserMatch.district = roleScope.districtId;
    if (roleScope.groupId) scopedUserMatch.group = roleScope.groupId;

    // User role breakdown
    const userRoleStats = await User.aggregate([
      { $match: scopedUserMatch },
      {
        $group: {
          _id: { role: '$role', tagType: '$roleTag.type' },
          count: { $sum: 1 }
        }
      }
    ]);

    const roleBreakdown = { district_admin: 0, area_admin: 0, unit_admin: 0, group_admin: 0, other: 0, total: 0 };
    for (const r of userRoleStats) {
      roleBreakdown.total += r.count;
      if (r._id.role === 'district_admin') roleBreakdown.district_admin += r.count;
      else if (r._id.role === 'group_admin' && r._id.tagType === 'area') roleBreakdown.area_admin += r.count;
      else if (r._id.role === 'group_admin' && r._id.tagType === 'unit') roleBreakdown.unit_admin += r.count;
      else if (r._id.role === 'group_admin') roleBreakdown.group_admin += r.count;
      else roleBreakdown.other += r.count;
    }

    // Leaders = district + area admins
    roleBreakdown.leaders = roleBreakdown.district_admin + roleBreakdown.area_admin;

    const targetBaseFilter = { isTemplate: false };
    if (targetAudiences) targetBaseFilter.targetAudience = { $in: targetAudiences };

    // Target counts
    const activeTargets = await PersonalTarget.countDocuments({
      ...targetBaseFilter,
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    const totalTargets = await PersonalTarget.countDocuments(targetBaseFilter);
    const scopedTargetIds = await PersonalTarget.find(targetBaseFilter).distinct('_id');

    const userProgressMatch = { 'userInfo.isActive': true };
    if (roleScope.districtId) userProgressMatch['userInfo.district'] = roleScope.districtId;
    if (roleScope.groupId) userProgressMatch['userInfo.group'] = roleScope.groupId;

    const memberProgressMatch = {};
    if (roleScope.districtId) memberProgressMatch['memberInfo.district'] = roleScope.districtId;
    if (roleScope.groupId) memberProgressMatch['memberInfo.group'] = roleScope.groupId;

    const targetProgressFilter = {};
    if (scopedTargetIds.length > 0) {
      targetProgressFilter.personalTarget = { $in: scopedTargetIds };
    } else {
      targetProgressFilter.personalTarget = { $in: [] };
    }

    // Submissions
    const [userSubmissionsResult, memberSubmissionsResult] = await Promise.all([
      UserTargetProgress.aggregate([
        { $match: { ...targetProgressFilter, status: 'completed' } },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        { $match: userProgressMatch },
        { $count: 'count' }
      ]),
      MemberTargetProgress.aggregate([
        { $match: { ...targetProgressFilter, status: 'completed' } },
        {
          $lookup: {
            from: 'members',
            localField: 'member',
            foreignField: '_id',
            as: 'memberInfo'
          }
        },
        { $unwind: '$memberInfo' },
        { $match: memberProgressMatch },
        { $count: 'count' }
      ])
    ]);

    const [userInProgressResult, memberInProgressResult] = await Promise.all([
      UserTargetProgress.aggregate([
        { $match: { ...targetProgressFilter, status: 'in_progress' } },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        { $match: userProgressMatch },
        { $count: 'count' }
      ]),
      MemberTargetProgress.aggregate([
        { $match: { ...targetProgressFilter, status: 'in_progress' } },
        {
          $lookup: {
            from: 'members',
            localField: 'member',
            foreignField: '_id',
            as: 'memberInfo'
          }
        },
        { $unwind: '$memberInfo' },
        { $match: memberProgressMatch },
        { $count: 'count' }
      ])
    ]);

    const userSubmissions = userSubmissionsResult[0]?.count || 0;
    const memberSubmissions = memberSubmissionsResult[0]?.count || 0;
    const userInProgress = userInProgressResult[0]?.count || 0;
    const memberInProgress = memberInProgressResult[0]?.count || 0;

    const groupFilter = { isActive: true };
    if (roleScope.districtId) groupFilter.district = roleScope.districtId;
    if (roleScope.groupId) groupFilter._id = roleScope.groupId;

    // Group count
    const totalGroups = await Group.countDocuments(groupFilter);

    res.status(200).json({
      success: true,
      data: {
        users: roleBreakdown,
        targets: {
          active: activeTargets,
          total: totalTargets,
          completedSubmissions: userSubmissions + memberSubmissions,
          inProgressSubmissions: userInProgress + memberInProgress
        },
        totalGroups
      }
    });
  } catch (error) {
    console.error('Org stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch org stats' });
  }
});

// @route   GET /api/reports/recurring-target-stats
// @desc    Get dashboard stats for all currently active recurring personal targets
// @access  Admins with view_reports
router.get('/recurring-target-stats', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    if (!['state_admin', 'district_admin', 'group_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied for this role' });
    }

    const now = new Date();
    const roleScope = getRoleScope(req.user);
    const targetAudiences = getAllowedTargetAudiences(req.user);

    if (req.user.role === 'district_admin' && !roleScope.districtId) {
      return res.status(403).json({ success: false, message: 'District access not configured for this user' });
    }
    if (req.user.role === 'group_admin' && !roleScope.groupId) {
      return res.status(403).json({ success: false, message: 'Group access not configured for this user' });
    }

    const targetFilter = {
      isRecurring: true,
      isTemplate: false,
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gte: now }
    };
    if (targetAudiences) targetFilter.targetAudience = { $in: targetAudiences };

    // Fetch active recurring targets whose window includes today
    const targets = await PersonalTarget.find(targetFilter)
      .sort({ startDate: -1 })
      .select('title category recurringFrequency startDate endDate targetAudience attendanceNeeded')
      .lean();

    if (targets.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const targetIds = targets.map(t => t._id);

    // --- UserTargetProgress stats (admin users) ---
    const userProgressScopeMatch = { 'userInfo.isActive': true };
    if (roleScope.districtId) userProgressScopeMatch['userInfo.district'] = roleScope.districtId;
    if (roleScope.groupId) userProgressScopeMatch['userInfo.group'] = roleScope.groupId;

    const userProgressStats = await UserTargetProgress.aggregate([
      { $match: { personalTarget: { $in: targetIds } } },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      { $match: userProgressScopeMatch },
      {
        $lookup: {
          from: 'districts',
          localField: 'userInfo.district',
          foreignField: '_id',
          as: 'districtInfo'
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'userInfo.group',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      {
        $group: {
          _id: {
            targetId: '$personalTarget',
            status: '$status',
            districtId: { $arrayElemAt: ['$districtInfo._id', 0] },
            districtName: { $arrayElemAt: ['$districtInfo.name', 0] },
            groupId: { $arrayElemAt: ['$groupInfo._id', 0] },
            groupName: { $arrayElemAt: ['$groupInfo.name', 0] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // --- MemberTargetProgress stats (members) ---
    const memberProgressScopeMatch = {};
    if (roleScope.districtId) memberProgressScopeMatch['memberInfo.district'] = roleScope.districtId;
    if (roleScope.groupId) memberProgressScopeMatch['memberInfo.group'] = roleScope.groupId;

    const memberProgressStats = await MemberTargetProgress.aggregate([
      { $match: { personalTarget: { $in: targetIds } } },
      {
        $lookup: {
          from: 'members',
          localField: 'member',
          foreignField: '_id',
          as: 'memberInfo'
        }
      },
      { $unwind: '$memberInfo' },
      { $match: memberProgressScopeMatch },
      {
        $lookup: {
          from: 'districts',
          localField: 'memberInfo.district',
          foreignField: '_id',
          as: 'districtInfo'
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'memberInfo.group',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      {
        $addFields: {
          normalizedStatus: {
            $cond: [
              { $in: ['$status', ['completed']] },
              'completed',
              {
                $cond: [
                  { $eq: ['$status', 'in_progress'] },
                  'in_progress',
                  'not_started'
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            targetId: '$personalTarget',
            status: '$normalizedStatus',
            districtId: { $arrayElemAt: ['$districtInfo._id', 0] },
            districtName: { $arrayElemAt: ['$districtInfo.name', 0] },
            groupId: { $arrayElemAt: ['$groupInfo._id', 0] },
            groupName: { $arrayElemAt: ['$groupInfo.name', 0] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Merge both result sets
    const combined = [...userProgressStats, ...memberProgressStats];

    // Build per-target aggregation map
    const statsMap = {};
    for (const row of combined) {
      const tid = row._id.targetId.toString();
      if (!statsMap[tid]) {
        statsMap[tid] = {
          completed: 0, in_progress: 0, not_started: 0,
          byDistrict: {}, byGroup: {}
        };
      }
      const s = statsMap[tid];
      const status = row._id.status;
      s[status] = (s[status] || 0) + row.count;

      // By district
      if (row._id.districtName) {
        const dk = row._id.districtName;
        if (!s.byDistrict[dk]) s.byDistrict[dk] = { _id: row._id.districtId?.toString(), completed: 0, not_completed: 0 };
        if (status === 'completed') s.byDistrict[dk].completed += row.count;
        else s.byDistrict[dk].not_completed += row.count;
      }

      // By group
      if (row._id.groupName) {
        const gk = row._id.groupName;
        if (!s.byGroup[gk]) s.byGroup[gk] = { _id: row._id.groupId?.toString(), completed: 0, not_completed: 0 };
        if (status === 'completed') s.byGroup[gk].completed += row.count;
        else s.byGroup[gk].not_completed += row.count;
      }
    }

    // Build final response
    const result = targets.map(t => {
      const tid = t._id.toString();
      const raw = statsMap[tid] || { completed: 0, in_progress: 0, not_started: 0, byDistrict: {}, byGroup: {} };
      const total = raw.completed + raw.in_progress + raw.not_started;
      const completionRate = total > 0 ? Math.round((raw.completed / total) * 100) : 0;

      return {
        _id: t._id,
        title: t.title,
        category: t.category,
        recurringFrequency: t.recurringFrequency,
        startDate: t.startDate,
        endDate: t.endDate,
        targetAudience: t.targetAudience,
        stats: {
          total,
          completed: raw.completed,
          in_progress: raw.in_progress,
          not_started: raw.not_started,
          completionRate,
          byDistrict: Object.entries(raw.byDistrict).map(([name, v]) => ({ name, ...v })),
          byGroup: Object.entries(raw.byGroup).map(([name, v]) => ({ name, ...v }))
        }
      };
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Recurring target stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recurring target stats' });
  }
});

// @route   GET /api/reports/recurring-marks
// @desc    Get all users' recurring marks for a target in a given year (admin grid view)
// @access  state_admin, district_admin, group_admin
router.get('/recurring-marks', authenticate, async (req, res) => {
  try {
    const { targetId, year } = req.query;
    if (!targetId || !year) {
      return res.status(400).json({ success: false, message: 'targetId and year are required' });
    }

    const yearNum = Number(year);

    // Fetch all marks for this target+year
    const marks = await RecurringMark.find({
      personalTarget: targetId,
      year: yearNum
    });

    // Group marks by userId
    const marksByUser = {};
    for (const m of marks) {
      const uid = m.user.toString();
      if (!marksByUser[uid]) {
        marksByUser[uid] = { userType: m.userType, marks: {} };
      }
      marksByUser[uid].marks[m.month] = m.completed;
    }

    const userIds = Object.keys(marksByUser);
    if (userIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Separate User and Member IDs
    const userTypeUser = userIds.filter(id => marksByUser[id].userType === 'User');
    const userTypeMember = userIds.filter(id => marksByUser[id].userType === 'Member');

    // Scope by admin role
    const districtFilter = req.user.role === 'district_admin' && req.user.district
      ? { district: req.user.district }
      : {};
    const groupFilter = req.user.role === 'group_admin' && req.user.group
      ? { group: req.user.group }
      : {};
    const scopeFilter = { ...districtFilter, ...groupFilter };

    const [users, members] = await Promise.all([
      userTypeUser.length > 0
        ? User.find({ _id: { $in: userTypeUser }, ...scopeFilter })
            .select('name role roleTag district group')
            .populate('district', 'name').populate('group', 'name')
        : Promise.resolve([]),
      userTypeMember.length > 0
        ? (await import('../models/Member.js')).default
            .find({ _id: { $in: userTypeMember }, ...scopeFilter })
            .select('name district group')
            .populate('district', 'name').populate('group', 'name')
        : Promise.resolve([])
    ]);

    const result = [
      ...users.map(u => ({
        userId: u._id.toString(),
        userName: u.name,
        role: u.role,
        district: u.district?.name || '',
        group: u.group?.name || '',
        marks: marksByUser[u._id.toString()]?.marks || {}
      })),
      ...members.map(m => ({
        userId: m._id.toString(),
        userName: m.name,
        role: 'member',
        district: m.district?.name || '',
        group: m.group?.name || '',
        marks: marksByUser[m._id.toString()]?.marks || {}
      }))
    ];

    // Sort by name
    result.sort((a, b) => a.userName.localeCompare(b.userName));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Recurring marks grid error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recurring marks grid' });
  }
});

// @route   GET /api/reports/recurring-marks-filter
// @desc    Filter recurring marks by target, region, period, and completion status
// @access  state_admin, district_admin, group_admin with view_reports
router.get('/recurring-marks-filter', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    if (!['state_admin', 'district_admin', 'group_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { targetId, districtId, fromYear, fromMonth, toYear, toMonth, status } = req.query;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'targetId is required' });
    }

    const roleScope = getRoleScope(req.user);

    const target = await PersonalTarget.findById(targetId).lean();
    if (!target || !target.isRecurring) {
      return res.status(404).json({ success: false, message: 'Recurring target not found' });
    }

    // Build mark query with optional period filter
    const markQuery = { personalTarget: target._id };

    if (fromYear && fromMonth && toYear && toMonth) {
      const fromYearN = Number(fromYear), fromMonthN = Number(fromMonth);
      const toYearN = Number(toYear), toMonthN = Number(toMonth);
      const pairs = [];
      let y = fromYearN, m = fromMonthN;
      while (y < toYearN || (y === toYearN && m <= toMonthN)) {
        pairs.push({ year: y, month: m });
        m++;
        if (m > 12) { m = 1; y++; }
      }
      if (pairs.length > 0) {
        markQuery.$or = pairs.map(p => ({ year: p.year, month: p.month }));
      }
    }

    const marks = await RecurringMark.find(markQuery).lean();

    // Group marks by userId
    const userMap = {};
    for (const m of marks) {
      const uid = m.user.toString();
      if (!userMap[uid]) {
        userMap[uid] = { userType: m.userType, completedMonths: [], notCompletedMonths: [] };
      }
      const key = `${m.year}-${m.month}`;
      if (m.completed) userMap[uid].completedMonths.push(key);
      else userMap[uid].notCompletedMonths.push(key);
    }

    let userIds = Object.keys(userMap);
    if (userIds.length === 0) {
      return res.status(200).json({ success: true, data: { total: 0, results: [] } });
    }

    // Filter by completion status at user level
    if (status === 'completed') {
      userIds = userIds.filter(uid => userMap[uid].completedMonths.length > 0);
    } else if (status === 'not_completed') {
      userIds = userIds.filter(uid => userMap[uid].completedMonths.length === 0);
    }

    if (userIds.length === 0) {
      return res.status(200).json({ success: true, data: { total: 0, results: [] } });
    }

    // Scope filter (respect role-based scope or provided districtId for state_admin)
    const effectiveDistrictId = req.user.role === 'state_admin' ? (districtId || null) : roleScope.districtId;
    const effectiveGroupId = req.user.role === 'state_admin' ? null : roleScope.groupId;

    const scopeFilter = {};
    if (effectiveDistrictId) scopeFilter.district = effectiveDistrictId;
    if (effectiveGroupId) scopeFilter.group = effectiveGroupId;

    const userTypeUser = userIds.filter(id => userMap[id].userType === 'User');
    const userTypeMember = userIds.filter(id => userMap[id].userType === 'Member');

    const [users, members] = await Promise.all([
      userTypeUser.length > 0
        ? User.find({ _id: { $in: userTypeUser }, ...scopeFilter })
            .select('name role roleTag district group phone')
            .populate('district', 'name').populate('group', 'name')
        : Promise.resolve([]),
      userTypeMember.length > 0
        ? Member.find({ _id: { $in: userTypeMember }, ...scopeFilter })
            .select('name district group phone')
            .populate('district', 'name').populate('group', 'name')
        : Promise.resolve([])
    ]);

    const results = [
      ...users.map(u => ({
        userId: u._id.toString(),
        name: u.name,
        role: u.role,
        roleTag: u.roleTag,
        district: u.district?.name || '',
        group: u.group?.name || '',
        phone: u.phone || '',
        completedMonths: userMap[u._id.toString()]?.completedMonths || [],
        completedCount: userMap[u._id.toString()]?.completedMonths.length || 0,
      })),
      ...members.map(m => ({
        userId: m._id.toString(),
        name: m.name,
        role: 'member',
        roleTag: null,
        district: m.district?.name || '',
        group: m.group?.name || '',
        phone: m.phone || '',
        completedMonths: userMap[m._id.toString()]?.completedMonths || [],
        completedCount: userMap[m._id.toString()]?.completedMonths.length || 0,
      }))
    ];

    results.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({ success: true, data: { total: results.length, results } });
  } catch (error) {
    console.error('Recurring marks filter error:', error);
    res.status(500).json({ success: false, message: 'Failed to filter recurring marks' });
  }
});

// @route   GET /api/reports/attendance-consolidation
// @desc    Get attendance data for a target across selected months
// @access  state_admin, district_admin with view_reports
router.get('/attendance-consolidation', authenticate, authorize(['view_reports']), async (req, res) => {
  try {
    if (!['state_admin', 'district_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { targetId, fromYear, fromMonth, toYear, toMonth, districtId } = req.query;

    if (!targetId) {
      return res.status(400).json({ success: false, message: 'targetId is required' });
    }

    const target = await PersonalTarget.findById(targetId).lean();
    if (!target || !target.isRecurring || !target.attendanceNeeded) {
      return res.status(404).json({ success: false, message: 'Attendance-enabled recurring target not found' });
    }

    // Build period pairs
    const fromYearN = Number(fromYear) || new Date().getFullYear();
    const fromMonthN = Number(fromMonth) || 1;
    const toYearN = Number(toYear) || new Date().getFullYear();
    const toMonthN = Number(toMonth) || (new Date().getMonth() + 1);

    const periods = [];
    let y = fromYearN, m = fromMonthN;
    while (y < toYearN || (y === toYearN && m <= toMonthN)) {
      periods.push({ year: y, month: m });
      m++;
      if (m > 12) { m = 1; y++; }
    }

    if (periods.length === 0) {
      return res.status(200).json({ success: true, data: { periods: [], members: [], summary: {} } });
    }

    // Fetch all recurring marks for this target in the period
    const markQuery = {
      personalTarget: target._id,
      $or: periods.map(p => ({ year: p.year, month: p.month }))
    };

    // Scope: district_admin sees only marks from users in their district
    const roleScope = getRoleScope(req.user);
    const effectiveDistrictId = req.user.role === 'state_admin' ? (districtId || null) : roleScope.districtId;

    const marks = await RecurringMark.find(markQuery)
      .populate('attendance.member', 'name phone group')
      .lean();

    // Build member attendance map: memberId → { name, phone, group, months: { "2026-3": true/false } }
    const memberMap = {};
    // Also track which area admins marked each period
    const adminMarks = [];

    for (const mark of marks) {
      if (!mark.attendance || mark.attendance.length === 0) continue;

      const periodKey = `${mark.year}-${mark.month}`;

      // Get the marking user's info for admin tracking
      adminMarks.push({
        userId: mark.user.toString(),
        userType: mark.userType,
        period: periodKey,
        completed: mark.completed
      });

      for (const att of mark.attendance) {
        if (!att.member) continue;
        const memberId = typeof att.member === 'object' ? att.member._id.toString() : att.member.toString();

        if (!memberMap[memberId]) {
          const memberObj = typeof att.member === 'object' ? att.member : null;
          memberMap[memberId] = {
            memberId,
            name: memberObj?.name || 'Unknown',
            phone: memberObj?.phone || '',
            groupId: memberObj?.group?.toString() || '',
            months: {}
          };
        }
        memberMap[memberId].months[periodKey] = att.present;
      }
    }

    let memberList = Object.values(memberMap);

    // Populate group names and filter by district if needed
    if (memberList.length > 0) {
      const memberIds = memberList.map(m => m.memberId);
      const memberFilter = { _id: { $in: memberIds } };
      if (effectiveDistrictId) memberFilter.district = effectiveDistrictId;

      const membersFromDB = await Member.find(memberFilter)
        .select('name phone group district')
        .populate('group', 'name')
        .lean();

      const memberDBMap = {};
      for (const m of membersFromDB) {
        memberDBMap[m._id.toString()] = m;
      }

      // Filter and enrich
      memberList = memberList
        .filter(m => memberDBMap[m.memberId])
        .map(m => {
          const dbMember = memberDBMap[m.memberId];
          return {
            ...m,
            name: dbMember.name,
            phone: dbMember.phone || '',
            group: dbMember.group?.name || ''
          };
        });
    }

    // Calculate summary
    const totalMembers = memberList.length;
    const periodSummary = {};
    for (const period of periods) {
      const key = `${period.year}-${period.month}`;
      let present = 0, absent = 0;
      for (const member of memberList) {
        if (member.months[key] === true) present++;
        else if (member.months[key] === false) absent++;
      }
      periodSummary[key] = { present, absent, total: present + absent };
    }

    // Overall attendance stats per member
    const periodKeys = periods.map(p => `${p.year}-${p.month}`);
    memberList = memberList.map(m => {
      let presentCount = 0, absentCount = 0, unmarkedCount = 0;
      for (const key of periodKeys) {
        if (m.months[key] === true) presentCount++;
        else if (m.months[key] === false) absentCount++;
        else unmarkedCount++;
      }
      return { ...m, presentCount, absentCount, unmarkedCount };
    });

    memberList.sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json({
      success: true,
      data: {
        targetTitle: target.title,
        periods: periods.map(p => `${p.year}-${p.month}`),
        members: memberList,
        periodSummary,
        totalMembers,
        totalPeriods: periods.length
      }
    });
  } catch (error) {
    console.error('Attendance consolidation error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch attendance consolidation' });
  }
});

export default router;
