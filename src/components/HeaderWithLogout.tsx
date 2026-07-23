import { LogOut, Menu, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getHomeRouteByRole, type AppUserRole } from "@/lib/roleRoutes";
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

interface HeaderWithLogoutProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
}

const roleLabels: Record<string, string> = {
  state_admin: "State Admin",
  district_admin: "District Admin",
  group_admin: "Area Admin",
  member: "Member",
};

const HeaderWithLogout = ({ icon, title, subtitle, leftAction }: HeaderWithLogoutProps) => {
  const { logout, userRole, user, availableRoles, switchRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [switching, setSwitching] = useState(false);

  const otherRoles = availableRoles.filter((role) => role !== userRole);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSwitchRole = async (targetRole: AppUserRole) => {
    if (switching) return;
    setSwitching(true);
    try {
      await switchRole(targetRole);
      toast({
        title: "Role switched",
        description: `You are now using ${roleLabels[targetRole] || targetRole}.`,
      });
      navigate(targetRole === "member" ? "/member-dashboard" : getHomeRouteByRole(targetRole));
    } catch (error) {
      toast({
        title: "Switch failed",
        description: error instanceof Error ? error.message : "Could not switch role.",
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
    }
  };

  const getRoleLabel = () => (userRole ? roleLabels[userRole] || "" : "");

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {leftAction && <div>{leftAction}</div>}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</h1>
            {userRole ? <span className="hidden rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary md:inline-flex">{getRoleLabel()}</span> : null}
          </div>
          {subtitle && <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{subtitle}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass w-64 rounded-xl border-border/50 p-1.5 shadow-2xl">
            <div className="px-3 py-2.5 mb-1 bg-secondary/50 rounded-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logged in as</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{user?.name || getRoleLabel()}</p>
              {user?.phone && <p className="text-xs text-muted-foreground mt-0.5">{user.phone}</p>}
            </div>
            {otherRoles.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2">
                  Switch role
                </DropdownMenuLabel>
                {otherRoles.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    disabled={switching}
                    onClick={() => handleSwitchRole(role)}
                    className="cursor-pointer rounded-xl transition-colors py-2.5 px-3 font-medium"
                  >
                    <Repeat className="h-4 w-4 mr-2" />
                    {roleLabels[role] || role}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} className="text-destructive focus:bg-destructive/10 cursor-pointer rounded-xl transition-colors py-2.5 px-3 font-medium mt-1">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Logout</DialogTitle>
          <DialogDescription>Are you sure you want to log out?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 justify-end">
          <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default HeaderWithLogout;
