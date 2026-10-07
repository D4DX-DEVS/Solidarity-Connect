import type { LucideIcon } from "lucide-react";
import { FEATURES } from "@/lib/features";
import {
  LayoutDashboard, Users, UserCog, Building2, ArrowRightLeft, Shield, FileCheck,
  FolderOpen, Database, Wallet, Bell, Calendar,
  Star, Archive, ClipboardList,
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
      // Members aged 38 and above (age over) — moved out of Members, state admin only
      { label: "Archives", path: "/archives", icon: Archive, roles: ["state_admin"] },
      { label: "Admins", path: "/state-admin/users", icon: UserCog, roles: ["state_admin"] },
      { label: "Districts", path: "/state-admin/districts", icon: Building2, roles: ["state_admin"] },
      { label: "Groups", path: "/state-admin/groups", icon: Users, roles: ["state_admin", "district_admin"] },
      { label: "Transfers", path: "/state-admin/transfer-approvals", icon: ArrowRightLeft, roles: ["state_admin", "district_admin"] },
      { label: "Role Management", path: "/role-management", icon: Shield, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "Requests", path: "/requests", icon: FileCheck, roles: ["group_admin"] },
      { label: "Reports", path: "/reports", icon: ClipboardList, roles: ["state_admin", "district_admin", "group_admin"] },
      ...(FEATURES.baithulMaal
        ? [{ label: "Baithul Maal", path: "/state-admin/baithul-data", icon: Wallet, roles: ["state_admin", "district_admin", "group_admin"] }]
        : []),
      { label: "Master Data", path: "/state-admin/master-data", icon: Database, roles: ["state_admin"] },
      { label: "Files & Documents", path: "/org-files", icon: FolderOpen },
    ],
  },
  {
    title: "Communication",
    items: [
      // ponytail: one entry — announcements are a tab on the alerts page
      { label: "Alerts", path: "/notifications", icon: Bell },
      // State/district admins get the rich overview (group progress, edit/delete);
      // group admins keep the attendance-marking list. Matches BottomNav routing.
      ...(FEATURES.meetings
        ? [
            { label: "Meetings", path: "/admin/meetings-view", icon: Calendar, roles: ["state_admin", "district_admin"] },
            { label: "Meetings", path: "/meetings", icon: Calendar, roles: ["group_admin"] },
          ]
        : []),
    ],
  },
  {
    title: "People",
    items: [
      { label: "Leaders", path: "/leaders", icon: Star },
    ],
  },
];

// ponytail: member gets flat daily-use-first list; admin roles keep grouped SECTIONS
export const MEMBER_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", path: "__home__", icon: LayoutDashboard },
      ...(FEATURES.meetings ? [{ label: "Meetings", path: "/member-dashboard?view=meetings", icon: Calendar }] : []),
      ...(FEATURES.baithulMaal ? [{ label: "Baithul Maal", path: "/member-dashboard?view=baithul", icon: Wallet }] : []),
      { label: "Alerts", path: "/notifications", icon: Bell },
      { label: "Leaders", path: "/leaders", icon: Star },
      { label: "Files & Documents", path: "/org-files", icon: FolderOpen },
      { label: "Profile", path: "/member-dashboard?view=profile", icon: UserCog },
    ],
  },
];

/**
 * Whether a nav path is the current page. A page's own query (tabs, filters, search)
 * keeps its item active. An item with a query (?view=…) needs those params, and a
 * plain item on the same pathname yields to it. `paths` = every item path in the nav.
 */
export function isNavPathActive(path: string, location: { pathname: string; search: string }, paths: string[]): boolean {
  const current = new URLSearchParams(location.search);
  const matches = (p: string) => {
    const [pathname, query] = p.split("?");
    if (pathname !== location.pathname) return false;
    return !query || [...new URLSearchParams(query)].every(([key, value]) => current.get(key) === value);
  };
  if (!matches(path)) return false;
  return path.includes("?") || !paths.some((p) => p.includes("?") && matches(p));
}

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
