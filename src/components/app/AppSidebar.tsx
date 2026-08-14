import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronsUpDown, Repeat } from "lucide-react";
import { SECTIONS, MEMBER_SECTIONS } from "@/lib/navSections";
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
import { useAuth, type LoginAccount } from "@/contexts/AuthContext";
import { getRoleLabel } from "@/lib/adminKinds";
import { getHomeRouteByRole } from "@/lib/roleRoutes";

// ponytail: labels live in lib/adminKinds — Area / Murabi / Coordinator Admin all
// share role "group_admin", so a role-keyed map cannot tell them apart.
const roleTitles = (role?: string | null, adminKind?: string | null) =>
  role ? getRoleLabel(role, adminKind) : "";

/** Desktop-only side navigation (lg+). Mobile keeps BottomNav + header menu. */
function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole, user, availableAccounts, switchAccount, logout } = useAuth();
  const home = getHomeRouteByRole(userRole);
  // Account-based, not role-based: Area/Murabi/Coordinator admin all share role
  // 'group_admin', so a role-name switcher collapses them into one unreachable entry.
  const otherAccounts = availableAccounts.filter((account) => account.id !== user?.id);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleSwitchAccount = async (account: LoginAccount) => {
    try {
      await switchAccount(account);
      navigate(account.type === "member" ? "/member-dashboard" : getHomeRouteByRole(account.role));
    } catch {
      // switch failed; stay on current account
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-20 items-center gap-3 border-b border-border px-5">
        <img src="/logo-icon.png" alt="Solidarity Connect logo" className="h-10 w-10 shrink-0 rounded-xl border-2 border-primary bg-white object-contain p-0.5" />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-foreground">Solidarity</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(userRole === "member" ? MEMBER_SECTIONS : SECTIONS).map((section, si) => {
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
                <p className="truncate text-sm font-semibold text-foreground">{user?.name || roleTitles(userRole, user?.adminKind)}</p>
                <p className="truncate text-xs text-muted-foreground">{roleTitles(userRole, user?.adminKind)}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52 rounded-xl p-1.5">
            {otherAccounts.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Switch account
                </DropdownMenuLabel>
                {otherAccounts.map((account) => (
                  <DropdownMenuItem key={account.id} className="cursor-pointer rounded-lg" onClick={() => handleSwitchAccount(account)}>
                    <Repeat className="mr-2 h-4 w-4" />
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
          <DialogFooter className="flex flex-row justify-center gap-2">
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
