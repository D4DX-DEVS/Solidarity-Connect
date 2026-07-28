import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, UserCog, Building2, ArrowRightLeft, Shield, FileCheck,
  BarChart3, FolderOpen, Database, Wallet, Bell, Calendar,
  Target, Star, Landmark,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles?: string[]; // undefined = all roles
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", path: "__home__", icon: LayoutDashboard }],
  },
  {
    title: "Management",
    items: [
      { label: "Members", path: "/members", icon: Users, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "Users", path: "/state-admin/users", icon: UserCog, roles: ["state_admin"] },
      { label: "Districts", path: "/state-admin/districts", icon: Building2, roles: ["state_admin"] },
      { label: "Groups", path: "/state-admin/groups", icon: Users, roles: ["state_admin", "district_admin"] },
      { label: "Transfers", path: "/state-admin/transfer-approvals", icon: ArrowRightLeft, roles: ["state_admin", "district_admin"] },
      { label: "Role Management", path: "/role-management", icon: Shield, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "Requests", path: "/requests", icon: FileCheck, roles: ["group_admin"] },
      { label: "Reports", path: "/state-admin/group-reports", icon: BarChart3, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "Consolidation", path: "/consolidation", icon: Landmark, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "Baithul Maal", path: "/state-admin/baithul-data", icon: Wallet, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "Master Data", path: "/state-admin/master-data", icon: Database, roles: ["state_admin"] },
      { label: "Files & Documents", path: "/org-files", icon: FolderOpen },
    ],
  },
  {
    title: "Communication",
    items: [
      // ponytail: one entry — announcements are a tab on the alerts page
      { label: "Alerts", path: "/notifications", icon: Bell },
      { label: "Meetings", path: "/meetings", icon: Calendar, roles: ["state_admin", "district_admin", "group_admin"] },
    ],
  },
  {
    title: "Targets & Planning",
    items: [
      { label: "My Targets", path: "/my-targets", icon: Target, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "Personal Targets", path: "/personal-targets", icon: Target, roles: ["state_admin"] },
      { label: "Leaders", path: "/leaders", icon: Star },
    ],
  },
];

// ponytail: member gets flat daily-use-first list; admin roles keep grouped SECTIONS
export const MEMBER_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", path: "__home__", icon: LayoutDashboard },
      { label: "My Targets", path: "/member-dashboard?view=targets", icon: Target },
      { label: "Meetings", path: "/member-dashboard?view=meetings", icon: Calendar },
      { label: "Baithul Maal", path: "/member-dashboard?view=baithul", icon: Wallet },
      { label: "Alerts", path: "/notifications", icon: Bell },
      { label: "Leaders", path: "/leaders", icon: Star },
      { label: "Files & Documents", path: "/org-files", icon: FolderOpen },
      { label: "Profile", path: "/member-dashboard?view=profile", icon: UserCog },
    ],
  },
];

/** Paths already reachable from the mobile BottomNav — kept out of the "More" menu. */
export const getBottomNavPaths = (userRole?: string | null): string[] => {
  const isMeetingsAdmin = userRole === "state_admin" || userRole === "district_admin";
  return ["__home__", "/members", isMeetingsAdmin ? "/admin/meetings-view" : "/meetings", "/meetings", "/leaders", "/notifications"];
};

/** Role-filtered items not already in the bottom nav, flattened for a "More" menu. */
export const getMoreNavItems = (userRole?: string | null): NavItem[] => {
  const inFooter = new Set(getBottomNavPaths(userRole));
  const sections = userRole === "member" ? MEMBER_SECTIONS : SECTIONS;
  return sections
    .flatMap((section) => section.items)
    .filter((item) => (!item.roles || item.roles.includes(userRole || "")) && !inFooter.has(item.path));
};
