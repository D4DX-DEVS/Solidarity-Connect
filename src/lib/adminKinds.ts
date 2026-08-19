import { Building2, MapPinned, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Area-level admins come in three flavours. Murabi Admin and Coordinator Admin have
 * exactly the same permissions as Area Admin, so on the server they are all
 * role: "group_admin" and are told apart by `adminKind`. Everything user-facing —
 * labels, icons, filters, the login account picker — reads from here.
 */
export type AdminKind = "area" | "murabi" | "coordinator";

export type AppRole = "state_admin" | "district_admin" | "group_admin" | "member";

export const ADMIN_KINDS: readonly AdminKind[] = ["area", "murabi", "coordinator"] as const;

interface RoleDisplay {
  label: string;
  hint: string;
  icon: LucideIcon;
}

// Murabi and Coordinator admins are the same thing as Area Admin — one login,
// one label. adminKind survives only as a legacy data field on old accounts.
const AREA_ADMIN_DISPLAY: RoleDisplay = { label: "Area Admin", hint: "Area level", icon: ShieldCheck };

const ROLE_DISPLAY: Record<Exclude<AppRole, "group_admin">, RoleDisplay> = {
  state_admin: { label: "State Admin", hint: "State level", icon: Building2 },
  district_admin: { label: "District Admin", hint: "District level", icon: MapPinned },
  member: { label: "Member", hint: "Personal access", icon: UserRound },
};

const FALLBACK: RoleDisplay = { label: "Account", hint: "", icon: UserRound };

/** Label, hint and icon for an account. All area-level kinds display as Area Admin. */
export function getRoleDisplay(role?: string | null, _adminKind?: string | null): RoleDisplay {
  if (role === "group_admin") {
    return AREA_ADMIN_DISPLAY;
  }
  return ROLE_DISPLAY[role as Exclude<AppRole, "group_admin">] ?? FALLBACK;
}

export function getRoleLabel(role?: string | null, adminKind?: string | null): string {
  return getRoleDisplay(role, adminKind).label;
}

/**
 * Area-LEVEL admin: an area admin proper (roleTag.type === 'area'), or a Murabi /
 * Coordinator admin — identical permissions by design. Mirrors isAreaLevelAdmin in
 * solidarity-api/src/middleware/auth.js; keep the two in sync.
 * NOTE: adminKind === 'area' is NOT sufficient — legacy unit admins were backfilled
 * with adminKind 'area' too, and they must stay unit-scoped.
 */
export function isAreaLevelAdmin(
  user?: { role?: string | null; adminKind?: string | null; roleTag?: { type?: string } | null } | null
): boolean {
  if (user?.role !== "group_admin") return false;
  return user.roleTag?.type === "area" || user.adminKind === "murabi" || user.adminKind === "coordinator";
}

/**
 * Options for role/scope filters, e.g. the Role Management directory dropdown.
 * Area-level kinds are listed separately so a filter can target just Murabi
 * admins even though they share a `role` with everyone else at area level.
 */
export const ROLE_FILTER_OPTIONS = [
  { value: "all", label: "All Roles", role: null, adminKind: null },
  { value: "state_admin", label: "State Admins", role: "state_admin", adminKind: null },
  { value: "district_admin", label: "District Admins", role: "district_admin", adminKind: null },
  { value: "group_admin", label: "Area Admins", role: "group_admin", adminKind: null },
  { value: "member", label: "Members", role: "member", adminKind: null },
] as const;
