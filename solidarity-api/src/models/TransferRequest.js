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
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  // District admin approval (if transferring within district)
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
  // State admin approval (if transferring between districts)
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

// Virtual to check if transfer is between districts
transferRequestSchema.virtual('isCrossDistrict').get(function() {
  return this.currentDistrict.toString() !== this.targetDistrict.toString();
});

// Virtual to get required approval level
transferRequestSchema.virtual('requiredApprovalLevel').get(function() {
  return this.isCrossDistrict ? 'state' : 'district';
});

// Method to check if user can approve this transfer
transferRequestSchema.methods.canApprove = function(user) {
  if (user.role === 'state_admin') {
    return true; // State admin can approve all transfers
  }
  
  if (user.role === 'district_admin') {
    // District admin can approve transfers within their district
    if (!this.isCrossDistrict) {
      return user.district._id.toString() === this.currentDistrict.toString() ||
             user.district._id.toString() === this.targetDistrict.toString();
    }
    return false; // Cannot approve cross-district transfers
  }
  
  return false; // Group admins cannot approve transfers
};

// Method to get current approval status
transferRequestSchema.methods.getCurrentApprovalStatus = function() {
  if (this.status === 'completed' || this.status === 'rejected') {
    return this.status;
  }

  if (this.isCrossDistrict) {
    // Cross-district transfer needs state admin approval
    return this.stateApproval.status;
  } else {
    // Within district transfer needs district admin approval
    return this.districtApproval.status;
  }
};

// Method to approve transfer
transferRequestSchema.methods.approve = async function(user, comments = '') {
  if (!this.canApprove(user)) {
    throw new Error('You do not have permission to approve this transfer');
  }

  if (this.status !== 'pending') {
    throw new Error('Transfer request is not in pending status');
  }

  const now = new Date();

  if (user.role === 'state_admin') {
    this.stateApproval.status = 'approved';
    this.stateApproval.approvedBy = user._id;
    this.stateApproval.approvedAt = now;
    this.stateApproval.comments = comments;
    this.status = 'approved';
  } else if (user.role === 'district_admin' && !this.isCrossDistrict) {
    this.districtApproval.status = 'approved';
    this.districtApproval.approvedBy = user._id;
    this.districtApproval.approvedAt = now;
    this.districtApproval.comments = comments;
    this.status = 'approved';
  }

  await this.save();
  return this;
};

// Method to reject transfer
transferRequestSchema.methods.reject = async function(user, reason) {
  if (!this.canApprove(user)) {
    throw new Error('You do not have permission to reject this transfer');
  }

  if (this.status !== 'pending') {
    throw new Error('Transfer request is not in pending status');
  }

  const now = new Date();

  this.status = 'rejected';
  this.rejectionReason = reason;
  this.rejectedBy = user._id;
  this.rejectedAt = now;

  // Also update the specific approval level
  if (user.role === 'state_admin') {
    this.stateApproval.status = 'rejected';
    this.stateApproval.approvedBy = user._id;
    this.stateApproval.approvedAt = now;
    this.stateApproval.comments = reason;
  } else if (user.role === 'district_admin') {
    this.districtApproval.status = 'rejected';
    this.districtApproval.approvedBy = user._id;
    this.districtApproval.approvedAt = now;
    this.districtApproval.comments = reason;
  }

  await this.save();
  return this;
};

// Method to complete transfer (actually move the member)
transferRequestSchema.methods.complete = async function(user) {
  if (this.status !== 'approved') {
    throw new Error('Transfer request must be approved before completion');
  }

  // Only state admin or district admin can complete transfers
  if (!['state_admin', 'district_admin'].includes(user.role)) {
    throw new Error('You do not have permission to complete this transfer');
  }

  const Member = mongoose.model('Member');
  
  // Update the member's district and group
  await Member.findByIdAndUpdate(this.member, {
    district: this.targetDistrict,
    group: this.targetGroup,
    updatedBy: user._id
  });

  // Mark transfer as completed
  this.status = 'completed';
  this.completedBy = user._id;
  this.completedAt = new Date();

  await this.save();
  return this;
};

// Static method to get pending transfers for a user
transferRequestSchema.statics.getPendingForUser = async function(user) {
  let filter = { status: 'pending' };

  if (user.role === 'district_admin') {
    // District admin sees only within-district transfers (cross-district needs state approval)
    filter.currentDistrict = user.district._id;
    filter.targetDistrict = user.district._id;
  } else if (user.role === 'group_admin') {
    // Group admin sees transfers from their group
    filter.currentGroup = user.group._id;
  }
  // State admin sees all pending transfers (no additional filter)

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