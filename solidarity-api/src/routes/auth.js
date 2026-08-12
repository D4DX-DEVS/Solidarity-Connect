import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import otpService from '../services/otpService.js';
import loginService from '../services/loginService.js';
import { OTP_DIGITS } from '../services/msghexService.js';
import { loginValidation, verifyOTPValidation } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import Member from '../models/Member.js';
import MemberAuth from '../models/MemberAuth.js';

const router = express.Router();

// @route   POST /api/auth/send-otp
// @desc    Send OTP to user's phone
// @access  Public
// Middleware to format phone number
const formatPhoneNumber = (req, res, next) => {
  if (req.body.phone && req.body.phone.match(/^[6-9]\d{9}$/)) {
    req.body.phone = `+91${req.body.phone}`;
  }
  next();
};

router.post('/send-otp', formatPhoneNumber, loginValidation, async (req, res) => {
  try {
    const { phone, userType } = req.body;
    console.log('Received send-otp request:', { phone, userType });

    const result = await otpService.sendOTP(phone, userType);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message,
        availableRoles: result.availableRoles
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        expiresAt: result.expiresAt,
        ...(result.demoOTP && { demoOTP: result.demoOTP }) // Only in development
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send OTP'
    });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and login user
// @access  Public
router.post('/verify-otp', formatPhoneNumber, verifyOTPValidation, async (req, res) => {
  try {
    const { phone, otp, userType } = req.body;

    const result = await otpService.verifyOTP(phone, otp, userType);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: result.user.id,
        phone: result.user.phone,
        role: result.user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '365d' }
    );

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        token,
        user: result.user
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify OTP'
    });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP to user's phone
// @access  Public
router.post('/resend-otp', formatPhoneNumber, loginValidation, async (req, res) => {
  try {
    const { phone, userType } = req.body;

    const result = await otpService.resendOTP(phone, userType);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        expiresAt: result.expiresAt,
        ...(result.demoOTP && { demoOTP: result.demoOTP }) // Only in development
      }
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resend OTP'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user;

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        adminKind: user.role === 'group_admin' ? (user.adminKind || 'area') : null,
        label: loginService.accountLabel(user.role, user.adminKind),
        district: user.district,
        group: user.group,
        roleTag: user.roleTag,
        permissions: user.permissions,
        lastLogin: user.lastLogin,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', authenticate, async (req, res) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return success and let client handle token removal
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout'
    });
  }
});

// @route   GET /api/auth/otp-status
// @desc    Get OTP status for a user
// @access  Public
router.get('/otp-status', async (req, res) => {
  try {
    const { phone, userType } = req.query;

    if (!phone || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Phone and userType are required'
      });
    }

    const result = await otpService.getOTPStatus(phone, userType);

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Get OTP status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get OTP status'
    });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', authenticate, async (req, res) => {
  try {
    const user = req.user;

    // Generate new token
    const token = jwt.sign(
      { 
        id: user._id,
        phone: user.phone,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '365d' }
    );

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token'
    });
  }
});

// @route   POST /api/auth/check-roles
// @desc    Check available roles for a phone number
// @access  Public (rate-limited)
router.post('/check-roles', [
  body('phone').matches(/^(\+91)?[6-9]\d{9}$/).withMessage('Please enter a valid Indian phone number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    let { phone } = req.body;

    const roles = await otpService.getAvailableRoles(phone);

    res.status(200).json({
      success: true,
      data: {
        roles,
        hasMultipleRoles: roles.length > 1
      }
    });

  } catch (error) {
    console.error('Check roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check roles'
    });
  }
});

