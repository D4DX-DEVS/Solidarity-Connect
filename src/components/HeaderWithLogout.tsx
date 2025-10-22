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
        return "Group Admin";
      default:
        return "";
    }
  };

  return (
    <header className="bg-card border-b px-4 py-4">
      <div className="flex items-center gap-3">
        {leftAction && <div>{leftAction}</div>}
        <div className="bg-primary p-2 rounded-lg">{icon}</div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card">
            <div className="px-2 py-2 border-b">
              <p className="text-sm font-medium">{getRoleLabel()}</p>
            </div>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
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
