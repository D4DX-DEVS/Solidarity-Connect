import express from 'express';
import Request from '../models/Request.js';
import Member from '../models/Member.js';
import { authenticate, authorize, requireRole, isAreaLevelAdmin, areaGroupIdsFor } from '../middleware/auth.js';
import { 
  createRequestValidation,
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// @route   GET /api/requests
// @desc    Get all requests
// @access  Private
router.get('/', authenticate, paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      status,
      type,
      priority,
      approvalLevel
    } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      // Group admin sees requests they created or need to approve
      filter.$or = [
        { requestedBy: req.user._id },
        { approvalLevel: 'group_admin' }
      ];
    } else if (req.user.role === 'district_admin') {
      // District admin sees requests from their district
      filter.$or = [
        { requestedBy: req.user._id },
        { approvalLevel: 'district_admin' }
      ];
    } else if (req.user.role === 'state_admin') {
      // State admin sees all requests
      if (approvalLevel) filter.approvalLevel = approvalLevel;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'member', select: 'name phone district group' },
        { path: 'requestedBy', select: 'name phone role' },
        { path: 'approvedBy', select: 'name phone role' },
        { path: 'rejectedBy', select: 'name phone role' }
      ]
    };

    const result = await Request.paginate(filter, options);

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
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch requests'
    });
  }
});

// @route   GET /api/requests/pending
// @desc    Get pending requests for current user's approval level
// @access  Private
router.get('/pending', authenticate, async (req, res) => {
  try {
    let approvalLevel;

    switch (req.user.role) {
      case 'state_admin':
        approvalLevel = req.query.level || 'state_admin';
        break;
      case 'district_admin':
        approvalLevel = 'district_admin';
        break;
      case 'group_admin':
        approvalLevel = 'group_admin';
        break;
      default:
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
    }

    const requests = await Request.getPendingByLevel(approvalLevel)
      .populate('member', 'name phone district group')
      .populate('requestedBy', 'name phone role')
      .limit(20);

    res.status(200).json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending requests'
    });
  }
});

// @route   GET /api/requests/stats
// @desc    Get request statistics
// @access  Private
router.get('/stats', authenticate, async (req, res) => {
  try {
    let matchFilter = {};

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      matchFilter.approvalLevel = 'group_admin';
    } else if (req.user.role === 'district_admin') {
      matchFilter.approvalLevel = { $in: ['district_admin', 'group_admin'] };
    }

    const stats = await Request.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          pendingRequests: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approvedRequests: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejectedRequests: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          memberEditRequests: { $sum: { $cond: [{ $eq: ['$type', 'member_edit'] }, 1, 0] } },
          transferRequests: { $sum: { $cond: [{ $eq: ['$type', 'member_transfer'] }, 1, 0] } },
          statusChangeRequests: { $sum: { $cond: [{ $eq: ['$type', 'member_status_change'] }, 1, 0] } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        totalRequests: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        rejectedRequests: 0,
        memberEditRequests: 0,
        transferRequests: 0,
        statusChangeRequests: 0
      }
    });

  } catch (error) {
    console.error('Get request stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request statistics'
    });
  }
});

// @route   GET /api/requests/:id
// @desc    Get single request by ID
// @access  Private
router.get('/:id', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('member', 'name phone email district group')
      .populate('requestedBy', 'name phone role')
      .populate('approvedBy', 'name phone role')
      .populate('rejectedBy', 'name phone role')
      .populate('comments.user', 'name phone role');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }

    // Check access permissions
    const canView = req.user.role === 'state_admin' ||
      request.requestedBy._id.toString() === req.user._id.toString() ||
      (req.user.role === 'district_admin' && request.approvalLevel === 'district_admin') ||
      (req.user.role === 'group_admin' && request.approvalLevel === 'group_admin');

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Enforce district scoping for district_admin
    if (req.user.role === 'district_admin') {
      const userDistrictId = req.user.district?._id || req.user.district;
      const memberDistrictId = request.member?.district?._id || request.member?.district;
      if (userDistrictId?.toString() !== memberDistrictId?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (isAreaLevelAdmin(req.user)) {
      // area-level group_admin: must be in own area's groups
      const areaGroupIds = await areaGroupIdsFor(req.user);
      const memberGroupId = request.member?.group?._id || request.member?.group;
      if (!areaGroupIds.map(g => g.toString()).includes(memberGroupId?.toString())) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.status(200).json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch request'
    });
  }
});

