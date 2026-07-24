import express from 'express';
import Member from '../models/Member.js';
import { authenticate, authorize, requireAreaScope } from '../middleware/auth.js';
import { 
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// @route   GET /api/baithul-maal
// @desc    Get Baithul Maal data
// @access  Private
router.get('/', authenticate, authorize(['manage_baithul_maal']), requireAreaScope,paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-baithulMaal.monthlyAmount',
      district,
      group,
      minAmount,
      maxAmount
    } = req.query;

    let filter = { 
      status: 'Active', 
      isApproved: true,
      'baithulMaal.monthlyAmount': { $gt: 0 },
      district: { $ne: null }, // Ensure district exists
      group: { $ne: null } // Ensure group exists
    };

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      filter.group = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      filter.district = req.user.district._id;
    } else if (req.user.role === 'state_admin') {
      if (district) filter.district = district;
      if (group) filter.group = group;
    }

    // Amount filtering
    if (minAmount) {
      filter['baithulMaal.monthlyAmount'] = { 
        ...filter['baithulMaal.monthlyAmount'], 
        $gte: parseInt(minAmount) 
      };
    }
    if (maxAmount) {
      filter['baithulMaal.monthlyAmount'] = { 
        ...filter['baithulMaal.monthlyAmount'], 
        $lte: parseInt(maxAmount) 
      };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' }
      ],
      select: 'name phone baithulMaal district group joinedDate'
    };

    const result = await Member.paginate(filter, options);

    // Filter out any members where district or group population failed
    const validMembers = result.docs.filter(member => 
      member && member._id && member.district && member.group && 
      member.district.name && member.group.name
    );

    // Calculate statistics
    const stats = await Member.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          totalMonthlyAmount: { $sum: '$baithulMaal.monthlyAmount' },
          totalPaidAmount: { $sum: '$baithulMaal.totalPaid' },
          averageMonthlyAmount: { $avg: '$baithulMaal.monthlyAmount' },
          minAmount: { $min: '$baithulMaal.monthlyAmount' },
          maxAmount: { $max: '$baithulMaal.monthlyAmount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: validMembers,
      pagination: {
        currentPage: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        limit: result.limit,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      },
      statistics: stats[0] || {
        totalMembers: 0,
        totalMonthlyAmount: 0,
        totalPaidAmount: 0,
        averageMonthlyAmount: 0,
        minAmount: 0,
        maxAmount: 0
      }
    });

  } catch (error) {
    console.error('Get Baithul Maal data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Baithul Maal data'
    });
  }
});

// @route   GET /api/baithul-maal/member/:id
// @desc    Get member's Baithul Maal details
// @access  Private
router.get('/member/:id', authenticate, authorize(['manage_baithul_maal']), requireAreaScope,objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id)
      .populate('district', 'name code')
      .populate('group', 'name code')
      .select('name phone baithulMaal district group joinedDate status');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Check access permissions
    if (req.user.role === 'group_admin' &&
        member.group?._id?.toString() !== req.user.group._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view Baithul Maal data for members in your group.'
      });
    }

    if (req.user.role === 'district_admin' &&
        member.district?._id?.toString() !== req.user.district._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view Baithul Maal data for members in your district.'
      });
    }

    // Calculate additional statistics
    const contribStart = member.baithulMaal.startDate || member.joinedDate;
    const monthsActive = contribStart ?
      Math.floor((Date.now() - contribStart.getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0;
    
    const expectedTotal = monthsActive * (member.baithulMaal.monthlyAmount || 0);
    const pendingAmount = Math.max(0, expectedTotal - (member.baithulMaal.totalPaid || 0));

    res.status(200).json({
      success: true,
      data: {
        ...member.toObject(),
        calculatedStats: {
          monthsActive,
          expectedTotal,
          pendingAmount,
          paymentRate: expectedTotal > 0 ? ((member.baithulMaal.totalPaid || 0) / expectedTotal * 100).toFixed(1) : 0
        }
      }
    });

  } catch (error) {
    console.error('Get member Baithul Maal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member Baithul Maal data'
    });
  }
});

