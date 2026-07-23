import express from 'express';
import Meeting from '../models/Meeting.js';
import MeetingSession from '../models/MeetingSession.js';
import Attendance from '../models/Attendance.js';
import GuestAttendance from '../models/GuestAttendance.js';
import { authenticate as verifyToken, authorize, requireRole, requireAreaScope } from '../middleware/auth.js';
// Every meetings handler assumes req.user.group/district resolve for scoped
// roles, so run the area-scope guard with authentication on all routes.
const authenticate = [verifyToken, requireAreaScope];
import { 
  createMeetingValidation,
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body, query } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'uploads/meetings';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Allow common document and image formats
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|xlsx|xls|ppt|pptx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only document and image files are allowed'));
    }
  }
});

const router = express.Router();

// @route   GET /api/meetings/test
// @desc    Test endpoint to check if meetings API is working
// @access  Private
router.get('/test', authenticate, async (req, res) => {
  try {
    const totalMeetings = await Meeting.countDocuments();
    const userMeetings = await Meeting.find({}).limit(5).select('title targetAudience createdBy');
    
    res.status(200).json({
      success: true,
      message: 'Meetings API is working',
      data: {
        user: {
          id: req.user._id,
          role: req.user.role,
          name: req.user.name
        },
        totalMeetings,
        sampleMeetings: userMeetings
      }
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Test endpoint failed',
      error: error.message
    });
  }
});

// @route   GET /api/meetings/create-data
// @desc    Get simplified data for monthly meeting creation
// @access  Private (State Admin and District Admin)
router.get('/create-data', authenticate, requireRole(['state_admin', 'district_admin']), async (req, res) => {
  try {
    // Current date info for form defaults
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Month options for monthly meetings
    const monthOptions = [
      { value: 1, label: 'January' },
      { value: 2, label: 'February' },
      { value: 3, label: 'March' },
      { value: 4, label: 'April' },
      { value: 5, label: 'May' },
      { value: 6, label: 'June' },
      { value: 7, label: 'July' },
      { value: 8, label: 'August' },
      { value: 9, label: 'September' },
      { value: 10, label: 'October' },
      { value: 11, label: 'November' },
      { value: 12, label: 'December' }
    ];

    // Year options (2025 and 2026 by default)
    const yearOptions = [
      { value: 2025, label: '2025' },
      { value: 2026, label: '2026' }
    ];

    res.status(200).json({
      success: true,
      data: {
        monthOptions,
        yearOptions,
        defaults: {
          currentMonth,
          currentYear: 2025 // Default to 2025
        },
        userInfo: {
          role: req.user.role,
          district: req.user.district,
          group: req.user.group
        }
      }
    });

  } catch (error) {
    console.error('Get create data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch creation data'
    });
  }
});

// @route   GET /api/meetings
// @desc    Get all meetings with session information and enhanced group admin features
// @access  Private
router.get('/', authenticate, paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-scheduledDate',
      status,
      meetingType,
      targetAudience,
      upcoming,
      past,
      myMeetings, // New filter for group admins to see meetings they created
      search
    } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (meetingType) filter.meetingType = meetingType;
    if (targetAudience) filter.targetAudience = targetAudience;

    // Search by title or description
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Filter by time
    if (upcoming === 'true') {
      filter.scheduledDate = { $gte: new Date() };
      filter.status = 'scheduled';
    } else if (past === 'true') {
      filter.scheduledDate = { $lt: new Date() };
    }

    // Simplified approach: For group admins, show all meetings since they are general
    // The user-specific data (attendance) will be handled in the response processing
    
    // Filter for meetings created by current user (if requested)
    if (myMeetings === 'true') {
      filter.createdBy = req.user._id;
    }
    
    // For group admins, don't apply any restrictive filters - show all meetings
    // This is because meetings are general and should be visible to all group admins

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'createdBy', select: 'name phone role' },
        { path: 'targetGroups', select: 'name code district' },
        { path: 'targetDistricts', select: 'name code' }
      ]
    };

    const result = await Meeting.paginate(filter, options);

    // Enhance meeting data with session information and attendance details
    const enhancedMeetings = await Promise.all(
      result.docs.map(async (meeting) => {
        const meetingObj = meeting.toObject();
        
        // Get session information for monthly series meetings
        if (meeting.meetingType === 'monthly_series') {
          const sessions = await MeetingSession.find({ meeting: meeting._id })
            .sort({ sessionNumber: 1 })
            .populate('completedBy', 'name role')
            .populate('memberAttendance.member', 'name phone status group')
            .select('sessionNumber title scheduledDate duration sessionStatus completedBy completedAt memberAttendance guestAttendance');
          
          // Calculate detailed session statistics
          const totalSessions = sessions.length;
          const completedSessions = sessions.filter(s => s.sessionStatus === 'completed').length;
          const upcomingSessions = sessions.filter(s => 
            s.sessionStatus === 'scheduled' && new Date(s.scheduledDate) >= new Date()
          ).length;
          
          // For group admins, filter attendance data to show only their group's data
          // For other roles, show general statistics without detailed attendance
          let totalAttendanceRecords = 0;
          let totalPresentRecords = 0;
          let totalMembersAcrossSessions = 0;
          let totalGuestsAcrossSessions = 0;

          const sessionDetails = sessions.map(session => {
            let memberPresent = 0;
            let memberTotal = 0;
            let guestPresent = 0;
            let guestTotal = 0;
            let hasGroupSpecificData = false;

            // For group admins, only show attendance for their group members
            if (req.user.role === 'group_admin' && req.user.group) {
              // Filter member attendance to only include members from this group admin's group
              const groupMemberAttendance = session.memberAttendance.filter(attendance => 
                attendance.member && 
                attendance.member.group && 
                attendance.member.group.toString() === req.user.group._id.toString()
              );
              
              memberTotal = groupMemberAttendance.length;
              memberPresent = groupMemberAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
              
              // Only show guest data if this group admin has added guests
              const groupGuestAttendance = session.guestAttendance.filter(guest => 
                guest.addedBy && guest.addedBy.toString() === req.user._id.toString()
              );
              
              guestTotal = groupGuestAttendance.length;
              guestPresent = groupGuestAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
              
              hasGroupSpecificData = memberTotal > 0 || guestTotal > 0;
            } else {
              // For other roles, show general counts without detailed data
              memberTotal = session.memberAttendance.length;
              memberPresent = session.memberAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
              guestTotal = session.guestAttendance.length;
              guestPresent = session.guestAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
              hasGroupSpecificData = true; // Other roles can see all data
            }
            
            totalAttendanceRecords += (memberTotal + guestTotal);
            totalPresentRecords += (memberPresent + guestPresent);
            totalMembersAcrossSessions += memberTotal;
            totalGuestsAcrossSessions += guestTotal;

            return {
              sessionId: session._id,
              sessionNumber: session.sessionNumber,
              title: session.title,
              scheduledDate: session.scheduledDate,
              duration: session.duration,
              status: session.sessionStatus,
              completedBy: session.completedBy,
              completedAt: session.completedAt,
              attendance: hasGroupSpecificData ? {
                members: { total: memberTotal, present: memberPresent },
                guests: { total: guestTotal, present: guestPresent },
                overall: { 
                  total: memberTotal + guestTotal, 
                  present: memberPresent + guestPresent,
                  attendanceRate: (memberTotal + guestTotal) > 0 ? 
                    (((memberPresent + guestPresent) / (memberTotal + guestTotal)) * 100).toFixed(1) : 0
                }
              } : {
                members: { total: 0, present: 0 },
                guests: { total: 0, present: 0 },
                overall: { total: 0, present: 0, attendanceRate: 0 },
                message: 'No attendance data for your group yet'
              },
              canMarkAttendance: req.user.role === 'group_admin' && session.sessionStatus !== 'completed',
              canMarkComplete: req.user.role === 'group_admin' && session.sessionStatus === 'scheduled',
              hasGroupData: hasGroupSpecificData
            };
          });
          
          meetingObj.sessionInfo = {
            totalSessions,
            completedSessions,
            upcomingSessions,
            pendingSessions: totalSessions - completedSessions,
            completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
            overallAttendanceRate: totalAttendanceRecords > 0 ? ((totalPresentRecords / totalAttendanceRecords) * 100).toFixed(1) : 0,
            totalMembersAcrossSessions,
            totalGuestsAcrossSessions,
            nextSession: sessions.find(s => 
              s.sessionStatus === 'scheduled' && new Date(s.scheduledDate) >= new Date()
            ) || null,
            sessions: sessionDetails
          };

          // Add quick action flags for group admins
          if (req.user.role === 'group_admin') {
            // Check if this group admin has any sessions with their group's attendance data
            const sessionsWithGroupData = sessionDetails.filter(s => s.hasGroupData);
            const sessionsNeedingInitialization = sessionDetails.filter(s => 
              s.status === 'scheduled' && !s.hasGroupData
            );
            
            meetingObj.quickActions = {
              hasUpcomingSessions: upcomingSessions > 0,
              hasPendingAttendance: sessionsNeedingInitialization.length > 0,
              canInitializeAttendance: sessionsNeedingInitialization.length > 0,
              sessionsWithGroupData: sessionsWithGroupData.length,
              sessionsNeedingInitialization: sessionsNeedingInitialization.length,
              nextActionRequired: sessionsNeedingInitialization.length > 0 ? 'initialize_attendance' : 
                                 (sessionsWithGroupData.some(s => s.status === 'scheduled') ? 'mark_attendance' : 'none')
            };
          }
        }

        // Add enhanced user-specific information
        meetingObj.userInfo = {
          canEdit: req.user.role === 'state_admin' || 
                  (meeting.createdBy && meeting.createdBy._id.toString() === req.user._id.toString()),
          canManageAttendance: ['group_admin', 'district_admin', 'state_admin'].includes(req.user.role),
          canViewReports: ['district_admin', 'state_admin'].includes(req.user.role),
          canMarkSessionComplete: req.user.role === 'group_admin',
          canAddGuests: req.user.role === 'group_admin',
          isCreator: meeting.createdBy && meeting.createdBy._id.toString() === req.user._id.toString(),
          role: req.user.role
        };

        // Add meeting status indicators for group admins
        if (req.user.role === 'group_admin' && meeting.meetingType === 'monthly_series') {
          meetingObj.statusIndicators = {
            requiresAttention: meetingObj.quickActions?.nextActionRequired !== 'none',
            completionStatus: meetingObj.sessionInfo.completionRate >= 100 ? 'completed' : 
                             meetingObj.sessionInfo.completionRate > 0 ? 'in_progress' : 'not_started',
            attendanceStatus: meetingObj.sessionInfo.overallAttendanceRate >= 80 ? 'good' :
                             meetingObj.sessionInfo.overallAttendanceRate >= 60 ? 'average' : 'poor'
          };
        }

        return meetingObj;
      })
    );

    // Add summary statistics for group admins
    let summaryStats = null;
    if (req.user.role === 'group_admin') {
      const totalMeetings = enhancedMeetings.length;
      const monthlySeriesMeetings = enhancedMeetings.filter(m => m.meetingType === 'monthly_series');
      const meetingsRequiringAttention = enhancedMeetings.filter(m => 
        m.statusIndicators?.requiresAttention
      ).length;
      
      let totalSessions = 0;
      let completedSessions = 0;
      monthlySeriesMeetings.forEach(meeting => {
        if (meeting.sessionInfo) {
          totalSessions += meeting.sessionInfo.totalSessions;
          completedSessions += meeting.sessionInfo.completedSessions;
        }
      });

      summaryStats = {
        totalMeetings,
        monthlySeriesMeetings: monthlySeriesMeetings.length,
        meetingsRequiringAttention,
        sessionStats: {
          total: totalSessions,
          completed: completedSessions,
          pending: totalSessions - completedSessions,
          completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0
        }
      };
    }

    res.status(200).json({
      success: true,
      data: enhancedMeetings,
      summaryStats,
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
    console.error('Get meetings error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meetings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/meetings/:id
// @desc    Get single meeting by ID with complete session and attendance data
// @access  Private
router.get('/:id', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('createdBy', 'name phone role')
      .populate('targetGroups', 'name code district')
      .populate('targetDistricts', 'name code')
      .populate('attendance.user', 'name phone role')
      .populate('attendance.member', 'name phone')
      .populate('minutes.actionItems.assignedTo', 'name phone');

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check access permissions
    const hasAccess = req.user.role === 'state_admin' ||
      meeting.targetAudience === 'all' ||
      (meeting.targetAudience === 'group_admins' && req.user.role === 'group_admin') ||
      (meeting.targetAudience === 'district_admins' && req.user.role === 'district_admin') ||
      (meeting.targetGroups && meeting.targetGroups.some(g => g._id.toString() === req.user.group?._id.toString())) ||
      (meeting.targetDistricts && meeting.targetDistricts.some(d => d._id.toString() === req.user.district?._id.toString()));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not invited to this meeting.'
      });
    }

    const meetingData = meeting.toObject();

    // Get sessions for monthly series meetings
    if (meeting.meetingType === 'monthly_series') {
      const sessions = await MeetingSession.find({ meeting: req.params.id })
        .sort({ sessionNumber: 1 })
        .populate('createdBy', 'name phone role')
        .populate('completedBy', 'name phone role')
        .populate('memberAttendance.member', 'name phone status group district')
        .populate('memberAttendance.markedBy', 'name role')
        .populate('guestAttendance.addedBy', 'name role');

      // For group admins, initialize member attendance if not already done
      if (req.user.role === 'group_admin' && req.user.group) {
        for (const session of sessions) {
          if (session.memberAttendance.length === 0) {
            await session.initializeMemberAttendance(req.user.group._id);
          }
        }
        
        // Refetch sessions with updated attendance
        const updatedSessions = await MeetingSession.find({ meeting: req.params.id })
          .sort({ sessionNumber: 1 })
          .populate('createdBy', 'name phone role')
          .populate('completedBy', 'name phone role')
          .populate('memberAttendance.member', 'name phone status group district')
          .populate('memberAttendance.markedBy', 'name role')
          .populate('guestAttendance.addedBy', 'name role');

        meetingData.sessions = updatedSessions;
      } else {
        meetingData.sessions = sessions;
      }

      // Calculate overall session statistics
      const totalSessions = sessions.length;
      const completedSessions = sessions.filter(s => s.sessionStatus === 'completed').length;
      const upcomingSessions = sessions.filter(s => 
        s.sessionStatus === 'scheduled' && new Date(s.scheduledDate) >= new Date()
      ).length;

      let totalParticipants = 0;
      let totalPresent = 0;

      sessions.forEach(session => {
        const stats = session.getAttendanceStats();
        totalParticipants += stats.overall.totalParticipants;
        totalPresent += stats.overall.totalPresent;
      });

      meetingData.sessionSummary = {
        totalSessions,
        completedSessions,
        upcomingSessions,
        pendingSessions: totalSessions - completedSessions,
        completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
        overallAttendanceRate: totalParticipants > 0 ? ((totalPresent / totalParticipants) * 100).toFixed(1) : 0,
        nextSession: sessions.find(s => 
          s.sessionStatus === 'scheduled' && new Date(s.scheduledDate) >= new Date()
        ) || null
      };
    }

    // Add user permissions
    meetingData.userPermissions = {
      canEdit: req.user.role === 'state_admin' || 
              (meeting.createdBy && meeting.createdBy._id.toString() === req.user._id.toString()),
      canManageAttendance: ['group_admin', 'district_admin', 'state_admin'].includes(req.user.role),
      canViewReports: ['district_admin', 'state_admin'].includes(req.user.role),
      canMarkComplete: req.user.role === 'group_admin' && 
                      (meeting.targetAudience === 'all' || 
                       meeting.targetAudience === 'group_admins' ||
                       (meeting.targetGroups && meeting.targetGroups.some(g => g._id.toString() === req.user.group?._id.toString()))),
      canAddGuests: ['group_admin', 'district_admin', 'state_admin'].includes(req.user.role),
      canUploadFiles: ['group_admin', 'district_admin', 'state_admin'].includes(req.user.role)
    };

    // Add group member list for group admins
    if (req.user.role === 'group_admin' && req.user.group && meeting.meetingType === 'monthly_series') {
      const Member = (await import('../models/Member.js')).default;
      const groupMembers = await Member.find({ 
        group: req.user.group._id, 
        status: 'Active', 
        isApproved: true 
      }).select('name phone status');
      
      meetingData.groupMembers = groupMembers;
    }

    res.status(200).json({
      success: true,
      data: meetingData
    });

  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meeting'
    });
  }
});

