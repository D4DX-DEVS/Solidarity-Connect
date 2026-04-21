import { Shield, Users, Building2, FileCheck, Settings, Bell, Upload, Wallet, BarChart3, Menu, Calendar, Target, UserCog, Star, Megaphone, FolderOpen, RefreshCw, CheckCircle, X } from "lucide-react";
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
import { reportsAPI, usersAPI, baithulMaalAPI, apiCall } from "@/utils/api";

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

  // State admin recurring targets
  const [myRecurringTargets, setMyRecurringTargets] = useState<any[]>([]);
  const [myMarks, setMyMarks] = useState<Record<string, Record<string, boolean>>>({});
  const [markingLoading, setMarkingLoading] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const WEEKLY_SLOTS = [1, 2, 3, 4, 5];

  const getWeeksInMonth = (year: number, monthIdx0: number): number => {
    const firstDay = new Date(year, monthIdx0, 1).getDay();
    const daysInMonth = new Date(year, monthIdx0 + 1, 0).getDate();
    return Math.ceil((firstDay + daysInMonth) / 7);
  };

  const adminActions = [
    { icon: UserCog, label: "User Management", path: "/state-admin/users", color: "text-purple-500" },
    { icon: Target, label: "Personal Targets", path: "/personal-targets", color: "text-purple-500" },
    { icon: Wallet, label: "Baithul Maal", path: "/state-admin/baithul-data", color: "text-primary" },
    { icon: BarChart3, label: "Group Reports", path: "/state-admin/group-reports", color: "text-primary" },
    { icon: FileCheck, label: "Transfer Approvals", path: "/state-admin/transfer-approvals", color: "text-orange-500" },
    { icon: Bell, label: "Send Notifications", path: "/state-admin/send-notification", color: "text-destructive" },
    { icon: Shield, label: "Role Management", path: "/role-management", color: "text-blue-500" },
    { icon: Star, label: "Leaders", path: "/leaders", color: "text-yellow-500" },
    { icon: Megaphone, label: "Announcements", path: "/announcements", color: "text-green-600" },
    { icon: FolderOpen, label: "Org Files", path: "/org-files", color: "text-teal-500" },
    { icon: BarChart3, label: "Consolidation", path: "/consolidation", color: "text-indigo-500" },
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
      const dashboardResult = await reportsAPI.getDashboard();
      setDashboardData(dashboardResult.data);

      // Fetch user statistics
      const userStatsResult = await usersAPI.getUserStats();
      setUserStats(userStatsResult.data.statistics);

      // Fetch Baithul Maal statistics
      const baithulMaalResult = await baithulMaalAPI.getStats();
      setBaithulMaalStats(baithulMaalResult.data);

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
    fetchMyRecurringTargets();
    fetchMyMarks();
  }, []);

  const fetchMyRecurringTargets = async () => {
    try {
      const res = await apiCall('/personal-targets?isRecurring=true&targetAudience=state_admins&limit=50');
      const now = new Date();
      const filtered = (res.data || []).filter((t: any) =>
        t.isRecurring && t.targetAudience === 'state_admins' &&
        t.status === 'active' &&
        new Date(t.startDate) <= now && new Date(t.endDate) >= now
      );
      setMyRecurringTargets(filtered);
    } catch {}
  };

  const fetchMyMarks = async () => {
    try {
      const res = await apiCall('/recurring-marks/my');
      const marksMap: Record<string, Record<string, boolean>> = {};
      for (const m of (res.data || [])) {
        if (!marksMap[m.targetId]) marksMap[m.targetId] = {};
        const week = m.week || 0;
        marksMap[m.targetId][`${m.year}-${m.month}-${week}`] = m.completed;
      }
      setMyMarks(marksMap);
    } catch {}
  };

  const toggleMark = async (targetId: string, year: number, month: number, week: number = 0) => {
    const key = `${year}-${month}-${week}`;
    const current = myMarks[targetId]?.[key] || false;
    const loadingKey = `${targetId}-${key}`;
    setMarkingLoading(loadingKey);
    try {
      await apiCall('/recurring-marks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId, year, month, week, completed: !current }) });
      setMyMarks(prev => ({
        ...prev,
        [targetId]: { ...prev[targetId], [key]: !current }
      }));
    } catch {
      toast({ title: "Error", description: "Failed to update mark", variant: "destructive" });
    } finally {
      setMarkingLoading(null);
    }
  };

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
                  <DropdownMenuItem onClick={() => navigate("/state-admin/users")}>
                    <UserCog className="h-4 w-4 mr-2" />
                    User Management
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/personal-targets")}>
                    <Target className="h-4 w-4 mr-2" />
                    Personal Targets
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/role-management")}>
                    <Shield className="h-4 w-4 mr-2" />
                    Role Management
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/leaders")}>
                    <Star className="h-4 w-4 mr-2" />
                    Leaders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/announcements")}>
                    <Megaphone className="h-4 w-4 mr-2" />
                    Announcements
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

        {/* State Admin Recurring Targets */}
        {myRecurringTargets.length > 0 && (
          <Card className="shadow-sm border-blue-100">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <h2 className="font-semibold text-sm">My Recurring Targets</h2>
              </div>
              <div className="space-y-4">
                {myRecurringTargets.map((target: any) => {
                  const freq = target.recurringFrequency || 'monthly';
                  const isWeekly = freq === 'weekly';
                  return (
                    <div key={target._id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-sm">{target.title}</p>
                        {isWeekly && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Weekly</span>
                        )}
                      </div>

                      {isWeekly ? (
                        /* ── Weekly grid: month rows × week columns ── */
                        <div className="space-y-1.5">
                          {MONTHS_SHORT.map((month, idx) => {
                            const monthNum = idx + 1;
                            const weeksInMonth = getWeeksInMonth(currentYear, idx);
                            const monthIsFuture = monthNum > currentMonth;
                            return (
                              <div key={monthNum} className="flex items-center gap-2">
                                <span className="text-xs font-medium w-8 shrink-0 text-muted-foreground">{month}</span>
                                <div className="grid grid-cols-5 gap-1 flex-1">
                                  {WEEKLY_SLOTS.map((weekNum) => {
                                    const exists = weekNum <= weeksInMonth;
                                    if (!exists) return <div key={weekNum} className="h-7" aria-hidden />;
                                    const key = `${currentYear}-${monthNum}-${weekNum}`;
                                    const completed = myMarks[target._id]?.[key] || false;
                                    const loadingKey = `${target._id}-${key}`;
                                    const isFuture = monthIsFuture;
                                    return (
                                      <button
                                        key={weekNum}
                                        onClick={() => !isFuture && toggleMark(target._id, currentYear, monthNum, weekNum)}
                                        disabled={markingLoading === loadingKey || isFuture}
                                        title={isFuture ? 'Future week' : `${month} W${weekNum}`}
                                        className={`h-7 rounded text-[10px] font-medium transition-all border ${
                                          completed
                                            ? 'bg-green-500 border-green-500 text-white'
                                            : isFuture
                                              ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                                              : 'bg-white border-gray-200 text-gray-500 hover:border-primary hover:text-primary'
                                        } ${markingLoading === loadingKey ? 'opacity-60 cursor-wait' : ''}`}
                                      >
                                        {completed ? '✓' : `W${weekNum}`}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* ── Monthly grid (existing) ── */
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr>
                                {MONTHS_SHORT.map((m, i) => (
                                  <th key={i} className="p-1 text-center text-muted-foreground font-medium min-w-[36px]">{m}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {Array.from({ length: 12 }, (_, i) => {
                                  const monthNum = i + 1;
                                  const isFuture = monthNum > currentMonth;
                                  const key = `${currentYear}-${monthNum}-0`;
                                  const completed = myMarks[target._id]?.[key] || false;
                                  const loadingKey = `${target._id}-${key}`;
                                  return (
                                    <td key={monthNum} className="p-1 text-center">
                                      {isFuture ? (
                                        <span className="text-gray-200 text-base">–</span>
                                      ) : (
                                        <button
                                          onClick={() => toggleMark(target._id, currentYear, monthNum, 0)}
                                          disabled={markingLoading === loadingKey}
                                          className="mx-auto flex items-center justify-center w-7 h-7 rounded-full hover:bg-muted transition-colors"
                                        >
                                          {completed
                                            ? <CheckCircle className="h-5 w-5 text-green-500" />
                                            : <X className="h-4 w-4 text-gray-300" />
                                          }
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-2 text-right">{currentYear}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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
