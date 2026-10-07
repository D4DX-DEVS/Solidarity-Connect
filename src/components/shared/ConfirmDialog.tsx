import { useSyncExternalStore } from "react";
import { AlertTriangle, CircleHelp, Loader2, Trash2, Undo2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { confirmStore, type ConfirmOptions, type ConfirmTone } from "@/lib/confirm";
import { langOf } from "@/lib/malayalam";
import { cn } from "@/lib/utils";
import { UNDO_WINDOW_MS } from "@/lib/undoDelete";

const TONES: Record<ConfirmTone, { icon: typeof Trash2; badge: string; button: string; label: string }> = {
  danger: {
    icon: Trash2,
    badge: "bg-destructive/10 text-destructive ring-destructive/5",
    button: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    label: "Delete",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-warning/15 text-warning ring-warning/5",
    button: "bg-warning text-warning-foreground hover:bg-warning/90",
    label: "Continue",
  },
  primary: {
    icon: CircleHelp,
    badge: "bg-primary/10 text-primary ring-primary/5",
    button: "",
    label: "Confirm",
  },
};

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Work in flight: buttons lock, the dialog can't be dismissed, the confirm button spins. */
  busy?: boolean;
}

/** The app's confirmation modal. The owner closes it (onOpenChange) once the action is done. */
export function ConfirmDialog({
  open, onOpenChange, onConfirm, busy = false,
  title, description, itemName, confirmLabel, cancelLabel = "Cancel", tone = "danger", icon, undoable,
}: ConfirmDialogProps) {
  const style = TONES[tone];
  const Icon = icon ?? style.icon;

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <AlertDialogContent
        className="max-w-sm gap-0 overflow-hidden p-0"
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-7 text-center">
          <div className={cn("flex size-14 items-center justify-center rounded-full ring-8", style.badge)}>
            <Icon className="size-6" aria-hidden />
          </div>
          <AlertDialogHeader className="space-y-1.5 sm:text-center">
            <AlertDialogTitle className="text-lg leading-snug" lang={langOf(title)}>{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription className="leading-relaxed" lang={langOf(description)}>{description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          {itemName ? (
            <p className="w-full truncate rounded-xl border bg-muted/50 px-3 py-2.5 text-sm font-medium leading-relaxed" lang={langOf(itemName)} title={itemName}>
              {itemName}
            </p>
          ) : null}
          {undoable ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Undo2 className="size-3.5" aria-hidden />
              You can undo this for {UNDO_WINDOW_MS / 1000} seconds.
            </p>
          ) : null}
        </div>
        <AlertDialogFooter className="grid grid-cols-2 gap-3 border-t bg-muted/40 px-6 py-4 sm:space-x-0">
          <AlertDialogCancel disabled={busy} className="mt-0 h-11 rounded-xl">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            className={cn("h-11 gap-2 rounded-xl", style.button)}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel ?? style.label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Mounted once in App; shows whatever confirmAction() asks. */
export function ConfirmDialogHost() {
  const { request, open } = useSyncExternalStore(confirmStore.subscribe, confirmStore.get);
  if (!request) return null;

  const { resolve: _resolve, ...options } = request;
  return (
    <ConfirmDialog
      {...options}
      open={open}
      onOpenChange={(open) => { if (!open) confirmStore.settle(false); }}
      onConfirm={() => confirmStore.settle(true)}
    />
  );
}
