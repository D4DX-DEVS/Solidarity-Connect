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
        title="Murabbi Panel"
        subtitle={userGroup ? `${userGroup} - ${userDistrict}` : "Applicant - Thrissur"}
      />

      <main className="p-4 sm:p-5 max-w-5xl mx-auto space-y-6">
        <div className="flex justify-center">
          <Button
            onClick={() => navigate("/bulk-import")}
            className="w-full bg-success hover:bg-success/90 text-success-foreground font-medium py-6 rounded-2xl shadow-lg shadow-success/20 transition-all active:scale-[0.98]"
          >
            <Upload className="h-5 w-5 mr-2" />
            Bulk Import Data
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="border-none shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-card to-secondary/20">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  <div className={`p-2 rounded-xl bg-background shadow-sm ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
                <p className={`text-3xl font-bold tracking-tight ${stat.color}`}>
                  {loading ? "..." : stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <UserTargetsSection />

        {dashboardData?.upcomingMeetings && dashboardData.upcomingMeetings.length > 0 && (
          <Card className="border-none shadow-sm overflow-hidden bg-gradient-to-br from-card to-secondary/10">
            <CardContent className="p-5">
              <h2 className="font-bold text-lg mb-3 tracking-tight">Upcoming Meetings</h2>
              <div className="space-y-3">
                {dashboardData.upcomingMeetings.slice(0, 3).map((meeting) => (
                  <div key={meeting._id} className="flex justify-between items-center p-3 rounded-xl bg-background/50 border border-border/50 transition-colors hover:bg-background">
                    <span className="font-medium text-sm text-foreground">{meeting.title}</span>
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-md">
                      {new Date(meeting.scheduledDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-sm overflow-hidden bg-gradient-to-br from-card to-secondary/10">
          <CardContent className="p-5">
            <h2 className="font-bold text-lg mb-1 tracking-tight">Murabbi Actions</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Manage your members, track attendance, and handle requests efficiently.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-24 py-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-border/50 hover:bg-secondary/50 hover:border-blue-500/30 transition-all shadow-sm group bg-background/50 text-foreground"
                onClick={() => navigate("/role-management")}
              >
                <div className="p-2.5 rounded-full bg-blue-50 dark:bg-blue-500/10 group-hover:scale-110 transition-transform">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <span className="text-xs font-semibold">Role Management</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 py-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-border/50 hover:bg-secondary/50 hover:border-yellow-500/30 transition-all shadow-sm group bg-background/50 text-foreground"
                onClick={() => navigate("/leaders")}
              >
                <div className="p-2.5 rounded-full bg-yellow-50 dark:bg-yellow-500/10 group-hover:scale-110 transition-transform">
                  <Star className="h-5 w-5 text-yellow-500" />
                </div>
                <span className="text-xs font-semibold">Leaders</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 py-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-border/50 hover:bg-secondary/50 hover:border-indigo-500/30 transition-all shadow-sm group bg-background/50 text-foreground"
                onClick={() => navigate("/consolidation")}
              >
                <div className="p-2.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-5 w-5 text-indigo-500" />
                </div>
                <span className="text-xs font-semibold">Consolidation</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 py-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-border/50 hover:bg-secondary/50 hover:border-green-600/30 transition-all shadow-sm group bg-background/50 text-foreground col-span-2"
                onClick={() => navigate("/org-files")}
              >
                <div className="p-2.5 rounded-full bg-green-50 dark:bg-green-600/10 group-hover:scale-110 transition-transform">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-semibold">Membership Form & Files</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
