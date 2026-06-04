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

const POPULATE_OPTS = [
  { path: 'member', select: 'name phone' },
  { path: 'currentDistrict', select: 'name code' },
  { path: 'currentGroup', select: 'name code' },
  { path: 'targetDistrict', select: 'name code' },
  { path: 'targetGroup', select: 'name code' },
  { path: 'requestedBy', select: 'name phone role' },
  { path: 'sourceDistrictApproval.approvedBy', select: 'name' },
  { path: 'targetDistrictApproval.approvedBy', select: 'name' },
  { path: 'stateApproval.approvedBy', select: 'name' },
  { path: 'completedBy', select: 'name' },
  { path: 'rejectedBy', select: 'name' }
];

// Validation for creation
const createTransferValidation = [
  body('member').isMongoId().withMessage('Valid member ID is required'),
  body('targetDistrict').isMongoId().withMessage('Valid target district ID is required'),
  body('targetGroup').isMongoId().withMessage('Valid target group ID is required'),
  body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be 10–500 characters'),
  handleValidationErrors
];

const approvalValidation = [
  objectIdValidation('id'),
  body('comments').optional().trim().isLength({ max: 500 }),
  handleValidationErrors
];

// @route   GET /api/transfer-requests
// @desc    Get transfer requests filtered by role
// @access  Private
router.get('/', authenticate, paginationValidation, async (req, res) => {
  try {
    const { page = 1, limit = 20, sort = '-requestDate', member, district } = req.query;

    let filter = {};

    if (req.user.role === 'group_admin') {
      // Group admins see requests created from their group
      if (!req.user.group) {
        return res.status(500).json({ success: false, message: 'User account misconfigured: no group assigned' });
      }
      filter.currentGroup = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      // District admins see requests pending their approval
      if (!req.user.district) {
        return res.status(500).json({ success: false, message: 'User account misconfigured: no district assigned' });
      }
      const distId = req.user.district._id;
      filter.status = 'pending';
      filter.$or = [
        { currentDistrict: distId, 'sourceDistrictApproval.status': 'pending' },
        { targetDistrict: distId, 'targetDistrictApproval.status': 'pending' }
      ];
    } else if (req.user.role === 'state_admin') {
      // State admin sees requests where both district admins have approved
      filter.status = 'district_approved';
    }
    // Other roles: no results

    // Optional additional filters (don't override role-based $or for district_admin)
    if (member) filter.member = member;
    if (district && req.user.role !== 'district_admin') {
      filter.$or = [
        { currentDistrict: district },
        { targetDistrict: district }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: POPULATE_OPTS
    };

    const result = await TransferRequest.paginate(filter, options);

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
    console.error('Get transfer requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transfer requests' });
  }
});

// @route   POST /api/transfer-requests
// @desc    Create new transfer request (group_admin only)
// @access  Private
router.post('/', authenticate, authorize(['manage_members']), createTransferValidation, async (req, res) => {
  try {
    const { member: memberId, targetDistrict, targetGroup, reason } = req.body;

    // Only group_admin can create transfer requests
    if (req.user.role !== 'group_admin') {
      return res.status(403).json({ success: false, message: 'Only group admins can create transfer requests' });
    }

    const member = await Member.findById(memberId).populate('group district');
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Only allow transfers from own group
    if (member.group._id.toString() !== req.user.group._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only transfer members from your group' });
    }

    const targetDistrictDoc = await District.findById(targetDistrict);
    if (!targetDistrictDoc) {
      return res.status(400).json({ success: false, message: 'Invalid target district' });
    }

    const targetGroupDoc = await Group.findById(targetGroup).populate('district');
    if (!targetGroupDoc) {
      return res.status(400).json({ success: false, message: 'Invalid target group' });
    }

    if (targetGroupDoc.district._id.toString() !== targetDistrict) {
      return res.status(400).json({ success: false, message: 'Target group does not belong to the selected district' });
    }

    if (member.group._id.toString() === targetGroup) {
      return res.status(400).json({ success: false, message: 'Member is already in the target group' });
    }

    // Check for existing active request
    const existingRequest = await TransferRequest.findOne({
      member: memberId,
      status: { $in: ['pending', 'district_approved'] }
    });
    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'There is already an active transfer request for this member' });
    }

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
    await transferRequest.populate(POPULATE_OPTS);

    res.status(201).json({
      success: true,
      message: 'Transfer request submitted successfully',
      data: transferRequest
    });

  } catch (error) {
    console.error('Create transfer request error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create transfer request' });
  }
});

// @route   POST /api/transfer-requests/:id/approve
// @desc    Approve a transfer request
//          - District admin: advances district approval stage
//          - State admin: final approval + immediately completes (member data updated)
// @access  Private
router.post('/:id/approve', authenticate, authorize(['manage_members']), approvalValidation, async (req, res) => {
  try {
    const { comments } = req.body;

    const transferRequest = await TransferRequest.findById(req.params.id).populate(POPULATE_OPTS);
    if (!transferRequest) {
      return res.status(404).json({ success: false, message: 'Transfer request not found' });
    }

    if (!transferRequest.canApprove(req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to approve this transfer at this stage' });
    }

    await transferRequest.approve(req.user, comments);

    const msg = req.user.role === 'state_admin'
      ? 'Transfer completed — member has been moved'
      : 'Transfer approved — forwarded to next approval stage';

    res.status(200).json({ success: true, message: msg, data: transferRequest });

  } catch (error) {
    console.error('Approve transfer error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to approve transfer request' });
  }
});

// @route   POST /api/transfer-requests/:id/reject
// @desc    Reject a transfer request
// @access  Private
router.post('/:id/reject', authenticate, authorize(['manage_members']), [
  objectIdValidation('id'),
  body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Rejection reason must be 5–500 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { reason } = req.body;

    const transferRequest = await TransferRequest.findById(req.params.id).populate(POPULATE_OPTS);
    if (!transferRequest) {
      return res.status(404).json({ success: false, message: 'Transfer request not found' });
    }

    // Check the user can act on this request
    const canAct =
      req.user.role === 'state_admin' ||
      (req.user.role === 'district_admin' && (
        req.user.district?._id?.toString() === transferRequest.currentDistrict?._id?.toString() ||
        req.user.district?._id?.toString() === transferRequest.targetDistrict?._id?.toString()
      ));

    if (!canAct) {
      return res.status(403).json({ success: false, message: 'You do not have permission to reject this transfer request' });
    }

    await transferRequest.reject(req.user, reason);

    res.status(200).json({ success: true, message: 'Transfer request rejected', data: transferRequest });

  } catch (error) {
    console.error('Reject transfer error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to reject transfer request' });
  }
});

// @route   GET /api/transfer-requests/:id
// @desc    Get a single transfer request
// @access  Private
router.get('/:id', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const transferRequest = await TransferRequest.findById(req.params.id).populate(POPULATE_OPTS);
    if (!transferRequest) {
      return res.status(404).json({ success: false, message: 'Transfer request not found' });
    }

    // Access check
    let hasAccess = req.user.role === 'state_admin';
    if (req.user.role === 'district_admin') {
      const distId = req.user.district?._id?.toString();
      hasAccess =
        transferRequest.currentDistrict?._id?.toString() === distId ||
        transferRequest.targetDistrict?._id?.toString() === distId;
    } else if (req.user.role === 'group_admin') {
      hasAccess = transferRequest.currentGroup?._id?.toString() === req.user.group?._id?.toString();
    }

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({ success: true, data: transferRequest });

  } catch (error) {
    console.error('Get transfer request error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transfer request' });
  }
});

export default router;
