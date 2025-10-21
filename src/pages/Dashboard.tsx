import { Users, CheckCircle, Clock, Calendar, Upload, Bell, Menu } from "lucide-react";
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
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { userRole, userDistrict, userGroup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect based on role
    if (userRole === "state_admin") {
      navigate("/state-admin");
    } else if (userRole === "district_admin") {
      navigate("/district-admin");
    }
  }, [userRole, navigate]);
  const stats = [
    { label: "Total Members", value: "17", icon: Users, color: "text-primary" },
    { label: "Active Members", value: "3", icon: CheckCircle, color: "text-success" },
    { label: "Pending Requests", value: "0", icon: Clock, color: "text-destructive" },
    { label: "Pending Meetings", value: "4", icon: Calendar, color: "text-foreground" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Murabbi Panel"
        subtitle={userGroup ? `${userGroup} - ${userDistrict}` : "Applicant - Thrissur"}
      />

      <main className="p-4 space-y-4">
        <div className="flex gap-3">
          <Button
            onClick={() => navigate("/bulk-import")}
            className="flex-1 bg-success hover:bg-success/90"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1">
                <Menu className="h-4 w-4 mr-2" />
                Master Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/bulk-import")}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import Members
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/state-admin/send-notification")}>
                <Bell className="h-4 w-4 mr-2" />
                Send Notifications
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Menu className="h-4 w-4 mr-2" />
                More Options
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => (
            <Card key={index} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-2">Murabbi Actions</h2>
            <p className="text-sm text-muted-foreground">
              Manage your members, track attendance, and handle requests efficiently.
            </p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
