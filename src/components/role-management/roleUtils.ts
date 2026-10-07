import { getRoleLabel } from "@/lib/adminKinds";

export const ROLE_TYPE_LABELS: Record<string, string> = {
  state: "State",
  district: "District",
  area: "Area",
  unit: "Unit",
  murabi: "Murabi",
  coordinator: "Coordinator",
};

export const ROLE_TYPE_COLORS: Record<string, string> = {
  state: "bg-purple-100 text-purple-800",
  district: "bg-blue-100 text-blue-800",
  area: "bg-green-100 text-green-800",
  unit: "bg-orange-100 text-orange-800",
  murabi: "bg-teal-100 text-teal-800",
  coordinator: "bg-indigo-100 text-indigo-800",
};

export interface RoleTagLike {
  type?: string;
  name?: string;
  listingOrder?: number | null;
}

/** Another record of the same person (same phone) — an admin login or their member record. */
export interface LinkedRecord {
  _id: string;
  role: string; // "member" for the member record
  adminKind?: string | null;
}

/** The record a person's leader roles are held on, with those roles. */
export interface LeaderHolder extends LinkedRecord {
  isLeader?: boolean;
  roleTag?: RoleTagLike;
  extraRoleTags?: RoleTagLike[];
}

/** "District Admin" / "Member record" — the record a person's leader roles are managed on. */
export const recordTitle = (r: LinkedRecord) => (r.role === "member" ? "Member record" : getRoleLabel(r.role, r.adminKind));

/** "District Admin account" / "member record", for sentences. */
export const recordName = (r: LinkedRecord) => (r.role === "member" ? "member record" : `${recordTitle(r)} account`);

/** One admin login of a person listed once in All Roles (groupBy=person). */
export interface AdminAccount extends LinkedRecord {
  district?: { name: string } | null;
  group?: { name: string } | null;
  /** Where this person's leader roles are edited — decided by the server. */
  managesLeaderRoles?: boolean;
  /** Listed as a leader — false for an Area Admin account none of the person's roles fits. */
  isLeader?: boolean;
}

export interface UserWithLeader {
  _id: string;
  name: string;
  phone: string;
  role?: string;
  // Distinguishes Area / Murabi / Coordinator admins, which all share role 'group_admin'.
  adminKind?: string | null;
  status?: string; // for members
  isLeader: boolean;
  roleTag?: RoleTagLike;
  extraRoleTags?: RoleTagLike[];
  canEdit?: boolean; // leaders view: server-decided (scope + hierarchy) for the whole person
  roleSlot?: number; // leaders view fan-out: 0 = primary role, N = extraRoleTags[N-1]
  district?: { name: string };
  group?: { name: string };
  // Role Management lists (withLinks=true): the person's other admin logins, and the
  // record their leader roles are edited on when it isn't this one (null when it is).
  linkedAccounts?: LinkedRecord[];
  leaderRecord?: LeaderHolder | null;
  // All Roles lists one row per person: this row is the login their roles are edited on,
  // and accounts are all their admin logins, most senior first.
  accounts?: AdminAccount[];
}

/** Search value that finds every record of a phone, stored with or without +91. */
export const phoneSearchKey = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
};

export interface ExtraRoleEdit {
  type: string;
  name: string;
  listingOrder: string;
}

export interface EditState {
  isLeader: boolean;
  roleTagType: string;
  roleTagName: string;
  listingOrder: string; // kept as string for a controlled input; empty means "no order"
  extraRoles: ExtraRoleEdit[];
}

export interface LeaderGroup {
  key: string;
  label: string;
  leaders: UserWithLeader[];
}

interface RoleTagPayload {
  type?: string;
  name?: string;
  listingOrder: number | null;
}

export interface LeaderSavePayload {
  isLeader: boolean;
  roleTag?: RoleTagPayload;
  extraRoles?: RoleTagPayload[];
}

// Leaders view fans a multi-role leader into one row per role sharing the same
// _id, so edit states are keyed by _id + roleSlot.
export const rowKey = (user: UserWithLeader) => (user.roleSlot ? `${user._id}#${user.roleSlot}` : user._id);

export const buildExtraRoleEdits = (user: UserWithLeader): ExtraRoleEdit[] =>
  (user.extraRoleTags || []).map((r) => ({
    type: r.type || "",
    name: r.name || "",
    listingOrder: typeof r.listingOrder === "number" ? String(r.listingOrder) : "",
  }));

export const buildEditState = (user: UserWithLeader): EditState => ({
  isLeader: user.isLeader || false,
  roleTagType: user.roleTag?.type || "",
  roleTagName: user.roleTag?.name || "",
  listingOrder: typeof user.roleTag?.listingOrder === "number" ? String(user.roleTag.listingOrder) : "",
  extraRoles: buildExtraRoleEdits(user),
});

export const toOrderValue = (raw: string): number | null => {
  const trimmed = raw.trim();
  return trimmed === "" ? null : Number(trimmed);
};

/** Leaders-directory rows (one per role, roleSlot set) — they never edit the person's other roles. */
const isFanOutRow = (user: UserWithLeader) => user.roleSlot !== undefined;

