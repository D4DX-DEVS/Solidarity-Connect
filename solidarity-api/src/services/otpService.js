import User from '../models/User.js';
import Member from '../models/Member.js';
import dxingService from './dxingService.js';

class OTPService {
  // Generate 4-digit OTP
  generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  // Get all available roles for a phone number
  async getAvailableRoles(phone) {
    const roles = [];

    // Normalize phone to check both formats (with and without +91)
    const phoneWithPrefix = phone.startsWith('+91') ? phone : `+91${phone}`;
    const phoneWithoutPrefix = phone.startsWith('+91') ? phone.slice(3) : phone;

    // Check User collection for admin roles (stored without +91)
    const users = await User.find({
      phone: { $in: [phone, phoneWithPrefix, phoneWithoutPrefix] },
      isActive: true
    }).select('role').lean();
    for (const u of users) {
      roles.push(u.role);
    }

    // Check Member collection (stored with +91)
    const member = await Member.findOne({
      phone: { $in: [phone, phoneWithPrefix, phoneWithoutPrefix] },
      status: 'Active',
      isApproved: true
    }).lean();
    if (member) {
      roles.push('member');
    }

    return roles;
  }

  // Build all stored phone variants (admins stored as 10-digit, others may have +91)
  getPhoneVariants(phone) {
    const phoneWithPrefix = phone.startsWith('+91') ? phone : `+91${phone}`;
    const phoneWithoutPrefix = phone.startsWith('+91') ? phone.slice(3) : phone;
    return [...new Set([phone, phoneWithPrefix, phoneWithoutPrefix])];
  }

  // Send OTP to user
  async sendOTP(phone, userType) {
    try {
      // Check if user exists with this phone and role (match all stored phone formats)
      let user = await User.findOne({ phone: { $in: this.getPhoneVariants(phone) }, role: userType });
      
      if (!user) {
        // Check what roles this phone actually has
        const availableRoles = await this.getAvailableRoles(phone);

        return {
          success: false,
          message: `No ${userType.replace('_', ' ')} found with this phone number. Please contact administrator.`,
          availableRoles: availableRoles.length > 0 ? availableRoles : undefined
        };
      }

      // Generate OTP
      const otp = this.generateOTP();
      const expiryTime = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10) * 60 * 1000);

      console.log('\n🎯 ================================');
      console.log('🔐 OTP GENERATED FOR TESTING');
      console.log('================================');
      console.log(`📱 Phone: ${phone}`);
      console.log(`🔢 OTP: ${otp}`);
      console.log(`👤 User Type: ${userType}`);
      console.log(`⏰ Expires: ${expiryTime.toLocaleString()}`);
      console.log('================================');
      console.log('💡 Use this OTP in your app!');
      console.log('================================\n');

      // Save OTP to user (will be hashed by pre-save middleware)
      user.otp = {
        code: otp,
        expiresAt: expiryTime,
        attempts: 0
      };

      await user.save({ validateModifiedOnly: true });

      // Send OTP via WhatsApp
      const result = await dxingService.sendOTP(phone, otp);

