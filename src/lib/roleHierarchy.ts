import { isAreaLevelAdmin } from "@/lib/adminKinds";

/**
 * Leader role hierarchy. Mirrors canManageRoleType / canManageLeaderTarget in
 * solidarity-api/src/middleware/auth.js — the server enforces it; this only
 * decides what the UI offers. Keep the two in sync.
 */
export const LEADER_ROLE_TYPES = ["state", "district", "area", "unit", "murabi", "coordinator"] as const;

// Murabi and coordinator are area-level roles.
const AREA_LEVEL_ROLE_TYPES = ["area", "murabi", "coordinator"];

interface RoleTagLike {
  type?: string;
}

interface HierarchyAccount {
  role?: string | null;
  adminKind?: string | null;
  roleTag?: RoleTagLike | null;
}

interface HierarchyTarget extends HierarchyAccount {
  isLeader?: boolean;
  extraRoleTags?: RoleTagLike[];
}

const adminRankOf = (user?: HierarchyAccount | null): number => {
  switch (user?.role) {
    case "state_admin":
      return 0;
    case "district_admin":
      return 1;
    case "group_admin":
      return isAreaLevelAdmin(user) ? 2 : 3;
    default:
      return Infinity;
  }
};

/**
 * Leader role types each admin may assign or change (state admin: every type):
 * district admin — area-level only; area-level admin — area-level + unit;
 * unit admin — unit.
 */
const manageableRoleTypes = (user?: HierarchyAccount | null): string[] => {
  switch (user?.role) {
    case "district_admin":
      return AREA_LEVEL_ROLE_TYPES;
    case "group_admin":
      return isAreaLevelAdmin(user) ? [...AREA_LEVEL_ROLE_TYPES, "unit"] : ["unit"];
    default:
      return [];
  }
};

export function canManageRoleType(user: HierarchyAccount | null | undefined, type: string): boolean {
  return user?.role === "state_admin" || manageableRoleTypes(user).includes(type);
}

/** Every role the target holds, and an admin target's own account, must sit below the editor. */
export function canManageLeaderTarget(user: HierarchyAccount | null | undefined, target: HierarchyTarget): boolean {
  if (user?.role === "state_admin") return true;
  if (manageableRoleTypes(user).length === 0) return false;
  if (target.role && target.role !== "member" && adminRankOf(target) <= adminRankOf(user)) return false;
  if (!target.isLeader) return true;
  const held = [target.roleTag?.type, ...(target.extraRoleTags || []).map((r) => r?.type)].filter(Boolean) as string[];
  return held.every((t) => canManageRoleType(user, t));
}
