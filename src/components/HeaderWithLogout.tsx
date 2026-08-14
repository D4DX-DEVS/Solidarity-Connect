import { LogOut, Menu, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, type LoginAccount } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { getRoleLabel } from "@/lib/adminKinds";
import { MoreNavMenuItems } from "@/components/MoreNavMenuItems";
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
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  /** Dashboards keep their title on mobile; every other page shows logo + menu only */
  showTitleOnMobile?: boolean;
}

// ponytail: labels live in lib/adminKinds — Area / Murabi / Coordinator Admin all
// share role "group_admin", so a role-keyed map cannot tell them apart.
const roleLabels = (role?: string | null, adminKind?: string | null) =>
  role ? getRoleLabel(role, adminKind) : "";

const HeaderWithLogout = ({ title, subtitle, leftAction, showTitleOnMobile = false }: HeaderWithLogoutProps) => {
  const { logout, userRole, user, availableAccounts, switchAccount } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Account-based, not role-based: Area/Murabi/Coordinator admin all share role
  // 'group_admin', so a role-name switcher collapses them into one unreachable entry.
  const otherAccounts = availableAccounts.filter((account) => account.id !== user?.id);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSwitchAccount = async (account: LoginAccount) => {
    if (switching) return;
    setSwitching(true);
    try {
      await switchAccount(account);
      toast({
        title: "Account switched",
        description: `You are now using ${account.label}.`,
      });
      navigate(account.type === "member" ? "/member-dashboard" : getHomeRouteByRole(account.role));
    } catch (error) {
      toast({
        title: "Switch failed",
        description: error instanceof Error ? error.message : "Could not switch account.",
        variant: "destructive",
      });
    } finally {
      setSwitching(false);
    }
  };

  const currentRoleLabel = () => roleLabels(userRole, user?.adminKind);

  return (
    <>
    <header className="sticky top-0 z-40 rounded-b-2xl border-b-2 border-primary bg-card text-foreground shadow-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {leftAction && <div>{leftAction}</div>}
        {/* ponytail: brand logo on mobile only — desktop sidebar already shows it */}
        <img src="/logo-icon.png" alt="Solidarity Connect logo" className="h-10 w-10 shrink-0 rounded-xl border-2 border-primary bg-white object-contain p-0.5 lg:hidden" />
        {/* Title div stays as the flex-1 spacer even when its text is hidden on mobile */}
        <div className={`flex-1 min-w-0 ${showTitleOnMobile ? "" : "max-lg:invisible"}`}>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</h1>
            {userRole ? <span className="hidden rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground md:inline-flex">{currentRoleLabel()}</span> : null}
          </div>
          {subtitle && <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{subtitle}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline" className="shrink-0 lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass max-h-[70vh] w-64 overflow-y-auto rounded-xl border-border/50 p-1.5 shadow-2xl">
            <div className="px-3 py-2.5 mb-1 bg-secondary/50 rounded-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logged in as</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{user?.name || currentRoleLabel()}</p>
              {user?.phone && <p className="text-xs text-muted-foreground mt-0.5">{user.phone}</p>}
            </div>
            {otherAccounts.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2">
                  Switch account
                </DropdownMenuLabel>
                {otherAccounts.map((account) => (
                  <DropdownMenuItem
                    key={account.id}
                    disabled={switching}
                    onClick={() => handleSwitchAccount(account)}
                    className="cursor-pointer rounded-xl transition-colors py-2.5 px-3 font-medium"
                  >
                    <Repeat className="h-4 w-4 mr-2" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{account.label}</span>
                      {account.scope && (
                        <span className="truncate text-xs font-normal text-muted-foreground">{account.scope}</span>
                      )}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <MoreNavMenuItems />
            <DropdownMenuSeparator />
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
        <DialogFooter className="flex flex-row justify-center gap-2">
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
