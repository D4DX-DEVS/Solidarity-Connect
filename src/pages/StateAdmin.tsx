import { Shield, Users, Building2, FileCheck, Settings, Bell, Upload, Wallet, BarChart3, Menu, Calendar, Target, UserCog, Star, Megaphone, FolderOpen, RefreshCw, CheckCircle, X, LogOut, Database } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { MetricCard, PageHero, PageShell, SectionCard } from "@/components/app/AppShell";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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
    totalPaidAmount: number;
    averageMonthlyAmount: number;
    minAmount: number;
    maxAmount: number;
  };
}

const StateAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
  const [selectedRecurringMonth, setSelectedRecurringMonth] = useState(currentMonth);
  const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const WEEKLY_SLOTS = [1, 2, 3, 4, 5];

  const getWeeksInMonth = (year: number, monthIdx0: number): number => {
    const firstDay = new Date(year, monthIdx0, 1).getDay();
    const daysInMonth = new Date(year, monthIdx0 + 1, 0).getDate();
    return Math.ceil((firstDay + daysInMonth) / 7);
  };

  const adminActions = [
    { icon: Database, label: "Master Data", path: "/state-admin/master-data", color: "text-emerald-600" },
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

  const getCompletedRecurringCount = (targetId: string, isWeekly: boolean) => {
    if (isWeekly) {
      let total = 0;
      for (let month = 1; month <= currentMonth; month += 1) {
        const weeksInMonth = getWeeksInMonth(currentYear, month - 1);
        for (const week of WEEKLY_SLOTS) {
          if (week > weeksInMonth) {
            continue;
          }
          if (myMarks[targetId]?.[`${currentYear}-${month}-${week}`]) {
            total += 1;
          }
        }
      }
      return total;
    }

    let total = 0;
    for (let month = 1; month <= currentMonth; month += 1) {
      if (myMarks[targetId]?.[`${currentYear}-${month}-0`]) {
        total += 1;
      }
    }
    return total;
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    } else if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}k`;
    }
    return `₹${amount}`;
  };

  const analysisCards = [
    {
      title: "Total Members",
      value: dashboardData?.memberStatistics?.totalMembers?.toLocaleString() || "0",
      detail: `${dashboardData?.memberStatistics?.activeMembers || 0} active members`,
      icon: Users,
      tone: "primary" as const,
    },
    {
      title: "Active Members",
      value: dashboardData?.memberStatistics?.activeMembers?.toLocaleString() || "0",
      detail: `${dashboardData?.memberStatistics?.totalMembers ? Math.round((dashboardData.memberStatistics.activeMembers / dashboardData.memberStatistics.totalMembers) * 100) : 0}% of total members`,
      icon: CheckCircle,
      tone: "success" as const,
    },
    {
      title: "Baithul Maal",
      value: baithulMaalStats?.overallStatistics?.totalMonthlyAmount ? formatCurrency(baithulMaalStats.overallStatistics.totalMonthlyAmount) : "₹0",
      detail: `${baithulMaalStats?.overallStatistics?.contributingMembers || 0} contributing members`,
      icon: Wallet,
      tone: "warning" as const,
    },
    {
      title: "Pending Actions",
      value: String(dashboardData?.pendingRequestsCount || 0),
      detail: dashboardData?.pendingRequestsCount ? "Needs attention" : "All clear",
      icon: FileCheck,
      tone: dashboardData?.pendingRequestsCount ? "danger" : "neutral",
    },
  ];

  const quickStats = [
    { label: "Total Districts", value: dashboardData?.districtStatistics?.totalDistricts || 0 },
    { label: "Total Groups", value: dashboardData?.groupStatistics?.totalGroups || 0 },
    { label: "Total Members", value: dashboardData?.memberStatistics?.totalMembers?.toLocaleString() || "0" },
    { label: "Total Users", value: userStats?.totalUsers?.toLocaleString() || "0" },
    { label: "Pending Approvals", value: dashboardData?.pendingRequestsCount || 0 },
    { label: "Contributing Members", value: baithulMaalStats?.overallStatistics?.contributingMembers || 0 },
  ];

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
    <PageShell>
      <PageHero
        eyebrow="State Overview"
        title="State Admin Panel"
        subtitle="A modern control center for people, approvals, reports, and recurring progress across the entire system."
        icon={<Shield className="h-6 w-6" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        }
        details={
          <>
            <div className="data-strip">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total Members</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{dashboardData?.memberStatistics?.totalMembers?.toLocaleString() || "0"}</p>
            </div>
            <div className="data-strip">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Active Members</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{dashboardData?.memberStatistics?.activeMembers?.toLocaleString() || "0"}</p>
            </div>
            <div className="data-strip">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Monthly Collection</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{baithulMaalStats?.overallStatistics?.totalMonthlyAmount ? formatCurrency(baithulMaalStats.overallStatistics.totalMonthlyAmount) : "₹0"}</p>
            </div>
            <div className="data-strip">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pending Actions</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{dashboardData?.pendingRequestsCount || 0}</p>
            </div>
          </>
        }
      />

      <SectionCard title="Quick Analysis" description="Key state-level signals arranged for mobile and desktop scanning.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {analysisCards.map((card) => (
                <MetricCard
                  key={card.title}
                  title={card.title}
                  value={card.value}
                  detail={card.detail}
                  icon={card.icon}
                  tone={card.tone}
                />
              ))}
            </div>
      </SectionCard>

      <SectionCard
        title="Administrative Controls"
        description="High-traffic admin workflows with cleaner grouping and larger touch targets."
        action={
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
        }
      >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {adminActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="action-tile h-auto"
                  onClick={() => navigate(action.path)}
                >
                  <div className="action-tile-icon">
                    <action.icon className={`h-5 w-5 ${action.color}`} />
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-sm font-semibold text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">Open {action.label.toLowerCase()} tools.</p>
                  </div>
                </Button>
              ))}
            </div>
      </SectionCard>

        {myRecurringTargets.length > 0 && (
          <SectionCard title="My Recurring Targets" description="Mark monthly and weekly progress without losing context.">
              <div className="mb-4 rounded-[1.6rem] border border-border/70 bg-background/75 p-3 backdrop-blur-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Focused Month</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{MONTHS_SHORT[selectedRecurringMonth - 1]} {currentYear}</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 sm:justify-end">
                    {MONTHS_SHORT.map((month, index) => {
                      const monthNum = index + 1;
                      const isActive = monthNum === selectedRecurringMonth;
                      const isFuture = monthNum > currentMonth;
                      return (
                        <button
                          key={month}
                          type="button"
                          onClick={() => setSelectedRecurringMonth(monthNum)}
                          disabled={isFuture}
                          aria-pressed={isActive}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : isFuture
                                ? 'bg-muted text-muted-foreground/60'
                                : 'bg-white text-muted-foreground hover:text-foreground'
                          } ${isFuture ? 'cursor-not-allowed' : ''}`}
                        >
                          {month}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {myRecurringTargets.map((target: any) => {
                  const freq = target.recurringFrequency || 'monthly';
                  const isWeekly = freq === 'weekly';
                  const selectedMonthLabel = MONTHS_SHORT[selectedRecurringMonth - 1];
                  const selectedMonthIsFuture = selectedRecurringMonth > currentMonth;
                  const completedCount = getCompletedRecurringCount(target._id, isWeekly);
                  return (
                    <div key={target._id} className="data-strip rounded-[1.6rem] p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{target.title}</p>
                          {isWeekly && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Weekly</span>
                          )}
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                          {completedCount} {isWeekly ? 'weeks done' : 'months done'}
                        </span>
                      </div>

                      {isWeekly ? (
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                          <div className="space-y-2">
                            <div>
                              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected Month</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{selectedMonthLabel} {currentYear}</p>
                            </div>
                            <div className="grid grid-cols-5 gap-2">
                              {WEEKLY_SLOTS.map((weekNum) => {
                                const weeksInMonth = getWeeksInMonth(currentYear, selectedRecurringMonth - 1);
                                const exists = weekNum <= weeksInMonth;
                                if (!exists) {
                                  return <div key={weekNum} className="h-10" aria-hidden />;
                                }
                                const key = `${currentYear}-${selectedRecurringMonth}-${weekNum}`;
                                const completed = myMarks[target._id]?.[key] || false;
                                const loadingKey = `${target._id}-${key}`;
                                return (
                                  <button
                                    key={weekNum}
                                    type="button"
                                    onClick={() => !selectedMonthIsFuture && toggleMark(target._id, currentYear, selectedRecurringMonth, weekNum)}
                                    disabled={markingLoading === loadingKey || selectedMonthIsFuture}
                                    title={selectedMonthIsFuture ? 'Future week' : `${selectedMonthLabel} W${weekNum}`}
                                    className={`h-10 rounded-2xl border text-xs font-semibold transition-all ${
                                      completed
                                        ? 'border-green-500 bg-green-500 text-white'
                                        : selectedMonthIsFuture
                                          ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                                          : 'border-gray-200 bg-white text-gray-500 hover:border-primary hover:text-primary'
                                    } ${markingLoading === loadingKey ? 'cursor-wait opacity-60' : ''}`}
                                  >
                                    {completed ? '✓' : `W${weekNum}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm lg:min-w-[148px]">
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                            <p className="mt-1 font-semibold text-foreground">
                              {selectedMonthIsFuture ? 'Locked until month starts' : 'Tap a week to update'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 rounded-[1.4rem] border border-white/70 bg-white/80 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Selected Month</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{selectedMonthLabel} {currentYear}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {selectedMonthIsFuture ? 'Available when the month begins.' : 'Use the toggle to mark this month complete.'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 rounded-2xl bg-background/80 px-3 py-2">
                            {selectedMonthIsFuture ? (
                              <span className="text-xs font-semibold text-muted-foreground">Locked</span>
                            ) : (
                              (() => {
                                const key = `${currentYear}-${selectedRecurringMonth}-0`;
                                const completed = myMarks[target._id]?.[key] || false;
                                const loadingKey = `${target._id}-${key}`;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => toggleMark(target._id, currentYear, selectedRecurringMonth, 0)}
                                    disabled={markingLoading === loadingKey}
                                    className={`flex min-w-[144px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                                      completed
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white text-muted-foreground hover:text-foreground'
                                    } ${markingLoading === loadingKey ? 'cursor-wait opacity-60' : ''}`}
                                  >
                                    {completed ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                    {completed ? 'Completed' : 'Mark Month'}
                                  </button>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-2 text-right">{currentYear}</p>
                    </div>
                  );
                })}
              </div>
          </SectionCard>
        )}

      <SectionCard title="Quick Stats" description="Supporting totals for districts, groups, users, and contribution health.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quickStats.map((item) => (
                <div key={item.label} className="data-strip flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
      </SectionCard>

      <BottomNav />

      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>Are you sure you want to log out?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default StateAdmin;
