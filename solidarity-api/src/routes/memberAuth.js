import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import crypto from 'crypto';
import MemberAuth from '../models/MemberAuth.js';
import Member from '../models/Member.js';
import PersonalTarget from '../models/PersonalTarget.js';
import MemberTargetProgress from '../models/MemberTargetProgress.js';
import BaithulMaalPayment from '../models/BaithulMaalPayment.js';
import Meeting from '../models/Meeting.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import District from '../models/District.js';
import Group from '../models/Group.js';
import OrgFile from '../models/OrgFile.js';
import { body, validationResult } from 'express-validator';
import RecurringMark from '../models/RecurringMark.js';

// Multer in-memory storage for file uploads
const memberUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'video/mp4', 'video/mpeg',
      'audio/mpeg', 'audio/wav'
    ];
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
});

const router = express.Router();

// Middleware to format phone number
const formatPhoneNumber = (req, res, next) => {
  if (req.body.phone && req.body.phone.match(/^[6-9]\d{9}$/)) {
    req.body.phone = `+91${req.body.phone}`;
  }
  next();
};

// Build phone query that matches both '+91XXXXXXXXXX' and 'XXXXXXXXXX' formats
const buildPhoneQuery = (phone) => {
  const digits = phone.replace(/^\+91/, '');
  return { $in: [`+91${digits}`, digits] };
};

// Validation middleware
const memberLoginValidation = [
  body('phone').matches(/^(\+91)?[6-9]\d{9}$/).withMessage('Please enter a valid Indian phone number')
];

const memberVerifyOTPValidation = [
  body('phone').matches(/^(\+91)?[6-9]\d{9}$/).withMessage('Please enter a valid Indian phone number'),
  body('otp').isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits')
];

// Member authentication middleware
const authenticateMember = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.userType !== 'member') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const memberAuth = await MemberAuth.findById(decoded.id).populate({
      path: 'member',
      populate: [
        { path: 'district', select: 'name' },
        { path: 'group', select: 'name' }
      ]
    });

    if (!memberAuth || !memberAuth.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Member account not found or inactive'
      });
    }

    if (!memberAuth.member || !memberAuth.member.isApproved || memberAuth.member.status !== 'Active') {
      return res.status(401).json({
        success: false,
        message: 'Member account not approved or inactive'
      });
    }

    req.memberAuth = memberAuth;
    req.member = memberAuth.member;
    next();

  } catch (error) {
    console.error('Member authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// @route   POST /api/member-auth/send-otp
// @desc    Send OTP to member's phone
// @access  Public
router.post('/send-otp', memberLoginValidation, formatPhoneNumber, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone } = req.body;

    // Check if member exists and is active (handle both +91XXXXXXXXXX and XXXXXXXXXX formats)
    const member = await Member.findOne({ phone: buildPhoneQuery(phone), status: 'Active', isApproved: true })
      .populate('district', 'name')
      .populate('group', 'name');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or not approved. Please contact your group admin.'
      });
    }

    // Create or get member auth record (also search by phone to handle format mismatches)
    let memberAuth = await MemberAuth.findOne({ member: member._id });
    if (!memberAuth) {
      memberAuth = await MemberAuth.findOne({ phone: buildPhoneQuery(phone) });
      if (memberAuth) {
        // Fix the member reference to point to the found member
        memberAuth.member = member._id;
        await memberAuth.save();
      } else {
        memberAuth = await MemberAuth.createForMember(member._id);
      }
    }

    // Check if account is locked
    if (memberAuth.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to multiple failed attempts. Please try again later.'
      });
    }

    // Generate and send OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    memberAuth.otp = {
      code: otpCode,
      expiresAt,
      attempts: 0
    };

    await memberAuth.save();

    // In development, return the OTP for testing
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Here you would integrate with your SMS service
    // For now, we'll just log it
    console.log('\n🎯 ================================');
    console.log('🔐 MEMBER OTP GENERATED FOR TESTING');
    console.log('================================');
    console.log(`📱 Phone: ${phone}`);
    console.log(`🔢 OTP: ${otpCode}`);
    console.log(`👤 User Type: member`);
    console.log(`⏰ Expires: ${expiresAt.toLocaleString()}`);
    console.log('================================');
    console.log('💡 Use this OTP in your app!');
    console.log('================================\n');

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your registered mobile number',
      data: {
        expiresAt,
        ...(isDevelopment && { demoOTP: otpCode })
      }
    });

  } catch (error) {
    console.error('Member send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
});

