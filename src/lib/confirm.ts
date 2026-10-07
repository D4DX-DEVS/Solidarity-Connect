import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ConfirmTone = "danger" | "warning" | "primary";

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  /** The thing being acted on, shown on its own line so it can't be missed. */
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: LucideIcon;
  /** Tells the user they get a few seconds to undo afterwards (see undoableDelete). */
  undoable?: boolean;
}

export type ConfirmRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void };

export interface ConfirmState {
  /** The latest question — kept after it is answered so the close animation still has content. */
  request: ConfirmRequest | null;
  open: boolean;
}

let state: ConfirmState = { request: null, open: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Backing store for <ConfirmDialogHost /> — one question on screen at a time. */
export const confirmStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  get: (): ConfirmState => state,
  settle(confirmed: boolean) {
    if (!state.open || !state.request) return;
    const { resolve } = state.request;
    state = { ...state, open: false };
    emit();
    resolve(confirmed);
  },
};

/**
 * Ask before acting: `if (!(await confirmAction({ title: "Delete file?" }))) return;`
 * Resolves true on confirm, false on cancel/Escape. Rendered by <ConfirmDialogHost /> in App.
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // A newer question replaces one still open; the old one counts as cancelled.
  confirmStore.settle(false);
  return new Promise((resolve) => {
    state = { request: { ...options, resolve }, open: true };
    emit();
  });
}
