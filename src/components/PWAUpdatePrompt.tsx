import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

/**
 * Shows a toast-style bar when a new SW version is ready.
 * User taps "Update" to reload with the new version.
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every hour in the background
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
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