// @route   POST /api/meetings/monthly
// @desc    Create simplified monthly meeting with multiple sessions
// @access  Private (State Admin and District Admin)
router.post('/monthly', authenticate, requireRole(['state_admin', 'district_admin']), upload.single('file'), async (req, res) => {
  try {
    const { title, description, month, year, sessions } = req.body;

    // Debug: Log received data
    console.log('Received form data:', {
      title,
      description,
      month,
      year,
      sessions,
      file: req.file ? req.file.originalname : 'No file'
    });

    // Manual validation for FormData
    const errors = [];

    if (!title || title.trim().length < 5 || title.trim().length > 200) {
      errors.push({
        type: 'field',
        value: title || '',
        msg: 'Meeting title must be between 5 and 200 characters',
        path: 'title',
        location: 'body'
      });
    }

    if (!description || description.trim().length < 10 || description.trim().length > 1000) {
      errors.push({
        type: 'field',
        value: description || '',
        msg: 'Description must be between 10 and 1000 characters',
        path: 'description',
        location: 'body'
      });
    }

    const monthNum = parseInt(month);
    if (!month || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      errors.push({
        type: 'field',
        value: month || '',
        msg: 'Month must be between 1 and 12',
        path: 'month',
        location: 'body'
      });
    }

    const yearNum = parseInt(year);
    if (!year || isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
      errors.push({
        type: 'field',
        value: year || '',
        msg: 'Year must be between 2020 and 2050',
        path: 'year',
        location: 'body'
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Parse sessions if it's a string (from form data)
    let parsedSessions = sessions || [];
    if (typeof sessions === 'string') {
      try {
        parsedSessions = JSON.parse(sessions);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sessions data format'
        });
      }
    }
    
    // Ensure parsedSessions is an array
    if (!Array.isArray(parsedSessions)) {
      parsedSessions = [];
    }

    // Create the main meeting with simplified structure
    const meeting = new Meeting({
      title: title.trim(),
      description: description.trim(),
      meetingType: 'monthly_series',
      monthlyDetails: {
        month: monthNum,
        year: yearNum,
        synopsis: description.trim(),
        totalSessions: parsedSessions.length || 0
      },
      scheduledDate: new Date(), // Use current date as default
      targetAudience: 'all', // Default to all members
      createdBy: req.user._id
    });

    await meeting.save();

    // Handle file upload if present
    let uploadedFile = null;
    if (req.file) {
      uploadedFile = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      };
    }

    // Create sessions (only if sessions exist)
    const createdSessions = [];
    for (let i = 0; i < parsedSessions.length; i++) {
      const sessionData = parsedSessions[i];
      const session = new MeetingSession({
        meeting: meeting._id,
        sessionNumber: i + 1,
        title: sessionData.title,
        description: sessionData.description || '',
        scheduledDate: new Date(), // Default to current date
        duration: sessionData.duration || 60,
        createdBy: req.user._id,
        // Add uploaded file to first session if present
        attachments: (i === 0 && uploadedFile) ? [uploadedFile] : []
      });

      await session.save();
      createdSessions.push(session);
    }

    // Populate the created meeting
    await meeting.populate([
      { path: 'createdBy', select: 'name phone role' },
      { path: 'targetGroups', select: 'name code district' },
      { path: 'targetDistricts', select: 'name code' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Monthly meeting with sessions created successfully',
      data: {
        meeting,
        sessions: createdSessions
      }
    });

  } catch (error) {
    console.error('Create monthly meeting error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create monthly meeting'
    });
  }
});

// @route   POST /api/meetings
// @desc    Create new meeting
// @access  Private (State Admin and District Admin)
router.post('/', authenticate, requireRole(['state_admin', 'district_admin']), createMeetingValidation, async (req, res) => {
  try {
    const meetingData = req.body;

    // District admin can only create meetings for their district
    if (req.user.role === 'district_admin') {
      if (meetingData.targetAudience === 'specific_districts') {
        meetingData.targetDistricts = [req.user.district._id];
      } else if (meetingData.targetAudience === 'specific_groups') {
        // Validate that all target groups belong to their district
        const Group = (await import('../models/Group.js')).default;
        const groups = await Group.find({ 
          _id: { $in: meetingData.targetGroups },
          district: req.user.district._id 
        });
        
        if (groups.length !== meetingData.targetGroups.length) {
          return res.status(403).json({
            success: false,
            message: 'You can only create meetings for groups in your district'
          });
        }
      }
    }

    // Create meeting
    const meeting = new Meeting({
      ...meetingData,
      createdBy: req.user._id
    });

    await meeting.save();

    // Populate the created meeting
    await meeting.populate([
      { path: 'createdBy', select: 'name phone role' },
      { path: 'targetGroups', select: 'name code district' },
      { path: 'targetDistricts', select: 'name code' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      data: meeting
    });

  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create meeting'
    });
  }
});

// @route   PUT /api/meetings/:id
// @desc    Update meeting
// @access  Private (Creator or State Admin)
router.put('/:id', 
  authenticate, 
  objectIdValidation('id'),
  [
    body('title').optional().trim().isLength({ min: 5, max: 200 }),
    body('scheduledDate').optional().isISO8601(),
    body('duration').optional().isInt({ min: 15, max: 480 }),
    body('status').optional().isIn(['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed']),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id);
      
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Check permissions
      const canEdit = req.user.role === 'state_admin' || 
                     meeting.createdBy.toString() === req.user._id.toString();

      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only edit meetings you created.'
        });
      }

      const updateData = req.body;

      // Update meeting
      Object.assign(meeting, updateData);
      meeting.updatedBy = req.user._id;

      await meeting.save();

      // Populate the updated meeting
      await meeting.populate([
        { path: 'createdBy', select: 'name phone role' },
        { path: 'targetGroups', select: 'name code district' },
        { path: 'targetDistricts', select: 'name code' }
      ]);

      res.status(200).json({
        success: true,
        message: 'Meeting updated successfully',
        data: meeting
      });

    } catch (error) {
      console.error('Update meeting error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update meeting'
      });
    }
  }
);

// @route   DELETE /api/meetings/:id
// @desc    Delete meeting
// @access  Private (Creator or State Admin)
router.delete('/:id', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check permissions
    const canDelete = req.user.role === 'state_admin' || 
                     meeting.createdBy.toString() === req.user._id.toString();

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete meetings you created.'
      });
    }

    await Meeting.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Meeting deleted successfully'
    });

  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete meeting'
    });
  }
});

// @route   POST /api/meetings/:id/attendance
// @desc    Mark attendance for meeting using new Attendance model
// @access  Private
router.post('/:id/attendance', 
  authenticate, 
  objectIdValidation('id'),
  [
    body('status').isIn(['present', 'absent', 'late', 'excused']),
    body('memberId').isMongoId().withMessage('Valid member ID is required'),
    body('notes').optional().trim().isLength({ max: 500 }),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id);
      
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      const { status, memberId, notes } = req.body;

      // Get member details to extract group and district
      const Member = (await import('../models/Member.js')).default;
      const member = await Member.findById(memberId).populate('group district');
      
      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      // For group admins, verify they can only mark attendance for their group members
      if (req.user.role === 'group_admin') {
        if (!req.user.group || member.group._id.toString() !== req.user.group._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'You can only mark attendance for members in your group'
          });
        }
      }

      // Mark attendance using new Attendance model
      const attendance = await Attendance.markAttendance({
        meetingId: req.params.id,
        memberId: memberId,
        groupId: member.group._id,
        districtId: member.district._id,
        status,
        markedBy: req.user._id,
        notes
      });

      // Get updated attendance statistics
      const attendanceStats = await Attendance.getMeetingStats(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Attendance marked successfully',
        data: {
          attendance,
          attendanceStats
        }
      });

    } catch (error) {
      console.error('Mark attendance error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to mark attendance'
      });
    }
  }
);

// @route   GET /api/meetings/:id/attendance
// @desc    Get meeting attendance using new Attendance model
// @access  Private
router.get('/:id/attendance', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Get attendance records from new Attendance model
    let attendanceFilter = { meeting: req.params.id };
    
    // For group admins, only show their group's attendance
    if (req.user.role === 'group_admin' && req.user.group) {
      attendanceFilter.group = req.user.group._id;
    }

    const attendance = await Attendance.find(attendanceFilter)
      .populate('member', 'name phone status isApproved')
      .populate('markedBy', 'name role')
      .sort({ 'member.name': 1 });

    // Get guest attendance
    let guestFilter = { meeting: req.params.id };
    if (req.user.role === 'group_admin' && req.user.group) {
      guestFilter.group = req.user.group._id;
    }

    const guests = await GuestAttendance.find(guestFilter)
      .populate('addedBy', 'name role')
      .sort({ name: 1 });

    // Get statistics
    const attendanceStats = await Attendance.getMeetingStats(req.params.id);
    const guestStats = await GuestAttendance.getMeetingGuestStats(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        memberAttendance: attendance,
        guestAttendance: guests,
        statistics: {
          members: attendanceStats,
          guests: guestStats,
          overall: {
            totalParticipants: attendanceStats.total + guestStats.total,
            totalPresent: attendanceStats.present + attendanceStats.late + guestStats.present + guestStats.late,
            attendanceRate: (attendanceStats.total + guestStats.total) > 0 ? 
              (((attendanceStats.present + attendanceStats.late + guestStats.present + guestStats.late) / 
                (attendanceStats.total + guestStats.total)) * 100).toFixed(1) : 0
          }
        }
      }
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance'
    });
  }
});

// @route   PUT /api/meetings/:id/minutes
// @desc    Update meeting minutes
// @access  Private (Creator or State Admin)
router.put('/:id/minutes', 
  authenticate, 
  objectIdValidation('id'),
  [
    body('summary').optional().trim().isLength({ max: 2000 }),
    body('decisions').optional().isArray(),
    body('actionItems').optional().isArray(),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id);
      
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Check permissions
      const canEdit = req.user.role === 'state_admin' || 
                     meeting.createdBy.toString() === req.user._id.toString();

      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only edit minutes for meetings you created.'
        });
      }

      const { summary, decisions, actionItems } = req.body;

      // Update minutes
      meeting.minutes = {
        ...meeting.minutes,
        summary: summary || meeting.minutes.summary,
        decisions: decisions || meeting.minutes.decisions,
        actionItems: actionItems || meeting.minutes.actionItems
      };

      await meeting.save();

      res.status(200).json({
        success: true,
        message: 'Meeting minutes updated successfully',
        data: meeting.minutes
      });

    } catch (error) {
      console.error('Update minutes error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update meeting minutes'
      });
    }
  }
);

