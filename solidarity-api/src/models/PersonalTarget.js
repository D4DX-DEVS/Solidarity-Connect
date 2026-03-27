import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const personalTargetSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Target title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Target description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    enum: ['quran', 'hadith', 'prayer', 'charity', 'knowledge', 'community', 'other'],
    default: 'other'
  },
  targetType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'monthly'
  },
  targetValue: {
    type: Number,
    required: [true, 'Target value is required'],
    min: [1, 'Target value must be at least 1']
  },
  unit: {
    type: String,
    required: [true, 'Target unit is required'],
    trim: true,
    maxlength: [50, 'Unit cannot exceed 50 characters']
  },
  month: {
    type: Number,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    min: 2020,
    max: 2050
  },
  targetAudience: {
    type: String,
    enum: ['all_users', 'members_only', 'group_admins', 'area_admins', 'group_and_area_admins', 'district_admins', 'state_admins'],
    default: 'all_users'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed'],
    default: 'active'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: [2000, 'Instructions cannot exceed 2000 characters']
  },
  rewards: {
    type: String,
    trim: true,
    maxlength: [500, 'Rewards cannot exceed 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Recurring target support
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringFrequency: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly'],
    required: function() { return this.isRecurring; }
  },
  recurringEndDate: {
    type: Date
  },
  parentTargetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalTarget'
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  attendanceNeeded: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
personalTargetSchema.index({ month: 1, year: 1 });
personalTargetSchema.index({ status: 1 });
personalTargetSchema.index({ category: 1 });
personalTargetSchema.index({ targetAudience: 1 });
personalTargetSchema.index({ createdBy: 1 });
personalTargetSchema.index({ startDate: 1, endDate: 1 });
personalTargetSchema.index({ parentTargetId: 1 });
personalTargetSchema.index({ isTemplate: 1 });

// Virtual for target period
personalTargetSchema.virtual('targetPeriod').get(function() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[this.month - 1]} ${this.year}`;
});

// Method to check if target is active
personalTargetSchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'active' && 
         this.startDate <= now && 
         this.endDate >= now;
};

// Method to check if target is expired
personalTargetSchema.methods.isExpired = function() {
  return new Date() > this.endDate;
};

// Static method to get active targets for a specific month/year
personalTargetSchema.statics.getActiveTargets = function(month, year, filter = {}) {
  return this.find({
    ...filter,
    month,
    year,
    status: 'active'
  }).populate('createdBy', 'name role');
};

// Static method to get targets by audience
personalTargetSchema.statics.getTargetsByAudience = function(audience) {
  return this.find({ status: 'active', targetAudience: audience })
    .populate('createdBy', 'name role');
};

// Add pagination plugin
personalTargetSchema.plugin(mongoosePaginate);

export default mongoose.model('PersonalTarget', personalTargetSchema);