import express from 'express';
import Notification from '../models/Notification.js';
import Member from '../models/Member.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import District from '../models/District.js';
import dxingService from '../services/dxingService.js';
import { authenticate, authorize, requireRole } from '../middleware/auth.js';
import { 
  createNotificationValidation,
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// @route   GET /api/notifications
// @desc    Get all notifications with server-side pagination
// @access  Private
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || '-createdAt';
    const status = req.query.status;
    const type = req.query.type;
    const search = req.query.search;
    const audienceFilter = req.query.audienceFilter;

    // Build filter
    let filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    // Search by title or message
    if (search && search.trim()) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: { $regex: search.trim(), $options: 'i' } },
          { message: { $regex: search.trim(), $options: 'i' } }
        ]
      });
    }

    // Audience filter (state_admin only: filter by specific targetAudience value)
    if (audienceFilter && req.user.role === 'state_admin' && audienceFilter !== 'all') {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { targetAudience: audienceFilter },
          { targetAudiences: audienceFilter }
        ]
      });
    }

    // Apply role-based filtering based on target audience
    if (req.user.role !== 'state_admin') {
      if (!status) {
        filter.status = 'sent';
      }

      const audienceValues = ['all'];

      if (req.user.role === 'group_admin') {
        audienceValues.push('group_admins');
      } else if (req.user.role === 'member') {
        audienceValues.push('members');
      } else if (req.user.role === 'district_admin') {
        audienceValues.push('district_admins');
      }

      filter.$or = [
        { targetAudience: { $in: audienceValues } },
        { targetAudiences: { $in: audienceValues } },
        { createdBy: req.user._id }
      ];
    }

    const options = {
      page,
      limit,
      sort,
      populate: { path: 'createdBy', select: 'name phone role' }
    };

    const result = await Notification.paginate(filter, options);

    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});

// @route   GET /api/notifications/stats
// @desc    Get notification statistics (Only State Admins)
// @access  Private - State Admin Only
router.get('/stats', authenticate, requireRole('state_admin'), async (req, res) => {
  try {
    let matchFilter = {};

    const stats = await Notification.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          draftNotifications: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          sentNotifications: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
          sendingNotifications: { $sum: { $cond: [{ $eq: ['$status', 'sending'] }, 1, 0] } },
          failedNotifications: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          totalRecipients: { $sum: '$deliveryStats.total' },
          totalDelivered: { $sum: '$deliveryStats.delivered' },
          totalFailed: { $sum: '$deliveryStats.failed' }
        }
      }
    ]);

    // Get recent notifications
    const recentNotifications = await Notification.find(matchFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'name phone')
      .select('title type status deliveryStats createdAt');

    res.status(200).json({
      success: true,
      data: {
        statistics: stats[0] || {
          totalNotifications: 0,
          draftNotifications: 0,
          sentNotifications: 0,
          sendingNotifications: 0,
          failedNotifications: 0,
          totalRecipients: 0,
          totalDelivered: 0,
          totalFailed: 0
        },
        recentNotifications
      }
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics'
    });
  }
});

// @route   GET /api/notifications/:id
// @desc    Get single notification by ID
// @access  Private
router.get('/:id', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('createdBy', 'name phone role')
      .populate('targetGroups', 'name code district')
      .populate('targetDistricts', 'name code')
      .populate('targetUsers', 'name phone role')
      .populate('recipients.user', 'name phone')
      .populate('recipients.member', 'name phone');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const targetAudienceValues = Array.isArray(notification.targetAudiences) && notification.targetAudiences.length > 0
      ? notification.targetAudiences
      : [notification.targetAudience];

    // Check access permissions based on target audience
    let canView = req.user.role === 'state_admin' ||
      targetAudienceValues.includes('all') ||
      notification.targetUsers.some(u => u._id.toString() === req.user._id.toString());

    // Role-specific access control
    if (!canView) {
      if (req.user.role === 'district_admin') {
        canView = targetAudienceValues.includes('district_admins') ||
          (notification.targetDistricts && notification.targetDistricts.some(d => d._id.toString() === req.user.district?._id?.toString()));
      } else if (req.user.role === 'group_admin') {
        canView = targetAudienceValues.includes('group_admins') ||
          (notification.targetGroups && notification.targetGroups.some(g => g._id.toString() === req.user.group?._id?.toString()));
      } else if (req.user.role === 'member') {
        canView = targetAudienceValues.includes('members');
      }
    }

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification'
    });
  }
});

