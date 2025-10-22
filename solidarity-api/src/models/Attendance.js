import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const attendanceSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  district: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'District',
    required: true
  },
  // Meeting details for easy querying
  meetingMonth: {
    type: Number, // 1-12
    required: true
  },
  meetingYear: {
    type: Number,
    required: true
  },
  meetingDate: {
    type: Date,
    required: true
  },
  // Attendance status
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    default: 'absent'
  },
  // Who marked the attendance
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  // Additional notes
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  // Guest attendance (for non-members)
  isGuest: {
    type: Boolean,
    default: false
  },
  guestName: {
    type: String,
    trim: true
  },
  guestPhone: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
attendanceSchema.index({ meeting: 1, member: 1 }, { unique: true }); // One attendance record per member per meeting
attendanceSchema.index({ group: 1, meetingMonth: 1, meetingYear: 1 });
attendanceSchema.index({ member: 1, meetingYear: 1, meetingMonth: 1 });
attendanceSchema.index({ meetingDate: 1 });
attendanceSchema.index({ status: 1 });
attendanceSchema.index({ markedBy: 1 });

// Virtual for meeting month-year string
attendanceSchema.virtual('meetingPeriod').get(function() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[this.meetingMonth - 1]} ${this.meetingYear}`;
});

// Static method to get attendance statistics for a meeting
attendanceSchema.statics.getMeetingStats = async function(meetingId) {
  const stats = await this.aggregate([
    { $match: { meeting: new mongoose.Types.ObjectId(meetingId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const result = {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  result.attendanceRate = result.total > 0 ? 
    ((result.present + result.late) / result.total * 100).toFixed(1) : 0;

  return result;
};

// Static method to get member attendance history
attendanceSchema.statics.getMemberHistory = async function(memberId, year = null, limit = 12) {
  const filter = { member: new mongoose.Types.ObjectId(memberId) };
  if (year) {
    filter.meetingYear = year;
  }

  return this.find(filter)
    .populate('meeting', 'title scheduledDate meetingType')
    .populate('markedBy', 'name role')
    .sort({ meetingDate: -1 })
    .limit(limit);
};

// Static method to get group attendance summary
attendanceSchema.statics.getGroupSummary = async function(groupId, month, year) {
  return this.aggregate([
    {
      $match: {
        group: new mongoose.Types.ObjectId(groupId),
        meetingMonth: month,
        meetingYear: year
      }
    },
    {
      $lookup: {
        from: 'members',
        localField: 'member',
        foreignField: '_id',
        as: 'memberInfo'
      }
    },
    {
      $unwind: '$memberInfo'
    },
    {
      $group: {
        _id: '$member',
        memberName: { $first: '$memberInfo.name' },
        memberPhone: { $first: '$memberInfo.phone' },
        totalMeetings: { $sum: 1 },
        presentCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0]
          }
        },
        absentCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'absent'] }, 1, 0]
          }
        },
        attendanceRate: {
          $multiply: [
            {
              $divide: [
                {
                  $sum: {
                    $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0]
                  }
                },
                { $sum: 1 }
              ]
            },
            100
          ]
        }
      }
    },
    {
      $sort: { attendanceRate: -1, memberName: 1 }
    }
  ]);
};

// Method to mark or update attendance
attendanceSchema.statics.markAttendance = async function(data) {
  const {
    meetingId,
    memberId,
    groupId,
    districtId,
    status,
    markedBy,
    notes,
    isGuest,
    guestName,
    guestPhone
  } = data;

  // Get meeting details
  const Meeting = mongoose.model('Meeting');
  const meeting = await Meeting.findById(meetingId);
  
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const attendanceData = {
    meeting: meetingId,
    member: memberId,
    group: groupId,
    district: districtId,
    meetingMonth: meeting.monthlyDetails?.month || new Date(meeting.scheduledDate).getMonth() + 1,
    meetingYear: meeting.monthlyDetails?.year || new Date(meeting.scheduledDate).getFullYear(),
    meetingDate: meeting.scheduledDate,
    status,
    markedBy,
    notes,
    isGuest: isGuest || false,
    guestName,
    guestPhone
  };

  // Use upsert to update existing or create new attendance record
  return this.findOneAndUpdate(
    { meeting: meetingId, member: memberId },
    attendanceData,
    { 
      upsert: true, 
      new: true,
      runValidators: true
    }
  );
};

// Add pagination plugin
attendanceSchema.plugin(mongoosePaginate);

export default mongoose.model('Attendance', attendanceSchema);