// @route   GET /api/meetings/:id/sessions
// @desc    Get all sessions for a meeting with attendance data
// @access  Private
router.get('/:id/sessions', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    
    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    // Check access permissions
    const hasAccess = req.user.role === 'state_admin' ||
      meeting.targetAudience === 'all' ||
      (meeting.targetAudience === 'group_admins' && req.user.role === 'group_admin') ||
      (meeting.targetAudience === 'district_admins' && req.user.role === 'district_admin') ||
      (meeting.targetGroups && meeting.targetGroups.some(g => g.toString() === req.user.group?._id.toString())) ||
      (meeting.targetDistricts && meeting.targetDistricts.some(d => d.toString() === req.user.district?._id.toString()));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not invited to this meeting.'
      });
    }

    const sessions = await MeetingSession.find({ meeting: req.params.id })
      .sort({ sessionNumber: 1 })
      .populate('createdBy', 'name phone role')
      .populate('completedBy', 'name phone role')
      .populate('memberAttendance.member', 'name phone status')
      .populate('memberAttendance.markedBy', 'name role')
      .populate('guestAttendance.addedBy', 'name role');

    // For group admins, initialize member attendance if not already done
    if (req.user.role === 'group_admin' && req.user.group) {
      for (const session of sessions) {
        if (session.memberAttendance.length === 0) {
          await session.initializeMemberAttendance(req.user.group._id);
        }
      }
      
      // Refetch sessions with updated attendance
      const updatedSessions = await MeetingSession.find({ meeting: req.params.id })
        .sort({ sessionNumber: 1 })
        .populate('createdBy', 'name phone role')
        .populate('completedBy', 'name phone role')
        .populate('memberAttendance.member', 'name phone status')
        .populate('memberAttendance.markedBy', 'name role')
        .populate('guestAttendance.addedBy', 'name role');

      return res.status(200).json({
        success: true,
        data: updatedSessions
      });
    }

    res.status(200).json({
      success: true,
      data: sessions
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions'
    });
  }
});

// @route   POST /api/meetings/:id/sessions/:sessionId/upload
// @desc    Upload file to a session
// @access  Private
router.post('/:id/sessions/:sessionId/upload', 
  authenticate, 
  objectIdValidation('id'),
  objectIdValidation('sessionId'),
  upload.single('file'),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const session = await MeetingSession.findOne({
        _id: req.params.sessionId,
        meeting: req.params.id
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Only the meeting creator or an admin role may attach files
      const meeting = await Meeting.findById(req.params.id).select('createdBy');
      const canUpload = ['state_admin', 'district_admin', 'group_admin'].includes(req.user.role) &&
        (req.user.role !== 'group_admin' || meeting?.createdBy?.toString() === req.user._id.toString());
      if (!canUpload) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to upload files to this session'
        });
      }

      // Add file to session attachments
      const attachment = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user._id
      };

      session.attachments.push(attachment);
      await session.save();

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: attachment
      });

    } catch (error) {
      console.error('Upload file error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload file'
      });
    }
  }
);

// @route   PUT /api/meetings/:id/sessions/:sessionId
// @desc    Update session details
// @access  Private
router.put('/:id/sessions/:sessionId', 
  authenticate, 
  objectIdValidation('id'),
  objectIdValidation('sessionId'),
  [
    body('title').optional().trim().isLength({ min: 3, max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('scheduledDate').optional().isISO8601(),
    body('duration').optional().isInt({ min: 15, max: 480 }),
    body('status').optional().isIn(['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed']),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const session = await MeetingSession.findOne({
        _id: req.params.sessionId,
        meeting: req.params.id
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Check if user can edit (creator or state admin)
      const meeting = await Meeting.findById(req.params.id);
      const canEdit = req.user.role === 'state_admin' || 
                     meeting.createdBy.toString() === req.user._id.toString();

      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only edit sessions for meetings you created.'
        });
      }

      // Update session
      Object.assign(session, req.body);
      session.updatedBy = req.user._id;
      await session.save();

      res.status(200).json({
        success: true,
        message: 'Session updated successfully',
        data: session
      });

    } catch (error) {
      console.error('Update session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update session'
      });
    }
  }
);

// @route   POST /api/meetings/:id/sessions/:sessionId/member-attendance
// @desc    Mark member attendance for a session (Group Admin)
// @access  Private (Group Admin)
router.post('/:id/sessions/:sessionId/member-attendance', 
  authenticate, 
  requireRole(['group_admin', 'district_admin', 'state_admin']),
  objectIdValidation('id'),
  objectIdValidation('sessionId'),
  [
    body('memberId').isMongoId().withMessage('Valid member ID is required'),
    body('status').isIn(['present', 'absent', 'late', 'excused']).withMessage('Invalid attendance status'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const session = await MeetingSession.findOne({
        _id: req.params.sessionId,
        meeting: req.params.id
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const { memberId, status, notes } = req.body;

      // Verify member belongs to user's group (for group admins)
      if (req.user.role === 'group_admin') {
        const Member = (await import('../models/Member.js')).default;
        const member = await Member.findOne({ 
          _id: memberId, 
          group: req.user.group._id 
        });
        
        if (!member) {
          return res.status(403).json({
            success: false,
            message: 'You can only mark attendance for members in your group'
          });
        }
      }

      // Mark member attendance
      await session.markMemberAttendance(memberId, status, req.user._id, notes);

      res.status(200).json({
        success: true,
        message: 'Member attendance marked successfully',
        data: {
          attendanceStats: session.getAttendanceStats()
        }
      });

    } catch (error) {
      console.error('Mark member attendance error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark member attendance'
      });
    }
  }
);

// @route   POST /api/meetings/:id/sessions/:sessionId/add-guest
// @desc    Add guest participant to session
// @access  Private (Group Admin)
router.post('/:id/sessions/:sessionId/add-guest', 
  authenticate, 
  requireRole(['group_admin', 'district_admin', 'state_admin']),
  objectIdValidation('id'),
  objectIdValidation('sessionId'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Guest name must be between 2 and 100 characters'),
    body('phone').optional().trim().matches(/^[6-9]\d{9}$/).withMessage('Invalid phone number'),
    body('organization').optional().trim().isLength({ max: 100 }).withMessage('Organization cannot exceed 100 characters'),
    body('status').optional().isIn(['present', 'absent', 'late']).withMessage('Invalid status'),
    body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const session = await MeetingSession.findOne({
        _id: req.params.sessionId,
        meeting: req.params.id
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      const guestData = {
        name: req.body.name,
        phone: req.body.phone,
        organization: req.body.organization,
        status: req.body.status || 'present',
        notes: req.body.notes
      };

      // Add guest
      await session.addGuest(guestData, req.user._id);

      res.status(200).json({
        success: true,
        message: 'Guest added successfully',
        data: {
          attendanceStats: session.getAttendanceStats()
        }
      });

    } catch (error) {
      console.error('Add guest error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add guest'
      });
    }
  }
);

// @route   POST /api/meetings/:id/sessions/:sessionId/complete
// @desc    Mark session as completed (Group Admin)
// @access  Private (Group Admin)
router.post('/:id/sessions/:sessionId/complete', 
  authenticate, 
  requireRole(['group_admin', 'district_admin', 'state_admin']),
  objectIdValidation('id'),
  objectIdValidation('sessionId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const session = await MeetingSession.findOne({
        _id: req.params.sessionId,
        meeting: req.params.id
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      if (session.sessionStatus === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Session is already marked as completed'
        });
      }

      // Mark session as completed
      await session.markCompleted(req.user._id);

      res.status(200).json({
        success: true,
        message: 'Session marked as completed successfully',
        data: {
          sessionStatus: session.sessionStatus,
          completedBy: req.user.name,
          completedAt: session.completedAt,
          attendanceStats: session.getAttendanceStats()
        }
      });

    } catch (error) {
      console.error('Complete session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark session as completed'
      });
    }
  }
);

// @route   GET /api/meetings/:id/attendance-data
// @desc    Get attendance data for state/district admins from new Attendance model
// @access  Private (State Admin, District Admin)
router.get('/:id/attendance-data', 
  authenticate, 
  requireRole(['state_admin', 'district_admin']),
  objectIdValidation('id'), 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id)
        .populate('createdBy', 'name phone role');

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Get attendance records from new Attendance model
      let attendanceFilter = { meeting: req.params.id };
      
      // For district admins, filter by their district
      if (req.user.role === 'district_admin' && req.user.district) {
        attendanceFilter.district = req.user.district._id;
      }

      const attendance = await Attendance.find(attendanceFilter)
        .populate('member', 'name phone status isApproved')
        .populate('group', 'name code')
        .populate('district', 'name code')
        .populate('markedBy', 'name role')
        .sort({ 'group.name': 1, 'member.name': 1 });

      // Get guest attendance
      const guests = await GuestAttendance.find(attendanceFilter)
        .populate('addedBy', 'name role')
        .populate('group', 'name code')
        .populate('district', 'name code')
        .sort({ 'group.name': 1, name: 1 });

      // Group attendance by group for better organization
      const attendanceByGroup = {};
      attendance.forEach(record => {
        const groupId = record.group._id.toString();
        if (!attendanceByGroup[groupId]) {
          attendanceByGroup[groupId] = {
            group: record.group,
            district: record.district,
            members: [],
            stats: { total: 0, present: 0, absent: 0, late: 0, excused: 0 }
          };
        }
        
        attendanceByGroup[groupId].members.push(record);
        attendanceByGroup[groupId].stats.total++;
        attendanceByGroup[groupId].stats[record.status]++;
      });

      // Group guests by group
      const guestsByGroup = {};
      guests.forEach(guest => {
        const groupId = guest.group._id.toString();
        if (!guestsByGroup[groupId]) {
          guestsByGroup[groupId] = {
            group: guest.group,
            district: guest.district,
            guests: [],
            stats: { total: 0, present: 0, absent: 0, late: 0 }
          };
        }
        
        guestsByGroup[groupId].guests.push(guest);
        guestsByGroup[groupId].stats.total++;
        guestsByGroup[groupId].stats[guest.status]++;
      });

      // Calculate overall statistics
      const overallStats = await Attendance.getMeetingStats(req.params.id);
      const overallGuestStats = await GuestAttendance.getMeetingGuestStats(req.params.id);

      res.status(200).json({
        success: true,
        data: {
          meeting,
          attendanceByGroup: Object.values(attendanceByGroup),
          guestsByGroup: Object.values(guestsByGroup),
          overallStats: {
            members: overallStats,
            guests: overallGuestStats,
            combined: {
              totalParticipants: overallStats.total + overallGuestStats.total,
              totalPresent: overallStats.present + overallStats.late + overallGuestStats.present + overallGuestStats.late,
              attendanceRate: (overallStats.total + overallGuestStats.total) > 0 ? 
                (((overallStats.present + overallStats.late + overallGuestStats.present + overallGuestStats.late) / 
                  (overallStats.total + overallGuestStats.total)) * 100).toFixed(1) : 0
            }
          }
        }
      });

    } catch (error) {
      console.error('Get attendance data error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance data'
      });
    }
  }
);

// @route   GET /api/meetings/:id/attendance-report
// @desc    Get detailed attendance report for a meeting (State/District Admin)
// @access  Private (State Admin, District Admin)
router.get('/:id/attendance-report', 
  authenticate, 
  requireRole(['state_admin', 'district_admin']),
  objectIdValidation('id'), 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id)
        .populate('targetGroups', 'name code district')
        .populate('targetDistricts', 'name code')
        .populate('createdBy', 'name phone role');

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Get all sessions with detailed attendance
      const sessions = await MeetingSession.find({ meeting: req.params.id })
        .sort({ sessionNumber: 1 })
        .populate('memberAttendance.member', 'name phone group district')
        .populate('memberAttendance.markedBy', 'name role')
        .populate('guestAttendance.addedBy', 'name role')
        .populate('completedBy', 'name role');

      // Calculate overall statistics
      let totalMembers = 0;
      let totalGuests = 0;
      let totalSessions = sessions.length;
      let completedSessions = sessions.filter(s => s.sessionStatus === 'completed').length;

      const groupStats = {};
      const sessionStats = [];

      sessions.forEach(session => {
        const stats = session.getAttendanceStats();
        sessionStats.push({
          sessionId: session._id,
          sessionNumber: session.sessionNumber,
          title: session.title,
          scheduledDate: session.scheduledDate,
          status: session.sessionStatus,
          completedBy: session.completedBy,
          completedAt: session.completedAt,
          stats
        });

        // Group-wise statistics
        session.memberAttendance.forEach(attendance => {
          if (attendance.member && attendance.member.group) {
            const groupId = attendance.member.group.toString();
            if (!groupStats[groupId]) {
              groupStats[groupId] = {
                groupName: attendance.member.group.name || 'Unknown',
                totalMembers: 0,
                totalPresent: 0,
                totalAbsent: 0,
                totalLate: 0,
                totalExcused: 0
              };
            }
            
            groupStats[groupId].totalMembers++;
            if (attendance.status === 'present') groupStats[groupId].totalPresent++;
            else if (attendance.status === 'absent') groupStats[groupId].totalAbsent++;
            else if (attendance.status === 'late') groupStats[groupId].totalLate++;
            else if (attendance.status === 'excused') groupStats[groupId].totalExcused++;
          }
        });

        totalMembers += stats.members.total;
        totalGuests += stats.guests.total;
      });

      const overallStats = {
        totalSessions,
        completedSessions,
        pendingSessions: totalSessions - completedSessions,
        totalMembers: totalMembers / totalSessions || 0, // Average per session
        totalGuests: totalGuests / totalSessions || 0,
        completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0
      };

      res.status(200).json({
        success: true,
        data: {
          meeting,
          overallStats,
          sessionStats,
          groupStats: Object.values(groupStats),
          sessions
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

// @route   GET /api/meetings/reports/summary
// @desc    Get summary of all meetings attendance (State/District Admin)
// @access  Private (State Admin, District Admin)
router.get('/reports/summary', 
  authenticate, 
  requireRole(['state_admin', 'district_admin']),
  [
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('year').optional().isInt({ min: 2020, max: 2050 }),
    query('district').optional().isMongoId(),
    query('group').optional().isMongoId(),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { month, year, district, group } = req.query;
      
      let meetingFilter = {};
      
      // Date filter
      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        meetingFilter.scheduledDate = { $gte: startDate, $lte: endDate };
      } else if (year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        meetingFilter.scheduledDate = { $gte: startDate, $lte: endDate };
      }

      // Role-based filtering
      if (req.user.role === 'district_admin') {
        meetingFilter.$or = [
          { targetAudience: 'all' },
          { targetAudience: 'district_admins' },
          { targetDistricts: req.user.district._id }
        ];
      }

      // Additional filters
      if (district) meetingFilter.targetDistricts = district;

      const meetings = await Meeting.find(meetingFilter)
        .populate('targetGroups', 'name code district')
        .populate('targetDistricts', 'name code')
        .sort({ scheduledDate: -1 });

      const summaryData = [];

      for (const meeting of meetings) {
        const sessions = await MeetingSession.find({ meeting: meeting._id })
          .populate('memberAttendance.member', 'name group district')
          .populate('completedBy', 'name role');

        const meetingSummary = {
          meetingId: meeting._id,
          title: meeting.title,
          meetingType: meeting.meetingType,
          scheduledDate: meeting.scheduledDate,
          totalSessions: sessions.length,
          completedSessions: sessions.filter(s => s.sessionStatus === 'completed').length,
          totalParticipants: 0,
          totalPresent: 0,
          attendanceRate: 0
        };

        let totalParticipants = 0;
        let totalPresent = 0;

        sessions.forEach(session => {
          const stats = session.getAttendanceStats();
          totalParticipants += stats.overall.totalParticipants;
          totalPresent += stats.overall.totalPresent;
        });

        meetingSummary.totalParticipants = totalParticipants;
        meetingSummary.totalPresent = totalPresent;
        meetingSummary.attendanceRate = totalParticipants > 0 ? 
          ((totalPresent / totalParticipants) * 100).toFixed(1) : 0;

        summaryData.push(meetingSummary);
      }

      res.status(200).json({
        success: true,
        data: summaryData
      });

    } catch (error) {
      console.error('Get meetings summary error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch meetings summary'
      });
    }
  }
);