// @route   PUT /api/baithul-maal/member/:id
// @desc    Update member's Baithul Maal amount
// @access  Private
router.put('/member/:id', 
  authenticate,
  authorize(['manage_baithul_maal']),
  requireAreaScope,
  objectIdValidation('id'),
  [
    body('monthlyAmount')
      .isInt({ min: 0, max: 10000 })
      .withMessage('Monthly amount must be between 0 and 10000'),
    body('totalPaid')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Total paid must be a positive number'),
    body('lastPaymentDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid payment date'),
    body('startMonth')
      .optional()
      .matches(/^\d{4}-\d{2}$/)
      .withMessage('Start month must be in YYYY-MM format'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const member = await Member.findById(req.params.id);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      // Check access permissions
      if (req.user.role === 'group_admin' && 
          member.group?.toString() !== req.user.group._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update Baithul Maal data for members in your group.'
        });
      }

      if (req.user.role === 'district_admin' && 
          member.district?.toString() !== req.user.district._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update Baithul Maal data for members in your district.'
        });
      }

      const { monthlyAmount, totalPaid, lastPaymentDate, startMonth } = req.body;

      // Update Baithul Maal data
      member.baithulMaal = {
        ...member.baithulMaal,
        monthlyAmount: monthlyAmount !== undefined ? monthlyAmount : member.baithulMaal.monthlyAmount,
        totalPaid: totalPaid !== undefined ? totalPaid : member.baithulMaal.totalPaid,
        lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : member.baithulMaal.lastPaymentDate,
        // Admin-chosen contribution start month; pending is counted from here
        startDate: startMonth ? new Date(`${startMonth}-01`) : member.baithulMaal.startDate
      };

      member.updatedBy = req.user._id;
      await member.save();

      // Populate the updated member
      await member.populate([
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' }
      ]);

      res.status(200).json({
        success: true,
        message: 'Baithul Maal data updated successfully',
        data: member
      });

    } catch (error) {
      console.error('Update Baithul Maal error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update Baithul Maal data'
      });
    }
  }
);

// @route   POST /api/baithul-maal/member/:id/payment
// @desc    Record payment for member
// @access  Private
router.post('/member/:id/payment', 
  authenticate,
  authorize(['manage_baithul_maal']),
  requireAreaScope,
  objectIdValidation('id'),
  [
    body('amount')
      .isInt({ min: 1, max: 50000 })
      .withMessage('Payment amount must be between 1 and 50000'),
    body('paymentDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid payment date'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Notes cannot exceed 200 characters'),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const member = await Member.findById(req.params.id);

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      // Check access permissions
      if (req.user.role === 'group_admin' && 
          member.group?.toString() !== req.user.group._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only record payments for members in your group.'
        });
      }

      if (req.user.role === 'district_admin' && 
          member.district?.toString() !== req.user.district._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only record payments for members in your district.'
        });
      }

      const { amount, paymentDate, notes } = req.body;

      // Update payment data
      member.baithulMaal.totalPaid = (member.baithulMaal.totalPaid || 0) + amount;
      member.baithulMaal.lastPaymentDate = paymentDate ? new Date(paymentDate) : new Date();
      
      if (notes) {
        member.notes = member.notes ? `${member.notes}\n[${new Date().toLocaleDateString()}] Payment: ₹${amount} - ${notes}` : `Payment: ₹${amount} - ${notes}`;
      }

      member.updatedBy = req.user._id;
      await member.save();

      res.status(200).json({
        success: true,
        message: 'Payment recorded successfully',
        data: {
          memberId: member._id,
          memberName: member.name,
          paymentAmount: amount,
          totalPaid: member.baithulMaal.totalPaid,
          lastPaymentDate: member.baithulMaal.lastPaymentDate
        }
      });

    } catch (error) {
      console.error('Record payment error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to record payment'
      });
    }
  }
);

// @route   GET /api/baithul-maal/stats
// @desc    Get Baithul Maal statistics
// @access  Private
router.get('/stats', authenticate, authorize(['manage_baithul_maal']), requireAreaScope,async (req, res) => {
  try {
    let matchFilter = { 
      status: 'Active', 
      isApproved: true 
    };

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      matchFilter.group = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      matchFilter.district = req.user.district._id;
    } else if (req.user.role === 'state_admin') {
      // State admin can filter by district and group via query params
      const { district, group } = req.query;
      if (district) matchFilter.district = district;
      if (group) matchFilter.group = group;
    }

    // Overall statistics
    const overallStats = await Member.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          contributingMembers: { 
            $sum: { 
              $cond: [{ $gt: ['$baithulMaal.monthlyAmount', 0] }, 1, 0] 
            } 
          },
          totalMonthlyAmount: { $sum: '$baithulMaal.monthlyAmount' },
          totalPaidAmount: { $sum: '$baithulMaal.totalPaid' },
          averageMonthlyAmount: { $avg: '$baithulMaal.monthlyAmount' },
          minAmount: { $min: '$baithulMaal.monthlyAmount' },
          maxAmount: { $max: '$baithulMaal.monthlyAmount' }
        }
      }
    ]);

    // Amount distribution
    const amountDistribution = await Member.aggregate([
      { 
        $match: { 
          ...matchFilter, 
          'baithulMaal.monthlyAmount': { $gt: 0 } 
        } 
      },
      {
        $bucket: {
          groupBy: '$baithulMaal.monthlyAmount',
          boundaries: [0, 25, 50, 100, 200, 500, 1000, 10000],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            totalAmount: { $sum: '$baithulMaal.monthlyAmount' }
          }
        }
      }
    ]);

    // Group-wise statistics (if user can see multiple groups)
    let groupStats = [];
    if (req.user.role !== 'group_admin') {
      groupStats = await Member.aggregate([
        { $match: { ...matchFilter, 'baithulMaal.monthlyAmount': { $gt: 0 } } },
        {
          $lookup: {
            from: 'groups',
            localField: 'group',
            foreignField: '_id',
            as: 'groupInfo'
          }
        },
        { $unwind: '$groupInfo' },
        {
          $group: {
            _id: '$group',
            groupName: { $first: '$groupInfo.name' },
            groupCode: { $first: '$groupInfo.code' },
            memberCount: { $sum: 1 },
            totalMonthlyAmount: { $sum: '$baithulMaal.monthlyAmount' },
            totalPaidAmount: { $sum: '$baithulMaal.totalPaid' },
            averageAmount: { $avg: '$baithulMaal.monthlyAmount' }
          }
        },
        { $sort: { totalMonthlyAmount: -1 } }
      ]);
    }

    // Recent payments
    const recentPayments = await Member.find({
      ...matchFilter,
      'baithulMaal.lastPaymentDate': { $exists: true }
    })
    .sort({ 'baithulMaal.lastPaymentDate': -1 })
    .limit(10)
    .populate('district', 'name')
    .populate('group', 'name')
    .select('name phone baithulMaal district group');

    res.status(200).json({
      success: true,
      data: {
        overallStatistics: overallStats[0] || {
          totalMembers: 0,
          contributingMembers: 0,
          totalMonthlyAmount: 0,
          totalPaidAmount: 0,
          averageMonthlyAmount: 0,
          minAmount: 0,
          maxAmount: 0
        },
        amountDistribution,
        groupStatistics: groupStats,
        recentPayments
      }
    });

  } catch (error) {
    console.error('Get Baithul Maal stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Baithul Maal statistics'
    });
  }
});

