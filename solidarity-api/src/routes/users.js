import express from 'express';
import User from '../models/User.js';
import Member from '../models/Member.js';
import otpService from '../services/otpService.js';
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
// @access  Private (State Admin, District Admin)
router.get('/', authenticate, requireRole(['state_admin', 'district_admin']), paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = '-createdAt',
      role,
      adminKind,
      district,
      group,
      isActive,
      search
    } = req.query;

    let filter = {};
    if (role) filter.role = role;
    // Area-level admins share role 'group_admin'; adminKind narrows to one flavour
    // (area / murabi / coordinator). Legacy rows predate the field, so a request for
    // 'area' must also match documents where it was never set.
    if (adminKind) {
      filter.adminKind = adminKind === 'area'
        ? { $in: ['area', null] }
        : adminKind;
    }
    if (district) filter.district = district;
    if (group) filter.group = group;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex }
      ];
    }

    // District admins can only see users in their own district
    if (req.user.role === 'district_admin' && req.user.district) {
      filter.district = req.user.district._id || req.user.district;
    }

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

// @route   GET /api/users/leaders
// @desc    Get all leaders from both User and Member collections
// @access  Private
router.get('/leaders', authenticate, async (req, res) => {
  try {
    const {
      roleType,
      search,
      districtId,
      groupId,
      unitName,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Build filter common to both collections
    const filter = { isLeader: true };
    // roleType is filtered in JS after multi-role fan-out (extraRoleTags may match too).
    if (districtId) filter.district = districtId;
    if (groupId) filter.group = groupId;
    if (unitName) filter['roleTag.name'] = unitName;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { 'roleTag.name': { $regex: search, $options: 'i' } },
        { 'extraRoleTags.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Query both collections in parallel
    const [users, members, userCount, memberCount] = await Promise.all([
      User.find(filter)
        .select('name phone role roleTag extraRoleTags isLeader district group')
        .populate('district', 'name code')
        .populate('group', 'name code')
        .populate('roleTag.areaId', 'name code')
        .lean(),
      Member.find(filter)
        .select('name phone roleTag extraRoleTags isLeader district group')
        .populate('district', 'name code')
        .populate('group', 'name code')
        .lean(),
      User.countDocuments(filter),
      Member.countDocuments(filter),
    ]);

    // Normalize member records to match user shape
    const normalizedMembers = members.map(m => ({
      ...m,
      role: 'member',
    }));

    // Deduplicate by phone number — prefer User record over Member record
    const normalizePhone = (raw) => {
      const digits = (raw || '').replace(/\D/g, '');
      // Strip leading 91 country code for Indian numbers (result should be 10 digits)
      if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
      return digits;
    };
    const seenPhones = new Set();
    const deduped = [];
    // Add users first (higher priority)
    for (const u of users) {
      const phone = normalizePhone(u.phone);
      if (phone && seenPhones.has(phone)) continue;
      if (phone) seenPhones.add(phone);
      deduped.push(u);
    }
    // Then add members only if their phone hasn't been seen
    for (const m of normalizedMembers) {
      const phone = normalizePhone(m.phone);
      if (phone && seenPhones.has(phone)) continue;
      if (phone) seenPhones.add(phone);
      deduped.push(m);
    }

    // Multi-role fan-out: one row per role. roleSlot 0 = primary roleTag,
    // roleSlot N = extraRoleTags[N-1]. Rows carry the full extraRoleTags array
    // so the client can save slot-level edits back as a full replace.
    let expanded = [];
    for (const leader of deduped) {
      expanded.push({ ...leader, roleSlot: 0 });
      (leader.extraRoleTags || []).forEach((extra, i) => {
        if (!extra || (!extra.type && !extra.name)) return;
        expanded.push({ ...leader, roleTag: extra, roleSlot: i + 1 });
      });
    }
    if (roleType) expanded = expanded.filter((l) => l.roleTag?.type === roleType);

    // Merge, sort, and paginate.
    // Primary sort: roleTag.listingOrder ASC (leaders without a listing order sink to the bottom),
    // then by roleTag.type, then by name — so the admin-defined order wins across all dashboards.
    const normalizeOrder = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : Number.POSITIVE_INFINITY);
    const combined = expanded.sort((a, b) => {
      const orderA = normalizeOrder(a.roleTag?.listingOrder);
      const orderB = normalizeOrder(b.roleTag?.listingOrder);
      if (orderA !== orderB) return orderA - orderB;

      const typeA = a.roleTag?.type || '';
      const typeB = b.roleTag?.type || '';
      if (typeA !== typeB) return typeA.localeCompare(typeB);

      return (a.name || '').localeCompare(b.name || '');
    });

    const total = combined.length;
    const start = (pageNum - 1) * limitNum;
    const paginated = combined.slice(start, start + limitNum);

    res.status(200).json({
      success: true,
      data: paginated,
      pagination: {
        currentPage: pageNum,
        totalDocs: total,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum,
        hasNextPage: start + limitNum < total,
        hasPrevPage: pageNum > 1,
      }
    });
  } catch (error) {
    console.error('Get leaders error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leaders' });
  }
});