// @route   GET /api/meetings/admin/dashboard-stats
// @desc    Get comprehensive meeting and attendance statistics for state/district admin dashboard
// @access  Private (State Admin, District Admin)
router.get('/admin/dashboard-stats', 
  authenticate, 
  requireRole(['state_admin', 'district_admin']),
  async (req, res) => {
    try {
      // Import attendance models
      const Attendance = (await import('../models/Attendance.js')).default;
      const GuestAttendance = (await import('../models/GuestAttendance.js')).default;

      let meetingFilter = {};
      let attendanceFilter = {};

      // Apply role-based filtering
      if (req.user.role === 'district_admin') {
        meetingFilter.$or = [
          { targetAudience: 'all' },
          { targetAudience: 'district_admins' },
          { targetDistricts: req.user.district._id }
        ];
        attendanceFilter.district = req.user.district._id;
      }
      // State admin can see all data (no additional filters needed)

      // Get current date for filtering
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Meeting statistics
      const totalMeetings = await Meeting.countDocuments(meetingFilter);
      const upcomingMeetings = await Meeting.countDocuments({
        ...meetingFilter,
        scheduledDate: { $gte: now },
        status: 'scheduled'
      });
      const thisMonthMeetings = await Meeting.countDocuments({
        ...meetingFilter,
        scheduledDate: { $gte: startOfMonth, $lte: endOfMonth }
      });
      const monthlySeriesMeetings = await Meeting.countDocuments({
        ...meetingFilter,
        meetingType: 'monthly_series'
      });

      // Session statistics
      let sessionStats = { total: 0, completed: 0, pending: 0, completionRate: 0 };
      if (monthlySeriesMeetings > 0) {
        const monthlyMeetings = await Meeting.find({
          ...meetingFilter,
          meetingType: 'monthly_series'
        }).select('_id');

        const meetingIds = monthlyMeetings.map(m => m._id);
        
        const totalSessions = await MeetingSession.countDocuments({
          meeting: { $in: meetingIds }
        });

        const completedSessions = await MeetingSession.countDocuments({
          meeting: { $in: meetingIds },
          sessionStatus: 'completed'
        });

        sessionStats = {
          total: totalSessions,
          completed: completedSessions,
          pending: totalSessions - completedSessions,
          completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0
        };
      }

      // Attendance statistics - This month
      const thisMonthAttendance = await Attendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingMonth: now.getMonth() + 1,
            meetingYear: now.getFullYear()
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
            meetingMonth: now.getMonth() + 1,
            meetingYear: now.getFullYear()
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Format this month's attendance stats
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

      const thisMonthTotalParticipants = thisMonthStats.members.total + thisMonthStats.guests.total;
      const thisMonthTotalPresent = thisMonthStats.members.present + thisMonthStats.members.late + 
                                   thisMonthStats.guests.present + thisMonthStats.guests.late;
      const thisMonthAttendanceRate = thisMonthTotalParticipants > 0 ? 
        ((thisMonthTotalPresent / thisMonthTotalParticipants) * 100).toFixed(1) : 0;

      // Year-to-date attendance statistics
      const ytdAttendance = await Attendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingYear: now.getFullYear()
          }
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }
          }
        }
      ]);

      const ytdGuests = await GuestAttendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingYear: now.getFullYear()
          }
        },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }
          }
        }
      ]);

      const ytdStats = {
        totalParticipants: (ytdAttendance[0]?.totalRecords || 0) + (ytdGuests[0]?.totalRecords || 0),
        totalPresent: (ytdAttendance[0]?.presentCount || 0) + (ytdGuests[0]?.presentCount || 0),
        attendanceRate: 0
      };

      if (ytdStats.totalParticipants > 0) {
        ytdStats.attendanceRate = ((ytdStats.totalPresent / ytdStats.totalParticipants) * 100).toFixed(1);
      }

      // Top performing groups (by attendance rate)
      const topGroups = await Attendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingYear: now.getFullYear()
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
        { $match: { totalRecords: { $gte: 3 } } }, // Only groups with at least 3 attendance records
        { $sort: { attendanceRate: -1 } },
        { $limit: 5 }
      ]);

      // Recent meetings with attendance data
      const recentMeetingsWithAttendance = await Meeting.find(meetingFilter)
        .sort({ scheduledDate: -1 })
        .limit(5)
        .populate('createdBy', 'name role')
        .select('title meetingType scheduledDate status');

      // Add attendance data to recent meetings
      const enhancedRecentMeetings = await Promise.all(
        recentMeetingsWithAttendance.map(async (meeting) => {
          const memberCount = await Attendance.countDocuments({
            ...attendanceFilter,
            meeting: meeting._id
          });
          
          const guestCount = await GuestAttendance.countDocuments({
            ...attendanceFilter,
            meeting: meeting._id
          });

          const presentCount = await Attendance.countDocuments({
            ...attendanceFilter,
            meeting: meeting._id,
            status: { $in: ['present', 'late'] }
          });

          const guestPresentCount = await GuestAttendance.countDocuments({
            ...attendanceFilter,
            meeting: meeting._id,
            status: { $in: ['present', 'late'] }
          });

          const totalParticipants = memberCount + guestCount;
          const totalPresent = presentCount + guestPresentCount;
          const attendanceRate = totalParticipants > 0 ? 
            ((totalPresent / totalParticipants) * 100).toFixed(1) : 0;

          return {
            ...meeting.toObject(),
            attendanceStats: {
              totalParticipants,
              totalPresent,
              attendanceRate,
              hasAttendanceData: totalParticipants > 0
            }
          };
        })
      );

      // Monthly attendance trends (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyTrends = await Attendance.aggregate([
        {
          $match: {
            ...attendanceFilter,
            meetingDate: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: {
              year: '$meetingYear',
              month: '$meetingMonth'
            },
            totalRecords: { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } }
          }
        },
        {
          $addFields: {
            attendanceRate: {
              $multiply: [
                { $divide: ['$presentCount', '$totalRecords'] },
                100
              ]
            }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          overview: {
            totalMeetings,
            upcomingMeetings,
            thisMonthMeetings,
            monthlySeriesMeetings
          },
          sessionStats,
          attendanceStats: {
            thisMonth: {
              ...thisMonthStats,
              totalParticipants: thisMonthTotalParticipants,
              totalPresent: thisMonthTotalPresent,
              attendanceRate: thisMonthAttendanceRate
            },
            yearToDate: ytdStats
          },
          topPerformingGroups: topGroups,
          recentMeetingsWithAttendance: enhancedRecentMeetings,
          monthlyAttendanceTrends: monthlyTrends,
          userRole: req.user.role,
          userDistrict: req.user.district,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Get admin dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch admin dashboard statistics'
      });
    }
  }
);

// @route   GET /api/meetings/dashboard-stats
// @desc    Get meeting statistics for dashboard
// @access  Private
router.get('/dashboard-stats', authenticate, async (req, res) => {
  try {
    let filter = {};

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      filter.$or = [
        { targetAudience: 'all' },
        { targetAudience: 'group_admins' },
        { targetGroups: req.user.group._id }
      ];
    } else if (req.user.role === 'district_admin') {
      filter.$or = [
        { targetAudience: 'all' },
        { targetAudience: 'district_admins' },
        { targetDistricts: req.user.district._id }
      ];
    }

    // Get current date for filtering
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Total meetings
    const totalMeetings = await Meeting.countDocuments(filter);

    // Upcoming meetings
    const upcomingMeetings = await Meeting.countDocuments({
      ...filter,
      scheduledDate: { $gte: now },
      status: 'scheduled'
    });

    // This month's meetings
    const thisMonthMeetings = await Meeting.countDocuments({
      ...filter,
      scheduledDate: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Monthly series meetings
    const monthlySeriesMeetings = await Meeting.countDocuments({
      ...filter,
      meetingType: 'monthly_series'
    });

    // Get session statistics for monthly series
    let sessionStats = { total: 0, completed: 0, pending: 0 };
    
    if (monthlySeriesMeetings > 0) {
      const monthlyMeetings = await Meeting.find({
        ...filter,
        meetingType: 'monthly_series'
      }).select('_id');

      const meetingIds = monthlyMeetings.map(m => m._id);
      
      const totalSessions = await MeetingSession.countDocuments({
        meeting: { $in: meetingIds }
      });

      const completedSessions = await MeetingSession.countDocuments({
        meeting: { $in: meetingIds },
        sessionStatus: 'completed'
      });

      sessionStats = {
        total: totalSessions,
        completed: completedSessions,
        pending: totalSessions - completedSessions,
        completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0
      };
    }

    // Recent meetings for quick access
    const recentMeetings = await Meeting.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'name role')
      .select('title meetingType scheduledDate status createdAt');

    // Upcoming sessions for group admins
    let upcomingSessions = [];
    if (req.user.role === 'group_admin') {
      const groupMeetings = await Meeting.find({
        $or: [
          { targetAudience: 'all' },
          { targetAudience: 'group_admins' },
          { targetGroups: req.user.group._id }
        ],
        meetingType: 'monthly_series'
      }).select('_id title');

      if (groupMeetings.length > 0) {
        const meetingIds = groupMeetings.map(m => m._id);
        
        upcomingSessions = await MeetingSession.find({
          meeting: { $in: meetingIds },
          scheduledDate: { $gte: now },
          sessionStatus: 'scheduled'
        })
          .sort({ scheduledDate: 1 })
          .limit(5)
          .populate('meeting', 'title')
          .select('title scheduledDate sessionNumber duration');
      }
    }

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalMeetings,
          upcomingMeetings,
          thisMonthMeetings,
          monthlySeriesMeetings
        },
        sessionStats,
        recentMeetings,
        upcomingSessions,
        userRole: req.user.role
      }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});

