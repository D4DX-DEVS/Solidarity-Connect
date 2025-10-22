import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const guestAttendanceSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
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
  // Guest details
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Guest name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true
  },
  organization: {
    type: String,
    trim: true,
    maxlength: [100, 'Organization cannot exceed 100 characters']
  },
  // Attendance status
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    default: 'present'
  },
  // Who added/marked the guest
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  // Additional notes
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
guestAttendanceSchema.index({ meeting: 1 });
guestAttendanceSchema.index({ group: 1, meetingMonth: 1, meetingYear: 1 });
guestAttendanceSchema.index({ meetingDate: 1 });
guestAttendanceSchema.index({ addedBy: 1 });

// Virtual for meeting month-year string
guestAttendanceSchema.virtual('meetingPeriod').get(function() {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[this.meetingMonth - 1]} ${this.meetingYear}`;
});

// Static method to get guest statistics for a meeting
guestAttendanceSchema.statics.getMeetingGuestStats = async function(meetingId) {
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
    late: 0
  };

  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });

  return result;
};

// Static method to add guest
guestAttendanceSchema.statics.addGuest = async function(data) {
  const {
    meetingId,
    groupId,
    districtId,
    name,
    phone,
    organization,
    status,
    addedBy,
    notes
  } = data;

  // Get meeting details
  const Meeting = mongoose.model('Meeting');
  const meeting = await Meeting.findById(meetingId);
  
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const guestData = {
    meeting: meetingId,
    group: groupId,
    district: districtId,
    meetingMonth: meeting.monthlyDetails?.month || new Date(meeting.scheduledDate).getMonth() + 1,
    meetingYear: meeting.monthlyDetails?.year || new Date(meeting.scheduledDate).getFullYear(),
    meetingDate: meeting.scheduledDate,
    name,
    phone,
    organization,
    status: status || 'present',
    addedBy,
    notes
  };

  return this.create(guestData);
};

// Add pagination plugin
guestAttendanceSchema.plugin(mongoosePaginate);

export default mongoose.model('GuestAttendance', guestAttendanceSchema);