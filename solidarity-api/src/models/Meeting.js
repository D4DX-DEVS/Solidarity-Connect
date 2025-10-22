import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Meeting title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  agenda: [{
    item: {
      type: String,
      required: true,
      trim: true
    },
    duration: Number, // in minutes
    presenter: String,
    notes: String
  }],
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required']
  },
  duration: {
    type: Number, // in minutes
    default: 60
  },
  venue: {
    type: String,
    trim: true,
    maxlength: [200, 'Venue cannot exceed 200 characters']
  },
  meetingType: {
    type: String,
    enum: ['general', 'emergency', 'monthly', 'annual', 'special', 'monthly_series'],
    default: 'general'
  },
  // For monthly series meetings
  monthlyDetails: {
    month: {
      type: Number, // 1-12
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      min: 2020,
      max: 2050
    },
    synopsis: {
      type: String,
      trim: true,
      maxlength: [2000, 'Synopsis cannot exceed 2000 characters']
    },
    totalSessions: {
      type: Number,
      min: 0,
      max: 31,
      default: 0
    }
  },
  targetAudience: {
    type: String,
    enum: ['all', 'state_admins', 'district_admins', 'group_admins', 'specific_groups'],
    default: 'all'
  },
  targetGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  targetDistricts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'District'
  }],
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed'],
    default: 'scheduled'
  },
  attendance: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member'
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      default: 'absent'
    },
    joinedAt: Date,
    leftAt: Date
  }],
  guestAttendance: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      default: 'present'
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  minutes: {
    summary: String,
    decisions: [String],
    actionItems: [{
      task: String,
      assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      dueDate: Date,
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed'],
        default: 'pending'
      }
    }],
    attachments: [String]
  },
  notifications: {
    sent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    reminderSent: {
      type: Boolean,
      default: false
    },
    reminderSentAt: Date
  },
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

// Indexes
meetingSchema.index({ scheduledDate: 1 });
meetingSchema.index({ status: 1 });
meetingSchema.index({ meetingType: 1 });
meetingSchema.index({ targetAudience: 1 });
meetingSchema.index({ createdBy: 1 });

// Virtual for meeting duration in hours
meetingSchema.virtual('durationHours').get(function() {
  return this.duration ? (this.duration / 60).toFixed(1) : 0;
});

// Method to check if meeting is upcoming
meetingSchema.methods.isUpcoming = function() {
  return this.scheduledDate > new Date() && this.status === 'scheduled';
};

// Method to check if meeting is today
meetingSchema.methods.isToday = function() {
  const today = new Date();
  const meetingDate = new Date(this.scheduledDate);
  return today.toDateString() === meetingDate.toDateString();
};

// Method to mark attendance
meetingSchema.methods.markAttendance = function(userId, memberId, status = 'present') {
  const existingAttendance = this.attendance.find(a => 
    (userId && a.user?.toString() === userId.toString()) ||
    (memberId && a.member?.toString() === memberId.toString())
  );

  if (existingAttendance) {
    existingAttendance.status = status;
    if (status === 'present' && !existingAttendance.joinedAt) {
      existingAttendance.joinedAt = new Date();
    }
  } else {
    this.attendance.push({
      user: userId,
      member: memberId,
      status,
      joinedAt: status === 'present' ? new Date() : undefined
    });
  }

  return this.save();
};

// Method to get attendance statistics
meetingSchema.methods.getAttendanceStats = function() {
  const total = this.attendance.length;
  const present = this.attendance.filter(a => a.status === 'present').length;
  const absent = this.attendance.filter(a => a.status === 'absent').length;
  const late = this.attendance.filter(a => a.status === 'late').length;

  return {
    total,
    present,
    absent,
    late,
    attendanceRate: total > 0 ? ((present + late) / total * 100).toFixed(1) : 0
  };
};

// Static method to get upcoming meetings
meetingSchema.statics.getUpcoming = function(filter = {}) {
  return this.find({
    ...filter,
    scheduledDate: { $gte: new Date() },
    status: 'scheduled'
  }).sort({ scheduledDate: 1 });
};

// Static method to get meetings by date range
meetingSchema.statics.getByDateRange = function(startDate, endDate, filter = {}) {
  return this.find({
    ...filter,
    scheduledDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ scheduledDate: 1 });
};

// Add pagination plugin
meetingSchema.plugin(mongoosePaginate);

export default mongoose.model('Meeting', meetingSchema);