// @route   GET /api/meetings/my-meetings
// @desc    Get meetings created by current user with enhanced management features (Group Admin)
// @access  Private (Group Admin)
router.get('/my-meetings', authenticate, requireRole(['group_admin', 'district_admin', 'state_admin']), async (req, res) => {
  try {
    const {
      status = 'all', // all, active, completed, pending_attention
      meetingType = 'all',
      limit = 50
    } = req.query;

    let filter = { createdBy: req.user._id };
    
    if (meetingType !== 'all') {
      filter.meetingType = meetingType;
    }

    const meetings = await Meeting.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name phone role')
      .populate('targetGroups', 'name code district')
      .populate('targetDistricts', 'name code');

    // Enhanced processing for group admin meetings
    const enhancedMeetings = await Promise.all(
      meetings.map(async (meeting) => {
        const meetingObj = meeting.toObject();
        
        if (meeting.meetingType === 'monthly_series') {
          // Get detailed session information
          const sessions = await MeetingSession.find({ meeting: meeting._id })
            .sort({ sessionNumber: 1 })
            .populate('completedBy', 'name role')
            .populate('memberAttendance.member', 'name phone status')
            .populate('memberAttendance.markedBy', 'name role');

          // Initialize member attendance for group admins if needed
          if (req.user.role === 'group_admin' && req.user.group) {
            for (const session of sessions) {
              if (session.memberAttendance.length === 0) {
                await session.initializeMemberAttendance(req.user.group._id);
              }
            }
            
            // Refetch with updated attendance
            const updatedSessions = await MeetingSession.find({ meeting: meeting._id })
              .sort({ sessionNumber: 1 })
              .populate('completedBy', 'name role')
              .populate('memberAttendance.member', 'name phone status')
              .populate('memberAttendance.markedBy', 'name role');
            
            meetingObj.sessions = updatedSessions;
          } else {
            meetingObj.sessions = sessions;
          }

          // Calculate comprehensive statistics
          const totalSessions = sessions.length;
          const completedSessions = sessions.filter(s => s.sessionStatus === 'completed').length;
          const scheduledSessions = sessions.filter(s => s.sessionStatus === 'scheduled').length;
          
          let totalMembers = 0;
          let totalPresent = 0;
          let sessionsWithAttendance = 0;
          let sessionsNeedingAttention = 0;

          const sessionDetails = sessions.map(session => {
            const memberPresent = session.memberAttendance.filter(a => 
              a.status === 'present' || a.status === 'late'
            ).length;
            const memberTotal = session.memberAttendance.length;
            const guestPresent = session.guestAttendance.filter(a => 
              a.status === 'present' || a.status === 'late'
            ).length;
            const guestTotal = session.guestAttendance.length;
            
            totalMembers += memberTotal;
            totalPresent += (memberPresent + guestPresent);
            
            if (memberTotal > 0 || guestTotal > 0) {
              sessionsWithAttendance++;
            }
            
            // Check if session needs attention
            const needsAttention = (
              session.sessionStatus === 'scheduled' && 
              new Date(session.scheduledDate) <= new Date() && 
              memberTotal === 0
            ) || (
              session.sessionStatus === 'scheduled' && 
              memberTotal > 0 && 
              (memberPresent + guestPresent) === 0
            );
            
            if (needsAttention) {
              sessionsNeedingAttention++;
            }

            return {
              sessionId: session._id,
              sessionNumber: session.sessionNumber,
              title: session.title,
              scheduledDate: session.scheduledDate,
              status: session.sessionStatus,
              completedBy: session.completedBy,
              completedAt: session.completedAt,
              attendance: {
                members: { total: memberTotal, present: memberPresent },
                guests: { total: guestTotal, present: guestPresent },
                attendanceRate: (memberTotal + guestTotal) > 0 ? 
                  (((memberPresent + guestPresent) / (memberTotal + guestTotal)) * 100).toFixed(1) : 0
              },
              needsAttention,
              actions: {
                canMarkAttendance: session.sessionStatus === 'scheduled',
                canMarkComplete: session.sessionStatus === 'scheduled' && (memberPresent + guestPresent) > 0,
                canAddGuests: session.sessionStatus === 'scheduled',
                canEditDetails: session.sessionStatus === 'scheduled'
              }
            };
          });

          meetingObj.managementInfo = {
            totalSessions,
            completedSessions,
            scheduledSessions,
            pendingSessions: totalSessions - completedSessions,
            completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
            overallAttendanceRate: totalMembers > 0 ? ((totalPresent / totalMembers) * 100).toFixed(1) : 0,
            sessionsWithAttendance,
            sessionsNeedingAttention,
            sessionDetails,
            nextActions: {
              initializeAttendance: sessions.some(s => 
                s.sessionStatus === 'scheduled' && s.memberAttendance.length === 0
              ),
              markAttendance: sessions.some(s => 
                s.sessionStatus === 'scheduled' && 
                s.memberAttendance.length > 0 && 
                s.memberAttendance.every(a => a.status === 'absent')
              ),
              completeSessions: sessions.some(s => 
                s.sessionStatus === 'scheduled' && 
                s.memberAttendance.some(a => a.status === 'present' || a.status === 'late')
              )
            }
          };

          // Determine meeting priority
          meetingObj.priority = sessionsNeedingAttention > 0 ? 'high' : 
                               (scheduledSessions > 0 ? 'medium' : 'low');
        }

        // Add management actions
        meetingObj.managementActions = {
          canEdit: true, // User created this meeting
          canDelete: meeting.status === 'scheduled',
          canViewDetailedReports: true,
          canManageAllSessions: req.user.role === 'group_admin',
          canExportAttendance: completedSessions > 0
        };

        return meetingObj;
      })
    );

    // Filter based on status if specified
    let filteredMeetings = enhancedMeetings;
    if (status !== 'all') {
      filteredMeetings = enhancedMeetings.filter(meeting => {
        switch (status) {
          case 'active':
            return meeting.managementInfo?.scheduledSessions > 0;
          case 'completed':
            return meeting.managementInfo?.completionRate >= 100;
          case 'pending_attention':
            return meeting.managementInfo?.sessionsNeedingAttention > 0 || meeting.priority === 'high';
          default:
            return true;
        }
      });
    }

    // Calculate summary for the response
    const summary = {
      totalMeetings: enhancedMeetings.length,
      activeMeetings: enhancedMeetings.filter(m => m.managementInfo?.scheduledSessions > 0).length,
      completedMeetings: enhancedMeetings.filter(m => m.managementInfo?.completionRate >= 100).length,
      meetingsNeedingAttention: enhancedMeetings.filter(m => m.priority === 'high').length,
      totalSessions: enhancedMeetings.reduce((sum, m) => sum + (m.managementInfo?.totalSessions || 0), 0),
      completedSessions: enhancedMeetings.reduce((sum, m) => sum + (m.managementInfo?.completedSessions || 0), 0)
    };

    res.status(200).json({
      success: true,
      data: filteredMeetings,
      summary,
      userRole: req.user.role
    });

  } catch (error) {
    console.error('Get my meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your meetings'
    });
  }
});

// @route   POST /api/meetings/:id/add-guest
// @desc    Add guest participant to meeting using new GuestAttendance model
// @access  Private (Group Admin)
router.post('/:id/add-guest', 
  authenticate, 
  requireRole(['group_admin', 'district_admin', 'state_admin']),
  objectIdValidation('id'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Guest name must be between 2 and 100 characters'),
    body('phone').optional().trim(),
    body('organization').optional().trim().isLength({ max: 100 }),
    body('status').optional().isIn(['present', 'absent', 'late']).withMessage('Invalid status'),
    body('notes').optional().trim().isLength({ max: 500 }),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id);
      
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // For group admins, use their group and district
      let groupId = req.user.group?._id;
      let districtId = req.user.district?._id;

      // For district/state admins, they might need to specify or we use defaults
      if (!groupId && req.user.role === 'district_admin') {
        // Use the first group in their district or handle differently
        groupId = req.user.district?._id; // This might need adjustment based on your logic
        districtId = req.user.district?._id;
      }

      if (!groupId || !districtId) {
        return res.status(400).json({
          success: false,
          message: 'Unable to determine group or district for guest attendance'
        });
      }

      // Add guest using new GuestAttendance model
      const guest = await GuestAttendance.addGuest({
        meetingId: req.params.id,
        groupId,
        districtId,
        name: req.body.name,
        phone: req.body.phone,
        organization: req.body.organization,
        status: req.body.status || 'present',
        addedBy: req.user._id,
        notes: req.body.notes
      });

      res.status(200).json({
        success: true,
        message: 'Guest added successfully',
        data: guest
      });

    } catch (error) {
      console.error('Add meeting guest error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add guest'
      });
    }
  }
);

// @route   GET /api/meetings/admin/attendance-overview
// @desc    Get comprehensive attendance overview for state/district admins
// @access  Private (State Admin, District Admin)
router.get('/admin/attendance-overview', 
  authenticate, 
  requireRole(['state_admin', 'district_admin']),
  [
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('year').optional().isInt({ min: 2020, max: 2050 }),
    query('district').optional().isMongoId(),
    query('group').optional().isMongoId(),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { month, year, district, group } = req.query;
      
      // Import attendance models
      const Attendance = (await import('../models/Attendance.js')).default;
      const GuestAttendance = (await import('../models/GuestAttendance.js')).default;

      let meetingFilter = {};
      let attendanceFilter = {};

      // Apply role-based filtering
      if (req.user.role === 'district_admin') {
        meetingFilter.$or = [
          { targetAudience: 'all' },
          { targetAudience: 'district_admins' },
          { targetDistricts: req.user.district._id }
        ];
        attendanceFilter.district = req.user.district._id;
      } else if (req.user.role === 'state_admin') {
        // State admin can see all data
        if (district) {
          meetingFilter.targetDistricts = district;
          attendanceFilter.district = district;
        }
        if (group) {
          meetingFilter.targetGroups = group;
          attendanceFilter.group = group;
        }
      }

      // Apply date filters
      if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        meetingFilter.scheduledDate = { $gte: startDate, $lte: endDate };
        attendanceFilter.meetingMonth = month;
        attendanceFilter.meetingYear = year;
      } else if (year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        meetingFilter.scheduledDate = { $gte: startDate, $lte: endDate };
        attendanceFilter.meetingYear = year;
      }

      // Get meetings with attendance data
      const meetings = await Meeting.find(meetingFilter)
        .populate('createdBy', 'name role')
        .populate('targetGroups', 'name code district')
        .populate('targetDistricts', 'name code')
        .sort({ scheduledDate: -1 });

      const attendanceOverview = [];

      for (const meeting of meetings) {
        // Get member attendance
        const memberAttendance = await Attendance.find({
          ...attendanceFilter,
          meeting: meeting._id
        })
        .populate('member', 'name phone status')
        .populate('group', 'name code')
        .populate('district', 'name code')
        .populate('markedBy', 'name role');

        // Get guest attendance
        const guestAttendance = await GuestAttendance.find({
          ...attendanceFilter,
          meeting: meeting._id
        })
        .populate('group', 'name code')
        .populate('district', 'name code')
        .populate('addedBy', 'name role');

        // Get session data for monthly series
        let sessionSummary = null;
        if (meeting.meetingType === 'monthly_series') {
          const sessions = await MeetingSession.find({ meeting: meeting._id })
            .sort({ sessionNumber: 1 })
            .select('sessionNumber title scheduledDate sessionStatus completedBy completedAt');

          sessionSummary = {
            totalSessions: sessions.length,
            completedSessions: sessions.filter(s => s.sessionStatus === 'completed').length,
            scheduledSessions: sessions.filter(s => s.sessionStatus === 'scheduled').length,
            sessions: sessions.map(s => ({
              sessionNumber: s.sessionNumber,
              title: s.title,
              scheduledDate: s.scheduledDate,
              status: s.sessionStatus,
              completedAt: s.completedAt
            }))
          };
        }

        // Calculate statistics by group and district
        const groupStats = {};
        const districtStats = {};

        // Process member attendance
        memberAttendance.forEach(record => {
          const groupId = record.group._id.toString();
          const districtId = record.district._id.toString();

          // Group statistics
          if (!groupStats[groupId]) {
            groupStats[groupId] = {
              group: record.group,
              district: record.district,
              members: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
              guests: { total: 0, present: 0, absent: 0, late: 0 }
            };
          }
          groupStats[groupId].members.total++;
          groupStats[groupId].members[record.status]++;

          // District statistics
          if (!districtStats[districtId]) {
            districtStats[districtId] = {
              district: record.district,
              members: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
              guests: { total: 0, present: 0, absent: 0, late: 0 },
              groups: new Set()
            };
          }
          districtStats[districtId].members.total++;
          districtStats[districtId].members[record.status]++;
          districtStats[districtId].groups.add(groupId);
        });

        // Process guest attendance
        guestAttendance.forEach(record => {
          const groupId = record.group._id.toString();
          const districtId = record.district._id.toString();

          // Group statistics
          if (!groupStats[groupId]) {
            groupStats[groupId] = {
              group: record.group,
              district: record.district,
              members: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
              guests: { total: 0, present: 0, absent: 0, late: 0 }
            };
          }
          groupStats[groupId].guests.total++;
          groupStats[groupId].guests[record.status]++;

          // District statistics
          if (!districtStats[districtId]) {
            districtStats[districtId] = {
              district: record.district,
              members: { total: 0, present: 0, absent: 0, late: 0, excused: 0 },
              guests: { total: 0, present: 0, absent: 0, late: 0 },
              groups: new Set()
            };
          }
          districtStats[districtId].guests.total++;
          districtStats[districtId].guests[record.status]++;
          districtStats[districtId].groups.add(groupId);
        });

        // Calculate attendance rates for groups
        Object.values(groupStats).forEach(stat => {
          const totalMembers = stat.members.total;
          const totalGuests = stat.guests.total;
          const totalParticipants = totalMembers + totalGuests;
          const totalPresent = stat.members.present + stat.members.late + stat.guests.present + stat.guests.late;
          
          stat.attendanceRate = totalParticipants > 0 ? 
            ((totalPresent / totalParticipants) * 100).toFixed(1) : 0;
          stat.totalParticipants = totalParticipants;
          stat.totalPresent = totalPresent;
        });

        // Calculate attendance rates for districts
        Object.values(districtStats).forEach(stat => {
          const totalMembers = stat.members.total;
          const totalGuests = stat.guests.total;
          const totalParticipants = totalMembers + totalGuests;
          const totalPresent = stat.members.present + stat.members.late + stat.guests.present + stat.guests.late;
          
          stat.attendanceRate = totalParticipants > 0 ? 
            ((totalPresent / totalParticipants) * 100).toFixed(1) : 0;
          stat.totalParticipants = totalParticipants;
          stat.totalPresent = totalPresent;
          stat.totalGroups = stat.groups.size;
          delete stat.groups; // Remove Set object for JSON serialization
        });

        // Overall meeting statistics
        const overallStats = {
          totalMembers: memberAttendance.length,
          totalGuests: guestAttendance.length,
          totalParticipants: memberAttendance.length + guestAttendance.length,
          memberStats: {
            present: memberAttendance.filter(a => a.status === 'present').length,
            absent: memberAttendance.filter(a => a.status === 'absent').length,
            late: memberAttendance.filter(a => a.status === 'late').length,
            excused: memberAttendance.filter(a => a.status === 'excused').length
          },
          guestStats: {
            present: guestAttendance.filter(a => a.status === 'present').length,
            absent: guestAttendance.filter(a => a.status === 'absent').length,
            late: guestAttendance.filter(a => a.status === 'late').length
          }
        };

        overallStats.totalPresent = overallStats.memberStats.present + overallStats.memberStats.late + 
                                   overallStats.guestStats.present + overallStats.guestStats.late;
        overallStats.attendanceRate = overallStats.totalParticipants > 0 ? 
          ((overallStats.totalPresent / overallStats.totalParticipants) * 100).toFixed(1) : 0;

        attendanceOverview.push({
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
          sessionSummary,
          attendance: {
            overall: overallStats,
            byGroup: Object.values(groupStats).sort((a, b) => b.attendanceRate - a.attendanceRate),
            byDistrict: Object.values(districtStats).sort((a, b) => b.attendanceRate - a.attendanceRate)
          },
          hasAttendanceData: memberAttendance.length > 0 || guestAttendance.length > 0
        });
      }

      // Calculate summary statistics
      const summaryStats = {
        totalMeetings: attendanceOverview.length,
        meetingsWithAttendance: attendanceOverview.filter(m => m.hasAttendanceData).length,
        totalParticipants: attendanceOverview.reduce((sum, m) => sum + m.attendance.overall.totalParticipants, 0),
        totalPresent: attendanceOverview.reduce((sum, m) => sum + m.attendance.overall.totalPresent, 0),
        overallAttendanceRate: 0,
        monthlySeriesMeetings: attendanceOverview.filter(m => m.meeting.meetingType === 'monthly_series').length,
        totalSessions: attendanceOverview.reduce((sum, m) => sum + (m.sessionSummary?.totalSessions || 0), 0),
        completedSessions: attendanceOverview.reduce((sum, m) => sum + (m.sessionSummary?.completedSessions || 0), 0)
      };

      if (summaryStats.totalParticipants > 0) {
        summaryStats.overallAttendanceRate = 
          ((summaryStats.totalPresent / summaryStats.totalParticipants) * 100).toFixed(1);
      }

      res.status(200).json({
        success: true,
        data: {
          summary: summaryStats,
          meetings: attendanceOverview,
          filters: { month, year, district, group },
          userRole: req.user.role,
          userDistrict: req.user.district,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Get admin attendance overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch attendance overview'
      });
    }
  }
);

