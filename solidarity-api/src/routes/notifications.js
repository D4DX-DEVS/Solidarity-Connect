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

    // Build filter
    let filter = {};
    if (status) filter.status = status;

    // Apply role-based filtering
    if (req.user.role !== 'state_admin') {
      filter.$or = [
        { targetAudience: 'all' },
        { targetAudience: 'members' }
      ];

      if (req.user.role === 'group_admin') {
        filter.$or.push({ targetAudience: 'group_admins' });
      }
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

    // Check access permissions - State admins can view all, others based on targeting
    let canView = req.user.role === 'state_admin' ||
      notification.targetAudience === 'all' ||
      notification.targetUsers.some(u => u._id.toString() === req.user._id.toString());

    if (!canView && req.user.role === 'district_admin') {
      canView = notification.targetAudience === 'district_admins' ||
        (notification.targetDistricts && notification.targetDistricts.some(d => d._id.toString() === req.user.district._id.toString()));
    }

    if (!canView && req.user.role === 'group_admin') {
      canView = notification.targetAudience === 'group_admins' ||
        (notification.targetGroups && notification.targetGroups.some(g => g._id.toString() === req.user.group._id.toString()));
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
// @desc    Create new notification (Only State Admins) - Simplified
// @access  Private - State Admin Only
router.post('/', authenticate, requireRole('state_admin'), async (req, res) => {
  try {
    const { title, message, targetAudience = 'all' } = req.body;

    // Basic validation
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Create notification with simplified data
    const notification = new Notification({
      title: title.trim(),
      message: message.trim(),
      type: 'general',
      priority: 'medium', // Default priority
      targetAudience,
      createdBy: req.user._id,
      status: 'draft',
      scheduledFor: new Date()
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
    const { title, message, targetAudience } = req.body;

    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      {
        ...(title && { title: title.trim() }),
        ...(message && { message: message.trim() }),
        ...(targetAudience && { targetAudience })
      },
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