// @route   POST /api/member-auth/verify-otp
// @desc    Verify OTP and login member
// @access  Public
router.post('/verify-otp', memberVerifyOTPValidation, formatPhoneNumber, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone, otp, deviceId, deviceName } = req.body;

    // First find the member from Member model (handle both +91XXXXXXXXXX and XXXXXXXXXX formats)
    const member = await Member.findOne({ phone: buildPhoneQuery(phone), status: 'Active', isApproved: true })
      .populate('district', 'name')
      .populate('group', 'name');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or not approved. Please contact your group admin.'
      });
    }

    // Then find the corresponding MemberAuth record (also search by phone for format mismatches)
    let memberAuth = await MemberAuth.findOne({ member: member._id });
    if (!memberAuth) {
      memberAuth = await MemberAuth.findOne({ phone: buildPhoneQuery(phone) });
      if (memberAuth) {
        memberAuth.member = member._id;
        await memberAuth.save();
      }
    }
    if (memberAuth) {
      await memberAuth.populate({
        path: 'member',
        populate: [
          { path: 'district', select: 'name' },
          { path: 'group', select: 'name' }
        ]
      });
    }

    if (!memberAuth) {
      return res.status(404).json({
        success: false,
        message: 'Member authentication record not found'
      });
    }

    // Check if account is locked
    if (memberAuth.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.'
      });
    }

    // Check if OTP is expired
    if (memberAuth.isOTPExpired()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    // Verify OTP (allow any 4-digit OTP in development)
    let isValidOTP = false;
    
    if (process.env.NODE_ENV === 'development') {
      // In development, accept any 4-digit OTP
      isValidOTP = /^\d{4}$/.test(otp);
      console.log(`🔐 Member Development OTP Check: ${otp} - Valid: ${isValidOTP}`);
    } else {
      // In production, verify against stored OTP
      isValidOTP = await memberAuth.compareOTP(otp);
    }
    
    if (!isValidOTP) {
      await memberAuth.incLoginAttempts();
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Clear OTP and reset login attempts
    memberAuth.clearOTP();
    await memberAuth.resetLoginAttempts();
    memberAuth.lastLogin = new Date();

    // Add device info if provided
    if (deviceId && deviceName) {
      await memberAuth.addDevice(deviceId, deviceName);
    }

    await memberAuth.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        id: memberAuth._id,
        memberId: memberAuth.member._id,
        phone: memberAuth.phone,
        userType: 'member'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        member: {
          id: memberAuth.member._id,
          name: memberAuth.member.name,
          phone: memberAuth.member.phone,
          email: memberAuth.member.email,
          district: memberAuth.member.district,
          group: memberAuth.member.group,
          status: memberAuth.member.status,
          joinedDate: memberAuth.member.joinedDate
        }
      }
    });

  } catch (error) {
    console.error('Member verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP'
    });
  }
});

