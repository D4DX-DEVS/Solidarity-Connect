import { Users, CheckCircle, Clock, Calendar, Upload, Shield, FileText, BarChart3, Menu, Target } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { MetricCard } from "@/components/app/AppShell";
import UserTargetsSection from "@/components/UserTargetsSection";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

// Members & Meetings live in bottom nav — keep Quick Actions for actions not already reachable there
const PRIMARY_AREA_LABELS = ["Bulk Import", "Files", "Group Reports", "Baithul Maal", "My Targets"];

const Dashboard = () => {
  const { userRole, userDistrict, userGroup, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  useEffect(() => {
    // Redirect based on role
    if (userRole === "state_admin") {
      navigate("/state-admin");
    } else if (userRole === "district_admin") {
      navigate("/district-admin");
    }
  }, [userRole, navigate]);

  // ponytail: cached — only group admins have dashboard data to fetch
  const { data: dashboardData = null, isPending, isError } = useQuery({
    queryKey: ['dashboard', 'group-admin'],
    queryFn: async () => (await reportsAPI.getDashboard()).data as DashboardData,
    enabled: userRole === 'group_admin',
  });
  const loading = userRole === 'group_admin' && isPending;

  useEffect(() => {
    if (!isError) return;
    toast({
      title: "Error",
      description: "Failed to load dashboard data",
      variant: "destructive",
    });
  }, [isError, toast]);

  const stats = dashboardData ? [
    {
      label: "Total Members",
      value: dashboardData.memberStatistics.totalMembers.toString(),
      icon: Users,
      tone: "primary" as const,
    },
    {
      label: "Active Members",
      value: dashboardData.memberStatistics.activeMembers.toString(),
      icon: CheckCircle,
      tone: "success" as const,
    },
    {
      label: "Pending Requests",
      value: dashboardData.pendingRequestsCount.toString(),
      icon: Clock,
      tone: "danger" as const,
    },
    {
      label: "Upcoming Meetings",
      value: dashboardData.upcomingMeetings.length.toString(),
      icon: Calendar,
      tone: "neutral" as const,
    },
  ] : [
    { label: "Total Members", value: "0", icon: Users, tone: "primary" as const },
    { label: "Active Members", value: "0", icon: CheckCircle, tone: "success" as const },
    { label: "Pending Requests", value: "0", icon: Clock, tone: "danger" as const },
    { label: "Upcoming Meetings", value: "0", icon: Calendar, tone: "neutral" as const },
  ];

  const firstName = user?.name?.trim().split(" ")[0] || "Admin";
  const statPaths = ["/members", "/members", "/requests", "/meetings"];
  const [showAllActions, setShowAllActions] = useState(false);

  // Members, Meetings, Leaders live in bottom nav — omitted here
  const areaTools = [
    { label: "Bulk Import", path: "/bulk-import", Icon: Upload, color: "text-purple" },
    { label: "Files", path: "/org-files", Icon: FileText, color: "text-success" },
    { label: "Group Reports", path: "/state-admin/group-reports", Icon: BarChart3, color: "text-info" },
    { label: "Role Management", path: "/role-management", Icon: Shield, color: "text-purple" },
    { label: "Consolidation", path: "/consolidation", Icon: BarChart3, color: "text-success" },
    { label: "Baithul Maal", path: "/state-admin/baithul-data", Icon: BarChart3, color: "text-primary" },
    { label: "My Targets", path: "/my-targets", Icon: Target, color: "text-info" },
  ];

  return (
    <div className="app-page">
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Area Admin Dashboard"
      />

      <main className="app-main pt-4 pb-28">
        <div className="space-y-4">
          {/* Compact stat cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {stats.map((stat, index) => (
              <MetricCard
                key={index}
                title={stat.label}
                value={loading ? "..." : stat.value}
                icon={stat.icon}
                tone={stat.tone}
                onClick={() => navigate(statPaths[index])}
              />
            ))}
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
              Quick Actions
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {areaTools.map(({ label, path, Icon, color }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => navigate(path)}
                  className={`${showAllActions || PRIMARY_AREA_LABELS.includes(label) ? "flex" : "hidden"} lg:flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-2.5 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:p-3`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <p className="text-xs font-medium leading-tight text-foreground">{label}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAllActions((v) => !v)}
                className="lg:hidden flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card p-2.5 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Menu className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs font-medium leading-tight text-foreground">{showAllActions ? "Less" : "More"}</p>
              </button>
            </div>
          </div>

          <UserTargetsSection />

          {/* Upcoming Meetings */}
          {dashboardData?.upcomingMeetings && dashboardData.upcomingMeetings.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
                Upcoming Meetings
              </h2>
              <div className="space-y-2">
                {dashboardData.upcomingMeetings.slice(0, 3).map((meeting) => (
                  <div key={meeting._id} className="flex items-center justify-between gap-3 rounded border bg-card p-3">
                    <span className="font-medium text-sm text-foreground">{meeting.title}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary whitespace-nowrap">
                      {new Date(meeting.scheduledDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