// @route   GET /api/meetings/upcoming
// @desc    Get upcoming meetings
// @access  Private
router.get('/upcoming/list', authenticate, async (req, res) => {
  try {
    let filter = {
      scheduledDate: { $gte: new Date() },
      status: 'scheduled'
    };

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      filter.$or = [
        { targetAudience: 'all' },
        { targetAudience: 'group_admins' },
        { targetGroups: req.user.group._id }
      ];
    } else if (req.user.role === 'district_admin') {
      filter.$or = [
        { targetAudience: 'all' },
        { targetAudience: 'district_admins' },
        { targetDistricts: req.user.district._id }
      ];
    }

    const meetings = await Meeting.find(filter)
      .sort({ scheduledDate: 1 })
      .limit(10)
      .populate('createdBy', 'name phone role')
      .populate('targetGroups', 'name code')
      .populate('targetDistricts', 'name code');

    res.status(200).json({
      success: true,
      data: meetings
    });

  } catch (error) {
    console.error('Get upcoming meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming meetings'
    });
  }
});

// @route   POST /api/meetings/:id/bulk-session-actions
// @desc    Perform bulk actions on meeting sessions (Group Admin)
// @access  Private (Group Admin)
router.post('/:id/bulk-session-actions', 
  authenticate, 
  requireRole(['group_admin', 'district_admin', 'state_admin']),
  objectIdValidation('id'),
  [
    body('action').isIn(['initialize_attendance', 'mark_all_present', 'complete_ready_sessions']).withMessage('Invalid bulk action'),
    body('sessionIds').optional().isArray().withMessage('Session IDs must be an array'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const { action, sessionIds } = req.body;
      const meetingId = req.params.id;

      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      // Check if user can perform bulk actions
      const canPerformBulkActions = req.user.role === 'state_admin' || 
                                   meeting.createdBy.toString() === req.user._id.toString() ||
                                   (req.user.role === 'group_admin' && meeting.targetAudience === 'group_admins');

      if (!canPerformBulkActions) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only perform bulk actions on meetings you can manage.'
        });
      }

      let filter = { meeting: meetingId };
      if (sessionIds && sessionIds.length > 0) {
        filter._id = { $in: sessionIds };
      }

      const sessions = await MeetingSession.find(filter);
      const results = [];

      switch (action) {
        case 'initialize_attendance':
          if (req.user.role === 'group_admin' && req.user.group) {
            for (const session of sessions) {
              if (session.memberAttendance.length === 0) {
                await session.initializeMemberAttendance(req.user.group._id);
                results.push({
                  sessionId: session._id,
                  sessionNumber: session.sessionNumber,
                  action: 'attendance_initialized',
                  success: true
                });
              } else {
                results.push({
                  sessionId: session._id,
                  sessionNumber: session.sessionNumber,
                  action: 'attendance_already_exists',
                  success: false,
                  message: 'Attendance already initialized'
                });
              }
            }
          }
          break;

        case 'mark_all_present':
          for (const session of sessions) {
            if (session.sessionStatus === 'scheduled') {
              // Mark all members as present
              session.memberAttendance.forEach(attendance => {
                if (attendance.status === 'absent') {
                  attendance.status = 'present';
                  attendance.markedBy = req.user._id;
                  attendance.markedAt = new Date();
                }
              });
              await session.save();
              
              results.push({
                sessionId: session._id,
                sessionNumber: session.sessionNumber,
                action: 'marked_all_present',
                success: true,
                attendanceCount: session.memberAttendance.length
              });
            }
          }
          break;

        case 'complete_ready_sessions':
          for (const session of sessions) {
            if (session.sessionStatus === 'scheduled') {
              const hasAttendance = session.memberAttendance.some(a => 
                a.status === 'present' || a.status === 'late'
              );
              
              if (hasAttendance) {
                await session.markCompleted(req.user._id);
                results.push({
                  sessionId: session._id,
                  sessionNumber: session.sessionNumber,
                  action: 'session_completed',
                  success: true
                });
              } else {
                results.push({
                  sessionId: session._id,
                  sessionNumber: session.sessionNumber,
                  action: 'no_attendance_recorded',
                  success: false,
                  message: 'Cannot complete session without attendance'
                });
              }
            }
          }
          break;
      }

      // Get updated meeting statistics
      const updatedSessions = await MeetingSession.find({ meeting: meetingId })
        .sort({ sessionNumber: 1 });
      
      const totalSessions = updatedSessions.length;
      const completedSessions = updatedSessions.filter(s => s.sessionStatus === 'completed').length;
      
      const updatedStats = {
        totalSessions,
        completedSessions,
        pendingSessions: totalSessions - completedSessions,
        completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0
      };

      res.status(200).json({
        success: true,
        message: `Bulk action '${action}' completed`,
        data: {
          action,
          results,
          updatedStats,
          processedSessions: results.length,
          successfulActions: results.filter(r => r.success).length
        }
      });

    } catch (error) {
      console.error('Bulk session actions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk actions'
      });
    }
  }
);