// @route   POST /api/member-auth/resend-otp
// @desc    Resend OTP to member's phone
// @access  Public
router.post('/resend-otp', memberLoginValidation, formatPhoneNumber, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone } = req.body;

    // First find the member from Member model (handle both +91XXXXXXXXXX and XXXXXXXXXX formats)
    const member = await Member.findOne({ phone: buildPhoneQuery(phone), status: 'Active', isApproved: true });
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or not approved. Please contact your group admin.'
      });
    }

    // Then find the corresponding MemberAuth record
    const memberAuth = await MemberAuth.findOne({ member: member._id });
    if (!memberAuth) {
      return res.status(404).json({
        success: false,
        message: 'Member authentication record not found'
      });
    }

    // Check if account is locked
    if (memberAuth.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.'
      });
    }

    // Generate new OTP
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    memberAuth.otp = {
      code: otpCode,
      expiresAt,
      attempts: 0
    };

    await memberAuth.save();

    // In development, return the OTP for testing
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    console.log('\n🎯 ================================');
    console.log('🔐 MEMBER OTP RESENT FOR TESTING');
    console.log('================================');
    console.log(`📱 Phone: ${phone}`);
    console.log(`🔢 OTP: ${otpCode}`);
    console.log(`👤 User Type: member`);
    console.log(`⏰ Expires: ${expiresAt.toLocaleString()}`);
    console.log('================================');
    console.log('💡 Use this OTP in your app!');
    console.log('================================\n');

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        expiresAt,
        ...(isDevelopment && { demoOTP: otpCode })
      }
    });

  } catch (error) {
    console.error('Member resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP'
    });
  }
});

// @route   GET /api/member-auth/profile
// @desc    Get member profile information
// @access  Private (Member)
router.get('/profile', authenticateMember, async (req, res) => {
  try {
    const member = req.member;

    // Get baithul maal payment summary
    const baithulMaalSummary = await BaithulMaalPayment.aggregate([
      { $match: { member: member._id } },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: '$amount' },
          lastPaymentDate: { $max: '$paymentDate' },
          paymentCount: { $sum: 1 }
        }
      }
    ]);

    const baithulMaalData = baithulMaalSummary[0] || {
      totalPaid: 0,
      lastPaymentDate: null,
      paymentCount: 0
    };

    // Calculate pending amount (assuming monthly contribution)
    const monthsActive = member.joinedDate ? 
      Math.floor((Date.now() - member.joinedDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
    const expectedTotal = monthsActive * (member.baithulMaal?.monthlyAmount || 0);
    const pendingAmount = Math.max(0, expectedTotal - baithulMaalData.totalPaid);

    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: member._id,
          name: member.name,
          phone: member.phone,
          email: member.email,
          dateOfBirth: member.dateOfBirth,
          age: member.age,
          bloodGroup: member.bloodGroup,
          profession: member.profession,
          education: member.education,
          address: member.address,
          district: member.district,
          group: member.group,
          status: member.status,
          joinedDate: member.joinedDate
        },
        baithulMaal: {
          monthlyAmount: member.baithulMaal?.monthlyAmount || 0,
          totalPaid: baithulMaalData.totalPaid,
          pendingAmount,
          lastPaymentDate: baithulMaalData.lastPaymentDate,
          paymentCount: baithulMaalData.paymentCount
        }
      }
    });

  } catch (error) {
    console.error('Get member profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile information'
    });
  }
});

// @route   GET /api/member-auth/baithul-maal
// @desc    Get member's baithul maal payment details
// @access  Private (Member)
router.get('/baithul-maal', authenticateMember, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { paymentDate: -1 }
    };

    const payments = await BaithulMaalPayment.paginate(
      { member: req.member._id },
      options
    );

    res.status(200).json({
      success: true,
      data: {
        payments: payments.docs,
        pagination: {
          currentPage: payments.page,
          totalPages: payments.totalPages,
          totalItems: payments.totalDocs,
          hasNext: payments.hasNextPage,
          hasPrev: payments.hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Get member baithul maal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch baithul maal details'
    });
  }
});

// @route   GET /api/member-auth/meetings
// @desc    Get meetings relevant to the member (view only)
// @access  Private (Member)
router.get('/meetings', authenticateMember, async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'scheduled' } = req.query;
    const member = req.member;

    let filter = {
      $or: [
        { targetAudience: 'all' },
        { targetGroups: member.group },
        { targetDistricts: member.district }
      ]
    };

    if (status) {
      filter.status = status;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { scheduledDate: status === 'scheduled' ? 1 : -1 },
      select: 'title description agenda scheduledDate duration venue meetingType status'
    };

    const meetings = await Meeting.paginate(filter, options);

    res.status(200).json({
      success: true,
      data: {
        meetings: meetings.docs,
        pagination: {
          currentPage: meetings.page,
          totalPages: meetings.totalPages,
          totalItems: meetings.totalDocs,
          hasNext: meetings.hasNextPage,
          hasPrev: meetings.hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Get member meetings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch meetings'
    });
  }
});

