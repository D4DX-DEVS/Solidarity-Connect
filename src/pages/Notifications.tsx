import { Bell, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Notifications = () => {
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const notifications = [
    {
      id: 1,
      title: "Meeting Reminder",
      message: "Monthly general meeting scheduled for October 25, 2025 at 7:00 PM",
      date: "2025-10-21",
      type: "Meeting",
      from: "State Admin",
    },
    {
      id: 2,
      title: "Baithul Maal Collection",
      message: "Please ensure all members submit their monthly Baithul Maal contributions by month end",
      date: "2025-10-20",
      type: "Payment",
      from: "State Admin",
    },
    {
      id: 3,
      title: "New Activity Target",
      message: "Daily prayer tracking has been activated. Please update member records accordingly",
      date: "2025-10-19",
      type: "Activity",
      from: "State Admin",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Bell className="h-6 w-6 text-primary-foreground" />}
        title="Notifications"
      />

      <main className="p-4 space-y-4">
        {userRole === "state_admin" && (
          <Button
            onClick={() => navigate("/state-admin/send-notification")}
            className="w-full bg-primary hover:bg-primary/90"
          >
            <Send className="h-4 w-4 mr-2" />
            Send New Notification
          </Button>
        )}

        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification.id} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold">{notification.title}</h3>
                  <Badge variant="outline">{notification.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>From: {notification.from}</span>
                  <span>{notification.date}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Notifications;