// @route   POST /api/notifications
// @desc    Create new notification (State Admins; Group Admins scoped to own group)
// @access  Private - State Admin / Group Admin
router.post('/', authenticate, requireRole(['state_admin', 'group_admin']), async (req, res) => {
  try {
    const {
      title,
      message,
      targetAudience = 'all',
      targetAudiences,
      type = 'general',
      priority = 'medium',
      status = 'draft',
      channels = ['in_app'],
      attachments = [],
      scheduledFor
    } = req.body;

    // Basic validation
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    let normalizedTargetAudiences = Array.isArray(targetAudiences) && targetAudiences.length > 0
      ? targetAudiences
      : [targetAudience];

    // Group admins can only announce to their own group's members
    let effectiveTargetAudience = targetAudience;
    let targetGroups = [];
    if (req.user.role === 'group_admin') {
      if (!req.user.group) {
        return res.status(400).json({
          success: false,
          message: 'No group assigned to your account'
        });
      }
      effectiveTargetAudience = 'specific_groups';
      normalizedTargetAudiences = [];
      targetGroups = [req.user.group._id || req.user.group];
    }

    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
          .filter(att => att && att.url)
          .map(att => ({
            url: att.url,
            originalName: att.originalName,
            mimetype: att.mimetype,
            size: att.size,
            filename: att.filename
          }))
      : [];

    // Create notification
    const notification = new Notification({
      title: title.trim(),
      message: message.trim(),
      type,
      priority,
      targetAudience: effectiveTargetAudience,
      targetAudiences: normalizedTargetAudiences,
      targetGroups,
      channels,
      attachments: normalizedAttachments,
      createdBy: req.user._id,
      status,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
      ...(status === 'sent' ? { sentAt: new Date() } : {})
    });

    await notification.save();

    // Populate the created notification
    await notification.populate('createdBy', 'name phone role');

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create notification'
    });
  }
});

// @route   POST /api/notifications/:id/send
// @desc    Mark notification as sent (Simplified - no actual sending)
// @access  Private - State Admin Only
router.post('/:id/send', authenticate, requireRole('state_admin'), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    if (notification.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Notification has already been sent'
      });
    }

    // Simply mark as sent - no actual sending
    notification.status = 'sent';
    notification.sentAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as sent',
      data: {
        id: notification._id,
        status: notification.status,
        sentAt: notification.sentAt
      }
    });

  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification'
    });
  }
});

// @route   GET /api/notifications/:id/status
// @desc    Get notification delivery status
// @access  Private
router.get('/:id/status', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('recipients.user', 'name phone')
      .populate('recipients.member', 'name phone');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Only state admins can view detailed delivery status
    if (req.user.role !== 'state_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only state admins can view notification delivery status.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: notification._id,
        status: notification.status,
        deliveryStats: notification.deliveryStats,
        deliveryRate: notification.deliveryRate,
        readRate: notification.readRate,
        recipients: notification.recipients,
        sentAt: notification.sentAt,
        completedAt: notification.completedAt
      }
    });

  } catch (error) {
    console.error('Get notification status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification status'
    });
  }
});

// @route   PUT /api/notifications/:id
// @desc    Update notification (Only State Admins)
// @access  Private - State Admin Only
router.put('/:id', authenticate, requireRole('state_admin'), async (req, res) => {
  try {
    const {
      title,
      message,
      targetAudience,
      targetAudiences,
      type,
      priority,
      status,
      channels,
      attachments
    } = req.body;

    const updatePayload = {
      ...(title && { title: title.trim() }),
      ...(message && { message: message.trim() }),
      ...(targetAudience && { targetAudience }),
      ...(Array.isArray(targetAudiences) && { targetAudiences }),
      ...(type && { type }),
      ...(priority && { priority }),
      ...(status && { status }),
      ...(Array.isArray(channels) && { channels }),
      ...(Array.isArray(attachments) && {
        attachments: attachments
          .filter(att => att && att.url)
          .map(att => ({
            url: att.url,
            originalName: att.originalName,
            mimetype: att.mimetype,
            size: att.size,
            filename: att.filename
          }))
      })
    };

    if (status === 'sent') {
      updatePayload.sentAt = new Date();
    }

    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name phone role');

    if (!updatedNotification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification updated successfully',
      data: updatedNotification
    });

  } catch (error) {
    console.error('Update notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update notification'
    });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete notification (Only State Admins)
// @access  Private - State Admin Only
router.delete('/:id', authenticate, requireRole('state_admin'), async (req, res) => {
  try {
    const deletedNotification = await Notification.findByIdAndDelete(req.params.id);

    if (!deletedNotification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
});

// Simplified notification system - no complex recipient management

export default router;