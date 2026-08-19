import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Star, Menu, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { getRoleLabel } from "@/lib/adminKinds";
import { MoreNavMenuItems } from "@/components/MoreNavMenuItems";
import { RoleSwitchMenuItems } from "@/components/RoleSwitchMenuItems";
import LogoutConfirmDialog from "@/components/LogoutConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const dashboardPath = getHomeRouteByRole(userRole);
  const isMeetingsAdmin = userRole === "state_admin" || userRole === "district_admin";

  // Filter nav items based on role
  const baseNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: dashboardPath },
    { icon: Users, label: "Members", path: "/members", hideForRoles: ["member"] },
    // ponytail: admins get the single meetings workspace; others the read-only list.
    { icon: Calendar, label: "Meetings", path: isMeetingsAdmin ? "/admin/meetings-view" : "/meetings", hideForRoles: ["member"] },
    { icon: Star, label: "Leaders", path: "/leaders" },
  ];

  const navItems = baseNavItems.filter(
    item => !item.hideForRoles?.includes(userRole || "")
  );
  // ponytail: "More" is the single mobile menu — nav extras, account switch, logout.
  // The header hamburger is gone; Alerts moved to the dashboard header bell.
  const slots = navItems.length + 1;

  // ponytail: member dashboard ships its own tab bar — don't stack two
  if (location.pathname.startsWith("/member-dashboard")) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 pb-safe sm:bottom-5 sm:px-4 lg:hidden">
      <nav className="glass pointer-events-auto w-full max-w-md rounded-2xl px-2 py-2 shadow-lg shadow-foreground/5">
        <div className={`grid h-[4.6rem] items-center gap-1 ${slots <= 4 ? 'grid-cols-4' : slots === 5 ? 'grid-cols-5' : 'grid-cols-6'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.label === "Meetings" && (location.pathname.includes("/meeting") || location.pathname === "/admin/meetings-view"));

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex h-full flex-col items-center justify-center rounded-xl px-2 transition-all duration-300 ease-spring ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
              >
                <Icon className={`h-[22px] w-[22px] transition-all duration-300 ${isActive ? "scale-105" : ""}`} />
                <span className="mt-1 text-[10px] font-semibold tracking-wide">{item.label}</span>
              </button>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-full flex-col items-center justify-center rounded-xl px-2 text-muted-foreground transition-all duration-300 ease-spring hover:bg-accent hover:text-foreground data-[state=open]:bg-primary/10 data-[state=open]:text-primary">
                <Menu className="h-[22px] w-[22px]" />
                <span className="mt-1 text-[10px] font-semibold tracking-wide">More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" sideOffset={12} className="glass max-h-[70vh] w-64 overflow-y-auto rounded-xl border-border/50 p-1.5 shadow-2xl">
              <div className="mb-1 rounded-xl bg-secondary/50 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logged in as</p>
                <p className="mt-0.5 text-sm font-bold text-foreground">{user?.name || (userRole ? getRoleLabel(userRole, user?.adminKind) : "")}</p>
                {user?.phone && <p className="mt-0.5 text-xs text-muted-foreground">{user.phone}</p>}
              </div>
              <RoleSwitchMenuItems />
              <MoreNavMenuItems />
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} className="mt-1 cursor-pointer rounded-xl px-3 py-2.5 font-medium text-destructive focus:bg-destructive/10">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
      <LogoutConfirmDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm} onConfirm={handleLogout} />
    </div>
  );
};

export default BottomNav;
