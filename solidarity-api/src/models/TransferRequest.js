import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const transferRequestSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: [true, 'Member is required']
  },
  // Current details
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
  requestDate: {
    type: Date,
    default: Date.now
  },
  // Approval workflow
  status: {
    type: String,
    enum: ['pending', 'area_approved', 'district_approved', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  // Area admin approval (first tier — group_admin with roleTag.type = 'area')
  areaApproval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    comments: String
  },
  // District admin approval (second tier)
  districtApproval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    comments: String
  },
  // State admin approval (third and final tier)
  stateApproval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    comments: String
  },
  // Final completion
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: Date,
  // Rejection details
  rejectionReason: String,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
transferRequestSchema.index({ member: 1 });
transferRequestSchema.index({ status: 1 });
transferRequestSchema.index({ requestedBy: 1 });
transferRequestSchema.index({ currentDistrict: 1 });
transferRequestSchema.index({ targetDistrict: 1 });
transferRequestSchema.index({ requestDate: -1 });

// Helper: is user an area admin?
const isAreaAdmin = (user) =>
  user.role === 'group_admin' && user.roleTag?.type === 'area';

// Virtual to check if transfer is between districts
transferRequestSchema.virtual('isCrossDistrict').get(function() {
  return this.currentDistrict.toString() !== this.targetDistrict.toString();
});

// Method to check if user can approve this transfer at their tier
transferRequestSchema.methods.canApprove = function(user) {
  if (user.role === 'state_admin') {
    return this.districtApproval.status === 'approved';
  }
  if (user.role === 'district_admin') {
    return this.areaApproval.status === 'approved' &&
      this.districtApproval.status === 'pending' &&
      (user.district?._id?.toString() === this.currentDistrict?.toString() ||
       user.district?._id?.toString() === this.targetDistrict?.toString());
  }
  if (isAreaAdmin(user)) {
    return this.areaApproval.status === 'pending' &&
      user.group?._id?.toString() === this.currentGroup?.toString();
  }
  return false;
};

// Method to approve transfer (advances one tier)
transferRequestSchema.methods.approve = async function(user, comments = '') {
  if (!this.canApprove(user)) {
    throw new Error('You do not have permission to approve this transfer, or previous tier has not approved yet');
  }

  const now = new Date();

  if (isAreaAdmin(user)) {
    this.areaApproval.status = 'approved';
    this.areaApproval.approvedBy = user._id;
    this.areaApproval.approvedAt = now;
    this.areaApproval.comments = comments;
    this.status = 'area_approved';
  } else if (user.role === 'district_admin') {
    this.districtApproval.status = 'approved';
    this.districtApproval.approvedBy = user._id;
    this.districtApproval.approvedAt = now;
    this.districtApproval.comments = comments;
    this.status = 'district_approved';
  } else if (user.role === 'state_admin') {
    this.stateApproval.status = 'approved';
    this.stateApproval.approvedBy = user._id;
    this.stateApproval.approvedAt = now;
    this.stateApproval.comments = comments;
    this.status = 'approved';
  }

  await this.save();
  return this;
};

// Method to reject transfer (any tier can reject)
transferRequestSchema.methods.reject = async function(user, reason) {
  const canReject =
    user.role === 'state_admin' ||
    user.role === 'district_admin' ||
    isAreaAdmin(user);

  if (!canReject) {
    throw new Error('You do not have permission to reject this transfer');
  }

  if (['completed', 'rejected'].includes(this.status)) {
    throw new Error('Transfer request is already ' + this.status);
  }

  const now = new Date();
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.rejectedBy = user._id;
  this.rejectedAt = now;

  if (isAreaAdmin(user)) {
    this.areaApproval.status = 'rejected';
    this.areaApproval.approvedBy = user._id;
    this.areaApproval.approvedAt = now;
    this.areaApproval.comments = reason;
  } else if (user.role === 'district_admin') {
    this.districtApproval.status = 'rejected';
    this.districtApproval.approvedBy = user._id;
    this.districtApproval.approvedAt = now;
    this.districtApproval.comments = reason;
  } else if (user.role === 'state_admin') {
    this.stateApproval.status = 'rejected';
    this.stateApproval.approvedBy = user._id;
    this.stateApproval.approvedAt = now;
    this.stateApproval.comments = reason;
  }

  await this.save();
  return this;
};

// Method to complete transfer (actually move the member)
transferRequestSchema.methods.complete = async function(user) {
  if (this.status !== 'approved') {
    throw new Error('Transfer request must be fully approved before completion');
  }

  // Only state admin can complete (they gave final approval)
  if (user.role !== 'state_admin') {
    throw new Error('Only State Admin can complete a transfer');
  }

  const Member = mongoose.model('Member');
  
  await Member.findByIdAndUpdate(this.member, {
    district: this.targetDistrict,
    group: this.targetGroup,
    updatedBy: user._id
  });

  this.status = 'completed';
  this.completedBy = user._id;
  this.completedAt = new Date();

  await this.save();
  return this;
};

// Static method to get pending transfers for a user (by their tier)
transferRequestSchema.statics.getPendingForUser = async function(user) {
  let filter = {};

  if (isAreaAdmin(user)) {
    // Area admin sees transfers from their group waiting for area approval
    filter.areaApproval = { status: 'pending' };
    filter.currentGroup = user.group?._id;
    filter.status = 'pending';
  } else if (user.role === 'district_admin') {
    // District admin sees transfers that area has approved, waiting for district
    filter['areaApproval.status'] = 'approved';
    filter['districtApproval.status'] = 'pending';
    filter.status = 'area_approved';
    filter.$or = [
      { currentDistrict: user.district?._id },
      { targetDistrict: user.district?._id }
    ];
  } else if (user.role === 'state_admin') {
    // State admin sees transfers district has approved, waiting for state
    filter['districtApproval.status'] = 'approved';
    filter['stateApproval.status'] = 'pending';
    filter.status = 'district_approved';
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

// Add pagination plugin
transferRequestSchema.plugin(mongoosePaginate);

const TransferRequest = mongoose.model('TransferRequest', transferRequestSchema);

export default TransferRequest;