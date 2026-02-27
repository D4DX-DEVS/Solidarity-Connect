import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const approvalSubSchema = {
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  comments: String
};

const transferRequestSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: [true, 'Member is required']
  },
  // Current details (captured at time of request)
  currentDistrict: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'District',
    required: [true, 'Current district is required']
  },
  currentGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Current group is required']
  },
  // Target details
  targetDistrict: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'District',
    required: [true, 'Target district is required']
  },
  targetGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: [true, 'Target group is required']
  },
  // Request details
  reason: {
    type: String,
    required: [true, 'Transfer reason is required'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requested by is required']
  },
  requestDate: { type: Date, default: Date.now },

  // Overall status
  // pending          → waiting for both district admins to approve
  // district_approved → both district admins approved, waiting for state admin
  // completed        → state admin approved + member data updated
  // rejected         → any admin rejected the request
  status: {
    type: String,
    enum: ['pending', 'district_approved', 'completed', 'rejected'],
    default: 'pending'
  },

  // Source district admin approval (tier 1a)
  sourceDistrictApproval: approvalSubSchema,
  // Target district admin approval (tier 1b) — auto-approved for within-district transfers
  targetDistrictApproval: approvalSubSchema,
  // State admin approval (tier 2, final — also completes the transfer)
  stateApproval: approvalSubSchema,

  // Completion info
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completedAt: Date,

  // Rejection info
  rejectionReason: String,
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
transferRequestSchema.index({ member: 1 });
transferRequestSchema.index({ status: 1 });
transferRequestSchema.index({ requestedBy: 1 });
transferRequestSchema.index({ currentDistrict: 1 });
transferRequestSchema.index({ targetDistrict: 1 });
transferRequestSchema.index({ requestDate: -1 });

// Virtual
transferRequestSchema.virtual('isCrossDistrict').get(function () {
  const src = this.currentDistrict?._id ?? this.currentDistrict;
  const tgt = this.targetDistrict?._id ?? this.targetDistrict;
  return src?.toString() !== tgt?.toString();
});

// Helper: extract string ID from either a populated doc or a raw ObjectId
const idStr = (field) => {
  if (!field) return null;
  // If populated (object with _id), use ._id; otherwise use directly
  return (field._id ?? field).toString();
};

// canApprove — returns true if this user has a pending action on this request
transferRequestSchema.methods.canApprove = function (user) {
  if (['completed', 'rejected'].includes(this.status)) return false;

  if (user.role === 'state_admin') {
    return this.status === 'district_approved' &&
      this.stateApproval.status === 'pending';
  }

  if (user.role === 'district_admin') {
    const distId = user.district?._id?.toString();
    const sourceId = idStr(this.currentDistrict);
    const targetId = idStr(this.targetDistrict);

    // Source district admin — their approval still pending
    if (distId === sourceId && this.sourceDistrictApproval.status === 'pending') return true;
    // Target district admin (cross-district only) — their approval still pending
    if (distId === targetId && distId !== sourceId && this.targetDistrictApproval.status === 'pending') return true;
  }

  return false;
};

// approve — advance the approval workflow
transferRequestSchema.methods.approve = async function (user, comments = '') {
  if (!this.canApprove(user)) {
    throw new Error('You do not have permission to approve this transfer at this stage');
  }

  const now = new Date();
  const sameDistrict = idStr(this.currentDistrict) === idStr(this.targetDistrict);

  if (user.role === 'district_admin') {
    const distId = user.district?._id?.toString();
    const sourceId = idStr(this.currentDistrict);

    if (distId === sourceId && this.sourceDistrictApproval.status === 'pending') {
      // Source district approval
      this.sourceDistrictApproval.status = 'approved';
      this.sourceDistrictApproval.approvedBy = user._id;
      this.sourceDistrictApproval.approvedAt = now;
      this.sourceDistrictApproval.comments = comments;

      // For within-district transfers, auto-approve target side too
      if (sameDistrict) {
        this.targetDistrictApproval.status = 'approved';
        this.targetDistrictApproval.approvedBy = user._id;
        this.targetDistrictApproval.approvedAt = now;
        this.targetDistrictApproval.comments = 'Auto-approved (within-district transfer)';
      }
    } else if (distId === idStr(this.targetDistrict) && this.targetDistrictApproval.status === 'pending') {
      // Target district approval (cross-district)
      this.targetDistrictApproval.status = 'approved';
      this.targetDistrictApproval.approvedBy = user._id;
      this.targetDistrictApproval.approvedAt = now;
      this.targetDistrictApproval.comments = comments;
    }

    // Advance to district_approved if both sides are approved
    if (
      this.sourceDistrictApproval.status === 'approved' &&
      this.targetDistrictApproval.status === 'approved'
    ) {
      this.status = 'district_approved';
    }

  } else if (user.role === 'state_admin') {
    // State admin approval = final approval + immediately complete the transfer
    this.stateApproval.status = 'approved';
    this.stateApproval.approvedBy = user._id;
    this.stateApproval.approvedAt = now;
    this.stateApproval.comments = comments;

    // Update the member's district and group
    const Member = mongoose.model('Member');
    await Member.findByIdAndUpdate(this.member, {
      district: this.targetDistrict,
      group: this.targetGroup,
      updatedBy: user._id
    });

    this.status = 'completed';
    this.completedBy = user._id;
    this.completedAt = now;
  }

  await this.save();
  return this;
};

// reject — any district or state admin can reject
transferRequestSchema.methods.reject = async function (user, reason) {
  if (['completed', 'rejected'].includes(this.status)) {
    throw new Error('Transfer request is already ' + this.status);
  }

  const canReject = user.role === 'state_admin' || user.role === 'district_admin';
  if (!canReject) {
    throw new Error('You do not have permission to reject this transfer');
  }

  const now = new Date();
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.rejectedBy = user._id;
  this.rejectedAt = now;

  if (user.role === 'district_admin') {
    const distId = user.district?._id?.toString();

    if (distId === idStr(this.currentDistrict)) {
      this.sourceDistrictApproval.status = 'rejected';
      this.sourceDistrictApproval.approvedBy = user._id;
      this.sourceDistrictApproval.approvedAt = now;
      this.sourceDistrictApproval.comments = reason;
    } else if (distId === idStr(this.targetDistrict)) {
      this.targetDistrictApproval.status = 'rejected';
      this.targetDistrictApproval.approvedBy = user._id;
      this.targetDistrictApproval.approvedAt = now;
      this.targetDistrictApproval.comments = reason;
    }
  } else if (user.role === 'state_admin') {
    this.stateApproval.status = 'rejected';
    this.stateApproval.approvedBy = user._id;
    this.stateApproval.approvedAt = now;
    this.stateApproval.comments = reason;
  }

  await this.save();
  return this;
};

// Static: get pending transfers for the current user (for badge counts)
transferRequestSchema.statics.getPendingForUser = async function (user) {
  let filter = {};

  if (user.role === 'district_admin') {
    const distId = user.district?._id;
    filter.status = 'pending';
    filter.$or = [
      { currentDistrict: distId, 'sourceDistrictApproval.status': 'pending' },
      { targetDistrict: distId, 'targetDistrictApproval.status': 'pending' }
    ];
  } else if (user.role === 'state_admin') {
    filter.status = 'district_approved';
    filter['stateApproval.status'] = 'pending';
  } else if (user.role === 'group_admin') {
    filter.currentGroup = user.group?._id;
    filter.status = { $in: ['pending', 'district_approved'] };
  }

  return await this.find(filter)
    .populate('member', 'name phone')
    .populate('currentDistrict', 'name code')
    .populate('currentGroup', 'name code')
    .populate('targetDistrict', 'name code')
    .populate('targetGroup', 'name code')
    .populate('requestedBy', 'name phone role')
    .sort({ requestDate: -1 });
};

transferRequestSchema.plugin(mongoosePaginate);

const TransferRequest = mongoose.model('TransferRequest', transferRequestSchema);
export default TransferRequest;
