import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Repeat } from "lucide-react";
import { SECTIONS, MEMBER_SECTIONS } from "@/lib/navSections";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import LogoutConfirmDialog from "@/components/LogoutConfirmDialog";
import { useAuth, type LoginAccount } from "@/contexts/AuthContext";
import { getRoleLabel } from "@/lib/adminKinds";
import { getHomeRouteByRole } from "@/lib/roleRoutes";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "solidarity:sidebar-collapsed";

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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Drives `.app-page` padding (index.css) so every page shifts with the rail,
  // without each page needing to know the sidebar's width.
  useEffect(() => {
    document.documentElement.setAttribute("data-sidebar-collapsed", String(collapsed));
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // storage unavailable (private mode, etc.); collapse state stays session-only
    }
  }, [collapsed]);

  const handleSwitchAccount = async (account: LoginAccount) => {
    try {
      await switchAccount(account);
      navigate(account.type === "member" ? "/member-dashboard" : getHomeRouteByRole(account.role));
    } catch {
      // switch failed; stay on current account
    }
  };

  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-20" : "w-60",
      )}
    >
      {/* Brand row matches the sticky page header height (h-16) so both bottoms line up.
          The toggle lives inside the rail: an edge button would sit under the header (z-40). */}
      <div className={cn("flex h-16 shrink-0 items-center", collapsed ? "justify-center px-2" : "gap-3 pl-4 pr-3")}>
        {collapsed ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                className={cn("group relative h-10 w-10 rounded-xl", focusRing)}
              >
                <img
                  src="/logo-icon.png"
                  alt=""
                  className="h-10 w-10 rounded-xl border-2 border-primary bg-white object-contain p-0.5 transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <PanelLeftOpen className="h-5 w-5" />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <img
              src="/logo-icon.png"
              alt="Solidarity Connect logo"
              className="h-10 w-10 shrink-0 rounded-xl border-2 border-primary bg-white object-contain p-0.5"
            />
            <p className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">Solidarity</p>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-accent-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                focusRing,
              )}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div aria-hidden className={cn("h-px shrink-0 bg-sidebar-border", collapsed ? "mx-3" : "mx-4")} />

      <nav className={cn("flex-1 overflow-y-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", collapsed ? "px-2" : "px-3")}>
        {(userRole === "member" ? MEMBER_SECTIONS : SECTIONS).map((section, si) => {
          const items = section.items.filter((item) => !item.roles || item.roles.includes(userRole || ""));
          if (!items.length) return null;
          return (
            <div key={si} className="mt-2">
              {section.title && (
                collapsed ? (
                  si > 0 && <div className="mx-3 my-3 h-px bg-sidebar-border" />
                ) : (
                  <p className="px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-accent-foreground/60">
                    {section.title}
                  </p>
                )
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const path = item.path === "__home__" ? home : item.path;
                  const full = location.pathname + location.search;
                  const active = full === path || (location.pathname === path && !location.search);
                  // Active = solid brand pill on the tinted panel; idle icons carry a soft red tint.
                  const navButton = (
                    <button
                      type="button"
                      onClick={() => navigate(path)}
                      aria-label={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center rounded-xl text-sm transition-colors",
                        focusRing,
                        collapsed ? "mx-auto h-10 w-10 justify-center" : "w-full gap-3 px-3 py-2",
                        active
                          ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/30"
                          : "font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      )}
                    >
                      <item.icon
                        className={cn(
                          "shrink-0",
                          collapsed ? "h-5 w-5" : "h-4 w-4",
                          !active && "text-sidebar-primary/70 group-hover:text-sidebar-primary",
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                  if (!collapsed) {
                    return <div key={item.label}>{navButton}</div>;
                  }
                  return (
                    <Tooltip key={item.label} delayDuration={200}>
                      <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={cn("shrink-0 p-3", collapsed && "px-2")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={collapsed ? "Account menu" : undefined}
              className={cn(
                "flex items-center text-left transition-colors",
                focusRing,
                collapsed
                  ? "mx-auto h-10 w-10 justify-center rounded-full hover:bg-sidebar-accent"
                  : "w-full gap-3 rounded-2xl border border-sidebar-border bg-card p-2 shadow-sm hover:bg-sidebar-accent",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-bold text-sidebar-accent-foreground">
                {(user?.name || "U").trim().charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{user?.name || roleTitles(userRole, user?.adminKind)}</p>
                    <p className="truncate text-xs text-sidebar-foreground/60">{roleTitles(userRole, user?.adminKind)}</p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? "center" : "start"} side="top" className="w-52 rounded-xl p-1.5">
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

      <LogoutConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        onConfirm={() => { logout(); navigate("/login"); }}
      />
    </aside>
  );
}

export default AppSidebar;
