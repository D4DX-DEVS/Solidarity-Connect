import express from 'express';
import TransferRequest from '../models/TransferRequest.js';
import Member from '../models/Member.js';
import District from '../models/District.js';
import Group from '../models/Group.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { 
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// Helper: is user an area admin?
const isAreaAdmin = (user) =>
  user.role === 'group_admin' && user.roleTag?.type === 'area';

// Validation for transfer request creation
const createTransferValidation = [
  body('member')
    .isMongoId()
    .withMessage('Valid member ID is required'),
  body('targetDistrict')
    .isMongoId()
    .withMessage('Valid target district ID is required'),
  body('targetGroup')
    .isMongoId()
    .withMessage('Valid target group ID is required'),
  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  handleValidationErrors
];

// Validation for approval/rejection
const approvalValidation = [
  objectIdValidation('id'),
  body('comments')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comments cannot exceed 500 characters'),
  handleValidationErrors
];

// @route   GET /api/transfer-requests
// @desc    Get transfer requests with filtering and pagination
// @access  Private
router.get('/', authenticate, paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-requestDate',
      status,
      member,
      district
    } = req.query;

    // Build filter based on user role (3-tier hierarchy)
    let filter = {};
    
    if (isAreaAdmin(req.user)) {
      // Area admin sees only transfers from their group at area-pending stage
      filter.currentGroup = req.user.group._id;
      filter['areaApproval.status'] = 'pending';
      filter.status = 'pending';
    } else if (req.user.role === 'district_admin') {
      // District admin sees transfers waiting at district tier (area already approved)
      filter['areaApproval.status'] = 'approved';
      filter['districtApproval.status'] = 'pending';
      filter.status = 'area_approved';
      filter.$or = [
        { currentDistrict: req.user.district._id },
        { targetDistrict: req.user.district._id }
      ];
    } else if (req.user.role === 'group_admin') {
      // Non-area group_admin: sees only their group's requests
      filter.currentGroup = req.user.group._id;
    }
    // State admin sees all transfers (no role filter — filtered by status/query params below)

    // Apply additional filters
    if (status) filter.status = status;
    if (member) filter.member = member;
    if (district) {
      filter.$or = [
        { currentDistrict: district },
        { targetDistrict: district }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'member', select: 'name phone' },
        { path: 'currentDistrict', select: 'name code' },
        { path: 'currentGroup', select: 'name code' },
        { path: 'targetDistrict', select: 'name code' },
        { path: 'targetGroup', select: 'name code' },
        { path: 'requestedBy', select: 'name phone role' },
        { path: 'areaApproval.approvedBy', select: 'name phone' },
        { path: 'districtApproval.approvedBy', select: 'name phone' },
        { path: 'stateApproval.approvedBy', select: 'name phone' },
        { path: 'completedBy', select: 'name phone' },
        { path: 'rejectedBy', select: 'name phone' }
      ]
    };

    const result = await TransferRequest.paginate(filter, options);

    // Calculate statistics
    const stats = await TransferRequest.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
        }
      }
    ]);

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
      },
      statistics: stats[0] || { total: 0, pending: 0, approved: 0, completed: 0, rejected: 0 }
    });

  } catch (error) {
    console.error('Get transfer requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer requests'
    });
  }
});

// @route   GET /api/transfer-requests/pending
// @desc    Get pending transfer requests for current user
// @access  Private
router.get('/pending', authenticate, async (req, res) => {
  try {
    const pendingTransfers = await TransferRequest.getPendingForUser(req.user);

    res.status(200).json({
      success: true,
      data: pendingTransfers
    });

  } catch (error) {
    console.error('Get pending transfers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending transfers'
    });
  }
});

// @route   POST /api/transfer-requests
// @desc    Create new transfer request
// @access  Private
router.post('/', authenticate, authorize(['manage_members']), createTransferValidation, async (req, res) => {
  try {
    const { member: memberId, targetDistrict, targetGroup, reason } = req.body;

    // Check if member exists and user has access
    const member = await Member.findById(memberId).populate('group district');
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'group_admin' && member.group._id.toString() !== req.user.group._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only transfer members from your group.'
      });
    }

    if (req.user.role === 'district_admin' && member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only transfer members from your district.'
      });
    }

    // Validate target district and group
    const targetDistrictDoc = await District.findById(targetDistrict);
    if (!targetDistrictDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid target district'
      });
    }

    const targetGroupDoc = await Group.findById(targetGroup).populate('district');
    if (!targetGroupDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid target group'
      });
    }

    // Ensure target group belongs to target district
    if (targetGroupDoc.district._id.toString() !== targetDistrict) {
      return res.status(400).json({
        success: false,
        message: 'Target group does not belong to the selected district'
      });
    }

    // Check if member is already in the target group
    if (member.group._id.toString() === targetGroup) {
      return res.status(400).json({
        success: false,
        message: 'Member is already in the target group'
      });
    }

    // Check for existing pending transfer request for this member
    const existingRequest = await TransferRequest.findOne({
      member: memberId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'There is already a pending transfer request for this member'
      });
    }

    // Create transfer request
    const transferRequest = new TransferRequest({
      member: memberId,
      currentDistrict: member.district._id,
      currentGroup: member.group._id,
      targetDistrict,
      targetGroup,
      reason,
      requestedBy: req.user._id
    });

    await transferRequest.save();

    // Populate the created request
    await transferRequest.populate([
      { path: 'member', select: 'name phone' },
      { path: 'currentDistrict', select: 'name code' },
      { path: 'currentGroup', select: 'name code' },
      { path: 'targetDistrict', select: 'name code' },
      { path: 'targetGroup', select: 'name code' },
      { path: 'requestedBy', select: 'name phone role' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Transfer request submitted successfully',
      data: transferRequest
    });

  } catch (error) {
    console.error('Create transfer request error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create transfer request'
    });
  }
});

