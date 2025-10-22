import express from 'express';
import BaithulMaalPayment from '../models/BaithulMaalPayment.js';
import Member from '../models/Member.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { 
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// Validation for payment creation
const createPaymentValidation = [
  body('member')
    .isMongoId()
    .withMessage('Valid member ID is required'),
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      if (Number(value) <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      return true;
    }),
  body('paymentMonth')
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('Payment month must be in YYYY-MM format'),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid payment date'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  handleValidationErrors
];

// Validation for payment update
const updatePaymentValidation = [
  objectIdValidation('id'),
  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => {
      if (value && Number(value) <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      return true;
    }),
  body('paymentMonth')
    .optional()
    .matches(/^\d{4}-\d{2}$/)
    .withMessage('Payment month must be in YYYY-MM format'),
  body('paymentDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid payment date'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  handleValidationErrors
];

// @route   GET /api/baithul-maal-payments
// @desc    Get all payments with filtering and pagination
// @access  Private
router.get('/', authenticate, paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-paymentDate',
      member,
      paymentMonth,
      paymentType,
      startDate,
      endDate
    } = req.query;

    // Build filter based on user role
    let filter = { isActive: true };
    
    if (req.user.role === 'group_admin') {
      // Group admin can only see payments for their group members
      const groupMembers = await Member.find({ group: req.user.group._id }).select('_id');
      filter.member = { $in: groupMembers.map(m => m._id) };
    } else if (req.user.role === 'district_admin') {
      // District admin can only see payments for their district members
      const districtMembers = await Member.find({ district: req.user.district._id }).select('_id');
      filter.member = { $in: districtMembers.map(m => m._id) };
    }

    // Apply additional filters
    if (member) filter.member = member;
    if (paymentMonth) filter.paymentMonth = paymentMonth;
    if (paymentType) filter.paymentType = paymentType;

    // Date range filter
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { 
          path: 'member', 
          select: 'name phone group district',
          populate: [
            { path: 'group', select: 'name code' },
            { path: 'district', select: 'name code' }
          ]
        },
        { path: 'recordedBy', select: 'name phone' },
        { path: 'updatedBy', select: 'name phone' }
      ]
    };

    const result = await BaithulMaalPayment.paginate(filter, options);

    // Calculate summary statistics
    const stats = await BaithulMaalPayment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalPayments: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
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
      statistics: stats[0] || { totalAmount: 0, totalPayments: 0, avgAmount: 0 }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments'
    });
  }
});

// @route   GET /api/baithul-maal-payments/member/:memberId
// @desc    Get payment history for a specific member
// @access  Private
router.get('/member/:memberId', authenticate, objectIdValidation('memberId'), handleValidationErrors, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { page = 1, limit = 20, sort = '-paymentDate' } = req.query;

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
        message: 'Access denied. You can only view payments for members in your group.'
      });
    }

    if (req.user.role === 'district_admin' && member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view payments for members in your district.'
      });
    }

    const filter = { member: memberId, isActive: true };
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'recordedBy', select: 'name phone' },
        { path: 'updatedBy', select: 'name phone' }
      ]
    };

    const result = await BaithulMaalPayment.paginate(filter, options);

    // Get payment summary
    const summary = await BaithulMaalPayment.calculateMemberTotal(memberId);

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
      member: {
        _id: member._id,
        name: member.name,
        phone: member.phone,
        monthlyAmount: member.baithulMaal?.monthlyAmount || 0
      },
      summary
    });

  } catch (error) {
    console.error('Get member payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member payments'
    });
  }
});

