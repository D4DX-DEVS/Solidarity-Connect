import express from 'express';
import jwt from 'jsonwebtoken';
import MemberAuth from '../models/MemberAuth.js';
import Member from '../models/Member.js';
import PersonalTarget from '../models/PersonalTarget.js';
import MemberTargetProgress from '../models/MemberTargetProgress.js';
import BaithulMaalPayment from '../models/BaithulMaalPayment.js';
import Meeting from '../models/Meeting.js';
import Notification from '../models/Notification.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Middleware to format phone number
const formatPhoneNumber = (req, res, next) => {
  if (req.body.phone && req.body.phone.match(/^[6-9]\d{9}$/)) {
    req.body.phone = `+91${req.body.phone}`;
  }
  next();
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

    // Check if member exists and is active
    const member = await Member.findOne({ phone, status: 'Active', isApproved: true })
      .populate('district', 'name')
      .populate('group', 'name');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or not approved. Please contact your group admin.'
      });
    }

    // Create or get member auth record
    let memberAuth = await MemberAuth.findOne({ member: member._id });
    if (!memberAuth) {
      memberAuth = await MemberAuth.createForMember(member._id);
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

    // First find the member from Member model
    const member = await Member.findOne({ phone, status: 'Active', isApproved: true })
      .populate('district', 'name')
      .populate('group', 'name');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found or not approved. Please contact your group admin.'
      });
    }

    // Then find the corresponding MemberAuth record
    const memberAuth = await MemberAuth.findOne({ member: member._id }).populate({
      path: 'member',
      populate: [
        { path: 'district', select: 'name' },
        { path: 'group', select: 'name' }
      ]
    });

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

    // First find the member from Member model
    const member = await Member.findOne({ phone, status: 'Active', isApproved: true });
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
    const { month, year, status } = req.query;
    const member = req.member;

    // Get member's target progress
    const progressRecords = await MemberTargetProgress.find({ member: member._id })
      .populate({
        path: 'personalTarget',
        match: {
          status: 'active',
          ...(month && { month: parseInt(month) }),
          ...(year && { year: parseInt(year) })
        }
      })
      .populate('personalTarget', 'title description category targetValue unit month year startDate endDate instructions rewards');

    // Filter out records where personalTarget is null (due to populate match)
    const validProgress = progressRecords.filter(p => p.personalTarget);

    // Apply status filter if provided
    const filteredProgress = status ? 
      validProgress.filter(p => p.status === status) : 
      validProgress;

    res.status(200).json({
      success: true,
      data: filteredProgress
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
    const { page = 1, limit = 20, isRead } = req.query;
    const member = req.member;

    let filter = {
      $or: [
        { targetAudience: 'all' },
        { targetAudience: 'members' },
        { targetGroups: member.group },
        { targetDistricts: member.district },
        { targetMembers: member._id }
      ]
    };

    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
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

export { authenticateMember };
export default router;