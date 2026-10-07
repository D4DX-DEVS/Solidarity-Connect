import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { UndoResultToast, UndoToast } from "@/components/shared/UndoToast";

/** How long a delete can be undone before it reaches the server. */
export const UNDO_WINDOW_MS = 10_000;

export interface UndoableDeleteOptions {
  /** Record id. Lists hide it (usePendingDeletes) while the undo window is open, and for good once deleted. */
  id?: string;
  /** Toast heading, e.g. "District deleted". */
  title: string;
  /** Usually the item's name. */
  description?: string;
  /** The real delete, sent once the window closes. Omit for removals from an unsaved draft. */
  commit?: () => Promise<unknown>;
  /** Runs after a successful commit — refresh lists and counts. */
  onCommitted?: () => unknown;
  /** Put local state back — on Undo, and when the commit fails. */
  onRestore?: () => void;
}

export interface UndoHandle {
  /** Drop the waiting delete without sending or restoring — a newer change made it moot. */
  discard: () => void;
}

interface Pending {
  options: UndoableDeleteOptions;
  timer: number;
}

const pending = new Map<string, Pending>();
let hidden: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
let sequence = 0;

const setHidden = (id: string, isHidden: boolean) => {
  const next = new Set(hidden);
  if (isHidden) next.add(id);
  else next.delete(id);
  hidden = next;
  listeners.forEach((listener) => listener());
};

// Our toasts draw their own surface; the Toaster's shared card styles would add a second box
const BARE = "!border-0 !bg-transparent !p-0 !shadow-none";

const showResult = (tone: "success" | "error", title: string, description?: string) =>
  toast.custom(() => <UndoResultToast tone={tone} title={title} description={description} />, {
    duration: tone === "success" ? 2500 : 6000,
    className: BARE,
  });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Ids deleted (or waiting out their undo window) this session — filter them out of lists. */
export function usePendingDeletes(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => hidden);
}

/**
 * Delete with a 10 second Undo: the row disappears now, the server delete runs when the
 * window closes. Undo cancels it and calls onRestore. A failed delete brings the row back.
 */
export function undoableDelete(options: UndoableDeleteOptions): UndoHandle {
  const key = `undo-delete-${++sequence}`;
  if (options.id) setHidden(options.id, true);
  pending.set(key, { options, timer: window.setTimeout(() => { void commit(key); }, UNDO_WINDOW_MS) });
  toast.custom(
    () => <UndoToast title={options.title} description={options.description} durationMs={UNDO_WINDOW_MS} onUndo={() => undo(key)} />,
    { id: key, duration: Infinity, className: BARE },
  );
  return {
    discard: () => {
      if (!take(key)) return;
      if (options.id) setHidden(options.id, false);
      toast.dismiss(key);
    },
  };
}

function take(key: string): UndoableDeleteOptions | null {
  const entry = pending.get(key);
  if (!entry) return null;
  pending.delete(key);
  window.clearTimeout(entry.timer);
  return entry.options;
}

function undo(key: string) {
  const options = take(key);
  if (!options) return;
  if (options.id) setHidden(options.id, false);
  options.onRestore?.();
  toast.dismiss(key);
  showResult("success", "Restored", options.description);
}

async function commit(key: string) {
  const options = take(key);
  if (!options) return;
  toast.dismiss(key);
  if (!options.commit) return;
  try {
    await options.commit();
  } catch (error) {
    if (options.id) setHidden(options.id, false);
    options.onRestore?.();
    showResult(
      "error",
      options.description ? `Couldn't delete ${options.description}` : "Couldn't delete",
      error instanceof Error ? error.message : "Please try again.",
    );
    return;
  }
  // The id stays hidden, so a list refreshing a moment late never flashes the deleted row.
  try {
    await options.onCommitted?.();
  } catch {
    // A failed refresh only leaves counts stale until the next load.
  }
}

/** Send every waiting delete now — before logout or a role switch, and when the tab closes. */
export function flushPendingDeletes(): void {
  [...pending.keys()].forEach((key) => { void commit(key); });
}

window.addEventListener("pagehide", flushPendingDeletes);
