import express from 'express';
import District from '../models/District.js';
import Group from '../models/Group.js';
import Member from '../models/Member.js';
import { authenticate, requireRole, requireDistrictAccess, isAreaLevelAdmin } from '../middleware/auth.js';
import { 
  createDistrictValidation,
  paginationValidation,
  objectIdValidation,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

// @route   GET /api/districts
// @desc    Get all districts
// @access  Private
router.get('/', authenticate, paginationValidation, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = 'name',
      isActive,
      search
    } = req.query;

    let filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'admin', select: 'name phone email' },
        { path: 'createdBy', select: 'name phone' }
      ]
    };

    const result = await District.paginate(filter, options);

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
    console.error('Get districts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch districts'
    });
  }
});

// @route   GET /api/districts/:id
// @desc    Get single district by ID
// @access  Private
router.get('/:id', authenticate, requireDistrictAccess, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const district = await District.findById(req.params.id)
      .populate('admin', 'name phone email')
      .populate('createdBy', 'name phone');

    if (!district) {
      return res.status(404).json({
        success: false,
        message: 'District not found'
      });
    }

    // Update and get statistics
    await district.updateStatistics();

    // Get groups in this district
    const groups = await Group.find({ district: district._id, isActive: true })
      .populate('admin', 'name phone')
      .select('name code statistics admin');

    res.status(200).json({
      success: true,
      data: {
        ...district.toObject(),
        groups
      }
    });

  } catch (error) {
    console.error('Get district error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch district'
    });
  }
});

// @route   POST /api/districts
// @desc    Create new district
// @access  Private (State Admin only)
router.post('/', authenticate, requireRole('state_admin'), createDistrictValidation, async (req, res) => {
  try {
    const districtData = req.body;

    // Check if district with same name or code already exists
    const existingDistrict = await District.findOne({
      $or: [
        { name: districtData.name },
        { code: districtData.code }
      ]
    });

    if (existingDistrict) {
      return res.status(400).json({
        success: false,
        message: 'District with this name or code already exists'
      });
    }

    // Create district
    const district = new District({
      ...districtData,
      createdBy: req.user._id
    });

    await district.save();

    // Populate the created district
    await district.populate([
      { path: 'admin', select: 'name phone email' },
      { path: 'createdBy', select: 'name phone' }
    ]);

    res.status(201).json({
      success: true,
      message: 'District created successfully',
      data: district
    });

  } catch (error) {
    console.error('Create district error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create district'
    });
  }
});

// @route   PUT /api/districts/:id
// @desc    Update district
// @access  Private (State Admin only)
router.put('/:id', 
  authenticate, 
  requireRole('state_admin'), 
  objectIdValidation('id'),
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('code').optional().trim().isLength({ min: 2, max: 10 }).isAlphanumeric(),
    body('admin').optional().isMongoId(),
    body('isActive').optional().isBoolean(),
    handleValidationErrors
  ],
  async (req, res) => {
    try {
      const district = await District.findById(req.params.id);
      
      if (!district) {
        return res.status(404).json({
          success: false,
          message: 'District not found'
        });
      }

      const updateData = req.body;

      // Check for duplicate name or code if being updated
      if (updateData.name || updateData.code) {
        const duplicateQuery = {
          _id: { $ne: district._id }
        };

        if (updateData.name) duplicateQuery.name = updateData.name;
        if (updateData.code) duplicateQuery.code = updateData.code;

        const existingDistrict = await District.findOne(duplicateQuery);
        if (existingDistrict) {
          return res.status(400).json({
            success: false,
            message: 'Another district with this name or code already exists'
          });
        }
      }

      // Update district
      Object.assign(district, updateData);
      await district.save();

      // Populate the updated district
      await district.populate([
        { path: 'admin', select: 'name phone email' },
        { path: 'createdBy', select: 'name phone' }
      ]);

      res.status(200).json({
        success: true,
        message: 'District updated successfully',
        data: district
      });

    } catch (error) {
      console.error('Update district error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update district'
      });
    }
  }
);