// @route   POST /api/requests
// @desc    Create new request
// @access  Private
router.post('/', authenticate, authorize(['manage_members']), createRequestValidation, async (req, res) => {
  try {
    const requestData = req.body;

    // Validate member exists and user has access
    const member = await Member.findById(requestData.member)
      .populate('district group');

    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'group_admin' && 
        member.group._id.toString() !== req.user.group._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only create requests for members in your group'
      });
    }

    if (req.user.role === 'district_admin' && 
        member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only create requests for members in your district'
      });
    }

    // Determine approval level based on request type and user role
    let approvalLevel = 'state_admin'; // Default

    if (requestData.type === 'member_edit' && req.user.role === 'group_admin') {
      approvalLevel = 'district_admin';
    } else if (requestData.type === 'member_transfer') {
      approvalLevel = 'state_admin';
    } else if (requestData.type === 'baithul_maal_update' && req.user.role === 'group_admin') {
      approvalLevel = 'district_admin';
    }

    // Get current member data
    const currentData = member.toObject();
    delete currentData._id;
    delete currentData.__v;
    delete currentData.createdAt;
    delete currentData.updatedAt;

    // Calculate changes
    const changes = [];
    Object.keys(requestData.proposedData).forEach(key => {
      if (currentData[key] !== requestData.proposedData[key]) {
        changes.push({
          field: key,
          oldValue: currentData[key],
          newValue: requestData.proposedData[key]
        });
      }
    });

    // Create request
    const request = new Request({
      ...requestData,
      requestedBy: req.user._id,
      currentData,
      changes,
      approvalLevel
    });

    await request.save();

    // Populate the created request
    await request.populate([
      { path: 'member', select: 'name phone district group' },
      { path: 'requestedBy', select: 'name phone role' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Request created successfully',
      data: request
    });

  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create request'
    });
  }
});

// @route   POST /api/requests/:id/approve
// @desc    Approve request
// @access  Private
router.post('/:id/approve', 
  authenticate, 
  objectIdValidation('id'),
  [
    body('comment').optional().trim().isLength({ max: 500 }),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const request = await Request.findById(req.params.id)
        .populate('member', 'district group');

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Request is not pending approval'
        });
      }

      // Check approval permissions
      const canApprove = (request.approvalLevel === 'state_admin' && req.user.role === 'state_admin') ||
        (request.approvalLevel === 'district_admin' && ['state_admin', 'district_admin'].includes(req.user.role)) ||
        (request.approvalLevel === 'group_admin' && ['state_admin', 'district_admin', 'group_admin'].includes(req.user.role));

      if (!canApprove) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to approve this request'
        });
      }

      // Enforce district scoping for district_admin
      if (req.user.role === 'district_admin') {
        const userDistrictId = req.user.district?._id || req.user.district;
        const memberDistrictId = request.member?.district?._id || request.member?.district;
        if (userDistrictId?.toString() !== memberDistrictId?.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else if (isAreaLevelAdmin(req.user)) {
        // area-level group_admin: must be in own area's groups
        const areaGroupIds = await areaGroupIdsFor(req.user);
        const memberGroupId = request.member?.group?._id || request.member?.group;
        if (!areaGroupIds.map(g => g.toString()).includes(memberGroupId?.toString())) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      const { comment } = req.body;

      // Approve request
      await request.approve(req.user._id, comment);

      // Populate the approved request
      await request.populate([
        { path: 'member', select: 'name phone district group' },
        { path: 'requestedBy', select: 'name phone role' },
        { path: 'approvedBy', select: 'name phone role' }
      ]);

      res.status(200).json({
        success: true,
        message: 'Request approved successfully',
        data: request
      });

    } catch (error) {
      console.error('Approve request error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to approve request'
      });
    }
  }
);