// @route   GET /api/member-auth/targets
// @desc    Get personal targets for the member
// @access  Private (Member)
router.get('/targets', authenticateMember, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const member = req.member;
    const now = new Date();

    // Build filter: only show targets that are active and within the current date range
    let targetFilter = {
      status: 'active',
      targetAudience: { $in: ['all_users', 'members_only'] },
      $or: [
        // Targets with a date range — only show if current time is within range
        { startDate: { $lte: now }, endDate: { $gte: now } },
        // Targets without dates set — always show (backward compat)
        { startDate: { $exists: false } },
        { startDate: null }
      ]
    };

    // Get all targets that apply to this member, sorted by release date (recent first)
    const targets = await PersonalTarget.find(targetFilter)
      .sort({ createdAt: -1, startDate: -1 }) // Sort by creation date first, then start date
      .limit(parseInt(limit))
      .populate('createdBy', 'name role');

    // Get member's progress for these targets
    const targetIds = targets.map(t => t._id);
    const progressRecords = await MemberTargetProgress.find({ 
      member: member._id,
      personalTarget: { $in: targetIds }
    });

    // Create a map of progress by target ID
    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.personalTarget.toString()] = progress;
    });

    // Combine targets with progress data
    const targetsWithProgress = targets.map(target => {
      const progress = progressMap[target._id.toString()];
      
      if (progress) {
        // Return existing progress record
        return {
          _id: progress._id,
          personalTarget: target,
          currentProgress: progress.currentProgress,
          targetValue: progress.targetValue,
          progressPercentage: progress.progressPercentage,
          status: progress.status,
          completedAt: progress.completedAt,
          feedback: progress.feedback || '',
          fileAttachment: progress.fileAttachment || null,
          notes: progress.notes,
          dailyProgress: progress.dailyProgress,
          createdAt: progress.createdAt,
          updatedAt: progress.updatedAt
        };
      } else {
        // Create a virtual progress record for targets without progress
        return {
          _id: null, // No progress record exists yet
          personalTarget: target,
          currentProgress: 0,
          targetValue: target.targetValue,
          progressPercentage: 0,
          status: 'not_started',
          completedAt: null,
          feedback: '',
          fileAttachment: null,
          notes: null,
          dailyProgress: [],
          createdAt: target.createdAt,
          updatedAt: target.updatedAt
        };
      }
    });

    const filteredTargets = targetsWithProgress;

    res.status(200).json({
      success: true,
      data: filteredTargets,
      meta: {
        total: filteredTargets.length,
        hasProgress: progressRecords.length,
        newTargets: targets.length - progressRecords.length
      }
    });

  } catch (error) {
    console.error('Get member targets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch personal targets'
    });
  }
});

// @route   GET /api/member-auth/notifications
// @desc    Get notifications for the member
// @access  Private (Member)
router.get('/notifications', authenticateMember, async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead, status, type } = req.query;
    const member = req.member;

    let filter = {
      status: status || 'sent',
      $or: [
        { targetAudience: 'all' },
        { targetAudience: 'members' },
        { targetAudiences: { $in: ['all', 'members'] } },
        { targetGroups: member.group },
        { targetDistricts: member.district },
        { targetMembers: member._id }
      ]
    };

    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
    }

    if (type) {
      filter.type = type;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const notifications = await Notification.paginate(filter, options);

    res.status(200).json({
      success: true,
      data: {
        notifications: notifications.docs,
        pagination: {
          currentPage: notifications.page,
          totalPages: notifications.totalPages,
          totalItems: notifications.totalDocs,
          hasNext: notifications.hasNextPage,
          hasPrev: notifications.hasPrevPage
        }
      }
    });

  } catch (error) {
    console.error('Get member notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// @route   POST /api/member-auth/logout
// @desc    Logout member
// @access  Private (Member)
router.post('/logout', authenticateMember, async (req, res) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return success and let client handle token removal
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Member logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout'
    });
  }
});