// @route   GET /api/baithul-maal/defaulters
// @desc    Get members with pending payments
// @access  Private
router.get('/defaulters', authenticate, authorize(['manage_baithul_maal']), requireAreaScope,paginationValidation, async (req, res) => {
  try {
    const { page = 1, limit = 20, minPending = 100 } = req.query;

    let matchFilter = { 
      status: 'Active', 
      isApproved: true,
      'baithulMaal.monthlyAmount': { $gt: 0 }
    };

    // Apply role-based filtering
    if (req.user.role === 'group_admin') {
      matchFilter.group = req.user.group._id;
    } else if (req.user.role === 'district_admin') {
      matchFilter.district = req.user.district._id;
    }

    const members = await Member.aggregate([
      { $match: matchFilter },
      {
        $addFields: {
          monthsActive: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), { $ifNull: ['$baithulMaal.startDate', '$joinedDate'] }] },
                1000 * 60 * 60 * 24 * 30
              ]
            }
          }
        }
      },
      {
        $addFields: {
          expectedTotal: { 
            $multiply: ['$monthsActive', '$baithulMaal.monthlyAmount'] 
          },
          pendingAmount: {
            $subtract: [
              { $multiply: ['$monthsActive', '$baithulMaal.monthlyAmount'] },
              { $ifNull: ['$baithulMaal.totalPaid', 0] }
            ]
          }
        }
      },
      {
        $match: {
          pendingAmount: { $gte: parseInt(minPending) }
        }
      },
      {
        $lookup: {
          from: 'districts',
          localField: 'district',
          foreignField: '_id',
          as: 'districtInfo'
        }
      },
      {
        $lookup: {
          from: 'groups',
          localField: 'group',
          foreignField: '_id',
          as: 'groupInfo'
        }
      },
      {
        $project: {
          name: 1,
          phone: 1,
          'baithulMaal.monthlyAmount': 1,
          'baithulMaal.totalPaid': 1,
          'baithulMaal.lastPaymentDate': 1,
          joinedDate: 1,
          monthsActive: 1,
          expectedTotal: 1,
          pendingAmount: 1,
          district: { $arrayElemAt: ['$districtInfo', 0] },
          group: { $arrayElemAt: ['$groupInfo', 0] }
        }
      },
      { $sort: { pendingAmount: -1 } },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ]);

    // Get total count
    const totalCount = await Member.aggregate([
      { $match: matchFilter },
      {
        $addFields: {
          monthsActive: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), { $ifNull: ['$baithulMaal.startDate', '$joinedDate'] }] },
                1000 * 60 * 60 * 24 * 30
              ]
            }
          }
        }
      },
      {
        $addFields: {
          pendingAmount: {
            $subtract: [
              { $multiply: ['$monthsActive', '$baithulMaal.monthlyAmount'] },
              { $ifNull: ['$baithulMaal.totalPaid', 0] }
            ]
          }
        }
      },
      {
        $match: {
          pendingAmount: { $gte: parseInt(minPending) }
        }
      },
      { $count: 'total' }
    ]);

    const total = totalCount[0]?.total || 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      success: true,
      data: members,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalDocs: total,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get defaulters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch defaulters list'
    });
  }
});

export default router;