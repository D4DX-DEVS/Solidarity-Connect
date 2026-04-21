import mongoose from 'mongoose';

// Tracks per-period (week/month) completion of a recurring PersonalTarget.
//
// Granularity:
//  - Monthly targets  → one document per user + target + year + month (week = 0).
//  - Weekly targets   → one document per user + target + year + month + week (week = 1..5).
//
// `completionCount` lets a user record multiple completions within the same period
// for monthly targets where they finished the target more than once (optional extra credit).
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
  // 0 = month-level mark (monthly/quarterly targets), 1..5 = specific week within the month
  week: {
    type: Number,
    required: true,
    min: 0,
    max: 5,
    default: 0
  },
  completed: {
    type: Boolean,
    default: false
  },
  // Optional: how many times the target was completed in this period.
  // Defaults to 1 when `completed` is true, 0 otherwise. Useful for monthly targets
  // where a user exceeds the target (e.g. finishes it twice in a month).
  completionCount: {
    type: Number,
    min: 0,
    default: 0
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

// One mark per user per target per year+month+week.
// Week defaults to 0 so legacy monthly marks continue to collide correctly.
recurringMarkSchema.index(
  { user: 1, personalTarget: 1, year: 1, month: 1, week: 1 },
  { unique: true }
);
recurringMarkSchema.index({ personalTarget: 1, year: 1 });
recurringMarkSchema.index({ user: 1 });

const RecurringMark = mongoose.model('RecurringMark', recurringMarkSchema);

export default RecurringMark;
