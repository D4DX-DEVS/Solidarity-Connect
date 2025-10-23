import { Users, CheckCircle, Clock, Calendar, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
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
  const { userRole, userDistrict, userGroup } = useAuth();
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
    <div className="min-h-screen bg-background pb-20">
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Murabbi Panel"
        subtitle={userGroup ? `${userGroup} - ${userDistrict}` : "Applicant - Thrissur"}
      />

      <main className="p-4 space-y-4">
        <div className="flex justify-center">
          <Button
            onClick={() => navigate("/bulk-import")}
            className="w-full max-w-sm bg-success hover:bg-success/90"
          >
            <Upload className="h-4 w-4 mr-2" />
            Bulk Import
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => (
            <Card key={index} className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className={`text-3xl font-bold ${stat.color}`}>
                  {loading ? "..." : stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {dashboardData?.upcomingMeetings && dashboardData.upcomingMeetings.length > 0 && (
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">Upcoming Meetings</h2>
              <div className="space-y-2">
                {dashboardData.upcomingMeetings.slice(0, 3).map((meeting) => (
                  <div key={meeting._id} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{meeting.title}</span>
                    <span className="text-foreground">
                      {new Date(meeting.scheduledDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
