import { Users, CheckCircle, Clock, Calendar, Upload, Shield, Star, FileText, BarChart3, Menu } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { MetricCard, PageHero, SectionCard } from "@/components/app/AppShell";
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

const PRIMARY_AREA_LABELS = ["Members", "Meetings", "Bulk Import", "Org Files", "Group Reports"];

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
    if (!userRole) return; // Still loading auth, wait

    if (userRole !== 'group_admin') {
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
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

    fetchDashboardData();
  }, [userRole]);

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

  const areaTools = [
    { label: "Members", path: "/members", Icon: Users, color: "text-info" },
    { label: "Meetings", path: "/meetings", Icon: Calendar, color: "text-warning" },
    { label: "Bulk Import", path: "/bulk-import", Icon: Upload, color: "text-purple" },
    { label: "Org Files", path: "/org-files", Icon: FileText, color: "text-success" },
    { label: "Group Reports", path: "/state-admin/group-reports", Icon: BarChart3, color: "text-info" },
    { label: "Role Management", path: "/role-management", Icon: Shield, color: "text-purple" },
    { label: "Leaders", path: "/leaders", Icon: Star, color: "text-warning" },
    { label: "Consolidation", path: "/consolidation", Icon: BarChart3, color: "text-success" },
    { label: "Baithul Maal", path: "/state-admin/baithul-data", Icon: BarChart3, color: "text-primary" },
  ];

  return (
    <div className="app-page">
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Area Admin Dashboard"
        subtitle={`${userGroup || user?.group?.name || "Loading..."} - ${userDistrict || user?.district?.name || ""}`}
      />

      <main className="app-main pt-5">
        <PageHero
          eyebrow="Daily Overview"
          title={`Welcome back, ${firstName} 👋`}
          subtitle="Here's what's happening in your area today."
          icon={<BarChart3 className="h-6 w-6" />}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

        <SectionCard title="Quick Actions" description="Frequently used actions">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {(showAllActions ? areaTools : areaTools.filter(({ label }) => PRIMARY_AREA_LABELS.includes(label))).map(({ label, path, Icon, color }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => navigate(path)}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:p-4"
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
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card p-3 text-center shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Menu className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs font-medium leading-tight text-foreground">{showAllActions ? "Less" : "More"}</p>
              </button>
            </div>
        </SectionCard>

        <UserTargetsSection />

        {dashboardData?.upcomingMeetings && dashboardData.upcomingMeetings.length > 0 && (
          <SectionCard title="Upcoming Meetings" description="These are the next meetings planned for your area.">
              <div className="space-y-2">
                {dashboardData.upcomingMeetings.slice(0, 3).map((meeting) => (
                  <div key={meeting._id} className="data-strip flex items-center justify-between gap-3">
                    <span className="font-medium text-sm text-foreground">{meeting.title}</span>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {new Date(meeting.scheduledDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
          </SectionCard>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
