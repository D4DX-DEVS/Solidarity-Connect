import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Group from '../models/Group.js';
import District from '../models/District.js';

// Verify JWT token
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id)
      .populate('district', 'name code')
      .populate('group', 'name code district');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not active.'
      });
    }

    // Handle orphan references: if group_admin's district/group populate failed,
    // try to resolve from roleTag.roleDescription (area name matching a group)
    if (user.role === 'group_admin' && !user.group) {
      const roleDesc = user.roleTag?.roleDescription;
      if (roleDesc) {
        const regex = new RegExp(`^${roleDesc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const matchedGroup = await Group.findOne({ name: regex })
          .select('name code district')
          .populate('district', 'name code')
          .lean();
        if (matchedGroup) {
          user.group = { _id: matchedGroup._id, name: matchedGroup.name, code: matchedGroup.code };
          if (!user.district && matchedGroup.district) {
            user.district = matchedGroup.district;
          }
        }
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication error.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Check if user has required permission
export const authorize = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.',
        required: permissions,
        userPermissions
      });
    }

    next();
  };
};

// Check if user has specific role
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const userRole = req.user.role;
    const hasRole = Array.isArray(roles) ? roles.includes(userRole) : roles === userRole;

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient role privileges.',
        required: roles,
        userRole
      });
    }

    next();
  };
};

// Check if user can access specific district
export const requireDistrictAccess = (req, res, next) => {
  const { districtId } = req.params;
  const user = req.user;

  // State admin can access all districts
  if (user.role === 'state_admin') {
    return next();
  }

  // District admin can only access their district
  if (user.role === 'district_admin') {
    if (!user.district || user.district._id.toString() !== districtId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your assigned district.'
      });
    }
    return next();
  }

  // Group admin can only access their district
  if (user.role === 'group_admin') {
    if (!user.district || user.district._id.toString() !== districtId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your district.'
      });
    }
    return next();
  }

  res.status(403).json({
    success: false,
    message: 'Access denied.'
  });
};

// Check if user can access specific group
export const requireGroupAccess = (req, res, next) => {
  const { groupId, id } = req.params;
  const targetGroupId = groupId || id; // Handle both :groupId and :id parameters
  const user = req.user;

  // State admin can access all groups
  if (user.role === 'state_admin') {
    return next();
  }

  // District admin can access groups in their district
  if (user.role === 'district_admin') {
    // This will be validated in the route handler by checking group's district
    return next();
  }

  // Group admin can only access their group
  if (user.role === 'group_admin') {
    if (!user.group || user.group._id.toString() !== targetGroupId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your assigned group.'
      });
    }
    return next();
  }

  res.status(403).json({
    success: false,
    message: 'Access denied.'
  });
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id)
        .populate('district', 'name code')
        .populate('group', 'name code district');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

export default {
  authenticate,
  authorize,
  requireRole,
  requireDistrictAccess,
  requireGroupAccess,
  optionalAuth
};