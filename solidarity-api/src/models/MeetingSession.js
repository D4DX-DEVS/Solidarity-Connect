import mongoose from 'mongoose';

const meetingSessionSchema = new mongoose.Schema({
  meeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true
  },
  sessionNumber: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: [true, 'Session title is required'],
    trim: true,
    maxlength: [200, 'Session title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Session description cannot exceed 1000 characters']
  },
  scheduledDate: {
    type: Date,
    required: [true, 'Session date is required']
  },
  duration: {
    type: Number, // in minutes
    default: 60
  },
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed'],
    default: 'scheduled'
  },
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Session completion status (marked by group admin)
  sessionStatus: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled', 'postponed'],
    default: 'scheduled'
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: Date,
  
  // Attendance for members
  memberAttendance: [{
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      default: 'absent'
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    markedAt: Date,
    notes: String
  }],
  
  // Guest participants
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
    organization: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
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
    },
    notes: String
  }],
  notes: {
    summary: String,
    keyPoints: [String],
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
    }]
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
meetingSessionSchema.index({ meeting: 1, sessionNumber: 1 }, { unique: true });
meetingSessionSchema.index({ scheduledDate: 1 });
meetingSessionSchema.index({ status: 1 });

// Method to initialize member attendance for a group
meetingSessionSchema.methods.initializeMemberAttendance = async function(groupId) {
  const Member = mongoose.model('Member');
  const members = await Member.find({ 
    group: groupId, 
    status: 'Active', 
    isApproved: true 
  });

  // Add members who aren't already in attendance
  for (const member of members) {
    const existingAttendance = this.memberAttendance.find(a => 
      a.member.toString() === member._id.toString()
    );
    
    if (!existingAttendance) {
      this.memberAttendance.push({
        member: member._id,
        status: 'absent'
      });
    }
  }

  return this.save();
};

// Method to mark member attendance
meetingSessionSchema.methods.markMemberAttendance = function(memberId, status, markedBy, notes = '') {
  const existingAttendance = this.memberAttendance.find(a => 
    a.member.toString() === memberId.toString()
  );

  if (existingAttendance) {
    existingAttendance.status = status;
    existingAttendance.markedBy = markedBy;
    existingAttendance.markedAt = new Date();
    existingAttendance.notes = notes;
  } else {
    this.memberAttendance.push({
      member: memberId,
      status,
      markedBy,
      markedAt: new Date(),
      notes
    });
  }

  return this.save();
};

// Method to add guest participant
meetingSessionSchema.methods.addGuest = function(guestData, addedBy) {
  this.guestAttendance.push({
    ...guestData,
    addedBy,
    addedAt: new Date()
  });

  return this.save();
};

// Method to mark session as completed
meetingSessionSchema.methods.markCompleted = function(completedBy) {
  this.sessionStatus = 'completed';
  this.completedBy = completedBy;
  this.completedAt = new Date();
  
  return this.save();
};

// Method to get attendance statistics
meetingSessionSchema.methods.getAttendanceStats = function() {
  const memberStats = {
    total: this.memberAttendance.length,
    present: this.memberAttendance.filter(a => a.status === 'present').length,
    absent: this.memberAttendance.filter(a => a.status === 'absent').length,
    late: this.memberAttendance.filter(a => a.status === 'late').length,
    excused: this.memberAttendance.filter(a => a.status === 'excused').length
  };

  const guestStats = {
    total: this.guestAttendance.length,
    present: this.guestAttendance.filter(a => a.status === 'present').length
  };

  const totalParticipants = memberStats.total + guestStats.total;
  const totalPresent = memberStats.present + memberStats.late + guestStats.present;

  return {
    members: memberStats,
    guests: guestStats,
    overall: {
      totalParticipants,
      totalPresent,
      attendanceRate: totalParticipants > 0 ? ((totalPresent / totalParticipants) * 100).toFixed(1) : 0
    }
  };
};

export default mongoose.model('MeetingSession', meetingSessionSchema);