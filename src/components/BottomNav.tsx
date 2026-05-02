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
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 pb-safe sm:bottom-5 sm:px-4">
      <nav className="glass pointer-events-auto w-full max-w-md rounded-[2rem] border-white/60 px-2 py-2 shadow-[0_28px_70px_-30px_hsl(var(--foreground)/0.35)]">
        <div className={`grid h-[4.6rem] items-center gap-1 ${navItems.length <= 4 ? 'grid-cols-4' : navItems.length === 5 ? 'grid-cols-5' : 'grid-cols-6'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path === "/meetings" && (location.pathname.includes("/meeting") || location.pathname === "/state-admin/meetings" || location.pathname === "/admin/meetings-view")) ||
              (item.path === "/notifications" && location.pathname === "/announcements");

            if (item.path === "/notifications" && item.hasMenu) {
              return (
                <DropdownMenu key={item.path} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex h-full flex-col items-center justify-center rounded-[1.35rem] px-2 transition-all duration-300 ease-spring ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                        }`}
                    >
                      <Icon className={`h-[22px] w-[22px] transition-all duration-300 ${isActive ? "scale-105" : ""}`} />
                      <span className="mt-1 text-[10px] font-semibold tracking-wide">{item.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" side="top" className="glass mb-4 w-48 rounded-[1.4rem] border-border/50 p-1.5 shadow-2xl">
                    <DropdownMenuItem onClick={() => navigate("/notifications")} className="rounded-xl py-3 px-3 cursor-pointer mb-1 focus:bg-primary/10 transition-colors">
                      <Bell className="h-4 w-4 mr-2.5 text-primary" />
                      <span className="font-medium">Notifications</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border/50 mx-2" />
                    <DropdownMenuItem onClick={() => navigate("/announcements")} className="rounded-xl py-3 px-3 cursor-pointer mt-1 focus:bg-primary/10 transition-colors">
                      <Megaphone className="h-4 w-4 mr-2.5 text-primary" />
                      <span className="font-medium">Announcements</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            if (item.hasMenu && (userRole === "state_admin" || userRole === "district_admin")) {
              return (
                <DropdownMenu key={item.path} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`flex h-full flex-col items-center justify-center rounded-[1.35rem] px-2 transition-all duration-300 ease-spring ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
                        }`}
                    >
                      <Icon className={`h-[22px] w-[22px] transition-all duration-300 ${isActive ? "scale-105" : ""}`} />
                      <span className="mt-1 text-[10px] font-semibold tracking-wide">{item.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" side="top" className="glass mb-4 w-48 rounded-[1.4rem] border-border/50 p-1.5 shadow-2xl">
                    <DropdownMenuItem onClick={() => navigate("/meetings")} className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-primary/10 transition-colors font-medium">
                      <Calendar className="h-4 w-4 mr-2.5 text-primary" />
                      View Meetings
                    </DropdownMenuItem>
                    {(userRole === "state_admin" || userRole === "district_admin") && (
                      <>
                        <DropdownMenuSeparator className="bg-border/50 mx-2" />
                        <DropdownMenuItem onClick={() => navigate("/admin/meetings-view")} className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-primary/10 transition-colors font-medium mt-1">
                          <Users className="h-4 w-4 mr-2.5 text-primary" />
                          Admin View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/state-admin/meeting-agenda")} className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-primary/10 transition-colors font-medium mt-1">
                          <Menu className="h-4 w-4 mr-2.5 text-primary" />
                          Meeting Agendas
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate("/state-admin/create-meeting")} className="rounded-xl py-2.5 px-3 cursor-pointer focus:bg-primary/10 transition-colors font-medium mt-1">
                          <Plus className="h-4 w-4 mr-2.5 text-primary" />
                          Create Agenda
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
                className={`flex h-full flex-col items-center justify-center rounded-[1.35rem] px-2 transition-all duration-300 ease-spring ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/70 hover:text-foreground"
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
