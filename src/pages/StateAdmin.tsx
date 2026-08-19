import { Shield, Users, Building2, FileCheck, Bell, Wallet, BarChart3, Target, UserCog, Star, FolderOpen, CheckCircle, Database, Calendar, Menu, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/app/AppShell";
import { NotificationBell } from "@/components/NotificationBell";
import { PageSkeleton } from "@/components/ui/loading-skeletons";import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { reportsAPI, usersAPI, baithulMaalAPI } from "@/utils/api";

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
  "Admins": "/state-admin/users",
  "Total Members": "/members",
  "Active Members": "/members",
  "Groups": "/state-admin/groups",
  "Baithul Maal": "/state-admin/baithul-data",
};

const StateAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAllActions, setShowAllActions] = useState(false);

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

  const adminActions = [
    { icon: Database, label: "Master Data", path: "/state-admin/master-data", color: "text-emerald-600" },
    { icon: UserCog, label: "User Management", path: "/state-admin/users", color: "text-purple-500" },
    { icon: Target, label: "Targets", path: "/personal-targets", color: "text-purple-500" },
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
      title: "Admins",
      value: userStats?.totalUsers?.toLocaleString() || "0",
      detail: `${userStats?.activeUsers?.toLocaleString() || "0"} active admins`,
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
        {/* ponytail: menu moved to BottomNav "More" — header keeps only the bell */}
        <NotificationBell />
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

      {(pendingApprovals > 0 || upcomingMeetingsCount > 0) && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">Needs Attention</h2>
          <Button variant="link" className="h-auto gap-1 p-0 text-xs md:text-sm text-info" onClick={() => navigate("/notifications")}>
            View all <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </div>
          <div className="space-y-2.5">
            {pendingApprovals > 0 && (
            <button
              type="button"
              onClick={() => navigate("/state-admin/transfer-approvals")}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:bg-accent/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <FileCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{pendingApprovals} pending approvals</p>
                <p className="truncate text-xs text-muted-foreground">Review requests and transfers</p>
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

          </div>
      </div>
      )}

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

      </main>
    </div>
  );
};

export default StateAdmin;