// @route   POST /api/auth/switch-role
// @desc    Switch active role within an authenticated session (no new OTP).
//          Works from an admin token or a member token. Identity is re-resolved
//          from the DB (not trusted from the JWT payload) and the target role
//          must exist, be active, and belong to the same phone number.
// @access  Private (admin or member token)
router.post('/switch-role', [
  body('targetRole').isIn(['state_admin', 'district_admin', 'group_admin', 'member'])
    .withMessage('Invalid target role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }

    // Resolve current identity from DB — never trust JWT payload alone
    let phone;
    if (decoded.userType === 'member') {
      const memberAuth = await MemberAuth.findById(decoded.id).populate('member', 'phone status isApproved');
      if (!memberAuth || !memberAuth.isActive || !memberAuth.member ||
          memberAuth.member.status !== 'Active' || !memberAuth.member.isApproved) {
        return res.status(401).json({
          success: false,
          message: 'Current session identity is no longer valid.'
        });
      }
      phone = memberAuth.phone || memberAuth.member.phone;
    } else {
      const currentUser = await User.findById(decoded.id).select('phone isActive');
      if (!currentUser || !currentUser.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Current session identity is no longer valid.'
        });
      }
      phone = currentUser.phone;
    }

    const { targetRole } = req.body;
    const phoneVariants = otpService.getPhoneVariants(phone);

    if (targetRole === 'member') {
      const member = await Member.findOne({
        phone: { $in: phoneVariants },
        status: 'Active',
        isApproved: true
      })
        .populate('district', 'name')
        .populate('group', 'name');

      if (!member) {
        return res.status(403).json({
          success: false,
          message: 'You do not have an active member account.'
        });
      }

      let memberAuth = await MemberAuth.findOne({ member: member._id });
      if (!memberAuth) {
        memberAuth = await MemberAuth.createForMember(member._id);
      }
      if (!memberAuth.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Member account is inactive.'
        });
      }

      memberAuth.lastLogin = new Date();
      await memberAuth.save({ validateModifiedOnly: true });

      const newToken = jwt.sign(
        {
          id: memberAuth._id,
          memberId: member._id,
          phone: memberAuth.phone,
          userType: 'member'
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '365d' }
      );

      return res.status(200).json({
        success: true,
        message: 'Switched to member',
        data: {
          token: newToken,
          userType: 'member',
          member: {
            id: member._id,
            name: member.name,
            phone: member.phone,
            email: member.email,
            district: member.district,
            group: member.group,
            status: member.status,
            joinedDate: member.joinedDate
          }
        }
      });
    }

    // Admin target role. (phone, role) can match several rows for group_admin
    // (area/murabi/coordinator) — this legacy role-name endpoint cannot express
    // which, so sort to deterministically pick 'area'. Kind-specific switching
    // goes through /switch-account (account-id based).
    const targetUser = await User.findOne({
      phone: { $in: phoneVariants },
      role: targetRole,
      isActive: true
    })
      .sort({ adminKind: 1 })
      .populate('district', 'name code')
      .populate('group', 'name code district');

    if (!targetUser) {
      return res.status(403).json({
        success: false,
        message: `You do not have an active ${targetRole.replace('_', ' ')} role.`
      });
    }

    targetUser.lastLogin = new Date();
    await targetUser.save({ validateModifiedOnly: true });

    const newToken = jwt.sign(
      {
        id: targetUser._id,
        phone: targetUser.phone,
        role: targetUser.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '365d' }
    );

    return res.status(200).json({
      success: true,
      message: `Switched to ${targetRole.replace('_', ' ')}`,
      data: {
        token: newToken,
        userType: targetRole,
        user: {
          id: targetUser._id,
          name: targetUser.name,
          phone: targetUser.phone,
          email: targetUser.email,
          role: targetUser.role,
          adminKind: targetUser.role === 'group_admin' ? (targetUser.adminKind || 'area') : null,
          label: loginService.accountLabel(targetUser.role, targetUser.adminKind),
          district: targetUser.district,
          group: targetUser.group,
          roleTag: targetUser.roleTag,
          permissions: targetUser.permissions,
          lastLogin: targetUser.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Switch role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to switch role'
    });
  }
});

// ---------------------------------------------------------------------------
// Phone-first sign-in: one code per number, then pick which account to enter.
// Replaces the legacy "choose a role, then request a code for it" flow above.
// ---------------------------------------------------------------------------

const phoneBody = body('phone')
  .custom((value) => loginService.isValidPhone(value))
  .withMessage('Enter a valid 10-digit mobile number');

// @route   POST /api/auth/login/send-otp
// @desc    Send one WhatsApp code covering every account on this number
// @access  Public
router.post('/login/send-otp', [phoneBody, body('resend').optional().isBoolean()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  try {
    const result = await loginService.sendLoginOtp(req.body.phone, { isResend: Boolean(req.body.resend) });

    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
        retryAfter: result.retryAfter,
        // The gateway's own words ("Device session offline", bad secret, ...) are the
        // only thing that makes a delivery failure diagnosable. Kept out of production
        // responses so provider internals aren't exposed to end users.
        ...(process.env.NODE_ENV !== 'production' && result.error
          ? { providerError: result.error }
          : {}),
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        expiresAt: result.expiresAt,
        accountsCount: result.accountsCount,
        isTestPhone: result.isTestPhone,
      },
    });
  } catch (error) {
    console.error('Login send-otp error:', error);
    res.status(500).json({ success: false, message: 'Failed to send verification code' });
  }
});

