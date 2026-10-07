import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Undo2 } from "lucide-react";
import { langOf } from "@/lib/malayalam";
import { cn } from "@/lib/utils";

const SURFACE =
  "relative w-full overflow-hidden rounded-2xl bg-zinc-900/95 text-white shadow-2xl shadow-black/25 ring-1 ring-white/10 backdrop-blur-md";

function ToastText({ title, description }: { title: string; description?: string }) {
  return (
    <div className="min-w-0 flex-1" role="status">
      <p className="truncate text-sm font-semibold leading-relaxed" lang={langOf(title)}>{title}</p>
      {description ? (
        <p className="truncate text-xs leading-relaxed text-white/60" lang={langOf(description)} title={description}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

interface UndoToastProps {
  title: string;
  description?: string;
  durationMs: number;
  onUndo: () => void;
}

/** Dark snackbar: countdown ring, what was deleted, and Undo — the ring and bar run out with the window. */
export function UndoToast({ title, description, durationMs, onUndo }: UndoToastProps) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000));

  useEffect(() => {
    const started = Date.now();
    const tick = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((durationMs - (Date.now() - started)) / 1000)));
    }, 250);
    return () => window.clearInterval(tick);
  }, [durationMs]);

  const drain = { animationDuration: `${durationMs}ms` };

  return (
    <div className={SURFACE}>
      <div className="flex items-center gap-3 p-2.5 pl-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center" aria-hidden>
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-white/15" />
            <circle
              cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round" pathLength={100}
              strokeDasharray="100" className="animate-undo-ring stroke-primary" style={drain}
            />
          </svg>
          <span className="text-sm font-bold tabular-nums">{secondsLeft}</span>
        </div>
        <ToastText title={title} description={description} />
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 active:scale-95"
        >
          <Undo2 className="size-4" aria-hidden />
          Undo
        </button>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10" aria-hidden>
        <div className="h-full origin-left animate-undo-bar bg-primary" style={drain} />
      </div>
    </div>
  );
}

interface UndoResultToastProps {
  tone: "success" | "error";
  title: string;
  description?: string;
}

/** Follow-up in the same style: "Restored", or a delete the server refused. */
export function UndoResultToast({ tone, title, description }: UndoResultToastProps) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div className={SURFACE}>
      <div className="flex items-center gap-3 p-2.5 pl-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            tone === "success" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </div>
        <ToastText title={title} description={description} />
      </div>
    </div>
  );
}