// @route   POST /api/requests/:id/reject
// @desc    Reject request
// @access  Private
router.post('/:id/reject', 
  authenticate, 
  objectIdValidation('id'),
  [
    body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Rejection reason is required (5-500 characters)'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const request = await Request.findById(req.params.id)
        .populate('member', 'district group');

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Request is not pending approval'
        });
      }

      // Check rejection permissions (same as approval)
      const canReject = (request.approvalLevel === 'state_admin' && req.user.role === 'state_admin') ||
        (request.approvalLevel === 'district_admin' && ['state_admin', 'district_admin'].includes(req.user.role)) ||
        (request.approvalLevel === 'group_admin' && ['state_admin', 'district_admin', 'group_admin'].includes(req.user.role));

      if (!canReject) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to reject this request'
        });
      }

      // Enforce district scoping for district_admin
      if (req.user.role === 'district_admin') {
        const userDistrictId = req.user.district?._id || req.user.district;
        const memberDistrictId = request.member?.district?._id || request.member?.district;
        if (userDistrictId?.toString() !== memberDistrictId?.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else if (isAreaLevelAdmin(req.user)) {
        // area-level group_admin: must be in own area's groups
        const areaGroupIds = await areaGroupIdsFor(req.user);
        const memberGroupId = request.member?.group?._id || request.member?.group;
        if (!areaGroupIds.map(g => g.toString()).includes(memberGroupId?.toString())) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      const { reason } = req.body;

      // Reject request
      await request.reject(req.user._id, reason);

      // Populate the rejected request
      await request.populate([
        { path: 'member', select: 'name phone district group' },
        { path: 'requestedBy', select: 'name phone role' },
        { path: 'rejectedBy', select: 'name phone role' }
      ]);

      res.status(200).json({
        success: true,
        message: 'Request rejected successfully',
        data: request
      });

    } catch (error) {
      console.error('Reject request error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reject request'
      });
    }
  }
);

// @route   POST /api/requests/:id/comment
// @desc    Add comment to request
// @access  Private
router.post('/:id/comment', 
  authenticate, 
  objectIdValidation('id'),
  [
    body('comment').trim().isLength({ min: 1, max: 500 }).withMessage('Comment is required (1-500 characters)'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const request = await Request.findById(req.params.id)
        .populate('member', 'district group');

      if (!request) {
        return res.status(404).json({
          success: false,
          message: 'Request not found'
        });
      }

      // Check access permissions
      const canComment = req.user.role === 'state_admin' ||
        request.requestedBy.toString() === req.user._id.toString() ||
        (req.user.role === 'district_admin' && request.approvalLevel === 'district_admin') ||
        (req.user.role === 'group_admin' && request.approvalLevel === 'group_admin');

      if (!canComment) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Enforce district scoping for district_admin
      if (req.user.role === 'district_admin') {
        const userDistrictId = req.user.district?._id || req.user.district;
        const memberDistrictId = request.member?.district?._id || request.member?.district;
        if (userDistrictId?.toString() !== memberDistrictId?.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else if (isAreaLevelAdmin(req.user)) {
        // area-level group_admin: must be in own area's groups
        const areaGroupIds = await areaGroupIdsFor(req.user);
        const memberGroupId = request.member?.group?._id || request.member?.group;
        if (!areaGroupIds.map(g => g.toString()).includes(memberGroupId?.toString())) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      const { comment } = req.body;

      // Add comment
      await request.addComment(req.user._id, comment);

      // Populate the updated request
      await request.populate('comments.user', 'name phone role');

      res.status(200).json({
        success: true,
        message: 'Comment added successfully',
        data: {
          comments: request.comments
        }
      });

    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add comment'
      });
    }
  }
);

export default router;
