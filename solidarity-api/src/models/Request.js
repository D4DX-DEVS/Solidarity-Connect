import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const requestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['member_edit', 'member_transfer', 'member_status_change', 'baithul_maal_update', 'group_transfer'],
    required: [true, 'Request type is required']
  },
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member',
    required: [true, 'Member is required']
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Requested by is required']
  },
  title: {
    type: String,
    required: [true, 'Request title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  currentData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  proposedData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  approvalLevel: {
    type: String,
    enum: ['group_admin', 'district_admin', 'state_admin'],
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Comment cannot exceed 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  expiresAt: {
    type: Date,
    default: function() {
      // Requests expire after 30 days
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  },
  notificationsSent: {
    created: {
      type: Boolean,
      default: false
    },
    approved: {
      type: Boolean,
      default: false
    },
    rejected: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes
requestSchema.index({ member: 1 });
requestSchema.index({ requestedBy: 1 });
requestSchema.index({ status: 1 });
requestSchema.index({ type: 1 });
requestSchema.index({ approvalLevel: 1 });
requestSchema.index({ createdAt: -1 });
requestSchema.index({ expiresAt: 1 });

// Virtual for request age in days
requestSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Method to check if request is expired
requestSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Method to check if request is pending
requestSchema.methods.isPending = function() {
  return this.status === 'pending' && !this.isExpired();
};

// Method to approve request
requestSchema.methods.approve = async function(approvedBy, comment = '') {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  
  if (comment) {
    this.comments.push({
      user: approvedBy,
      comment: comment
    });
  }
  
  // Apply changes to member
  if (this.type === 'member_edit') {
    const Member = mongoose.model('Member');
    await Member.findByIdAndUpdate(this.member, {
      ...this.proposedData,
      updatedBy: approvedBy
    });
  } else if (this.type === 'member_transfer') {
    const Member = mongoose.model('Member');
    await Member.findByIdAndUpdate(this.member, {
      district: this.proposedData.district,
      group: this.proposedData.group,
      updatedBy: approvedBy
    });
  } else if (this.type === 'member_status_change') {
    const Member = mongoose.model('Member');
    await Member.findByIdAndUpdate(this.member, {
      status: this.proposedData.status,
      updatedBy: approvedBy
    });
  }
  
  return this.save();
};

// Method to reject request
requestSchema.methods.reject = function(rejectedBy, reason) {
  this.status = 'rejected';
  this.rejectedBy = rejectedBy;
  this.rejectedAt = new Date();
  this.rejectionReason = reason;
  
  return this.save();
};

// Method to add comment
requestSchema.methods.addComment = function(userId, comment) {
  this.comments.push({
    user: userId,
    comment: comment
  });
  
  return this.save();
};

// Static method to get pending requests by approval level
requestSchema.statics.getPendingByLevel = function(approvalLevel, filter = {}) {
  return this.find({
    ...filter,
    status: 'pending',
    approvalLevel: approvalLevel,
    expiresAt: { $gt: new Date() }
  }).populate('member requestedBy', 'name phone email')
    .sort({ createdAt: -1 });
};

// Static method to get requests by member
requestSchema.statics.getByMember = function(memberId) {
  return this.find({ member: memberId })
    .populate('requestedBy approvedBy rejectedBy', 'name phone email')
    .sort({ createdAt: -1 });
};

// Static method to cleanup expired requests
requestSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    { 
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    { 
      status: 'cancelled',
      rejectionReason: 'Request expired automatically'
    }
  );
};

// Add pagination plugin
requestSchema.plugin(mongoosePaginate);

export default mongoose.model('Request', requestSchema);