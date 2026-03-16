import { Users, CheckCircle, Clock, Calendar, Upload, Shield, Star, FileText, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import UserTargetsSection from "@/components/UserTargetsSection";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { reportsAPI } from "@/utils/api";

interface DashboardData {
  memberStatistics: {
    totalMembers: number;
    activeMembers: number;
    pendingMembers: number;
    applicantMembers: number;
  };
  upcomingMeetings: Array<{
    _id: string;
    title: string;
    scheduledDate: string;
  }>;
  pendingRequestsCount: number;
}

const Dashboard = () => {
  const { userRole, userDistrict, userGroup, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect based on role
    if (userRole === "state_admin") {
      navigate("/state-admin");
    } else if (userRole === "district_admin") {
      navigate("/district-admin");
    }
  }, [userRole, navigate]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const result = await reportsAPI.getDashboard();

        if (result && result.data) {
          setDashboardData(result.data);
        } else {
          toast({
            title: "Error",
            description: result?.message || "Failed to fetch dashboard data",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (userRole === 'group_admin') {
      fetchDashboardData();
    }
  }, [userRole, toast]);

  const stats = dashboardData ? [
    {
      label: "Total Members",
      value: dashboardData.memberStatistics.totalMembers.toString(),
      icon: Users,
      color: "text-primary"
    },
    {
      label: "Active Members",
      value: dashboardData.memberStatistics.activeMembers.toString(),
      icon: CheckCircle,
      color: "text-success"
    },
    {
      label: "Pending Requests",
      value: dashboardData.pendingRequestsCount.toString(),
      icon: Clock,
      color: "text-destructive"
    },
    {
      label: "Upcoming Meetings",
      value: dashboardData.upcomingMeetings.length.toString(),
      icon: Calendar,
      color: "text-foreground"
    },
  ] : [
    { label: "Total Members", value: "0", icon: Users, color: "text-primary" },
    { label: "Active Members", value: "0", icon: CheckCircle, color: "text-success" },
    { label: "Pending Requests", value: "0", icon: Clock, color: "text-destructive" },
    { label: "Upcoming Meetings", value: "0", icon: Calendar, color: "text-foreground" },
  ];

  return (
    <div className="min-h-screen bg-background pb-28">
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Area Admin Panel"
        subtitle={userGroup ? `${userGroup} - ${userDistrict}` : "Applicant - Thrissur"}
      />

      <main className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => (
            <Card key={index} className="shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>
                  {loading ? "..." : stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* My Targets */}
        <UserTargetsSection />

        {/* Upcoming Meetings */}
        {dashboardData?.upcomingMeetings && dashboardData.upcomingMeetings.length > 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3">Upcoming Meetings</h2>
              <div className="space-y-2">
                {dashboardData.upcomingMeetings.slice(0, 3).map((meeting) => (
                  <div key={meeting._id} className="flex justify-between items-center p-2 rounded-lg bg-muted/50 border border-border/50">
                    <span className="font-medium text-sm">{meeting.title}</span>
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {new Date(meeting.scheduledDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Area Admin Tools */}
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">Area Admin Tools</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Members", path: "/members", Icon: Users },
                { label: "Meetings", path: "/meetings", Icon: Calendar },
                { label: "Role Management", path: "/role-management", Icon: Shield },
                { label: "Leaders", path: "/leaders", Icon: Star },
                { label: "Consolidation", path: "/consolidation", Icon: BarChart3 },
                { label: "Bulk Import", path: "/bulk-import", Icon: Upload },
                { label: "Membership Form & Files", path: "/org-files", Icon: FileText },
              ].map(({ label, path, Icon }) => (
                <Button key={label} variant="outline" className="h-14 flex-col gap-1 text-xs" onClick={() => navigate(path)}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