// @route   GET /api/member-auth/leaders
// @desc    Get all users marked as leaders (accessible to authenticated members)
// @access  Private (Member)
router.get('/leaders', authenticateMember, async (req, res) => {
  try {
    const {
      roleType,
      search,
      districtId,
      groupId,
      unitName,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { isLeader: true };
    if (roleType) filter['roleTag.type'] = roleType;
    if (districtId) filter.district = districtId;
    if (groupId) filter.group = groupId;
    if (unitName) filter['roleTag.name'] = unitName;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { 'roleTag.name': { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('name phone role roleTag isLeader district group')
      .populate('district', 'name code')
      .populate('group', 'name code')
      .populate('roleTag.areaId', 'name code')
      .sort({ 'roleTag.type': 1, name: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalDocs: total,
        totalPages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get leaders (member) error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaders' });
  }
});

// @route   POST /api/member-auth/targets/:targetId/progress
// @desc    Mark a target as completed / in-progress with feedback and optional file
// @access  Private (Member)
router.post('/targets/:targetId/progress', authenticateMember, async (req, res) => {
  try {
    const { status, feedback, fileAttachment } = req.body;
    const member = req.member;

    const validStatuses = ['not_started', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Fetch target to get targetValue for upsert
    const personalTarget = await PersonalTarget.findById(req.params.targetId);
    if (!personalTarget) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }

    const isCompleted = status === 'completed';
    const updateData = {
      status,
      targetValue: personalTarget.targetValue,
      currentProgress: isCompleted ? personalTarget.targetValue : 0,
      progressPercentage: isCompleted ? 100 : 0,
      ...(feedback !== undefined ? { feedback } : {}),
      ...(fileAttachment ? { fileAttachment } : {}),
      ...(isCompleted ? { completedAt: new Date() } : {})
    };

    const progress = await MemberTargetProgress.findOneAndUpdate(
      { member: member._id, personalTarget: req.params.targetId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, message: 'Progress updated', data: progress });
  } catch (error) {
    console.error('Update member target progress error:', error);
    res.status(500).json({ success: false, message: 'Failed to update progress' });
  }
});

// @route   GET /api/member-auth/recurring-marks
// @desc    Get all recurring marks for the logged-in member
// @access  Private (Member)
router.get('/recurring-marks', authenticateMember, async (req, res) => {
  try {
    const marks = await RecurringMark.find({
      user: req.member._id,
      userType: 'Member'
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
    console.error('Get member recurring marks error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch recurring marks' });
  }
});

// @route   POST /api/member-auth/recurring-marks
// @desc    Upsert a recurring mark for the logged-in member
// @access  Private (Member)
router.post('/recurring-marks', authenticateMember, async (req, res) => {
  try {
    const { targetId, year, month, completed } = req.body;

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

    const mark = await RecurringMark.findOneAndUpdate(
      {
        user: req.member._id,
        userType: 'Member',
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

    // Sync MemberTargetProgress: completed if any mark for this target is completed
    const anyCompleted = await RecurringMark.exists({
      user: req.member._id,
      userType: 'Member',
      personalTarget: targetId,
      completed: true
    });
    await MemberTargetProgress.findOneAndUpdate(
      { member: req.member._id, personalTarget: targetId },
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
    console.error('Upsert member recurring mark error:', error);
    res.status(500).json({ success: false, message: 'Failed to update mark' });
  }
});

// @route   POST /api/member-auth/uploads
// @desc    Upload a file to DigitalOcean Spaces (member)
// @access  Private (Member)
router.post('/uploads', authenticateMember, memberUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const s3 = new S3Client({
      endpoint: process.env.DO_SPACES_ENDPOINT,
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY,
        secretAccessKey: process.env.DO_SPACES_SECRET
      },
      forcePathStyle: false
    });

    const bucket = process.env.DO_SPACES_BUCKET;
    const folder = process.env.DO_SPACES_FOLDER || 'targets';
    const cdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT;
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(req.file.originalname);
    const key = `${folder}/${uniqueId}${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    }));

    const cdnBase = cdnEndpoint
      ? cdnEndpoint.replace(/\/$/, '')
      : `https://${bucket}.${process.env.DO_SPACES_ENDPOINT?.replace('https://', '')}`;

    res.status(200).json({
      success: true,
      data: {
        url: `${cdnBase}/${key}`,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        key
      }
    });
  } catch (error) {
    console.error('Member file upload error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload file' });
  }
});

// @route   GET /api/member-auth/districts
// @desc    Get all districts (for filter dropdowns)
// @access  Private (Member)
router.get('/districts', authenticateMember, async (req, res) => {
  try {
    const districts = await District.find({ isActive: true })
      .select('_id name code')
      .sort({ name: 1 });

    res.status(200).json({ success: true, data: districts });
  } catch (error) {
    console.error('Get districts (member) error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch districts' });
  }
});

// @route   GET /api/member-auth/groups
// @desc    Get all groups (for filter dropdowns), optionally filtered by district
// @access  Private (Member)
router.get('/groups', authenticateMember, async (req, res) => {
  try {
    const { district } = req.query;
    const filter = { isActive: true };
    if (district) filter.district = district;

    const groups = await Group.find(filter)
      .select('_id name code district')
      .sort({ name: 1 });

    res.status(200).json({ success: true, data: groups });
  } catch (error) {
    console.error('Get groups (member) error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch groups' });
  }
});

// @route   GET /api/member-auth/org-files
// @desc    Get organizational files visible to members (general files only, not membership_form)
// @access  Private (Member)
router.get('/org-files', authenticateMember, async (req, res) => {
  try {
    const { category, search } = req.query;

    const filter = { isActive: true, fileType: 'general' };

    if (category && category !== 'all') filter.category = category;

    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { originalName: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const files = await OrgFile.find(filter)
      .select('title description category fileType url originalName mimetype size createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: files });
  } catch (error) {
    console.error('Get org files (member) error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch files' });
  }
});

// @route   PUT /api/member-auth/profile
// @desc    Update member's own profile (name, email, profession, education, address, bloodGroup, age)
// @access  Private (Member)
router.put('/profile', authenticateMember, [
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters'),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('profession').optional().trim().isLength({ max: 100 }).withMessage('Profession cannot exceed 100 characters'),
  body('education').optional().trim().isLength({ max: 100 }).withMessage('Education cannot exceed 100 characters'),
  body('address').optional().trim().isLength({ max: 500 }).withMessage('Address cannot exceed 500 characters'),
  body('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']).withMessage('Invalid blood group'),
  body('age').optional({ checkFalsy: true }).isInt({ min: 0, max: 120 }).withMessage('Invalid age'),
  body('areaOfInterest').optional().trim().isLength({ max: 200 }),
  body('skills').optional().trim().isLength({ max: 200 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const allowedFields = ['name', 'email', 'profession', 'education', 'address', 'bloodGroup', 'age', 'areaOfInterest', 'skills'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const member = await Member.findByIdAndUpdate(
      req.member._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('district', 'name').populate('group', 'name');

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: member._id,
        name: member.name,
        phone: member.phone,
        email: member.email,
        dateOfBirth: member.dateOfBirth,
        age: member.age,
        bloodGroup: member.bloodGroup,
        profession: member.profession,
        education: member.education,
        address: member.address,
        areaOfInterest: member.areaOfInterest,
        skills: member.skills,
        district: member.district,
        group: member.group,
        status: member.status,
        joinedDate: member.joinedDate
      }
    });
  } catch (error) {
    console.error('Update member profile error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update profile' });
  }
});

export { authenticateMember };
export default router;