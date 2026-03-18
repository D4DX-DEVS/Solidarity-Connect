import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

/**
 * Shows a bottom banner prompting users to install the PWA.
 * Disappears once installed or dismissed.
 */
export function PWAInstallBanner() {
  const { isInstallable, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) return null;

  const handleInstall = async () => {
    const accepted = await install();
    if (!accepted) setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-card border border-border rounded-xl shadow-lg p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <img src="/logo.png" alt="SOLIDARITY" className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Install SOLIDARITY</p>
        <p className="text-xs text-muted-foreground">Add to home screen for offline access</p>
      </div>
      <Button size="sm" onClick={handleInstall} className="flex-shrink-0">
        <Download className="h-4 w-4 mr-1" />
        Install
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="flex-shrink-0 p-1 h-auto"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