// @route   DELETE /api/districts/:id
// @desc    Delete district
// @access  Private (State Admin only)
router.delete('/:id', authenticate, requireRole('state_admin'), objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const district = await District.findById(req.params.id);
    
    if (!district) {
      return res.status(404).json({
        success: false,
        message: 'District not found'
      });
    }

    // Check if district has groups or members
    const groupCount = await Group.countDocuments({ district: district._id });
    const memberCount = await Member.countDocuments({ district: district._id });

    if (groupCount > 0 || memberCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete district. It has ${groupCount} groups and ${memberCount} members.`
      });
    }

    await District.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'District deleted successfully'
    });

  } catch (error) {
    console.error('Delete district error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete district'
    });
  }
});

// @route   GET /api/districts/:id/groups
// @desc    Get all groups in a district
// @access  Private
router.get('/:id/groups', authenticate, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    // Validate scoping: non-state users can only access their own district
    if (req.user.role !== 'state_admin') {
      const userDistrictId = req.user.district?._id || req.user.district;
      if (req.params.id !== userDistrictId?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { page = 1, limit = 20, sort = 'name', isActive } = req.query;

    let filter = { district: req.params.id };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'admin', select: 'name phone email' },
        { path: 'district', select: 'name code' }
      ]
    };

    const result = await Group.paginate(filter, options);

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
    console.error('Get district groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch district groups'
    });
  }
});

// @route   GET /api/districts/:id/members
// @desc    Get all members in a district
// @access  Private
router.get('/:id/members', authenticate, requireDistrictAccess, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sort = '-createdAt',
      status,
      group,
      isApproved
    } = req.query;

    let filter = { district: req.params.id };
    if (status) filter.status = status;
    if (group) filter.group = group;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'district', select: 'name code' },
        { path: 'group', select: 'name code' }
      ]
    };

    const result = await Member.paginate(filter, options);

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
    console.error('Get district members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch district members'
    });
  }
});

// @route   GET /api/districts/:id/stats
// @desc    Get district statistics
// @access  Private
router.get('/:id/stats', authenticate, requireDistrictAccess, objectIdValidation('id'), handleValidationErrors, async (req, res) => {
  try {
    const district = await District.findById(req.params.id);
    
    if (!district) {
      return res.status(404).json({
        success: false,
        message: 'District not found'
      });
    }

    // Get detailed statistics
    const stats = await Member.aggregate([
      { $match: { district: district._id } },
      {
        $group: {
          _id: null,
          totalMembers: { $sum: 1 },
          activeMembers: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          inactiveMembers: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } },
          abroadMembers: { $sum: { $cond: [{ $eq: ['$status', 'Abroad'] }, 1, 0] } },
          applicantMembers: { $sum: { $cond: [{ $eq: ['$status', 'Applicant'] }, 1, 0] } },
          approvedMembers: { $sum: { $cond: ['$isApproved', 1, 0] } },
          pendingMembers: { $sum: { $cond: [{ $not: '$isApproved' }, 1, 0] } },
          totalBaithulMaal: { $sum: '$baithulMaal.monthlyAmount' },
          averageAge: { $avg: '$age' }
        }
      }
    ]);

    // Get group-wise statistics
    const groupStats = await Group.aggregate([
      { $match: { district: district._id, isActive: true } },
      {
        $lookup: {
          from: 'members',
          localField: '_id',
          foreignField: 'group',
          as: 'members'
        }
      },
      {
        $project: {
          name: 1,
          code: 1,
          totalMembers: { $size: '$members' },
          activeMembers: {
            $size: {
              $filter: {
                input: '$members',
                cond: { $eq: ['$$this.status', 'Active'] }
              }
            }
          },
          totalBaithulMaal: {
            $sum: {
              $map: {
                input: '$members',
                as: 'member',
                in: '$$member.baithulMaal.monthlyAmount'
              }
            }
          }
        }
      },
      { $sort: { name: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        district: {
          id: district._id,
          name: district.name,
          code: district.code
        },
        statistics: stats[0] || {
          totalMembers: 0,
          activeMembers: 0,
          inactiveMembers: 0,
          abroadMembers: 0,
          applicantMembers: 0,
          approvedMembers: 0,
          pendingMembers: 0,
          totalBaithulMaal: 0,
          averageAge: 0
        },
        groupStatistics: groupStats
      }
    });

  } catch (error) {
    console.error('Get district stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch district statistics'
    });
  }
});

export default router;