      if (result.success) {
        return {
          success: true,
          message: 'OTP sent successfully via WhatsApp',
          expiresAt: expiryTime
        };
      } else {
        // If WhatsApp fails, log the error and continue in development mode
        console.warn('⚠️  WhatsApp OTP failed:', result.error);
        console.log('📱 OTP for development:', otp);
        console.log('📞 Phone:', phone);
        
        return {
          success: true,
          message: 'OTP generated (WhatsApp delivery failed - check console for OTP)',
          expiresAt: expiryTime,
          demoOTP: process.env.NODE_ENV === 'development' ? otp : undefined,
          deliveryStatus: 'failed',
          deliveryError: result.error
        };
      }

    } catch (error) {
      console.error('Send OTP error:', error);
      throw new Error('Failed to send OTP');
    }
  }

  // Verify OTP
  async verifyOTP(phone, otp, userType) {
    try {
      const user = await User.findOne({ phone: { $in: this.getPhoneVariants(phone) }, role: userType })
        .populate('district', 'name code')
        .populate('group', 'name code district');

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Check if OTP exists
      if (!user.otp.code) {
        return {
          success: false,
          message: 'No OTP found. Please request a new OTP.'
        };
      }

      // Check if OTP is expired
      if (user.isOTPExpired()) {
        user.clearOTP();
        await user.save({ validateModifiedOnly: true });
        return {
          success: false,
          message: 'OTP has expired. Please request a new OTP.'
        };
      }

      // Check attempt limit
      if (user.otp.attempts >= 3) {
        user.clearOTP();
        await user.save({ validateModifiedOnly: true });
        return {
          success: false,
          message: 'Too many failed attempts. Please request a new OTP.'
        };
      }

      // Verify OTP (allow any 4-digit OTP in development)
      let isValidOTP = false;
      
      if (process.env.NODE_ENV === 'development') {
        // In development, accept any 4-digit OTP
        isValidOTP = /^\d{4}$/.test(otp);
      } else {
        // In production, verify against stored OTP
        isValidOTP = await user.compareOTP(otp);
      }
      
      if (!isValidOTP) {
        user.otp.attempts += 1;
        await user.save({ validateModifiedOnly: true });
        
        return {
          success: false,
          message: `Invalid OTP. ${3 - user.otp.attempts} attempts remaining.`
        };
      }

      // OTP is valid - clear it and update last login
      user.clearOTP();
      user.lastLogin = new Date();
      await user.save({ validateModifiedOnly: true });

      return {
        success: true,
        message: 'OTP verified successfully',
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          district: user.district,
          group: user.group,
          permissions: user.permissions,
          lastLogin: user.lastLogin
        }
      };

    } catch (error) {
      console.error('Verify OTP error:', error);
      throw new Error('Failed to verify OTP');
    }
  }

  // Resend OTP
  async resendOTP(phone, userType) {
    try {
      const user = await User.findOne({ phone: { $in: this.getPhoneVariants(phone) }, role: userType });
      
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Clear existing OTP
      user.clearOTP();
      await user.save({ validateModifiedOnly: true });

      // Send new OTP
      return await this.sendOTP(phone, userType);

    } catch (error) {
      console.error('Resend OTP error:', error);
      throw new Error('Failed to resend OTP');
    }
  }

  // Clean up expired OTPs (can be run as a cron job)
  async cleanupExpiredOTPs() {
    try {
      const result = await User.updateMany(
        {
          'otp.expiresAt': { $lt: new Date() },
          'otp.code': { $exists: true }
        },
        {
          $unset: {
            'otp.code': '',
            'otp.expiresAt': '',
            'otp.attempts': ''
          }
        }
      );

      console.log(`Cleaned up ${result.modifiedCount} expired OTPs`);
      return result.modifiedCount;

    } catch (error) {
      console.error('Cleanup expired OTPs error:', error);
      throw new Error('Failed to cleanup expired OTPs');
    }
  }

  // Get OTP status for a user
  async getOTPStatus(phone, userType) {
    try {
      const user = await User.findOne({ phone, role: userType });
      
      if (!user || !user.otp.code) {
        return {
          hasOTP: false,
          message: 'No active OTP found'
        };
      }

      const isExpired = user.isOTPExpired();
      const attemptsLeft = Math.max(0, 3 - user.otp.attempts);

      return {
        hasOTP: true,
        isExpired,
        expiresAt: user.otp.expiresAt,
        attemptsLeft,
        message: isExpired ? 'OTP has expired' : `OTP is active. ${attemptsLeft} attempts remaining.`
      };

    } catch (error) {
      console.error('Get OTP status error:', error);
      throw new Error('Failed to get OTP status');
    }
  }
}

export default new OTPService();