import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Star, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoutes";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole } = useAuth();
  const dashboardPath = getHomeRouteByRole(userRole);
  const isMeetingsAdmin = userRole === "state_admin" || userRole === "district_admin";

  // Filter nav items based on role
  const baseNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: dashboardPath },
    { icon: Users, label: "Members", path: "/members", hideForRoles: ["member"] },
    // ponytail: admins get the single meetings workspace; others the read-only list.
    { icon: Calendar, label: "Meetings", path: isMeetingsAdmin ? "/admin/meetings-view" : "/meetings", hideForRoles: ["member"] },
    { icon: Star, label: "Leaders", path: "/leaders" },
    // ponytail: announcements live in a tab on /notifications — one destination, no menu.
    { icon: Bell, label: "Alerts", path: "/notifications", hideForRoles: ["member"] },
  ];

  const navItems = baseNavItems.filter(
    item => !item.hideForRoles?.includes(userRole || "")
  );

  // ponytail: member dashboard ships its own tab bar — don't stack two
  if (location.pathname.startsWith("/member-dashboard")) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 pb-safe sm:bottom-5 sm:px-4 lg:hidden">
      <nav className="glass pointer-events-auto w-full max-w-md rounded-2xl px-2 py-2 shadow-lg shadow-foreground/5">
        <div className={`grid h-[4.6rem] items-center gap-1 ${navItems.length <= 4 ? 'grid-cols-4' : navItems.length === 5 ? 'grid-cols-5' : 'grid-cols-6'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.label === "Meetings" && (location.pathname.includes("/meeting") || location.pathname === "/admin/meetings-view")) ||
              (item.path === "/notifications" && location.pathname === "/announcements");

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
        </div>
      </nav>
    </div>
  );
};

export default BottomNav;
