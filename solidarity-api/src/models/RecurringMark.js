import mongoose from 'mongoose';

// Tracks per-period (month/week/quarter) completion of a recurring PersonalTarget.
// One document per user+target+year+month combination.
const recurringMarkSchema = new mongoose.Schema({
  // The user who made the mark — either a User (admin/group_admin) or a Member
  userType: {
    type: String,
    enum: ['User', 'Member'],
    required: true,
    default: 'User'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'userType',
    required: true
  },
  personalTarget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalTarget',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  completed: {
    type: Boolean,
    default: false
  },
  markedAt: {
    type: Date,
    default: Date.now
  },
  // Area attendance — only populated when the target has attendanceNeeded=true
  // and the marking user is an area admin
  attendance: [{
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true
    },
    present: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// One mark per user per target per year+month
recurringMarkSchema.index({ user: 1, personalTarget: 1, year: 1, month: 1 }, { unique: true });
recurringMarkSchema.index({ personalTarget: 1, year: 1 });
recurringMarkSchema.index({ user: 1 });

const RecurringMark = mongoose.model('RecurringMark', recurringMarkSchema);

export default RecurringMark;
