import { useAuth } from "@/contexts/AuthContext";
import { getRoleLabel } from "@/lib/adminKinds";
import { NotificationBell } from "@/components/NotificationBell";

interface HeaderWithLogoutProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  /** Dashboards keep their title on mobile; every other page shows logo + menu only */
  showTitleOnMobile?: boolean;
}

// ponytail: mobile menu (switch account, nav, logout) lives in the BottomNav "More"
// button — header keeps only branding, title, and the dashboard notification bell.
const HeaderWithLogout = ({ title, subtitle, leftAction, showTitleOnMobile = false }: HeaderWithLogoutProps) => {
  const { userRole, user } = useAuth();

  return (
    <header className={`sticky top-0 z-40 rounded-b-2xl border-b-2 border-primary bg-card text-foreground shadow-md ${showTitleOnMobile ? "" : "max-lg:hidden"}`}>
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        {leftAction && <div>{leftAction}</div>}
        {/* ponytail: brand logo on mobile only — desktop sidebar already shows it */}
        <img src="/logo-icon.png" alt="Solidarity Connect logo" className="h-10 w-10 shrink-0 rounded-xl border-2 border-primary bg-white object-contain p-0.5 lg:hidden" />
        {/* Title div stays as the flex-1 spacer even when its text is hidden on mobile */}
        <div className={`flex-1 min-w-0 ${showTitleOnMobile ? "" : "max-lg:invisible"}`}>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">{title}</h1>
            {userRole ? <span className="hidden rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground md:inline-flex">{getRoleLabel(userRole, user?.adminKind)}</span> : null}
          </div>
          {subtitle && <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{subtitle}</p>}
        </div>
        {/* ponytail: bell only on dashboards — other pages reach Alerts via nav */}
        {showTitleOnMobile && userRole !== "member" && <NotificationBell />}
      </div>
    </header>
  );
};

export default HeaderWithLogout;