// @route   POST /api/transfer-requests/:id/approve
// @desc    Approve transfer request
// @access  Private
router.post('/:id/approve', authenticate, authorize(['manage_members']), approvalValidation, async (req, res) => {
  try {
    const { comments } = req.body;

    const transferRequest = await TransferRequest.findById(req.params.id)
      .populate('member', 'name phone')
      .populate('currentDistrict', 'name code')
      .populate('currentGroup', 'name code')
      .populate('targetDistrict', 'name code')
      .populate('targetGroup', 'name code');

    if (!transferRequest) {
      return res.status(404).json({
        success: false,
        message: 'Transfer request not found'
      });
    }

    // Check if user can approve this transfer
    if (!transferRequest.canApprove(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to approve this transfer request'
      });
    }

    await transferRequest.approve(req.user, comments);

    res.status(200).json({
      success: true,
      message: 'Transfer request approved successfully',
      data: transferRequest
    });

  } catch (error) {
    console.error('Approve transfer error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to approve transfer request'
    });
  }
});

// @route   POST /api/transfer-requests/:id/reject
// @desc    Reject transfer request
// @access  Private
router.post('/:id/reject', authenticate, authorize(['manage_members']), [
  objectIdValidation('id'),
  body('reason')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Rejection reason must be between 5 and 500 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { reason } = req.body;

    const transferRequest = await TransferRequest.findById(req.params.id)
      .populate('member', 'name phone')
      .populate('currentDistrict', 'name code')
      .populate('currentGroup', 'name code')
      .populate('targetDistrict', 'name code')
      .populate('targetGroup', 'name code');

    if (!transferRequest) {
      return res.status(404).json({
        success: false,
        message: 'Transfer request not found'
      });
    }

    // Check if user can reject this transfer
    if (!transferRequest.canApprove(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to reject this transfer request'
      });
    }

    await transferRequest.reject(req.user, reason);

    res.status(200).json({
      success: true,
      message: 'Transfer request rejected successfully',
      data: transferRequest
    });

  } catch (error) {
    console.error('Reject transfer error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reject transfer request'
    });
  }
});

// @route   POST /api/transfer-requests/:id/complete
// @desc    Complete approved transfer (actually move the member)
// @access  Private
router.post('/:id/complete', authenticate, authorize(['manage_members']), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const transferRequest = await TransferRequest.findById(req.params.id)
      .populate('member', 'name phone')
      .populate('currentDistrict', 'name code')
      .populate('currentGroup', 'name code')
      .populate('targetDistrict', 'name code')
      .populate('targetGroup', 'name code');

    if (!transferRequest) {
      return res.status(404).json({
        success: false,
        message: 'Transfer request not found'
      });
    }

    await transferRequest.complete(req.user);

    res.status(200).json({
      success: true,
      message: 'Transfer completed successfully',
      data: transferRequest
    });

  } catch (error) {
    console.error('Complete transfer error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to complete transfer'
    });
  }
});

// @route   GET /api/transfer-requests/:id
// @desc    Get single transfer request
// @access  Private
router.get('/:id', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const transferRequest = await TransferRequest.findById(req.params.id)
      .populate('member', 'name phone')
      .populate('currentDistrict', 'name code')
      .populate('currentGroup', 'name code')
      .populate('targetDistrict', 'name code')
      .populate('targetGroup', 'name code')
      .populate('requestedBy', 'name phone role')
      .populate('areaApproval.approvedBy', 'name phone')
      .populate('districtApproval.approvedBy', 'name phone')
      .populate('stateApproval.approvedBy', 'name phone')
      .populate('completedBy', 'name phone')
      .populate('rejectedBy', 'name phone');

    if (!transferRequest) {
      return res.status(404).json({
        success: false,
        message: 'Transfer request not found'
      });
    }

    // Check access permissions
    let hasAccess = false;
    
    if (req.user.role === 'state_admin') {
      hasAccess = true;
    } else if (req.user.role === 'district_admin') {
      hasAccess = transferRequest.currentDistrict._id.toString() === req.user.district._id.toString() ||
                  transferRequest.targetDistrict._id.toString() === req.user.district._id.toString();
    } else if (req.user.role === 'group_admin') {
      hasAccess = transferRequest.currentGroup._id.toString() === req.user.group._id.toString();
    }

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: transferRequest
    });

  } catch (error) {
    console.error('Get transfer request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transfer request'
    });
  }
});

export default router;