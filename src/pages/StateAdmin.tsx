import { Shield, Users, Building2, FileCheck, Settings, Bell, Upload, Wallet, BarChart3, Menu } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";

const StateAdmin = () => {
  const navigate = useNavigate();

  const adminActions = [
    { icon: Wallet, label: "Baithul Maal", path: "/state-admin/baithul-data", color: "text-primary" },
    { icon: BarChart3, label: "Group Reports", path: "/state-admin/group-reports", color: "text-primary" },
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
        {/* Quick Analysis Section */}
        <Card className="shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Quick Analysis
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background/80 backdrop-blur rounded-lg p-3">
                <p className="text-2xl font-bold text-primary">1,247</p>
                <p className="text-xs text-muted-foreground">Total Members</p>
                <p className="text-xs text-success mt-1">↑ 12% this month</p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3">
                <p className="text-2xl font-bold text-success">1,089</p>
                <p className="text-xs text-muted-foreground">Active Members</p>
                <p className="text-xs text-muted-foreground mt-1">87.3% of total</p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3">
                <p className="text-2xl font-bold text-orange-500">₹4.2L</p>
                <p className="text-xs text-muted-foreground">Baithul Maal</p>
                <p className="text-xs text-success mt-1">↑ ₹45k this month</p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3">
                <p className="text-2xl font-bold text-destructive">23</p>
                <p className="text-xs text-muted-foreground">Pending Actions</p>
                <p className="text-xs text-orange-500 mt-1">Needs attention</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Administrative Controls</h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate("/state-admin/districts")}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Manage Districts
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/state-admin/groups")}>
                    <Users className="h-4 w-4 mr-2" />
                    Manage Groups
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled>
                    <Settings className="h-4 w-4 mr-2" />
                    Master Data Management
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