// @route   POST /api/baithul-maal-payments
// @desc    Create new payment record
// @access  Private
router.post('/', authenticate, authorize(['manage_members']), createPaymentValidation, async (req, res) => {
  try {
    const paymentData = req.body;

    // Check if member exists and user has access
    const member = await Member.findById(paymentData.member).populate('group district');
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
        message: 'Access denied. You can only add payments for members in your group.'
      });
    }

    if (req.user.role === 'district_admin' && member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only add payments for members in your district.'
      });
    }

    // Check for duplicate payment for the same month
    const existingPayment = await BaithulMaalPayment.findOne({
      member: paymentData.member,
      paymentMonth: paymentData.paymentMonth,
      isActive: true
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: `Payment for ${paymentData.paymentMonth} already exists. Please update the existing payment or choose a different month.`
      });
    }

    // Create payment with defaults for simplified fields
    const payment = new BaithulMaalPayment({
      ...paymentData,
      paymentType: 'monthly', // Default to monthly
      paymentMethod: 'cash',  // Default to cash
      recordedBy: req.user._id
    });

    await payment.save();

    // Populate the created payment
    await payment.populate([
      { 
        path: 'member', 
        select: 'name phone',
        populate: [
          { path: 'group', select: 'name code' },
          { path: 'district', select: 'name code' }
        ]
      },
      { path: 'recordedBy', select: 'name phone' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment
    });

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record payment'
    });
  }
});

// @route   PUT /api/baithul-maal-payments/:id
// @desc    Update payment record
// @access  Private
router.put('/:id', authenticate, authorize(['manage_members']), updatePaymentValidation, async (req, res) => {
  try {
    const payment = await BaithulMaalPayment.findById(req.params.id).populate({
      path: 'member',
      populate: [
        { path: 'group', select: 'name code' },
        { path: 'district', select: 'name code' }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    if (!payment.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update deleted payment record'
      });
    }

    // Check access permissions
    if (req.user.role === 'group_admin' && payment.member.group._id.toString() !== req.user.group._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update payments for members in your group.'
      });
    }

    if (req.user.role === 'district_admin' && payment.member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update payments for members in your district.'
      });
    }

    const updateData = req.body;

    // Check for duplicate payment month if being updated
    if (updateData.paymentMonth && updateData.paymentMonth !== payment.paymentMonth) {
      const existingPayment = await BaithulMaalPayment.findOne({
        member: payment.member._id,
        paymentMonth: updateData.paymentMonth,
        isActive: true,
        _id: { $ne: payment._id }
      });

      if (existingPayment) {
        return res.status(400).json({
          success: false,
          message: `Payment for ${updateData.paymentMonth} already exists.`
        });
      }
    }

    // Update payment
    Object.assign(payment, updateData);
    payment.updatedBy = req.user._id;

    await payment.save();

    // Populate the updated payment
    await payment.populate([
      { path: 'recordedBy', select: 'name phone' },
      { path: 'updatedBy', select: 'name phone' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: payment
    });

  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update payment'
    });
  }
});

// @route   DELETE /api/baithul-maal-payments/:id
// @desc    Delete (soft delete) payment record
// @access  Private
router.delete('/:id', authenticate, authorize(['manage_members']), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const payment = await BaithulMaalPayment.findById(req.params.id).populate({
      path: 'member',
      populate: [
        { path: 'group', select: 'name code' },
        { path: 'district', select: 'name code' }
      ]
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    if (!payment.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Payment record is already deleted'
      });
    }

    // Check access permissions
    if (req.user.role === 'group_admin' && payment.member.group._id.toString() !== req.user.group._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete payments for members in your group.'
      });
    }

    if (req.user.role === 'district_admin' && payment.member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete payments for members in your district.'
      });
    }

    // Soft delete
    payment.isActive = false;
    payment.updatedBy = req.user._id;
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Payment record deleted successfully'
    });

  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment record'
    });
  }
});

// @route   GET /api/baithul-maal-payments/summary/:memberId
// @desc    Get payment summary for a member
// @access  Private
router.get('/summary/:memberId', authenticate, objectIdValidation('memberId'), handleValidationErrors, async (req, res) => {
  try {
    const { memberId } = req.params;
    const { startDate, endDate } = req.query;

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
        message: 'Access denied'
      });
    }

    if (req.user.role === 'district_admin' && member.district._id.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const summary = await BaithulMaalPayment.getPaymentSummary(memberId, startDate, endDate);
    const total = await BaithulMaalPayment.calculateMemberTotal(memberId);

    res.status(200).json({
      success: true,
      data: {
        member: {
          _id: member._id,
          name: member.name,
          phone: member.phone,
          monthlyAmount: member.baithulMaal?.monthlyAmount || 0
        },
        monthlyBreakdown: summary,
        totalSummary: total
      }
    });

  } catch (error) {
    console.error('Get payment summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment summary'
    });
  }
});

export default router;