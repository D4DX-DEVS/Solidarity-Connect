import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

interface PageHeroProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon: ReactNode;
  actions?: ReactNode;
  details?: ReactNode;
  className?: string;
  /** Dashboards keep their title on mobile; every other page shows logo + menu only */
  showTitleOnMobile?: boolean;
}

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

interface MetricCardProps {
  title: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
  className?: string;
  onClick?: () => void;
}

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  primary: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  danger: "text-destructive bg-destructive/10",
  neutral: "text-info bg-info/10",
};

function PageShell({ children, className, contentClassName }: PageShellProps) {
  return (
    <div className={cn("app-page", className)}>
      <main className={cn("app-main", contentClassName)}>{children}</main>
    </div>
  );
}

function PageHero({ title, subtitle, eyebrow, icon, actions, details, className, showTitleOnMobile = false }: PageHeroProps) {
  const { userRole } = useAuth();
  return (
    <>
    {/* ponytail: mobile shows the header only on dashboards; other pages rely on BottomNav */}
    <section className={cn("hero-card", !showTitleOnMobile && "max-lg:hidden", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          {/* ponytail: brand logo everywhere; per-page icon prop kept for API compat but unused */}
          <img src="/logo-icon.png" alt="Solidarity Connect logo" className="h-12 w-12 shrink-0 rounded-2xl border-2 border-primary bg-white object-contain p-0.5 lg:hidden" />
          {/* ponytail: eyebrow dropped for uniform h-20 header; prop kept for API compat */}
          <div className={cn("min-w-0 space-y-0.5", !showTitleOnMobile && "max-lg:hidden")}>
            <h1 className="hero-title truncate">{title}</h1>
            {subtitle ? <p className="hero-subtitle truncate">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
          {/* ponytail: bell only on dashboards — the mobile menu lives in the BottomNav "More" button */}
          {showTitleOnMobile && userRole !== "member" && <NotificationBell />}
        </div>
      </div>
    </section>
    {/* Details flow below the sticky header so it stays the same h-20 bar as every other page */}
    {details ? <div className="hero-details !mt-0 text-foreground">{details}</div> : null}
    </>
  );
}

function SectionCard({ title, description, action, children, className, contentClassName }: SectionCardProps) {
  return (
    <Card className={cn("surface-card", className)}>
      <CardHeader className="space-y-3 p-4 pb-0 sm:p-6 sm:pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">{title}</CardTitle>
            {/* ponytail: descriptions hidden on mobile to save vertical space */}
            {description ? <CardDescription className="hidden text-sm sm:block">{description}</CardDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("p-4 pt-4 sm:p-6 sm:pt-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

function MetricCard({ title, value, detail, icon: Icon, tone = "neutral", className, onClick }: MetricCardProps) {
  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={cn(
        "metric-card",
        onClick && "cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <CardContent className="p-2.5 sm:p-4 md:p-5">
        <div className="flex items-start justify-between gap-1.5 sm:gap-3">
          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground sm:text-[13px]">{title}</p>
            <p className="truncate text-lg font-bold leading-tight tracking-tight text-foreground sm:text-2xl md:text-[1.7rem]">{value}</p>
            {detail ? <p className="truncate text-[10px] text-muted-foreground sm:text-xs md:text-sm">{detail}</p> : null}
          </div>
          <div className={cn("metric-icon h-7 w-7 shrink-0 sm:h-10 sm:w-10", toneClasses[tone])}>
            <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { MetricCard, PageHero, PageShell, SectionCard };