// @route   POST /api/auth/login/verify-otp
// @desc    Verify the code; returns every account on the number + a selection ticket
// @access  Public
router.post('/login/verify-otp', [
  phoneBody,
  body('otp').isLength({ min: OTP_DIGITS, max: OTP_DIGITS }).isNumeric()
    .withMessage(`Code must be ${OTP_DIGITS} digits`),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  try {
    const result = await loginService.verifyLoginOtp(req.body.phone, req.body.otp);

    if (!result.success) {
      return res.status(result.status || 400).json({
        success: false,
        message: result.message,
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: { accounts: result.accounts, ticket: result.ticket },
    });
  } catch (error) {
    console.error('Login verify-otp error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify code' });
  }
});

// @route   POST /api/auth/login/select-account
// @desc    Exchange a verification ticket for a session on one chosen account
// @access  Public (ticket-gated)
router.post('/login/select-account', [
  body('ticket').notEmpty().withMessage('Verification ticket is required'),
  body('accountId').isMongoId().withMessage('Invalid account'),
  body('accountType').isIn(['admin', 'member']).withMessage('Invalid account type'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  let phone;
  try {
    phone = loginService.readTicket(req.body.ticket);
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Your verification expired. Please sign in again.',
    });
  }

  try {
    const result = await loginService.selectAccount(phone, req.body.accountId, req.body.accountType);

    if (!result.success) {
      return res.status(result.status || 403).json({ success: false, message: result.message });
    }

    res.status(200).json({
      success: true,
      message: 'Signed in successfully',
      data: {
        token: result.token,
        userType: result.userType,
        ...(result.user ? { user: result.user } : {}),
        ...(result.member ? { member: result.member } : {}),
      },
    });
  } catch (error) {
    console.error('Login select-account error:', error);
    res.status(500).json({ success: false, message: 'Failed to sign in' });
  }
});

/** Resolve the phone behind a raw session token, straight from the DB. */
async function phoneFromToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.userType === 'member') {
    const memberAuth = await MemberAuth.findById(decoded.id).populate('member', 'phone');
    if (!memberAuth || !memberAuth.isActive) return null;
    return memberAuth.phone || memberAuth.member?.phone || null;
  }

  const user = await User.findById(decoded.id).select('phone isActive');
  if (!user || !user.isActive) return null;
  return user.phone;
}

// @route   GET /api/auth/accounts
// @desc    Every account on the signed-in user's number, for the in-app switcher
// @access  Private (admin or member token)
router.get('/accounts', async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const phone = await phoneFromToken(token);
    if (!phone) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid.' });
    }

    const accounts = await loginService.listAccounts(phone);
    res.status(200).json({ success: true, data: { accounts } });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
    console.error('List accounts error:', error);
    res.status(500).json({ success: false, message: 'Failed to load accounts' });
  }
});

// @route   POST /api/auth/switch-account
// @desc    Switch to another account on the same number, no new OTP. Account-id based,
//          so a phone holding two area-level admin accounts (e.g. Area + Murabi) can
//          switch between them — which role-name-based /switch-role cannot express.
// @access  Private (admin or member token)
router.post('/switch-account', [
  body('accountId').isMongoId().withMessage('Invalid account'),
  body('accountType').isIn(['admin', 'member']).withMessage('Invalid account type'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const phone = await phoneFromToken(token);
    if (!phone) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid.' });
    }

    const result = await loginService.selectAccount(phone, req.body.accountId, req.body.accountType);
    if (!result.success) {
      return res.status(result.status || 403).json({ success: false, message: result.message });
    }

    res.status(200).json({
      success: true,
      message: 'Switched account',
      data: {
        token: result.token,
        userType: result.userType,
        ...(result.user ? { user: result.user } : {}),
        ...(result.member ? { member: result.member } : {}),
      },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
    console.error('Switch account error:', error);
    res.status(500).json({ success: false, message: 'Failed to switch account' });
  }
});

export default router;