import { Bell } from "lucide-react";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import AnnouncementsPanel from "@/components/AnnouncementsPanel";

// ponytail: single alerts surface — the panel lists every notification type
// and owns the compose form; the old notifications/announcements tabs are gone.
const Notifications = () => {
  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Bell className="h-6 w-6 text-primary-foreground" />}
        title="Alerts"
      />

      <main className="app-main pt-4 space-y-4">
        <AnnouncementsPanel />
      </main>
    </div>
  );
};

export default Notifications;
