import { Shield, Users, Building2, FileCheck, Settings, Bell, Upload, Wallet, BarChart3, Menu, Calendar } from "lucide-react";
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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface DashboardData {
  memberStatistics: {
    totalMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    abroadMembers: number;
    applicantMembers: number;
    approvedMembers: number;
    pendingMembers: number;
    totalBaithulMaal: number;
    averageAge: number;
  };
  groupStatistics: {
    totalGroups: number;
    activeGroups: number;
  } | null;
  districtStatistics: {
    totalDistricts: number;
    activeDistricts: number;
  } | null;
  recentMembers: any[];
  upcomingMeetings: any[];
  pendingRequestsCount: number;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  stateAdmins: number;
  districtAdmins: number;
  groupAdmins: number;
}

interface BaithulMaalStats {
  overallStatistics: {
    totalMembers: number;
    contributingMembers: number;
    totalMonthlyAmount: number;
    averageMonthlyAmount: number;
    totalCollected: number;
    totalPaid: number;
    totalBalance: number;
  };
}

const StateAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [baithulMaalStats, setBaithulMaalStats] = useState<BaithulMaalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const adminActions = [
    { icon: Wallet, label: "Baithul Maal", path: "/state-admin/baithul-data", color: "text-primary" },
    { icon: BarChart3, label: "Group Reports", path: "/state-admin/group-reports", color: "text-primary" },
    { icon: Calendar, label: "Meeting Reports", path: "/state-admin/meetings", color: "text-blue-500" },
    { icon: FileCheck, label: "Transfer Approvals", path: "/state-admin/transfer-approvals", color: "text-orange-500" },
    { icon: Bell, label: "Send Notifications", path: "/state-admin/send-notification", color: "text-destructive" },
    { icon: Upload, label: "Bulk Import", path: "/bulk-import", color: "text-success" },
  ];

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch dashboard overview
      const dashboardResponse = await fetch('/api/reports/dashboard', { headers });
      if (dashboardResponse.ok) {
        const dashboardResult = await dashboardResponse.json();
        setDashboardData(dashboardResult.data);
      }

      // Fetch user statistics
      const userStatsResponse = await fetch('/api/users/stats/overview', { headers });
      if (userStatsResponse.ok) {
        const userStatsResult = await userStatsResponse.json();
        setUserStats(userStatsResult.data.statistics);
      }

      // Fetch Baithul Maal statistics
      const baithulMaalResponse = await fetch('/api/baithul-maal/stats', { headers });
      if (baithulMaalResponse.ok) {
        const baithulMaalResult = await baithulMaalResponse.json();
        setBaithulMaalStats(baithulMaalResult.data);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}k`;
    }
    return `₹${amount}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

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
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              navigate("/login");
            }}
          >
            Logout
          </Button>
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
                <p className="text-2xl font-bold text-primary">
                  {dashboardData?.memberStatistics?.totalMembers?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-muted-foreground">Total Members</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboardData?.memberStatistics?.activeMembers || 0} active
                </p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3">
                <p className="text-2xl font-bold text-success">
                  {dashboardData?.memberStatistics?.activeMembers?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-muted-foreground">Active Members</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {dashboardData?.memberStatistics?.totalMembers 
                    ? Math.round((dashboardData.memberStatistics.activeMembers / dashboardData.memberStatistics.totalMembers) * 100)
                    : 0}% of total
                </p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3">
                <p className="text-2xl font-bold text-orange-500">
                  {baithulMaalStats?.overallStatistics?.totalBalance 
                    ? formatCurrency(baithulMaalStats.overallStatistics.totalBalance)
                    : '₹0'}
                </p>
                <p className="text-xs text-muted-foreground">Baithul Maal Balance</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(baithulMaalStats?.overallStatistics?.totalMonthlyAmount || 0)} monthly
                </p>
              </div>
              <div className="bg-background/80 backdrop-blur rounded-lg p-3">
                <p className="text-2xl font-bold text-destructive">
                  {dashboardData?.pendingRequestsCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">Pending Actions</p>
                <p className="text-xs text-orange-500 mt-1">
                  {dashboardData?.pendingRequestsCount ? 'Needs attention' : 'All clear'}
                </p>
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
                    Manage
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
                  <DropdownMenuItem onClick={() => navigate("/state-admin/meeting-agenda")}>
                    <Settings className="h-4 w-4 mr-2" />
                    Meeting Agenda
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/state-admin/meetings")}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Meeting Reports
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
                <span className="font-semibold">
                  {dashboardData?.districtStatistics?.totalDistricts || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Groups:</span>
                <span className="font-semibold">
                  {dashboardData?.groupStatistics?.totalGroups || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Members:</span>
                <span className="font-semibold">
                  {dashboardData?.memberStatistics?.totalMembers?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Users:</span>
                <span className="font-semibold">
                  {userStats?.totalUsers?.toLocaleString() || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending Approvals:</span>
                <span className={`font-semibold ${dashboardData?.pendingRequestsCount ? 'text-orange-500' : 'text-success'}`}>
                  {dashboardData?.pendingRequestsCount || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contributing Members:</span>
                <span className="font-semibold text-primary">
                  {baithulMaalStats?.overallStatistics?.contributingMembers || 0}
                </span>
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
