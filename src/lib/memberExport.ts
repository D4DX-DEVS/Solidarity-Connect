// Column layout for the Members page Excel/PDF download.

export interface MemberRoleTag {
  type?: string;
  name?: string;
}

export interface ExportableMember {
  name: string;
  phone: string;
  email?: string;
  status: string;
  district?: { name: string; code: string } | null;
  group?: { name: string; code: string } | null;
  address?: string; // unit name
  dateOfBirth?: string;
  bloodGroup?: string;
  isLeader?: boolean;
  roleTag?: MemberRoleTag | null;
  extraRoleTags?: MemberRoleTag[];
  isApproved: boolean;
  createdAt: string;
}

const ROLE_TYPE_LABELS: Record<string, string> = {
  state: "State",
  district: "District",
  area: "Area",
  unit: "Unit",
  murabi: "Murabi",
  coordinator: "Coordinator",
};

/** "Area - Secretary; Murabi; Unit - President" — primary role first. */
export function formatMemberRoles(m: Pick<ExportableMember, "isLeader" | "roleTag" | "extraRoleTags">): string {
  if (!m.isLeader) return "";
  return [m.roleTag, ...(m.extraRoleTags || [])]
    .filter((t): t is MemberRoleTag => !!t && !!(t.type || t.name))
    .map((t) => {
      const label = t.type ? ROLE_TYPE_LABELS[t.type] || t.type : "";
      const name = t.name?.trim() || "";
      if (!label) return name;
      return !name || name.toLowerCase() === label.toLowerCase() ? label : `${label} - ${name}`;
    })
    .join("; ");
}

/**
 * DD-MM-YYYY from the stored ISO date. Read the date part as-is rather than via
 * local time: DOBs are stored as UTC midnight, so local parsing could shift a day.
 */
export function formatDob(dob?: string): string {
  const m = dob ? String(dob).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export const MEMBER_EXPORT_HEADERS = [
  "Name", "Phone", "Email", "Status", "District", "Area", "Unit",
  "Date of Birth", "Blood Group", "Roles", "Approved", "Joined",
];

export const MEMBER_EXPORT_COL_WIDTHS = [22, 15, 24, 10, 20, 22, 18, 13, 11, 36, 10, 12].map((wch) => ({ wch }));

export function memberExportRow(m: ExportableMember): string[] {
  return [
    m.name,
    m.phone,
    m.email || "",
    m.status,
    m.district ? `${m.district.name} (${m.district.code})` : "",
    m.group ? `${m.group.name} (${m.group.code})` : "",
    m.address || "",
    formatDob(m.dateOfBirth),
    m.bloodGroup || "",
    formatMemberRoles(m),
    m.isApproved ? "Yes" : "No",
    m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "",
  ];
}