// @route   PATCH /api/users/:id/leader
// @desc    Update isLeader and roleTag for a user
// @access  Private (state_admin, district_admin, group_admin)
router.patch('/:id/leader',
  authenticate,
  requireRole(['state_admin', 'district_admin', 'group_admin']),
  objectIdValidation('id'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { isLeader, roleTag, extraRoles } = req.body;
      const targetUser = await User.findById(req.params.id);

      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const allowedRoleTypes = {
        state_admin: ['state', 'district', 'area', 'unit', 'murabi', 'coordinator'],
        district_admin: ['district', 'area', 'unit', 'murabi', 'coordinator'],
        group_admin: ['area', 'unit', 'murabi', 'coordinator']
      };

      const allowed = allowedRoleTypes[req.user.role] || [];
      if (roleTag && roleTag.type && !allowed.includes(roleTag.type)) {
        return res.status(403).json({
          success: false,
          message: `Your role does not have permission to assign roleTag type: ${roleTag.type}`
        });
      }
      if (Array.isArray(extraRoles)) {
        for (const r of extraRoles) {
          if (r && r.type && !allowed.includes(r.type)) {
            return res.status(403).json({
              success: false,
              message: `Your role does not have permission to assign roleTag type: ${r.type}`
            });
          }
        }
      }

      targetUser.isLeader = isLeader !== undefined ? isLeader : targetUser.isLeader;

      const toOrder = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const parsed = Number(v);
        return Number.isFinite(parsed) ? parsed : null;
      };
      if (isLeader === false) {
        targetUser.extraRoleTags = [];
      } else if (Array.isArray(extraRoles)) {
        // Full replace of additional roles (multi-role support).
        targetUser.extraRoleTags = extraRoles
          .filter((r) => r && (r.type || r.name))
          .map((r) => ({ type: r.type || undefined, name: r.name || undefined, listingOrder: toOrder(r.listingOrder) }));
      }

      if (isLeader === false) {
        targetUser.roleTag = undefined;
      } else if (roleTag) {
        // Normalise listingOrder: allow null/"" to clear it, cast strings to numbers.
        let nextListingOrder = targetUser.roleTag && targetUser.roleTag.listingOrder;
        if (roleTag.listingOrder !== undefined) {
          if (roleTag.listingOrder === null || roleTag.listingOrder === '') {
            nextListingOrder = null;
          } else {
            const parsed = Number(roleTag.listingOrder);
            nextListingOrder = Number.isFinite(parsed) ? parsed : null;
          }
        }

        targetUser.roleTag = {
          type: roleTag.type || (targetUser.roleTag && targetUser.roleTag.type),
          name: roleTag.name || (targetUser.roleTag && targetUser.roleTag.name),
          areaId: roleTag.areaId !== undefined ? (roleTag.areaId || null) : (targetUser.roleTag && targetUser.roleTag.areaId),
          roleDescription: roleTag.roleDescription !== undefined ? roleTag.roleDescription : (targetUser.roleTag && targetUser.roleTag.roleDescription),
          listingOrder: nextListingOrder
        };
      }

      await targetUser.save();

      await targetUser.populate([
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' }
      ]);

      res.status(200).json({
        success: true,
        message: 'Leader status updated successfully',
        data: targetUser
      });
    } catch (error) {
      console.error('Update leader error:', error);
      res.status(500).json({ success: false, message: 'Failed to update leader status' });
    }
  }
);

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
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('role').optional().isIn(['state_admin', 'district_admin', 'group_admin']),
    body('district').optional({ checkFalsy: true }).isMongoId(),
    body('group').optional({ checkFalsy: true }).isMongoId(),
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

      // Clean up empty string values that should be undefined for ObjectId fields
      if (updateData.district === '') {
        delete updateData.district;
      }
      if (updateData.group === '') {
        delete updateData.group;
      }
      if (updateData.email === '') {
        delete updateData.email;
      }

      // Only state admin can change role, district, group, and isActive
      if (!isStateAdmin) {
        delete updateData.role;
        delete updateData.district;
        delete updateData.group;
        delete updateData.isActive;
        delete updateData.permissions;
      }

      // Multi-role: same phone may hold other role docs. Changing role to one
      // that already exists for this phone violates the unique (phone, role)
      // index — catch it here with a friendly error instead of a raw E11000.
      if (updateData.role && updateData.role !== user.role) {
        const phoneVariants = otpService.getPhoneVariants(user.phone);
        const conflict = await User.findOne({
          phone: { $in: phoneVariants },
          role: updateData.role,
          _id: { $ne: user._id }
        });
        if (conflict) {
          return res.status(400).json({
            success: false,
            message: `This phone number already has a separate account for role: ${updateData.role}. Edit that account instead.`
          });
        }
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
    body('phone').matches(/^[6-9]\d{9}$/),  // 10 digit phone number starting with 6-9
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    body('role').isIn(['state_admin', 'district_admin', 'group_admin']),
    body('district').optional({ checkFalsy: true }).isMongoId(),
    body('group').optional({ checkFalsy: true }).isMongoId(),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const userData = req.body;

      // Check if user with same phone and role already exists.
      // Match all stored phone formats (10-digit and +91-prefixed) so the
      // unique (phone, role) index never throws a raw E11000.
      const existingUser = await User.findOne({
        phone: { $in: otpService.getPhoneVariants(userData.phone) },
        role: userData.role
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: `User with this phone number already exists for role: ${userData.role}`
        });
      }

      // Clean up empty string values that should be undefined for ObjectId fields
      if (userData.district === '') {
        delete userData.district;
      }
      if (userData.group === '') {
        delete userData.group;
      }
      if (userData.email === '') {
        delete userData.email;
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

export default router;