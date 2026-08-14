import { Shield, Users, Building2, FileCheck, Bell, Wallet, BarChart3, Target, UserCog, Star, FolderOpen, CheckCircle, LogOut, Database, Calendar, Menu, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { MetricCard } from "@/components/app/AppShell";
import { PageSkeleton } from "@/components/ui/loading-skeletons";import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { RoleSwitchMenuItems } from "@/components/RoleSwitchMenuItems";
import { MoreNavMenuItems } from "@/components/MoreNavMenuItems";
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
  // Count of TransferRequest documents pending the current user's action
  // (role-aware: state_admin sees district_approved; district_admin sees
  // pending+their-district; group_admin sees their own in-flight requests).
  pendingTransfersCount: number;
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

const PRIMARY_ACTION_LABELS = ["User Management", "Transfer Approvals", "Send Notifications", "Announcements", "Files", "Group Reports"];

const CARD_PATHS: Record<string, string> = {
  "Monthly Collection": "/state-admin/baithul-data",
  "Pending Actions": "/requests",
  "Districts": "/state-admin/districts",
  "System Users": "/state-admin/users",
  "Total Members": "/members",
  "Active Members": "/members",
  "Groups": "/state-admin/groups",
  "Baithul Maal": "/state-admin/baithul-data",
};

const StateAdmin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { logout, user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const queryClient = useQueryClient();

  // ponytail: cached queries, not useEffect+setState — revisiting the dashboard
  // paints from cache instead of refetching everything.
  const { data: dashboardData = null, isPending: loading } = useQuery({
    queryKey: ['state-admin', 'dashboard'],
    queryFn: async () => (await reportsAPI.getDashboard()).data as DashboardData,
  });

  const { data: userStats = null } = useQuery({
    queryKey: ['state-admin', 'user-stats'],
    queryFn: async () => (await usersAPI.getUserStats()).data.statistics as UserStats,
  });

  const { data: baithulMaalStats = null } = useQuery({
    queryKey: ['state-admin', 'baithul-stats'],
    queryFn: async () => (await baithulMaalAPI.getStats()).data as BaithulMaalStats,
  });

  const { data: myRecurringTargets = [] } = useQuery({
    queryKey: ['state-admin', 'recurring-targets'],
    queryFn: async () => {
      const res = await apiCall('/personal-targets?isRecurring=true&targetAudience=state_admins&limit=50');
      const now = new Date();
      return (res.data || []).filter((t: any) =>
        t.isRecurring && t.targetAudience === 'state_admins' &&
        t.status === 'active' &&
        new Date(t.startDate) <= now && new Date(t.endDate) >= now
      );
    },
  });

  const { data: myMarks = {} } = useQuery({
    queryKey: ['state-admin', 'recurring-marks'],
    queryFn: async () => {
      const res = await apiCall('/recurring-marks/my');
      const marksMap: Record<string, Record<string, boolean>> = {};
      for (const m of (res.data || [])) {
        if (!marksMap[m.targetId]) marksMap[m.targetId] = {};
        marksMap[m.targetId][`${m.year}-${m.month}-${m.week || 0}`] = m.completed;
      }
      return marksMap;
    },
  });

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
    { icon: Building2, label: "Manage Districts", path: "/state-admin/districts", color: "text-sky-600" },
    { icon: Users, label: "Manage Groups", path: "/state-admin/groups", color: "text-cyan-600" },
    { icon: Calendar, label: "Meeting Agenda", path: "/state-admin/meeting-agenda", color: "text-amber-600" },
    { icon: Wallet, label: "Baithul Maal", path: "/state-admin/baithul-data", color: "text-primary" },
    { icon: BarChart3, label: "Group Reports", path: "/state-admin/group-reports", color: "text-primary" },
    { icon: FileCheck, label: "Transfer Approvals", path: "/state-admin/transfer-approvals", color: "text-orange-500" },
    { icon: Bell, label: "Announcements", path: "/notifications", color: "text-destructive" },
    { icon: Shield, label: "Role Management", path: "/role-management", color: "text-blue-500" },
    { icon: Star, label: "Leaders", path: "/leaders", color: "text-yellow-500" },
    { icon: FolderOpen, label: "Files", path: "/org-files", color: "text-teal-500" },
    { icon: BarChart3, label: "Consolidation", path: "/consolidation", color: "text-indigo-500" },
  ];

  const toggleMark = async (targetId: string, year: number, month: number, week: number = 0) => {
    const key = `${year}-${month}-${week}`;
    const current = myMarks[targetId]?.[key] || false;
    const loadingKey = `${targetId}-${key}`;
    setMarkingLoading(loadingKey);
    try {
      await apiCall('/recurring-marks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetId, year, month, week, completed: !current }) });
      queryClient.setQueryData(
        ['state-admin', 'recurring-marks'],
        (prev: Record<string, Record<string, boolean>> = {}) => ({
          ...prev,
          [targetId]: { ...prev[targetId], [key]: !current },
        })
      );
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

  const kpiCards = [
    {
      title: "Monthly Collection",
      value: baithulMaalStats?.overallStatistics?.totalMonthlyAmount ? formatCurrency(baithulMaalStats.overallStatistics.totalMonthlyAmount) : "₹0",
      detail: `${baithulMaalStats?.overallStatistics?.contributingMembers || 0} contributing`,
      icon: Wallet,
      tone: "primary" as const,
    },
    {
      title: "Pending Actions",
      value: String(dashboardData?.pendingRequestsCount || 0),
      detail: dashboardData?.pendingRequestsCount ? "Needs attention" : "All clear",
      icon: FileCheck,
      tone: (dashboardData?.pendingRequestsCount ? "danger" : "success") as "danger" | "success",
    },
    {
      title: "Districts",
      value: String(dashboardData?.districtStatistics?.totalDistricts || 0),
      detail: `${dashboardData?.districtStatistics?.activeDistricts || 0} active`,
      icon: Building2,
      tone: "neutral" as const,
    },
    {
      title: "System Users",
      value: userStats?.totalUsers?.toLocaleString() || "0",
      detail: `${userStats?.activeUsers?.toLocaleString() || "0"} active users`,
      icon: UserCog,
      tone: "warning" as const,
    },
  ];

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
      title: "Groups",
      value: String(dashboardData?.groupStatistics?.totalGroups || 0),
      detail: `${dashboardData?.groupStatistics?.activeGroups || 0} active groups`,
      icon: Users,
      tone: "neutral" as const,
    },
    {
      title: "Baithul Maal",
      value: baithulMaalStats?.overallStatistics?.totalMonthlyAmount ? formatCurrency(baithulMaalStats.overallStatistics.totalMonthlyAmount) : "₹0",
      detail: `${baithulMaalStats?.overallStatistics?.contributingMembers || 0} contributing members`,
      icon: Wallet,
      tone: "warning" as const,
    },
  ];

  const pendingApprovals = (dashboardData?.pendingRequestsCount || 0) + (dashboardData?.pendingTransfersCount || 0);
  const upcomingMeetingsCount = dashboardData?.upcomingMeetings?.length || 0;

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  return (
    <div className="app-page">
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 rounded-b-2xl border-b-2 border-primary bg-card px-4 shadow-md sm:px-6 lg:px-8">
        {/* ponytail: brand logo on mobile only — matches HeaderWithLogout/PageHero */}
        <img src="/logo-icon.png" alt="Solidarity Connect logo" className="h-10 w-10 shrink-0 rounded-xl border-2 border-primary bg-white object-contain p-0.5 lg:hidden" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg md:text-xl font-semibold text-foreground">
            {`Welcome back, ${user?.name?.trim().split(' ')[0] || 'Admin'}`}
          </h1>
          <p className="text-xs text-muted-foreground">State Admin Dashboard</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => navigate("/notifications")} aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <span className="lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass w-56 rounded-xl border-border/50 p-1.5 shadow-2xl">
                <div className="px-3 py-2 mb-1 bg-secondary/50 rounded-xl">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logged in as</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{user?.name || 'State Admin'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.phone}</p>
                </div>
                <RoleSwitchMenuItems />
                <MoreNavMenuItems />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </div>
      </div>

      <main className="app-main pb-28">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <MetricCard
            key={card.title}
            title={card.title}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
            tone={card.tone}
            onClick={() => navigate(CARD_PATHS[card.title])}
          />
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">Quick Analysis</h2>
          <Button variant="link" className="h-auto gap-1 p-0 text-xs md:text-sm text-info" onClick={() => navigate("/state-admin/group-reports")}>
            View all <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
          {analysisCards.map((card) => (
            <MetricCard
              key={card.title}
              title={card.title}
              value={card.value}
              detail={card.detail}
              icon={card.icon}
              tone={card.tone}
              onClick={() => navigate(CARD_PATHS[card.title])}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">Needs Attention</h2>
          <Button variant="link" className="h-auto gap-1 p-0 text-xs md:text-sm text-info" onClick={() => navigate("/notifications")}>
            View all <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </div>
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => navigate(pendingApprovals ? "/state-admin/transfer-approvals" : "/requests")}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent/60"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pendingApprovals ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                {pendingApprovals ? <FileCheck className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {pendingApprovals ? `${pendingApprovals} pending approvals` : "No pending approvals"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {pendingApprovals ? "Review requests and transfers" : "Great! You're all caught up."}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            {myRecurringTargets.length > 0 && (
              <button
                type="button"
                onClick={() => document.getElementById("my-recurring-targets")?.scrollIntoView({ behavior: "smooth" })}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
                  <Target className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{myRecurringTargets.length} recurring {myRecurringTargets.length === 1 ? "target" : "targets"} active</p>
                  <p className="truncate text-xs text-muted-foreground">Track your progress below</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}

            {upcomingMeetingsCount > 0 && (
              <button
                type="button"
                onClick={() => navigate("/meetings")}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent/60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple/10 text-purple">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{upcomingMeetingsCount} upcoming {upcomingMeetingsCount === 1 ? "meeting" : "meetings"}</p>
                  <p className="truncate text-xs text-muted-foreground">In the next few days</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}

            <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                <Shield className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">System health: Good</p>
                <p className="truncate text-xs text-muted-foreground">All systems operational</p>
              </div>
            </div>
          </div>
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {adminActions.map((action) => {
            // Show a count badge on the Transfer Approvals tile when
            // there are transfer requests pending the state admin's action.
            const badgeCount = action.label === 'Transfer Approvals'
              ? dashboardData?.pendingTransfersCount
              : undefined;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => navigate(action.path)}
                className={`${showAllActions || PRIMARY_ACTION_LABELS.includes(action.label) ? "flex" : "hidden"} lg:flex relative cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card p-2 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:gap-2 sm:p-4`}
              >
                {badgeCount ? (
                  <Badge variant="destructive" className="absolute right-2 top-2 h-5 min-w-[1.25rem] justify-center px-1.5 text-[0.65rem]">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Badge>
                ) : null}
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted sm:h-10 sm:w-10">
                  <action.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${action.color}`} />
                </div>
                <p className="text-[10px] font-medium leading-tight text-foreground sm:text-xs">{action.label}</p>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowAllActions((v) => !v)}
            className="lg:hidden flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-card p-2 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:gap-2 sm:p-4"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted sm:h-10 sm:w-10">
              <Menu className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" />
            </div>
            <p className="text-[10px] font-medium leading-tight text-foreground sm:text-xs">{showAllActions ? "Less" : "More"}</p>
          </button>
        </div>
      </div>

        {myRecurringTargets.length > 0 && (
          <div id="my-recurring-targets" className="scroll-mt-20">
          <h2 className="flex items-center gap-2 text-base font-semibold mb-3">My Recurring Targets</h2>
          <div>
              <div className="mb-4 grid grid-cols-6 gap-1.5 sm:flex sm:flex-wrap">
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
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors sm:px-3 ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isFuture
                            ? 'cursor-not-allowed bg-muted text-muted-foreground/50'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                {myRecurringTargets.map((target: any) => {
                  const freq = target.recurringFrequency || 'monthly';
                  const isWeekly = freq === 'weekly';
                  const selectedMonthLabel = MONTHS_SHORT[selectedRecurringMonth - 1];
                  const selectedMonthIsFuture = selectedRecurringMonth > currentMonth;
                  const completedCount = getCompletedRecurringCount(target._id, isWeekly);
                  const weeksInSelectedMonth = getWeeksInMonth(currentYear, selectedRecurringMonth - 1);
                  const completedInSelectedMonth = isWeekly
                    ? WEEKLY_SLOTS.filter((w) => w <= weeksInSelectedMonth && myMarks[target._id]?.[`${currentYear}-${selectedRecurringMonth}-${w}`]).length
                    : 0;
                  const progressTotal = isWeekly ? weeksInSelectedMonth : 12;
                  const progressDone = isWeekly ? completedInSelectedMonth : completedCount;
                  const progressPct = progressTotal ? Math.round((progressDone / progressTotal) * 100) : 0;
                  const monthKey = `${currentYear}-${selectedRecurringMonth}-0`;
                  const monthCompleted = myMarks[target._id]?.[monthKey] || false;
                  const monthLoadingKey = `${target._id}-${monthKey}`;
                  return (
                    <div key={target._id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{target.title}</p>
                          <Badge variant="outline" className="shrink-0 rounded-md px-1.5 py-0 text-[10px] font-medium">
                            {isWeekly ? 'Weekly' : 'Monthly'}
                          </Badge>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {isWeekly ? `${progressDone} / ${progressTotal} weeks` : `${progressDone} / 12 months`}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${isWeekly ? 'bg-success' : 'bg-primary/70'}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        {isWeekly ? (
                          <div className="flex flex-wrap gap-1.5">
                            {WEEKLY_SLOTS.filter((w) => w <= weeksInSelectedMonth).map((weekNum) => {
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
                                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                    completed
                                      ? 'bg-success text-success-foreground'
                                      : selectedMonthIsFuture
                                        ? 'cursor-not-allowed bg-muted text-muted-foreground/50'
                                        : 'bg-muted text-muted-foreground hover:text-foreground'
                                  } ${markingLoading === loadingKey ? 'cursor-wait opacity-60' : ''}`}
                                >
                                  W{weekNum}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markingLoading === monthLoadingKey || selectedMonthIsFuture}
                            onClick={() => toggleMark(target._id, currentYear, selectedRecurringMonth, 0)}
                            className={monthCompleted ? 'border-success/40 bg-success/10 text-success hover:bg-success/15' : ''}
                          >
                            {monthCompleted ? <CheckCircle className="h-4 w-4" /> : null}
                            {monthCompleted ? `${selectedMonthLabel} marked` : selectedMonthIsFuture ? 'Locked' : `Mark ${selectedMonthLabel}`}
                          </Button>
                        )}
                        <span className="text-[11px] text-muted-foreground">{selectedMonthLabel} {currentYear}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
          </div>
        )}
      </main>
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>Are you sure you want to log out?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row justify-center gap-2">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StateAdmin;
