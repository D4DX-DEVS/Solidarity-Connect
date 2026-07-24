import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^(\+91)?[6-9]\d{9}$/, 'Please enter a valid 10-digit phone number']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  dateOfBirth: {
    type: Date
  },
  age: {
    type: Number,
    min: [0, 'Age cannot be negative'],
    max: [120, 'Age cannot exceed 120']
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  avatar: {
    type: String,
    trim: true
  },
  profession: {
    type: String,
    trim: true,
    maxlength: [100, 'Profession cannot exceed 100 characters']
  },
  education: {
    type: String,
    trim: true,
    maxlength: [100, 'Education cannot exceed 100 characters']
  },
  areaOfInterest: {
    type: String,
    trim: true,
    maxlength: [200, 'Area of interest cannot exceed 200 characters']
  },
  skills: {
    type: String,
    trim: true,
    maxlength: [200, 'Skills cannot exceed 200 characters']
  },
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  district: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'District',
    required: [true, 'District is required']
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Group is required']
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Abroad', 'Applicant', 'Age over', 'Dismissed'],
    default: 'Inactive'
  },
  joinedDate: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  baithulMaal: {
    monthlyAmount: {
      type: Number,
      default: 0,
      min: [0, 'Baithul Maal amount cannot be negative']
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: [0, 'Total paid cannot be negative']
    },
    lastPaymentDate: Date,
    startDate: Date // when contribution began; pending is counted from here, not joinedDate
  },
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
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
    name: String,
    roleDescription: String,
    // Listing order used to sort leaders in member-facing dashboards.
    // Lower values appear first; leaders without a value are pushed to the end.
    listingOrder: {
      type: Number,
      min: [0, 'Listing order cannot be negative'],
      default: null
    }
  },
  // Additional leader roles beyond the primary roleTag (multi-role support).
  extraRoleTags: [{
    type: {
      type: String,
      enum: ['state', 'district', 'area', 'unit', 'murabi', 'coordinator'],
    },
    name: String,
    listingOrder: {
      type: Number,
      min: [0, 'Listing order cannot be negative'],
      default: null
    }
  }],
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
memberSchema.index({ phone: 1 });
memberSchema.index({ district: 1 });
memberSchema.index({ group: 1 });
memberSchema.index({ status: 1 });
memberSchema.index({ isApproved: 1 });
memberSchema.index({ name: 'text', email: 'text' });
memberSchema.index({ createdAt: -1 });

// Compound indexes for common query patterns
memberSchema.index({ district: 1, status: 1 });
memberSchema.index({ group: 1, status: 1 });
memberSchema.index({ status: 1, isApproved: 1 });
memberSchema.index({ district: 1, group: 1, status: 1 }); // For role-based filtering

// Calculate age from date of birth
memberSchema.pre('save', function(next) {
  if (this.dateOfBirth && this.isModified('dateOfBirth')) {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    this.age = age;
  }

  // Stamp contribution start when monthly amount first set
  if (this.baithulMaal?.monthlyAmount > 0 && !this.baithulMaal.startDate) {
    this.baithulMaal.startDate = new Date();
  }

  next();
});

// Virtual for full name with title
memberSchema.virtual('displayName').get(function() {
  return this.name;
});

// Method to check if member is active
memberSchema.methods.isActiveMember = function() {
  return this.status === 'Active' && this.isApproved;
};

// Method to calculate total baithul maal contribution
memberSchema.methods.calculateTotalContribution = function() {
  const monthsActive = this.joinedDate ? 
    Math.floor((Date.now() - this.joinedDate.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
  return monthsActive * (this.baithulMaal.monthlyAmount || 0);
};

// Static method to get members by district
memberSchema.statics.findByDistrict = function(districtId) {
  return this.find({ district: districtId }).populate('district group');
};

// Static method to get members by group
memberSchema.statics.findByGroup = function(groupId) {
  return this.find({ group: groupId }).populate('district group');
};

// Static method to get active members count
memberSchema.statics.getActiveCount = function(filter = {}) {
  return this.countDocuments({ ...filter, status: 'Active', isApproved: true });
};

// Add pagination plugin
memberSchema.plugin(mongoosePaginate);

export default mongoose.model('Member', memberSchema);