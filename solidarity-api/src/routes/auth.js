import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import otpService from '../services/otpService.js';
import { loginValidation, verifyOTPValidation } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';

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
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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

export default router;