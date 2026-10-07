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
  // Anchored — "ALAPPUZHA" must not match "AMBALAPPUZHA".
  const areaRegex = new RegExp(`^${areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const groups = await Group.find({ district: districtId, name: areaRegex }).select('_id').lean();
  return groups.map(g => g._id);
};

// Leader role hierarchy. Murabi and coordinator are area-level roles — they
// fold into "area" everywhere else too.
const AREA_LEVEL_ROLE_TYPES = ['area', 'murabi', 'coordinator'];

/**
 * Leader role types each admin may assign or change (state admin: every type):
 *   district_admin — area-level roles only (no state / district / unit)
 *   area-level     — area-level roles and unit roles in their own area
 *   unit admin     — unit roles in their own group
 */
const manageableRoleTypes = (user) => {
  switch (user?.role) {
    case 'district_admin': return AREA_LEVEL_ROLE_TYPES;
    case 'group_admin': return isAreaLevelAdmin(user) ? [...AREA_LEVEL_ROLE_TYPES, 'unit'] : ['unit'];
    default: return [];
  }
};

/** Account seniority: state 0, district 1, area-level 2, unit 3. */
const adminRankOf = (user) => {
  switch (user?.role) {
    case 'state_admin': return 0;
    case 'district_admin': return 1;
    case 'group_admin': return isAreaLevelAdmin(user) ? 2 : 3;
    default: return Infinity;
  }
};

/** May this admin assign a leader role of this type? Mirrors src/lib/roleHierarchy.ts; keep in sync. */
export const canManageRoleType = (user, type) =>
  user?.role === 'state_admin' || manageableRoleTypes(user).includes(type);

/**
 * May this admin change the leader roles of this target (a User or a Member)?
 * Every role the target already holds must be one the admin could assign, and an
 * admin account must sit below the editor — no editing peers or seniors.
 */
export const canManageLeaderTarget = (user, target) => {
  if (user?.role === 'state_admin') return true;
  if (manageableRoleTypes(user).length === 0) return false;
  if (target?.role && target.role !== 'member' && adminRankOf(target) <= adminRankOf(user)) return false;
  if (!target?.isLeader) return true;
  const held = [target.roleTag?.type, ...(target.extraRoleTags || []).map((r) => r?.type)].filter(Boolean);
  return held.every((t) => canManageRoleType(user, t));
};

/**
 * Where an admin may edit leader roles: district admins their own district,
 * area-level admins their area's groups (plus own group), unit admins their own
 * group. Returns a predicate over a Member or User, populated or not.
 */
export const leaderEditScopeFor = async (user) => {
  if (user?.role === 'state_admin') return () => true;
  const idOf = (v) => String(v?._id || v || '');
  if (user?.role === 'district_admin') {
    const mine = idOf(user.district);
    return (t) => !!mine && idOf(t?.district) === mine;
  }
  if (user?.role === 'group_admin') {
    const groups = new Set(isAreaLevelAdmin(user) ? (await areaGroupIdsFor(user)).map(String) : []);
    if (user.group) groups.add(idOf(user.group));
    return (t) => groups.has(idOf(t?.group));
  }
  return () => false;
};

const HIERARCHY_DENIED = 'This leader holds a role your level cannot change.';

/**
 * Validate a leader-role edit body ({ isLeader, roleTag, extraRoles }) against the
 * hierarchy. Returns null when allowed, else { status, message }. Checks the role
 * set as it will be AFTER the update — a bare { isLeader: true } must not revive
 * stale tags the editor could never assign.
 */
export const leaderEditError = (user, target, { isLeader, roleTag, extraRoles } = {}) => {
  if (isLeader !== undefined && typeof isLeader !== 'boolean') {
    return { status: 400, message: 'isLeader must be true or false' };
  }
  if (!canManageLeaderTarget(user, target)) return { status: 403, message: HIERARCHY_DENIED };
  // An Area Admin's main role type is their access — set on the Admins page only.
  if (target?.role === 'group_admin' && roleTag?.type && roleTag.type !== target.roleTag?.type) {
    return { status: 403, message: "An Area Admin's main role is their admin access. Change it on the Admins page." };
  }
  if (user?.role === 'state_admin') return null;

  // An admin account's primary roleTag also sets its access scope
  // (isAreaLevelAdmin, areaGroupIdsFor) — only a state admin may change it.
  const isAdminAccount = !!target?.role && target.role !== 'member';
  if (isAdminAccount && roleTag?.type && roleTag.type !== target.roleTag?.type) {
    return { status: 403, message: "Changing an admin account's primary role changes their access. Ask a State Admin." };
  }

  if (!(isLeader ?? target?.isLeader)) return null;
  const extras = Array.isArray(extraRoles) ? extraRoles : (target?.extraRoleTags || []);
  const next = [roleTag?.type || target?.roleTag?.type, ...extras.map((r) => r?.type)].filter(Boolean);
  const denied = next.find((t) => !canManageRoleType(user, t));
  return denied ? { status: 403, message: `Your role does not have permission to assign roleTag type: ${denied}` } : null;
};

// Leader directory level of a fanned-out leader row (row.roleTag = that row's
// role). State/district admins never given a role tag still count at their
// admin level, so the default "State" view includes every state admin.
const LEADER_LEVEL_BY_ROLE = { state_admin: 'state', district_admin: 'district' };

export const leaderLevelOf = (l) => l.roleTag?.type || LEADER_LEVEL_BY_ROLE[l.role];

// Role-type filter for the leader directory. "area" folds in murabi +
// coordinator — they have no separate filter in the UI.
export const matchesLeaderRoleType = (roleType) => {
  const types = roleType === 'area' ? ['area', 'murabi', 'coordinator'] : [roleType];
  return (l) => types.includes(leaderLevelOf(l));
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