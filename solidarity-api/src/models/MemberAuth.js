import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const memberAuthSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: [/^\+91[6-9]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  otp: {
    code: String,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    }
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  deviceInfo: [{
    deviceId: String,
    deviceName: String,
    lastUsed: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  }]
}, {
  timestamps: true
});

// Index for better query performance
memberAuthSchema.index({ phone: 1 });
memberAuthSchema.index({ member: 1 });

// Virtual for checking if account is locked
memberAuthSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash OTP before saving
memberAuthSchema.pre('save', async function(next) {
  if (!this.isModified('otp.code') || !this.otp.code) {
    return next();
  }
  
  this.otp.code = await bcrypt.hash(this.otp.code, 10);
  next();
});

// Method to compare OTP
memberAuthSchema.methods.compareOTP = async function(candidateOTP) {
  if (!this.otp.code) return false;
  return await bcrypt.compare(candidateOTP, this.otp.code);
};

// Method to check if OTP is expired
memberAuthSchema.methods.isOTPExpired = function() {
  return !this.otp.expiresAt || this.otp.expiresAt < new Date();
};

// Method to clear OTP
memberAuthSchema.methods.clearOTP = function() {
  this.otp = {
    code: undefined,
    expiresAt: undefined,
    attempts: 0
  };
};

// Method to increment login attempts
memberAuthSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
memberAuthSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to add device info
memberAuthSchema.methods.addDevice = function(deviceId, deviceName) {
  const existingDevice = this.deviceInfo.find(d => d.deviceId === deviceId);
  
  if (existingDevice) {
    existingDevice.lastUsed = new Date();
    existingDevice.isActive = true;
  } else {
    this.deviceInfo.push({
      deviceId,
      deviceName,
      lastUsed: new Date(),
      isActive: true
    });
  }
  
  return this.save();
};

// Static method to find by phone
memberAuthSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone }).populate('member');
};

// Static method to create member auth record
memberAuthSchema.statics.createForMember = async function(memberId) {
  const Member = mongoose.model('Member');
  const member = await Member.findById(memberId);
  
  if (!member) {
    throw new Error('Member not found');
  }
  
  // Check if auth record already exists
  const existingAuth = await this.findOne({ member: memberId });
  if (existingAuth) {
    return existingAuth;
  }
  
  const memberAuth = new this({
    member: memberId,
    phone: member.phone,
    isActive: member.status === 'Active' && member.isApproved
  });
  
  return await memberAuth.save();
};

export default mongoose.model('MemberAuth', memberAuthSchema);