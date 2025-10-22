import express from 'express';
import User from '../models/User.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { 
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users
// @access  Private (State Admin only)
router.get('/', authenticate, requireRole('state_admin'), paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      role,
      district,
      isActive
    } = req.query;

    let filter = {};
    if (role) filter.role = role;
    if (district) filter.district = district;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' }
      ]
    };

    const result = await User.paginate(filter, options);

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
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get single user by ID
// @access  Private
router.get('/:id', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('district', 'name code')
      .populate('group', 'name code district')
      .select('-otp'); // Exclude OTP data

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Users can only view their own profile unless they're state admin
    if (req.user.role !== 'state_admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put('/:id', 
  authenticate, 
  objectIdValidation('id'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').optional().isIn(['state_admin', 'district_admin', 'group_admin']),
    body('district').optional().isMongoId(),
    body('group').optional().isMongoId(),
    body('isActive').optional().isBoolean(),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check permissions
      const isSelfUpdate = req.user._id.toString() === user._id.toString();
      const isStateAdmin = req.user.role === 'state_admin';

      if (!isSelfUpdate && !isStateAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const updateData = req.body;

      // Only state admin can change role, district, group, and isActive
      if (!isStateAdmin) {
        delete updateData.role;
        delete updateData.district;
        delete updateData.group;
        delete updateData.isActive;
        delete updateData.permissions;
      }

      // Update user
      Object.assign(user, updateData);
      await user.save();

      // Populate the updated user
      await user.populate([
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code district' }
      ]);

      // Remove sensitive data
      user.otp = undefined;

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: user
      });

    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update user'
      });
    }
  }
);

// @route   POST /api/users
// @desc    Create new user (State Admin only)
// @access  Private
router.post('/', 
  authenticate, 
  requireRole('state_admin'),
  [
    body('name').trim().isLength({ min: 2, max: 100 }),
    body('phone').matches(/^\+91[6-9]\d{9}$/),
    body('email').optional().isEmail().normalizeEmail(),
    body('role').isIn(['state_admin', 'district_admin', 'group_admin']),
    body('district').optional().isMongoId(),
    body('group').optional().isMongoId(),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const userData = req.body;

      // Check if user with same phone already exists
      const existingUser = await User.findOne({ phone: userData.phone });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }

      // Create user
      const user = new User(userData);
      await user.save();

      // Populate the created user
      await user.populate([
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code district' }
      ]);

      // Remove sensitive data
      user.otp = undefined;

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user
      });

    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create user'
      });
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Delete user (State Admin only)
// @access  Private
router.delete('/:id', authenticate, requireRole('state_admin'), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting self
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

// @route   POST /api/users/:id/toggle-status
// @desc    Toggle user active status
// @access  Private (State Admin only)
router.post('/:id/toggle-status', authenticate, requireRole('state_admin'), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deactivating self
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: user._id,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle user status'
    });
  }
});

// @route   GET /api/users/stats/overview
// @desc    Get users overview statistics
// @access  Private (State Admin only)
router.get('/stats/overview', authenticate, requireRole('state_admin'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          inactiveUsers: { $sum: { $cond: [{ $not: '$isActive' }, 1, 0] } },
          stateAdmins: { $sum: { $cond: [{ $eq: ['$role', 'state_admin'] }, 1, 0] } },
          districtAdmins: { $sum: { $cond: [{ $eq: ['$role', 'district_admin'] }, 1, 0] } },
          groupAdmins: { $sum: { $cond: [{ $eq: ['$role', 'group_admin'] }, 1, 0] } }
        }
      }
    ]);

    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('district', 'name')
      .populate('group', 'name')
      .select('name phone role isActive createdAt');

    res.status(200).json({
      success: true,
      data: {
        statistics: stats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          stateAdmins: 0,
          districtAdmins: 0,
          groupAdmins: 0
        },
        recentUsers
      }
    });

  } catch (error) {
    console.error('Get users stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics'
    });
  }
});

export default router;