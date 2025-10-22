import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['general', 'meeting', 'urgent', 'reminder', 'announcement', 'system'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  targetAudience: {
    type: String,
    enum: ['all', 'state_admins', 'district_admins', 'group_admins', 'members', 'specific_groups', 'specific_districts', 'specific_users'],
    default: 'all'
  },
  targetGroups: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  targetDistricts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'District'
  }],
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  targetMembers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  }],
  channels: [{
    type: String,
    enum: ['whatsapp', 'sms', 'email', 'in_app'],
    default: 'whatsapp'
  }],
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'],
    default: 'draft'
  },
  deliveryStats: {
    total: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    read: {
      type: Number,
      default: 0
    }
  },
  recipients: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member'
    },
    phone: String,
    email: String,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
      default: 'pending'
    },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failureReason: String,
    messageId: String // External service message ID
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String
  }],
  metadata: {
    relatedMeeting: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting'
    },
    relatedRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request'
    },
    campaignId: String,
    tags: [String]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sentAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ status: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ createdBy: 1 });
notificationSchema.index({ targetAudience: 1 });
notificationSchema.index({ createdAt: -1 });

// Virtual for delivery rate
notificationSchema.virtual('deliveryRate').get(function() {
  if (this.deliveryStats.total === 0) return 0;
  return ((this.deliveryStats.delivered / this.deliveryStats.total) * 100).toFixed(1);
});

// Virtual for read rate
notificationSchema.virtual('readRate').get(function() {
  if (this.deliveryStats.delivered === 0) return 0;
  return ((this.deliveryStats.read / this.deliveryStats.delivered) * 100).toFixed(1);
});

// Method to check if notification is scheduled for future
notificationSchema.methods.isScheduled = function() {
  return this.scheduledFor > new Date() && this.status === 'scheduled';
};

// Method to check if notification is ready to send
notificationSchema.methods.isReadyToSend = function() {
  return this.scheduledFor <= new Date() && 
         (this.status === 'scheduled' || this.status === 'draft');
};

// Method to update delivery stats
notificationSchema.methods.updateDeliveryStats = function() {
  const stats = {
    total: this.recipients.length,
    sent: this.recipients.filter(r => ['sent', 'delivered', 'read'].includes(r.status)).length,
    delivered: this.recipients.filter(r => ['delivered', 'read'].includes(r.status)).length,
    failed: this.recipients.filter(r => r.status === 'failed').length,
    read: this.recipients.filter(r => r.status === 'read').length
  };
  
  this.deliveryStats = stats;
  
  // Update overall status
  if (stats.total === stats.sent + stats.failed) {
    this.status = 'sent';
    this.completedAt = new Date();
  }
  
  return this.save();
};

// Method to mark recipient status
notificationSchema.methods.updateRecipientStatus = function(recipientId, status, metadata = {}) {
  const recipient = this.recipients.id(recipientId);
  if (!recipient) return false;
  
  recipient.status = status;
  
  switch (status) {
    case 'sent':
      recipient.sentAt = new Date();
      if (metadata.messageId) recipient.messageId = metadata.messageId;
      break;
    case 'delivered':
      recipient.deliveredAt = new Date();
      break;
    case 'read':
      recipient.readAt = new Date();
      break;
    case 'failed':
      if (metadata.failureReason) recipient.failureReason = metadata.failureReason;
      break;
  }
  
  this.updateDeliveryStats();
  return this.save();
};

// Static method to get notifications ready to send
notificationSchema.statics.getReadyToSend = function() {
  return this.find({
    scheduledFor: { $lte: new Date() },
    status: { $in: ['scheduled', 'draft'] }
  }).sort({ priority: -1, scheduledFor: 1 });
};

// Static method to get notifications by user
notificationSchema.statics.getByUser = function(userId, filter = {}) {
  return this.find({
    ...filter,
    $or: [
      { targetAudience: 'all' },
      { targetUsers: userId },
      { createdBy: userId }
    ]
  }).sort({ createdAt: -1 });
};

// Static method to get delivery statistics
notificationSchema.statics.getDeliveryStats = function(filter = {}) {
  return this.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        totalRecipients: { $sum: '$deliveryStats.total' },
        totalSent: { $sum: '$deliveryStats.sent' },
        totalDelivered: { $sum: '$deliveryStats.delivered' },
        totalFailed: { $sum: '$deliveryStats.failed' },
        totalRead: { $sum: '$deliveryStats.read' }
      }
    },
    {
      $addFields: {
        deliveryRate: {
          $cond: [
            { $eq: ['$totalRecipients', 0] },
            0,
            { $multiply: [{ $divide: ['$totalDelivered', '$totalRecipients'] }, 100] }
          ]
        },
        readRate: {
          $cond: [
            { $eq: ['$totalDelivered', 0] },
            0,
            { $multiply: [{ $divide: ['$totalRead', '$totalDelivered'] }, 100] }
          ]
        }
      }
    }
  ]);
};

// Add pagination plugin
notificationSchema.plugin(mongoosePaginate);

export default mongoose.model('Notification', notificationSchema);