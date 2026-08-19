import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { notificationsAPI } from "@/utils/api";
import { cn } from "@/lib/utils";

const SEEN_KEY = "alertsSeenAt";

// ponytail: "unread" = newest notification is newer than the last time the bell was
// opened on this device (localStorage) — the API has no per-user read state.
export function NotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await notificationsAPI.getNotifications({ limit: 1, page: 1 });
        const latest = result.data?.[0]?.createdAt;
        if (cancelled || !latest) return;
        const seenAt = localStorage.getItem(SEEN_KEY);
        setHasUnread(!seenAt || new Date(latest) > new Date(seenAt));
      } catch {
        // no dot on failure
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openAlerts = () => {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
    setHasUnread(false);
    navigate("/notifications");
  };

  return (
    <Button size="icon" variant="outline" className={cn("relative shrink-0", className)} onClick={openAlerts} aria-label="Notifications">
      <Bell className="h-5 w-5" />
      {hasUnread && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" aria-hidden />}
    </Button>
  );
}
