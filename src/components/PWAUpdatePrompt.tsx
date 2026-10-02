import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Shows a toast-style bar when a new SW version is ready.
 * User taps "Update" to reload with the new version.
 *
 * An installed PWA resumes from memory without navigating, so the browser never
 * re-checks sw.js by itself — check on resume, on reconnect and on a timer.
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return;
      const checkForUpdate = () => {
        if (r.installing || !navigator.onLine) return;
        r.update().catch(() => {
          // Server unreachable — next resume/interval retries
        });
      };
      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("online", checkForUpdate);
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 bg-primary text-primary-foreground rounded-xl shadow-lg p-4 flex items-center gap-3 animate-in slide-in-from-top-4">
      <RefreshCw className="h-5 w-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium">A new version is available!</p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => updateServiceWorker(true)}
      >
        Update now
      </Button>
    </div>
  );
}
