import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, UserCog, Building2, ArrowRightLeft, Shield, FileCheck,
  BarChart3, FolderOpen, Database, Wallet, Bell, Megaphone, Calendar, Send,
  Target, Star, Landmark, LogOut, ChevronsUpDown, Repeat,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getHomeRouteByRole, type AppUserRole } from "@/lib/roleRoutes";

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles?: string[]; // undefined = all roles
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
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
      { label: "Profile", path: "/member-dashboard?view=profile", icon: UserCog, roles: ["member"] },
      { label: "Files & Documents", path: "/org-files", icon: FolderOpen },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Notifications", path: "/notifications", icon: Bell },
      { label: "Announcements", path: "/announcements", icon: Megaphone },
      { label: "Meetings", path: "/meetings", icon: Calendar, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "Meetings", path: "/member-dashboard?view=meetings", icon: Calendar, roles: ["member"] },
      { label: "Send Notification", path: "/state-admin/send-notification", icon: Send, roles: ["state_admin"] },
    ],
  },
  {
    title: "Targets & Planning",
    items: [
      { label: "My Targets", path: "/my-targets", icon: Target, roles: ["state_admin", "district_admin", "group_admin"] },
      { label: "My Targets", path: "/member-dashboard?view=targets", icon: Target, roles: ["member"] },
      { label: "Personal Targets", path: "/personal-targets", icon: Target, roles: ["state_admin"] },
      { label: "Leaders", path: "/leaders", icon: Star },
    ],
  },
];

const roleTitles: Record<string, string> = {
  state_admin: "State Admin",
  district_admin: "District Admin",
  group_admin: "Area Admin",
  member: "Member",
};

/** Desktop-only side navigation (lg+). Mobile keeps BottomNav + header menu. */
function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, user, availableRoles, switchRole, logout } = useAuth();
  const home = getHomeRouteByRole(userRole);
  const otherRoles = availableRoles.filter((role) => role !== userRole);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleSwitchRole = async (targetRole: AppUserRole) => {
    try {
      await switchRole(targetRole);
      navigate(targetRole === "member" ? "/member-dashboard" : getHomeRouteByRole(targetRole));
    } catch {
      // switch failed; stay on current role
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-foreground">Solidarity</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((section, si) => {
          const items = section.items.filter((item) => !item.roles || item.roles.includes(userRole || ""));
          if (!items.length) return null;
          return (
            <div key={si} className="mt-1">
              {section.title ? (
                <p className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const path = item.path === "__home__" ? home : item.path;
                  const full = location.pathname + location.search;
                  const active = full === path || (location.pathname === path && !location.search);
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => navigate(path)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {(user?.name || "U").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{user?.name || roleTitles[userRole || ""]}</p>
                <p className="truncate text-xs text-muted-foreground">{roleTitles[userRole || ""] || ""}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52 rounded-xl p-1.5">
            {otherRoles.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Switch role
                </DropdownMenuLabel>
                {otherRoles.map((role) => (
                  <DropdownMenuItem key={role} className="cursor-pointer rounded-lg" onClick={() => handleSwitchRole(role)}>
                    <Repeat className="mr-2 h-4 w-4" />
                    {roleTitles[role] || role}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className="cursor-pointer rounded-lg text-destructive focus:bg-destructive/10"
              onSelect={(e) => { e.preventDefault(); setShowLogoutConfirm(true); }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>Are you sure you want to log out?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export default AppSidebar;
