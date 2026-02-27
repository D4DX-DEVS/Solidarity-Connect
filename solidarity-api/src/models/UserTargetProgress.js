import mongoose from 'mongoose';

// Tracks progress of a User (not Member) on a PersonalTarget.
// Used when a target is assigned to district_admin, area_admin, or unit_admin roles.
const userTargetProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  personalTarget: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PersonalTarget',
    required: [true, 'Personal target is required']
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
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
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Each user can have only one progress record per target
userTargetProgressSchema.index({ user: 1, personalTarget: 1 }, { unique: true });
userTargetProgressSchema.index({ personalTarget: 1 });
userTargetProgressSchema.index({ user: 1 });
userTargetProgressSchema.index({ status: 1 });

const UserTargetProgress = mongoose.model('UserTargetProgress', userTargetProgressSchema);

export default UserTargetProgress;
