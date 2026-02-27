import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Plus, Calendar, Bell, Menu, Megaphone, Star } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { getHomeRouteByRole } from "@/lib/roleRoutes";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole } = useAuth();
  const dashboardPath = getHomeRouteByRole(userRole);

  // Filter nav items based on role
  const baseNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: dashboardPath },
    { icon: Users, label: "Members", path: "/members", hideForRoles: ["member"] },
    { icon: Plus, label: "Add", path: "/add-member", hideForRoles: ["district_admin", "state_admin", "member"] },
    { icon: Calendar, label: "Meetings", path: "/meetings", hasMenu: true, hideForRoles: ["member"] },
    { icon: Star, label: "Leaders", path: "/leaders" },
    { icon: Bell, label: "Alerts", path: "/notifications", hasMenu: true },
  ];

  const navItems = baseNavItems.filter(
    item => !item.hideForRoles?.includes(userRole || "")
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                          (item.path === "/meetings" && (location.pathname.includes("/meeting") || location.pathname === "/state-admin/meetings" || location.pathname === "/admin/meetings-view")) ||
                          (item.path === "/notifications" && location.pathname === "/announcements");

          if (item.path === "/notifications" && item.hasMenu) {
            return (
              <DropdownMenu key={item.path}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${isActive ? "text-primary" : ""}`} />
                    <span className="text-xs mt-1">{item.label}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="mb-2">
                  <DropdownMenuItem onClick={() => navigate("/notifications")}>
                    <Bell className="h-4 w-4 mr-2" />
                    Notifications
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/announcements")}>
                    <Megaphone className="h-4 w-4 mr-2" />
                    Announcements
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          if (item.hasMenu && (userRole === "state_admin" || userRole === "district_admin")) {
            return (
              <DropdownMenu key={item.path}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${isActive ? "text-primary" : ""}`} />
                    <span className="text-xs mt-1">{item.label}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="mb-2">
                  <DropdownMenuItem onClick={() => navigate("/meetings")}>
                    <Calendar className="h-4 w-4 mr-2" />
                    View Meetings
                  </DropdownMenuItem>
                  {(userRole === "state_admin" || userRole === "district_admin") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate("/admin/meetings-view")}>
                        <Users className="h-4 w-4 mr-2" />
                        Admin View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/state-admin/meeting-agenda")}>
                        <Menu className="h-4 w-4 mr-2" />
                        Meeting Agendas
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate("/state-admin/create-meeting")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Agenda
                      </DropdownMenuItem>
                    </>
                  )}
                  {userRole === "district_admin" && (
                    <>
                      <DropdownMenuItem onClick={() => navigate("/state-admin/meeting-agenda")}>
                        <Menu className="h-4 w-4 mr-2" />
                        View Meeting Agendas
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-6 w-6 ${isActive ? "text-primary" : ""}`} />
              <span className="text-xs mt-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
