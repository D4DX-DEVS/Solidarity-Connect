import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

/** Nothing to show yet — what is empty, and what to do about it. */
export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
      <Icon className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/** A load failed — the message and a Retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-10 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <p className="text-sm font-medium">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 min-h-11 gap-2">
          <RotateCw className="size-4" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
