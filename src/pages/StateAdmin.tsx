import { Shield, Users, Building2, FileCheck, Settings, Bell, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";

const StateAdmin = () => {
  const navigate = useNavigate();

  const adminActions = [
    { icon: Building2, label: "Manage Districts", path: "/state-admin/districts", color: "text-primary" },
    { icon: Users, label: "Manage Groups", path: "/state-admin/groups", color: "text-primary" },
    { icon: FileCheck, label: "Transfer Approvals", path: "/state-admin/transfer-approvals", color: "text-orange-500" },
    { icon: Settings, label: "Meeting Agenda", path: "/state-admin/meeting-agenda", color: "text-primary" },
    { icon: Bell, label: "Send Notifications", path: "/state-admin/send-notification", color: "text-destructive" },
    { icon: Upload, label: "Bulk Import", path: "/bulk-import", color: "text-success" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">State Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Full System Control</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">Administrative Controls</h2>
            <div className="grid grid-cols-2 gap-3">
              {adminActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => navigate(action.path)}
                >
                  <action.icon className={`h-6 w-6 ${action.color}`} />
                  <span className="text-xs text-center">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-2">Quick Stats</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Districts:</span>
                <span className="font-semibold">12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Groups:</span>
                <span className="font-semibold">85</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Members:</span>
                <span className="font-semibold">1,247</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending Approvals:</span>
                <span className="font-semibold text-orange-500">23</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default StateAdmin;
