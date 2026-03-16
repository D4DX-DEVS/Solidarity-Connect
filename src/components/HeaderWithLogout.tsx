import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderWithLogoutProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
}

const HeaderWithLogout = ({ icon, title, subtitle, leftAction }: HeaderWithLogoutProps) => {
  const { logout, userRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case "state_admin":
        return "State Admin";
      case "district_admin":
        return "District Admin";
      case "group_admin":
        return "Area Admin";
      default:
        return "";
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full glass border-b-0 px-5 py-4 transition-all duration-300 shadow-sm">
      <div className="flex items-center gap-3.5 max-w-5xl mx-auto">
        {leftAction && <div>{leftAction}</div>}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-border/40 shrink-0">
          <img src="/logo.jpg" alt="Solidarity" className="h-9 w-9 object-contain rounded-xl" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{subtitle}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <Menu className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass border-border/50 rounded-2xl p-1 shadow-2xl">
            <div className="px-3 py-2.5 mb-1 bg-secondary/50 rounded-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logged in as</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{getRoleLabel()}</p>
            </div>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 cursor-pointer rounded-xl transition-colors py-2.5 px-3 font-medium mt-1">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default HeaderWithLogout;
