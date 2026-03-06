import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import mongoosePaginate from 'mongoose-paginate-v2';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^(\+91)?[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        // Only validate if email is provided (not empty)
        return !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email'
    }
  },
  role: {
    type: String,
    enum: ['state_admin', 'district_admin', 'group_admin'],
    required: [true, 'User role is required']
  },
  district: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'District',
    required: function() {
      return this.role === 'district_admin';
    }
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: function() {
      return this.role === 'group_admin';
    }
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
  permissions: [{
    type: String,
    enum: [
      'manage_users',
      'manage_members',
      'manage_districts',
      'manage_groups',
      'approve_transfers',
      'send_notifications',
      'view_reports',
      'bulk_import',
      'manage_meetings',
      'manage_baithul_maal'
    ]
  }],
  isLeader: {
    type: Boolean,
    default: false,
    index: true
  },
  roleTag: {
    type: {
      type: String,
      enum: ['state', 'district', 'area', 'unit', 'murabi', 'coordinator'],
    },
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Role tag name cannot exceed 100 characters']
    },
    areaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group'
    },
    roleDescription: {
      type: String,
      trim: true,
      maxlength: [100, 'Role description cannot exceed 100 characters']
    }
  }
}, {
  timestamps: true
});

// Index for better query performance - compound index for phone + role
userSchema.index({ phone: 1, role: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ district: 1 });
userSchema.index({ group: 1 });

// Hash OTP before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('otp.code') || !this.otp.code) {
    return next();
  }
  
  this.otp.code = await bcrypt.hash(this.otp.code, 10);
  next();
});

// Method to compare OTP
userSchema.methods.compareOTP = async function(candidateOTP) {
  if (!this.otp.code) return false;
  return await bcrypt.compare(candidateOTP, this.otp.code);
};

// Method to check if OTP is expired
userSchema.methods.isOTPExpired = function() {
  return !this.otp.expiresAt || this.otp.expiresAt < new Date();
};

// Method to clear OTP
userSchema.methods.clearOTP = function() {
  this.otp = {
    code: undefined,
    expiresAt: undefined,
    attempts: 0
  };
};

// Set default permissions based on role
userSchema.pre('save', function(next) {
  if (!this.isModified('role')) {
    return next();
  }

  switch (this.role) {
    case 'state_admin':
      this.permissions = [
        'manage_users',
        'manage_members',
        'manage_districts',
        'manage_groups',
        'approve_transfers',
        'send_notifications',
        'view_reports',
        'bulk_import',
        'manage_meetings',
        'manage_baithul_maal'
      ];
      break;
    case 'district_admin':
      this.permissions = [
        'manage_members',
        'manage_groups',
        'approve_transfers',
        'send_notifications',
        'view_reports',
        'bulk_import',
        'manage_meetings',
        'manage_baithul_maal'
      ];
      break;
    case 'group_admin':
      this.permissions = [
        'manage_members',
        'view_reports',
        'bulk_import',
        'manage_baithul_maal'
      ];
      break;
  }
  next();
});

// Add pagination plugin
userSchema.plugin(mongoosePaginate);

export default mongoose.model('User', userSchema);