// Compare the way the server stores roles: names trimmed, orders as numbers, blank extra rows dropped.
const normalizeExtras = (roles: ExtraRoleEdit[]) =>
  roles
    .filter((r) => r.type || r.name.trim())
    .map((r) => ({
      type: r.type,
      name: r.name.trim(),
      listingOrder: toOrderValue(r.listingOrder),
    }));

export const hasPendingEditState = (state: EditState | undefined, user: UserWithLeader) => {
  if (!state) return false;
  const wasLeader = user.isLeader || false;
  // Not a leader before or after: there is nothing to save. (The server keeps an area/unit
  // admin's roleTag when Leader goes off, so comparing role fields here would never settle.)
  if (!state.isLeader && !wasLeader) return false;

  return (
    state.isLeader !== wasLeader ||
    state.roleTagType !== (user.roleTag?.type || "") ||
    state.roleTagName.trim() !== (user.roleTag?.name || "").trim() ||
    toOrderValue(state.listingOrder) !== (typeof user.roleTag?.listingOrder === "number" ? user.roleTag.listingOrder : null) ||
    (!isFanOutRow(user) && JSON.stringify(normalizeExtras(state.extraRoles)) !== JSON.stringify(normalizeExtras(buildExtraRoleEdits(user))))
  );
};

/** The person's other roles exactly as the server last sent them. */
const serverExtras = (user: UserWithLeader): RoleTagPayload[] =>
  (user.extraRoleTags || []).map((r) => ({
    type: r.type,
    name: r.name,
    listingOrder: typeof r.listingOrder === "number" ? r.listingOrder : null,
  }));

/** Digits only — listing order is a positive whole number or blank. */
export const digitsOnly = (raw: string) => raw.replace(/[^\d]/g, "");

export const roleTagLabel = (tag: { type?: string; name?: string }) =>
  [ROLE_TYPE_LABELS[tag.type || ""] || tag.type, tag.name?.trim()].filter(Boolean).join(" · ");

/** After a refetch: rows with unsaved edits keep them, every other row is reset from the server. */
export function mergeEditStates(prev: Record<string, EditState>, data: UserWithLeader[]): Record<string, EditState> {
  const next = { ...prev };
  data.forEach((user) => {
    const key = rowKey(user);
    if (!hasPendingEditState(prev[key], user)) {
      next[key] = buildEditState(user);
    }
  });
  return next;
}

/** Request body for PUT leader — same shape for admin users and members. */
export function buildSavePayload(user: UserWithLeader, state: EditState): LeaderSavePayload {
  const payload: LeaderSavePayload = { isLeader: state.isLeader };
  const slot = user.roleSlot || 0;
  if (slot > 0) {
    // Editing an extra-role row in the leaders directory: replace that slot,
    // keep the rest of the extras untouched.
    const extras = serverExtras(user);
    extras[slot - 1] = {
      type: state.roleTagType || undefined,
      name: state.roleTagName || undefined,
      listingOrder: toOrderValue(state.listingOrder),
    };
    payload.extraRoles = extras;
  } else if (state.isLeader) {
    if (state.roleTagType || state.roleTagName || state.listingOrder.trim() !== "") {
      payload.roleTag = {
        type: state.roleTagType || undefined,
        name: state.roleTagName || undefined,
        // Send null to explicitly clear, number when set, otherwise omit.
        listingOrder: toOrderValue(state.listingOrder),
      };
    }
    // A directory row edits only its own role: the other roles go back exactly as the
    // server last sent them, never an older copy held in the edit state.
    payload.extraRoles = isFanOutRow(user)
      ? serverExtras(user)
      : state.extraRoles.map((r) => ({
          type: r.type || undefined,
          name: r.name || undefined,
          listingOrder: toOrderValue(r.listingOrder),
        }));
  }
  return payload;
}

const GROUP_TYPE_ORDER = ["state", "district", "area", "unit", "murabi", "coordinator", "other"];

/** Leaders directory sections: State, then District/Area/Unit per district, then Murabi, Coordinator. */
export function groupLeaders(data: UserWithLeader[]): LeaderGroup[] {
  const groups: Record<string, UserWithLeader[]> = {};
  data.forEach((leader) => {
    const type = leader.roleTag?.type || "other";
    const distName = leader.district?.name || "Unknown";
    const groupKey = ["district", "area", "unit"].includes(type) ? `${type}-${distName}` : type;
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(leader);
  });

  return Object.entries(groups)
    .map(([key, leaders]) => ({
      key,
      label:
        key === "state"
          ? "State Leaders"
          : key.startsWith("district-")
            ? `District Leaders — ${key.replace("district-", "")}`
            : key.startsWith("area-")
              ? `Area Leaders — ${key.replace("area-", "")}`
              : key.startsWith("unit-")
                ? `Unit Leaders — ${key.replace("unit-", "")}`
                : `${ROLE_TYPE_LABELS[key] || key} Leaders`,
      leaders,
    }))
    .sort((a, b) => {
      const idxA = GROUP_TYPE_ORDER.indexOf(a.key.split("-")[0]);
      const idxB = GROUP_TYPE_ORDER.indexOf(b.key.split("-")[0]);
      if (idxA !== idxB) return idxA - idxB;
      return a.label.localeCompare(b.label);
    });
}
