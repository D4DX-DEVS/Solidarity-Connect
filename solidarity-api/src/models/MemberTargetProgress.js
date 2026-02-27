import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const memberTargetProgressSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  personalTarget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalTarget',
    required: true
  },
  currentProgress: {
    type: Number,
    default: 0,
    min: [0, 'Progress cannot be negative']
  },
  targetValue: {
    type: Number,
    required: true
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'overdue'],
    default: 'not_started'
  },
  completedAt: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: [1000, 'Feedback cannot exceed 1000 characters']
  },
  fileAttachment: {
    url: String,
    originalName: String,
    mimetype: String,
    size: Number,
    key: String
  },
  dailyProgress: [{
    date: {
      type: Date,
      required: true
    },
    value: {
      type: Number,
      required: true,
      min: 0
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Daily notes cannot exceed 500 characters']
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure one progress record per member per target
memberTargetProgressSchema.index({ member: 1, personalTarget: 1 }, { unique: true });
memberTargetProgressSchema.index({ status: 1 });
memberTargetProgressSchema.index({ progressPercentage: 1 });
memberTargetProgressSchema.index({ completedAt: 1 });

// Pre-save middleware to calculate progress percentage
memberTargetProgressSchema.pre('save', function(next) {
  if (this.targetValue > 0) {
    this.progressPercentage = Math.min(100, (this.currentProgress / this.targetValue) * 100);
  }
  
  // Update status based on progress
  if (this.progressPercentage >= 100) {
    this.status = 'completed';
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
  } else if (this.currentProgress > 0) {
    this.status = 'in_progress';
  }
  
  this.lastUpdated = new Date();
  next();
});

// Method to add daily progress
memberTargetProgressSchema.methods.addDailyProgress = function(value, notes = '') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if progress for today already exists
  const existingProgress = this.dailyProgress.find(p => {
    const progressDate = new Date(p.date);
    progressDate.setHours(0, 0, 0, 0);
    return progressDate.getTime() === today.getTime();
  });
  
  if (existingProgress) {
    // Update existing progress
    existingProgress.value = value;
    existingProgress.notes = notes;
  } else {
    // Add new daily progress
    this.dailyProgress.push({
      date: today,
      value,
      notes
    });
  }
  
  // Recalculate total progress
  this.currentProgress = this.dailyProgress.reduce((total, daily) => total + daily.value, 0);
  
  return this.save();
};

// Method to get progress for a specific date
memberTargetProgressSchema.methods.getProgressForDate = function(date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  return this.dailyProgress.find(p => {
    const progressDate = new Date(p.date);
    progressDate.setHours(0, 0, 0, 0);
    return progressDate.getTime() === targetDate.getTime();
  });
};

// Method to get weekly progress summary
memberTargetProgressSchema.methods.getWeeklyProgress = function() {
  const now = new Date();
  const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  const weeklyProgress = this.dailyProgress.filter(p => {
    const progressDate = new Date(p.date);
    return progressDate >= weekStart && progressDate <= weekEnd;
  });
  
  const totalWeeklyValue = weeklyProgress.reduce((total, daily) => total + daily.value, 0);
  
  return {
    weekStart,
    weekEnd,
    dailyEntries: weeklyProgress.length,
    totalValue: totalWeeklyValue,
    averageDaily: weeklyProgress.length > 0 ? totalWeeklyValue / weeklyProgress.length : 0
  };
};

// Static method to get member progress for multiple targets
memberTargetProgressSchema.statics.getMemberProgress = function(memberId, targetIds = []) {
  let query = { member: memberId };
  
  if (targetIds.length > 0) {
    query.personalTarget = { $in: targetIds };
  }
  
  return this.find(query)
    .populate('personalTarget', 'title description category targetValue unit month year')
    .populate('member', 'name phone');
};

// Static method to get target completion statistics
memberTargetProgressSchema.statics.getTargetStats = function(targetId) {
  return this.aggregate([
    { $match: { personalTarget: new mongoose.Types.ObjectId(targetId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProgress: { $avg: '$progressPercentage' }
      }
    }
  ]);
};

// Static method to get leaderboard for a target
memberTargetProgressSchema.statics.getLeaderboard = function(targetId, limit = 10) {
  return this.find({ personalTarget: targetId })
    .populate('member', 'name phone group district')
    .sort({ progressPercentage: -1, currentProgress: -1 })
    .limit(limit);
};

// Add pagination plugin
memberTargetProgressSchema.plugin(mongoosePaginate);

export default mongoose.model('MemberTargetProgress', memberTargetProgressSchema);