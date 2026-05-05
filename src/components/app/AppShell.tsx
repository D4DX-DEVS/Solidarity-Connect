import { type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
}

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  primary: "text-primary bg-primary/10 ring-primary/15",
  success: "text-success bg-success/10 ring-success/15",
  warning: "text-amber-600 bg-amber-500/10 ring-amber-500/15",
  danger: "text-destructive bg-destructive/10 ring-destructive/15",
  neutral: "text-foreground bg-foreground/5 ring-foreground/10",
};

function PageShell({ children, className, contentClassName }: PageShellProps) {
  return (
    <div className={cn("app-page", className)}>
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <main className={cn("app-main", contentClassName)}>{children}</main>
    </div>
  );
}

function PageHero({ title, subtitle, eyebrow, icon, actions, details, className }: PageHeroProps) {
  return (
    <section className={cn("hero-card", className)}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="hero-icon">{icon}</div>
          <div className="min-w-0 space-y-2">
            {eyebrow ? <p className="hero-eyebrow">{eyebrow}</p> : null}
            <div className="space-y-1">
              <h1 className="hero-title">{title}</h1>
              {subtitle ? <p className="hero-subtitle">{subtitle}</p> : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2 self-start">{actions}</div> : null}
      </div>
      {details ? <div className="hero-details">{details}</div> : null}
    </section>
  );
}

function SectionCard({ title, description, action, children, className, contentClassName }: SectionCardProps) {
  return (
    <Card className={cn("surface-card", className)}>
      <CardHeader className="space-y-3 p-5 pb-0 sm:p-6 sm:pb-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">{title}</CardTitle>
            {description ? <CardDescription className="text-sm">{description}</CardDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("p-5 pt-5 sm:p-6 sm:pt-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

function MetricCard({ title, value, detail, icon: Icon, tone = "neutral", className }: MetricCardProps) {
  return (
    <Card className={cn("metric-card", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/90">{title}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{value}</p>
            {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
          </div>
          <div className={cn("metric-icon", toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { MetricCard, PageHero, PageShell, SectionCard };