// @route   GET /api/meetings/:id/attendance-summary
// @desc    Get quick attendance summary for group admin dashboard
// @access  Private (Group Admin)
router.get('/:id/attendance-summary', 
  authenticate, 
  requireRole(['group_admin', 'district_admin', 'state_admin']),
  objectIdValidation('id'), 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const meeting = await Meeting.findById(req.params.id)
        .populate('createdBy', 'name role');

      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: 'Meeting not found'
        });
      }

      const sessions = await MeetingSession.find({ meeting: req.params.id })
        .sort({ sessionNumber: 1 })
        .populate('memberAttendance.member', 'name phone status')
        .populate('completedBy', 'name role');

      // Calculate summary statistics
      const summary = {
        meetingTitle: meeting.title,
        meetingType: meeting.meetingType,
        totalSessions: sessions.length,
        completedSessions: sessions.filter(s => s.sessionStatus === 'completed').length,
        scheduledSessions: sessions.filter(s => s.sessionStatus === 'scheduled').length,
        overallStats: {
          totalMembers: 0,
          totalPresent: 0,
          totalAbsent: 0,
          totalGuests: 0,
          attendanceRate: 0
        },
        sessionBreakdown: [],
        memberAttendanceOverview: {},
        actionItems: []
      };

      let allMemberIds = new Set();
      
      sessions.forEach(session => {
        const memberPresent = session.memberAttendance.filter(a => 
          a.status === 'present' || a.status === 'late'
        ).length;
        const memberTotal = session.memberAttendance.length;
        const guestTotal = session.guestAttendance.length;
        const guestPresent = session.guestAttendance.filter(a => 
          a.status === 'present' || a.status === 'late'
        ).length;

        summary.overallStats.totalMembers += memberTotal;
        summary.overallStats.totalPresent += (memberPresent + guestPresent);
        summary.overallStats.totalAbsent += (memberTotal - memberPresent);
        summary.overallStats.totalGuests += guestTotal;

        // Track individual member attendance
        session.memberAttendance.forEach(attendance => {
          const memberId = attendance.member._id.toString();
          allMemberIds.add(memberId);
          
          if (!summary.memberAttendanceOverview[memberId]) {
            summary.memberAttendanceOverview[memberId] = {
              memberName: attendance.member.name,
              memberPhone: attendance.member.phone,
              sessionsAttended: 0,
              totalSessions: 0,
              attendanceRate: 0,
              lastStatus: attendance.status
            };
          }
          
          summary.memberAttendanceOverview[memberId].totalSessions++;
          if (attendance.status === 'present' || attendance.status === 'late') {
            summary.memberAttendanceOverview[memberId].sessionsAttended++;
          }
        });

        summary.sessionBreakdown.push({
          sessionNumber: session.sessionNumber,
          title: session.title,
          scheduledDate: session.scheduledDate,
          status: session.sessionStatus,
          completedBy: session.completedBy,
          attendance: {
            members: { total: memberTotal, present: memberPresent },
            guests: { total: guestTotal, present: guestPresent },
            attendanceRate: (memberTotal + guestTotal) > 0 ? 
              (((memberPresent + guestPresent) / (memberTotal + guestTotal)) * 100).toFixed(1) : 0
          }
        });
      });

      // Calculate overall attendance rate
      summary.overallStats.attendanceRate = summary.overallStats.totalMembers > 0 ? 
        ((summary.overallStats.totalPresent / summary.overallStats.totalMembers) * 100).toFixed(1) : 0;

      // Calculate individual member attendance rates
      Object.keys(summary.memberAttendanceOverview).forEach(memberId => {
        const member = summary.memberAttendanceOverview[memberId];
        member.attendanceRate = member.totalSessions > 0 ? 
          ((member.sessionsAttended / member.totalSessions) * 100).toFixed(1) : 0;
      });

      // Generate action items
      if (summary.scheduledSessions > 0) {
        summary.actionItems.push({
          type: 'pending_sessions',
          message: `${summary.scheduledSessions} session(s) need to be completed`,
          priority: 'medium'
        });
      }

      const lowAttendanceMembers = Object.values(summary.memberAttendanceOverview)
        .filter(member => parseFloat(member.attendanceRate) < 50 && member.totalSessions > 1);
      
      if (lowAttendanceMembers.length > 0) {
        summary.actionItems.push({
          type: 'low_attendance',
          message: `${lowAttendanceMembers.length} member(s) have attendance below 50%`,
          priority: 'high',
          members: lowAttendanceMembers.map(m => ({ name: m.memberName, rate: m.attendanceRate }))
        });
      }

      res.status(200).json({
        success: true,
        data: summary
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

// @route   GET /api/meetings/admin/overview
// @desc    Get admin overview of meetings with group completion status
// @access  Private (State Admin and District Admin)
router.get('/admin/overview', 
  authenticate, 
  requireRole(['state_admin', 'district_admin']),
  paginationValidation,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        sort = '-scheduledDate', // Changed to sort by scheduled date (latest first)
        status,
        completionStatus,
        search
      } = req.query;

      let filter = {};
      
      // Apply basic filters
      if (status) filter.status = status;
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // For district admins, filter to their district
      if (req.user.role === 'district_admin' && req.user.district) {
        const Group = (await import('../models/Group.js')).default;
        const districtGroups = await Group.find({ district: req.user.district._id }).select('_id');
        const groupIds = districtGroups.map(g => g._id);
        
        filter.$or = [
          { targetAudience: 'all' },
          { targetDistricts: req.user.district._id },
          { targetGroups: { $in: groupIds } }
        ];
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: [
          { path: 'createdBy', select: 'name phone role' },
          { path: 'targetGroups', select: 'name code district', populate: { path: 'district', select: 'name code' } },
          { path: 'targetDistricts', select: 'name code' }
        ]
      };

      const result = await Meeting.paginate(filter, options);

      // Get all groups for analysis
      const Group = (await import('../models/Group.js')).default;
      let allGroups;
      if (req.user.role === 'district_admin' && req.user.district) {
        allGroups = await Group.find({ district: req.user.district._id }).populate('district', 'name code');
      } else {
        allGroups = await Group.find({}).populate('district', 'name code');
      }

      // Enhance meetings with group completion status
      const enhancedMeetings = await Promise.all(
        result.docs.map(async (meeting) => {
          const meetingObj = meeting.toObject();
          
          // Determine target groups for this meeting
          let targetGroups = [];
          if (meeting.targetAudience === 'all') {
            targetGroups = allGroups;
          } else if (meeting.targetAudience === 'group_admins') {
            targetGroups = allGroups;
          } else if (meeting.targetGroups && meeting.targetGroups.length > 0) {
            targetGroups = meeting.targetGroups;
          } else if (meeting.targetDistricts && meeting.targetDistricts.length > 0) {
            const districtIds = meeting.targetDistricts.map(d => d._id);
            targetGroups = allGroups.filter(g => districtIds.includes(g.district._id));
          }

          // For monthly series meetings, analyze session completion by groups
          if (meeting.meetingType === 'monthly_series') {
            const sessions = await MeetingSession.find({ meeting: meeting._id })
              .sort({ sessionNumber: 1 })
              .populate('memberAttendance.member', 'group')
              .populate('guestAttendance.addedBy', 'group');

            const groupProgress = {};
            
            // Get actual member counts and status breakdown from Member collection
            const Member = (await import('../models/Member.js')).default;
            const memberStats = await Promise.all(
              targetGroups.map(async (group) => {
                const [totalMembers, activeMembers, inactiveMembers, abroadMembers] = await Promise.all([
                  Member.countDocuments({ 
                    group: group._id, 
                    status: { $in: ['Active', 'Inactive', 'Abroad'] }, // Count all members except dismissed
                    isApproved: true 
                  }),
                  Member.countDocuments({ 
                    group: group._id, 
                    status: 'Active',
                    isApproved: true 
                  }),
                  Member.countDocuments({ 
                    group: group._id, 
                    status: 'Inactive',
                    isApproved: true 
                  }),
                  Member.countDocuments({ 
                    group: group._id, 
                    status: 'Abroad',
                    isApproved: true 
                  })
                ]);
                
                return { 
                  groupId: group._id.toString(), 
                  totalMembers,
                  activeMembers,
                  inactiveMembers,
                  abroadMembers
                };
              })
            );
            
            // Create member stats lookup
            const memberStatsLookup = {};
            memberStats.forEach((stats) => {
              memberStatsLookup[stats.groupId] = stats;
            });
            
            // Initialize group progress tracking with actual member counts and status breakdown
            targetGroups.forEach(group => {
              const stats = memberStatsLookup[group._id.toString()] || {
                totalMembers: 0,
                activeMembers: 0,
                inactiveMembers: 0,
                abroadMembers: 0
              };
              
              groupProgress[group._id.toString()] = {
                groupId: group._id,
                groupName: group.name,
                groupCode: group.code,
                district: group.district,
                totalSessions: sessions.length,
                completedSessions: 0,
                // Member counts from database
                totalMembers: stats.totalMembers,
                activeMembers: stats.activeMembers,
                inactiveMembers: stats.inactiveMembers,
                abroadMembersFromDB: stats.abroadMembers, // Members with 'Abroad' status in DB
                // Attendance tracking (will be updated from session data)
                totalGuests: 0,
                presentMembers: 0,
                absentMembers: 0,
                abroadMembers: 0, // Members marked as abroad in attendance
                presentGuests: 0,
                attendanceRecorded: false,
                lastActivity: null,
                status: 'pending' // pending, in_progress, completed
              };
            });

            // Analyze each session for group participation
            sessions.forEach(session => {
              // Track which groups have recorded attendance
              const groupsWithAttendance = new Set();
              const groupAttendanceData = {};
              
              session.memberAttendance.forEach(attendance => {
                if (attendance.member && attendance.member.group) {
                  const groupId = attendance.member.group.toString();
                  groupsWithAttendance.add(groupId);
                  
                  if (!groupAttendanceData[groupId]) {
                    groupAttendanceData[groupId] = {
                      totalMembers: 0,
                      presentMembers: 0,
                      absentMembers: 0,
                      lateMembers: 0,
                      abroadMembers: 0
                    };
                  }
                  
                  groupAttendanceData[groupId].totalMembers++;
                  
                  switch (attendance.status) {
                    case 'present':
                      groupAttendanceData[groupId].presentMembers++;
                      break;
                    case 'absent':
                      groupAttendanceData[groupId].absentMembers++;
                      break;
                    case 'late':
                      groupAttendanceData[groupId].lateMembers++;
                      groupAttendanceData[groupId].presentMembers++; // Late is considered present
                      break;
                    case 'abroad':
                      groupAttendanceData[groupId].abroadMembers++;
                      break;
                  }
                  
                  if (groupProgress[groupId]) {
                    groupProgress[groupId].attendanceRecorded = true;
                    if (!groupProgress[groupId].lastActivity || session.completedAt > groupProgress[groupId].lastActivity) {
                      groupProgress[groupId].lastActivity = session.completedAt || session.scheduledDate;
                    }
                  }
                }
              });

              session.guestAttendance.forEach(guest => {
                if (guest.addedBy && guest.addedBy.group) {
                  const groupId = guest.addedBy.group.toString();
                  if (groupProgress[groupId]) {
                    groupProgress[groupId].totalGuests = (groupProgress[groupId].totalGuests || 0) + 1;
                    if (guest.status === 'present' || guest.status === 'late') {
                      groupProgress[groupId].presentGuests = (groupProgress[groupId].presentGuests || 0) + 1;
                    }
                  }
                }
              });

              // Update group progress with attendance data (don't overwrite totalMembers)
              Object.keys(groupAttendanceData).forEach(groupId => {
                if (groupProgress[groupId]) {
                  const data = groupAttendanceData[groupId];
                  // Keep the actual member count from database, only update attendance data
                  groupProgress[groupId].presentMembers = Math.max(groupProgress[groupId].presentMembers || 0, data.presentMembers);
                  groupProgress[groupId].absentMembers = Math.max(groupProgress[groupId].absentMembers || 0, data.absentMembers);
                  groupProgress[groupId].abroadMembers = Math.max(groupProgress[groupId].abroadMembers || 0, data.abroadMembers);
                  
                  // Calculate attendance rate based on actual total members vs present members
                  const totalParticipants = (groupProgress[groupId].totalMembers || 0) + (groupProgress[groupId].totalGuests || 0);
                  const totalPresent = (groupProgress[groupId].presentMembers || 0) + (groupProgress[groupId].presentGuests || 0);
                  groupProgress[groupId].attendanceRate = totalParticipants > 0 ? 
                    ((totalPresent / totalParticipants) * 100).toFixed(1) : '0';
                }
              });

              // Mark session as completed for groups that have attendance
              if (session.sessionStatus === 'completed') {
                groupsWithAttendance.forEach(groupId => {
                  if (groupProgress[groupId]) {
                    groupProgress[groupId].completedSessions++;
                  }
                });
              }
            });

            // Calculate status for each group
            // Key Logic: If attendance is recorded, it means the program was conducted/completed by that group
            Object.values(groupProgress).forEach(progress => {
              // If group has recorded any attendance data (present, absent, etc.), consider program as conducted
              if (progress.attendanceRecorded || progress.presentMembers > 0 || progress.absentMembers > 0 || progress.abroadMembers > 0 || progress.totalGuests > 0) {
                progress.status = 'completed'; // Program conducted = completed
                progress.programConducted = true;
              } else {
                progress.status = 'pending'; // No attendance recorded = program not conducted
                progress.programConducted = false;
              }
            });

            meetingObj.groupProgress = Object.values(groupProgress);
            
            // Calculate overall meeting completion status
            const totalGroups = Object.keys(groupProgress).length;
            const completedGroups = Object.values(groupProgress).filter(g => g.status === 'completed').length;
            const pendingGroups = Object.values(groupProgress).filter(g => g.status === 'pending').length;
            
            meetingObj.overallProgress = {
              totalGroups,
              completedGroups,
              pendingGroups,
              programsConducted: completedGroups, // Same as completed groups
              programsNotConducted: pendingGroups, // Same as pending groups
              completionRate: totalGroups > 0 ? ((completedGroups / totalGroups) * 100).toFixed(1) : 0,
              conductionRate: totalGroups > 0 ? ((completedGroups / totalGroups) * 100).toFixed(1) : 0, // Same as completion rate
              status: completedGroups === totalGroups ? 'completed' : 'pending'
            };

            // Session summary
            const totalSessions = sessions.length;
            const completedSessions = sessions.filter(s => s.sessionStatus === 'completed').length;
            
            meetingObj.sessionSummary = {
              totalSessions,
              completedSessions,
              pendingSessions: totalSessions - completedSessions,
              completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0
            };
          } else {
            // For non-monthly series meetings, check if any group has recorded attendance
            const attendanceRecords = await Attendance.find({ meeting: meeting._id })
              .populate('member', 'name phone status')
              .populate('markedBy', 'name role');
            const guestRecords = await GuestAttendance.find({ meeting: meeting._id })
              .populate('addedBy', 'name role');
            
            const groupsWithData = new Set();
            const groupAttendanceData = {};
            
            // Process member attendance by group
            attendanceRecords.forEach(record => {
              if (record.group) {
                const groupId = record.group.toString();
                groupsWithData.add(groupId);
                
                if (!groupAttendanceData[groupId]) {
                  groupAttendanceData[groupId] = {
                    totalMembers: 0,
                    presentMembers: 0,
                    absentMembers: 0,
                    abroadMembers: 0,
                    totalGuests: 0,
                    presentGuests: 0,
                    lastActivity: null
                  };
                }
                
                groupAttendanceData[groupId].totalMembers++;
                
                switch (record.status) {
                  case 'present':
                    groupAttendanceData[groupId].presentMembers++;
                    break;
                  case 'absent':
                    groupAttendanceData[groupId].absentMembers++;
                    break;
                  case 'late':
                    groupAttendanceData[groupId].presentMembers++; // Late is considered present
                    break;
                  case 'abroad':
                    groupAttendanceData[groupId].abroadMembers++;
                    break;
                }
                
                if (!groupAttendanceData[groupId].lastActivity || record.markedAt > groupAttendanceData[groupId].lastActivity) {
                  groupAttendanceData[groupId].lastActivity = record.markedAt;
                }
              }
            });
            
            // Process guest attendance by group
            guestRecords.forEach(record => {
              if (record.group) {
                const groupId = record.group.toString();
                groupsWithData.add(groupId);
                
                if (!groupAttendanceData[groupId]) {
                  groupAttendanceData[groupId] = {
                    totalMembers: 0,
                    presentMembers: 0,
                    totalGuests: 0,
                    presentGuests: 0,
                    lastActivity: null
                  };
                }
                
                groupAttendanceData[groupId].totalGuests++;
                if (record.status === 'present' || record.status === 'late') {
                  groupAttendanceData[groupId].presentGuests++;
                }
                
                if (!groupAttendanceData[groupId].lastActivity || record.addedAt > groupAttendanceData[groupId].lastActivity) {
                  groupAttendanceData[groupId].lastActivity = record.addedAt;
                }
              }
            });

            // Get actual member counts and status breakdown for non-monthly series meetings too
            const Member = (await import('../models/Member.js')).default;
            const memberStats = await Promise.all(
              targetGroups.map(async (group) => {
                const [totalMembers, activeMembers, inactiveMembers, abroadMembers] = await Promise.all([
                  Member.countDocuments({ 
                    group: group._id, 
                    status: { $in: ['Active', 'Inactive', 'Abroad'] }, // Count all members except dismissed
                    isApproved: true 
                  }),
                  Member.countDocuments({ 
                    group: group._id, 
                    status: 'Active',
                    isApproved: true 
                  }),
                  Member.countDocuments({ 
                    group: group._id, 
                    status: 'Inactive',
                    isApproved: true 
                  }),
                  Member.countDocuments({ 
                    group: group._id, 
                    status: 'Abroad',
                    isApproved: true 
                  })
                ]);
                
                return { 
                  groupId: group._id.toString(), 
                  totalMembers,
                  activeMembers,
                  inactiveMembers,
                  abroadMembers
                };
              })
            );
            
            // Create member stats lookup
            const memberStatsLookup = {};
            memberStats.forEach((stats) => {
              memberStatsLookup[stats.groupId] = stats;
            });

            const groupProgress = targetGroups.map(group => {
              const groupId = group._id.toString();
              const data = groupAttendanceData[groupId] || {
                presentMembers: 0,
                absentMembers: 0,
                abroadMembers: 0,
                totalGuests: 0,
                presentGuests: 0,
                lastActivity: null
              };
              
              // Use actual member stats from database
              const stats = memberStatsLookup[groupId] || {
                totalMembers: 0,
                activeMembers: 0,
                inactiveMembers: 0,
                abroadMembers: 0
              };
              
              // Key Logic: If any attendance data exists, program was conducted
              const programConducted = groupsWithData.has(groupId) || data.presentMembers > 0 || data.totalGuests > 0;
              
              return {
                groupId: group._id,
                groupName: group.name,
                groupCode: group.code,
                district: group.district,
                status: programConducted ? 'completed' : 'pending', // For single meetings, conducted = completed
                attendanceRecorded: groupsWithData.has(groupId),
                programConducted: programConducted,
                // Member counts from database
                totalMembers: stats.totalMembers,
                activeMembers: stats.activeMembers,
                inactiveMembers: stats.inactiveMembers,
                abroadMembersFromDB: stats.abroadMembers, // Members with 'Abroad' status in DB
                // Attendance data from meeting records
                totalGuests: data.totalGuests,
                presentMembers: data.presentMembers,
                presentGuests: data.presentGuests,
                absentMembers: data.absentMembers,
                abroadMembers: data.abroadMembers, // Members marked as abroad in attendance
                attendanceRate: (stats.totalMembers + data.totalGuests) > 0 ? 
                  (((data.presentMembers + data.presentGuests) / (stats.totalMembers + data.totalGuests)) * 100).toFixed(1) : '0',
                lastActivity: data.lastActivity,
                conductedDate: data.lastActivity // When the program was conducted (attendance marked)
              };
            });

            meetingObj.groupProgress = groupProgress;
            
            const totalGroups = groupProgress.length;
            const completedGroupsCount = groupProgress.filter(g => g.status === 'completed').length;
            const pendingGroupsCount = totalGroups - completedGroupsCount;
            
            meetingObj.overallProgress = {
              totalGroups,
              completedGroups: completedGroupsCount,
              pendingGroups: pendingGroupsCount,
              programsConducted: completedGroupsCount, // Same as completed groups
              programsNotConducted: pendingGroupsCount, // Same as pending groups
              completionRate: totalGroups > 0 ? ((completedGroupsCount / totalGroups) * 100).toFixed(1) : 0,
              conductionRate: totalGroups > 0 ? ((completedGroupsCount / totalGroups) * 100).toFixed(1) : 0, // Same as completion rate
              status: completedGroupsCount === totalGroups ? 'completed' : 'pending'
            };
          }

          return meetingObj;
        })
      );

      // Apply completion status filter if specified (this affects the data but not pagination)
      let filteredMeetings = enhancedMeetings;
      if (completionStatus) {
        filteredMeetings = enhancedMeetings.filter(meeting => 
          meeting.overallProgress?.status === completionStatus
        );
        
        // If we filtered out results, we need to adjust pagination
        // For now, we'll return the filtered results but keep original pagination
        // In a production system, you'd want to apply this filter at the database level
      }

      // Calculate summary statistics based on all meetings (not just current page)
      // For accurate stats, we should query all meetings, but for performance we'll use current page
      const summaryStats = {
        totalMeetings: result.totalDocs, // Use total from database
        completedMeetings: filteredMeetings.filter(m => m.overallProgress?.status === 'completed').length,
        pendingMeetings: filteredMeetings.filter(m => m.overallProgress?.status === 'pending').length,
        totalGroups: allGroups.length,
        // Program conduction statistics
        totalProgramsConducted: filteredMeetings.reduce((sum, m) => sum + (m.overallProgress?.programsConducted || 0), 0),
        totalProgramsNotConducted: filteredMeetings.reduce((sum, m) => sum + (m.overallProgress?.programsNotConducted || 0), 0),
        averageCompletionRate: filteredMeetings.length > 0 ? 
          (filteredMeetings.reduce((sum, m) => sum + parseFloat(m.overallProgress?.completionRate || 0), 0) / filteredMeetings.length).toFixed(1) : 0,
        averageConductionRate: filteredMeetings.length > 0 ? 
          (filteredMeetings.reduce((sum, m) => sum + parseFloat(m.overallProgress?.completionRate || 0), 0) / filteredMeetings.length).toFixed(1) : 0 // Same as completion rate
      };

      res.status(200).json({
        success: true,
        data: filteredMeetings,
        summaryStats,
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
      console.error('Get admin meetings overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch meetings overview'
      });
    }
  }
);

