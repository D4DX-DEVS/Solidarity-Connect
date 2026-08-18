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

// Area-LEVEL admin: an area admin proper (roleTag.type === 'area'), or a Murabi /
// Coordinator admin — which by design have identical permissions to Area Admins.
// NOTE: adminKind === 'area' is deliberately NOT sufficient here. The migration
// backfilled adminKind='area' onto every legacy user, including unit-scoped
// group admins; treating it as the area test would silently widen their scope.
export const isAreaLevelAdmin = (user) =>
  user?.role === 'group_admin' &&
  (user.roleTag?.type === 'area' || user.adminKind === 'murabi' || user.adminKind === 'coordinator');

// The same rule as a Mongo query fragment, so listings and reports select exactly
// the users isAreaLevelAdmin() would let through.
const AREA_LEVEL_CONDITIONS = [
  { 'roleTag.type': 'area' },
  { adminKind: 'murabi' },
  { adminKind: 'coordinator' }
];

/** Which flavour of group_admin is this? Area proper unless tagged murabi/coordinator. */
export const adminKindOf = (user) =>
  user?.adminKind === 'murabi' || user?.adminKind === 'coordinator' ? user.adminKind : 'area';

/**
 * Query fragment for one slice of group_admin:
 *   'area'        — area admins proper
 *   'murabi' /
 *   'coordinator' — same permissions and area scoping as area admins, own accounts
 *   'area_level'  — all three of the above
 *   'unit'        — everything else, i.e. unit-scoped admins. Legacy rows were never
 *                   tagged roleTag.type 'unit', so this has to be a negation.
 */
export const adminKindQuery = (kind) => {
  switch (kind) {
    case 'murabi':
    case 'coordinator':
      return { role: 'group_admin', adminKind: kind };
    case 'area':
      return { role: 'group_admin', 'roleTag.type': 'area', adminKind: { $nin: ['murabi', 'coordinator'] } };
    case 'area_level':
      return { role: 'group_admin', $or: AREA_LEVEL_CONDITIONS };
    case 'unit':
      return { role: 'group_admin', $nor: AREA_LEVEL_CONDITIONS };
    default:
      return { role: 'group_admin' };
  }
};

// Groups belonging to an area-level admin's area: same district, group name
// matching the admin's area name (roleTag.roleDescription). Area admins see
// exactly these groups' members — never the whole district. Returns [] when
// the admin has no resolvable area.
export const areaGroupIdsFor = async (user) => {
  const areaName = user?.roleTag?.roleDescription;
  const districtId = user?.district?._id || user?.district;
  if (!areaName || !districtId) return [];
  const areaRegex = new RegExp(areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const groups = await Group.find({ district: districtId, name: areaRegex }).select('_id').lean();
  return groups.map(g => g._id);
};

// Target audiences whose personal targets this user owns and marks (their
// "My Targets" feed). members_only is member-app only, never a User audience.
// A district admin must NOT receive area/unit targets, and vice versa.
export const targetAudiencesFor = (user) => {
  switch (user?.role) {
    case 'state_admin':
      // State admins assign and review targets — they never receive them.
      return [];
    case 'district_admin':
      return ['all_users', 'district_admins'];
    case 'group_admin':
      return isAreaLevelAdmin(user)
        ? ['all_users', 'area_admins', 'group_and_area_admins']
        : ['all_users', 'group_admins', 'group_and_area_admins'];
    default:
      return ['all_users'];
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

// Guard scoped-role handlers that dereference req.user.group/district:
// orphaned group/district refs get a clean 403 instead of a 500 crash.
export const requireAreaScope = (req, res, next) => {
  if (req.user?.role === 'group_admin' && !req.user.group?._id) {
    return res.status(403).json({
      success: false,
      message: 'No group assigned to your account. Contact your administrator.'
    });
  }
  if (req.user?.role === 'district_admin' && !req.user.district?._id) {
    return res.status(403).json({
      success: false,
      message: 'No district assigned to your account. Contact your administrator.'
    });
  }
  next();
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