// @route   GET /api/meetings/admin/review
// @desc    Get all meetings data for state admin review with filters
// @access  Private (State Admin and District Admin)
router.get('/admin/review', 
  authenticate, 
  requireRole(['state_admin', 'district_admin']),
  paginationValidation,
  async (req, res) => {
    try {
      // Helper function to get groups in a district
      const getDistrictGroups = async (districtId) => {
        const Group = (await import('../models/Group.js')).default;
        const groups = await Group.find({ district: districtId }).select('_id');
        return groups.map(g => g._id);
      };

      const {
        page = 1,
        limit = 20,
        sort = '-createdAt',
        status,
        meetingType,
        targetAudience,
        district,
        group,
        dateFrom,
        dateTo,
        completionStatus,
        attendanceRate,
        search
      } = req.query;

      let filter = {};
      
      // Apply filters
      if (status) filter.status = status;
      if (meetingType) filter.meetingType = meetingType;
      if (targetAudience) filter.targetAudience = targetAudience;
      
      // Date range filter
      if (dateFrom || dateTo) {
        filter.scheduledDate = {};
        if (dateFrom) filter.scheduledDate.$gte = new Date(dateFrom);
        if (dateTo) filter.scheduledDate.$lte = new Date(dateTo);
      }

      // Search filter
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // District filter
      if (district) {
        filter.targetDistricts = district;
      }

      // Group filter  
      if (group) {
        filter.targetGroups = group;
      }

      // For district admins, filter to only show meetings in their district
      if (req.user.role === 'district_admin' && req.user.district) {
        filter.$or = [
          { targetAudience: 'all' },
          { targetDistricts: req.user.district._id },
          { targetGroups: { $in: await getDistrictGroups(req.user.district._id) } }
        ];
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort,
        populate: [
          { path: 'createdBy', select: 'name phone role district group' },
          { path: 'targetGroups', select: 'name code district', populate: { path: 'district', select: 'name code' } },
          { path: 'targetDistricts', select: 'name code' }
        ]
      };

      const result = await Meeting.paginate(filter, options);

      // Enhance meetings with detailed session and attendance data
      const enhancedMeetings = await Promise.all(
        result.docs.map(async (meeting) => {
          const meetingObj = meeting.toObject();
          
          // Get session information for monthly series meetings
          if (meeting.meetingType === 'monthly_series') {
            const sessions = await MeetingSession.find({ meeting: meeting._id })
              .sort({ sessionNumber: 1 })
              .populate('completedBy', 'name role group district')
              .populate('memberAttendance.member', 'name phone status group district')
              .populate('memberAttendance.markedBy', 'name role group district')
              .populate('guestAttendance.addedBy', 'name role group district')
              .select('sessionNumber title scheduledDate duration sessionStatus completedBy completedAt memberAttendance guestAttendance');
            
            // Calculate comprehensive session statistics
            const totalSessions = sessions.length;
            const completedSessions = sessions.filter(s => s.sessionStatus === 'completed').length;
            const upcomingSessions = sessions.filter(s => 
              s.sessionStatus === 'scheduled' && new Date(s.scheduledDate) >= new Date()
            ).length;
            
            let totalMemberAttendance = 0;
            let totalMemberPresent = 0;
            let totalGuestAttendance = 0;
            let totalGuestPresent = 0;
            let groupWiseStats = {};
            let districtWiseStats = {};

            // Detailed session analysis
            const sessionDetails = sessions.map(session => {
              const memberPresent = session.memberAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
              const memberTotal = session.memberAttendance.length;
              const guestPresent = session.guestAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
              const guestTotal = session.guestAttendance.length;
              
              totalMemberAttendance += memberTotal;
              totalMemberPresent += memberPresent;
              totalGuestAttendance += guestTotal;
              totalGuestPresent += guestPresent;

              // Group-wise statistics
              session.memberAttendance.forEach(attendance => {
                if (attendance.member && attendance.member.group) {
                  const groupId = attendance.member.group._id.toString();
                  const groupName = attendance.member.group.name;
                  
                  if (!groupWiseStats[groupId]) {
                    groupWiseStats[groupId] = {
                      groupName,
                      totalMembers: 0,
                      presentMembers: 0,
                      sessions: 0
                    };
                  }
                  
                  groupWiseStats[groupId].totalMembers++;
                  if (attendance.status === 'present' || attendance.status === 'late') {
                    groupWiseStats[groupId].presentMembers++;
                  }
                }
              });

              // District-wise statistics
              session.memberAttendance.forEach(attendance => {
                if (attendance.member && attendance.member.district) {
                  const districtId = attendance.member.district._id.toString();
                  const districtName = attendance.member.district.name;
                  
                  if (!districtWiseStats[districtId]) {
                    districtWiseStats[districtId] = {
                      districtName,
                      totalMembers: 0,
                      presentMembers: 0,
                      sessions: 0
                    };
                  }
                  
                  districtWiseStats[districtId].totalMembers++;
                  if (attendance.status === 'present' || attendance.status === 'late') {
                    districtWiseStats[districtId].presentMembers++;
                  }
                }
              });

              return {
                sessionId: session._id,
                sessionNumber: session.sessionNumber,
                title: session.title,
                scheduledDate: session.scheduledDate,
                duration: session.duration,
                status: session.sessionStatus,
                completedBy: session.completedBy,
                completedAt: session.completedAt,
                attendance: {
                  members: { total: memberTotal, present: memberPresent },
                  guests: { total: guestTotal, present: guestPresent },
                  overall: { 
                    total: memberTotal + guestTotal, 
                    present: memberPresent + guestPresent,
                    attendanceRate: (memberTotal + guestTotal) > 0 ? 
                      (((memberPresent + guestPresent) / (memberTotal + guestTotal)) * 100).toFixed(1) : 0
                  }
                }
              };
            });

            // Calculate group-wise attendance rates
            Object.keys(groupWiseStats).forEach(groupId => {
              const stats = groupWiseStats[groupId];
              stats.attendanceRate = stats.totalMembers > 0 ? 
                ((stats.presentMembers / stats.totalMembers) * 100).toFixed(1) : 0;
              stats.sessions = sessions.length;
            });

            // Calculate district-wise attendance rates
            Object.keys(districtWiseStats).forEach(districtId => {
              const stats = districtWiseStats[districtId];
              stats.attendanceRate = stats.totalMembers > 0 ? 
                ((stats.presentMembers / stats.totalMembers) * 100).toFixed(1) : 0;
              stats.sessions = sessions.length;
            });
            
            const overallAttendanceRate = (totalMemberAttendance + totalGuestAttendance) > 0 ? 
              (((totalMemberPresent + totalGuestPresent) / (totalMemberAttendance + totalGuestAttendance)) * 100).toFixed(1) : 0;

            meetingObj.sessionInfo = {
              totalSessions,
              completedSessions,
              upcomingSessions,
              pendingSessions: totalSessions - completedSessions,
              completionRate: totalSessions > 0 ? ((completedSessions / totalSessions) * 100).toFixed(1) : 0,
              overallAttendanceRate,
              totalMemberAttendance,
              totalGuestAttendance,
              totalParticipants: totalMemberAttendance + totalGuestAttendance,
              totalPresent: totalMemberPresent + totalGuestPresent,
              sessions: sessionDetails,
              groupWiseStats: Object.values(groupWiseStats),
              districtWiseStats: Object.values(districtWiseStats)
            };

            // Add completion status for filtering
            meetingObj.completionStatus = completedSessions === 0 ? 'not_started' :
              completedSessions === totalSessions ? 'completed' : 'in_progress';
          }

          // Add review flags
          meetingObj.reviewFlags = {
            needsAttention: false,
            lowAttendance: false,
            incompleteData: false,
            issues: []
          };

          if (meeting.meetingType === 'monthly_series' && meetingObj.sessionInfo) {
            const attendanceRate = parseFloat(meetingObj.sessionInfo.overallAttendanceRate);
            const completionRate = parseFloat(meetingObj.sessionInfo.completionRate);
            
            if (attendanceRate < 60 && meetingObj.sessionInfo.totalParticipants > 0) {
              meetingObj.reviewFlags.lowAttendance = true;
              meetingObj.reviewFlags.needsAttention = true;
              meetingObj.reviewFlags.issues.push('Low attendance rate');
            }
            
            if (completionRate < 50 && meetingObj.sessionInfo.totalSessions > 0) {
              meetingObj.reviewFlags.incompleteData = true;
              meetingObj.reviewFlags.needsAttention = true;
              meetingObj.reviewFlags.issues.push('Incomplete session data');
            }

            if (meetingObj.sessionInfo.pendingSessions > 0 && new Date(meeting.scheduledDate) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
              meetingObj.reviewFlags.needsAttention = true;
              meetingObj.reviewFlags.issues.push('Overdue sessions');
            }
          }

          return meetingObj;
        })
      );

      // Apply post-processing filters
      let filteredMeetings = enhancedMeetings;

      if (completionStatus) {
        filteredMeetings = filteredMeetings.filter(meeting => 
          meeting.completionStatus === completionStatus
        );
      }

      if (attendanceRate) {
        const minRate = parseFloat(attendanceRate);
        filteredMeetings = filteredMeetings.filter(meeting => {
          if (!meeting.sessionInfo) return true;
          const rate = parseFloat(meeting.sessionInfo.overallAttendanceRate);
          return rate >= minRate;
        });
      }

      // Calculate summary statistics
      const summaryStats = {
        totalMeetings: filteredMeetings.length,
        monthlySeriesMeetings: filteredMeetings.filter(m => m.meetingType === 'monthly_series').length,
        completedMeetings: filteredMeetings.filter(m => m.completionStatus === 'completed').length,
        inProgressMeetings: filteredMeetings.filter(m => m.completionStatus === 'in_progress').length,
        notStartedMeetings: filteredMeetings.filter(m => m.completionStatus === 'not_started').length,
        meetingsNeedingAttention: filteredMeetings.filter(m => m.reviewFlags?.needsAttention).length,
        lowAttendanceMeetings: filteredMeetings.filter(m => m.reviewFlags?.lowAttendance).length,
        averageAttendanceRate: filteredMeetings.length > 0 ? 
          (filteredMeetings.reduce((sum, m) => sum + (parseFloat(m.sessionInfo?.overallAttendanceRate) || 0), 0) / filteredMeetings.length).toFixed(1) : 0,
        totalParticipants: filteredMeetings.reduce((sum, m) => sum + (m.sessionInfo?.totalParticipants || 0), 0),
        totalSessions: filteredMeetings.reduce((sum, m) => sum + (m.sessionInfo?.totalSessions || 0), 0),
        completedSessions: filteredMeetings.reduce((sum, m) => sum + (m.sessionInfo?.completedSessions || 0), 0)
      };

      res.status(200).json({
        success: true,
        data: filteredMeetings,
        summaryStats,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalDocs: filteredMeetings.length,
          limit: result.limit,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage
        }
      });

    } catch (error) {
      console.error('Get admin meetings review error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch meetings for review'
      });
    }
  }
);

export default router;