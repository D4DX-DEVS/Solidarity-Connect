import { Users, CheckCircle, Clock, Calendar, Upload, Shield, Star, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="app-page">
      <div className="app-page-orb app-page-orb-primary" aria-hidden />
      <div className="app-page-orb app-page-orb-secondary" aria-hidden />
      <HeaderWithLogout
        icon={<Users className="h-6 w-6 text-primary-foreground" />}
        title="Area Admin Panel"
        subtitle={userGroup ? `${userGroup} - ${userDistrict}` : "Applicant - Thrissur"}
      />

      <main className="app-main pt-5">
        <PageHero
          eyebrow="Daily Overview"
          title={`Welcome back, ${firstName}`}
          subtitle="Your tools, recurring targets, meetings, and member status are all surfaced here with a cleaner mobile-first layout."
          icon={<BarChart3 className="h-6 w-6" />}
          details={
            <>
              <div className="data-strip">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Area</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{userGroup || "Applicant"}</p>
              </div>
              <div className="data-strip">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">District</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{userDistrict || "Thrissur"}</p>
              </div>
              <div className="data-strip">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pending Requests</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{dashboardData?.pendingRequestsCount ?? 0}</p>
              </div>
              <div className="data-strip">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Upcoming Meetings</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{dashboardData?.upcomingMeetings?.length ?? 0}</p>
              </div>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat, index) => (
            <MetricCard
              key={index}
              title={stat.label}
              value={loading ? "..." : stat.value}
              icon={stat.icon}
              tone={stat.tone}
            />
          ))}
        </div>

        <UserTargetsSection />

        {dashboardData?.upcomingMeetings && dashboardData.upcomingMeetings.length > 0 && (
          <SectionCard title="Upcoming Meetings" description="Next scheduled meetings at a glance.">
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

        <SectionCard title="Area Admin Tools" description="Common actions optimized for touch and fast navigation.">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                { label: "Members", path: "/members", Icon: Users },
                { label: "Meetings", path: "/meetings", Icon: Calendar },
                { label: "Role Management", path: "/role-management", Icon: Shield },
                { label: "Leaders", path: "/leaders", Icon: Star },
                { label: "Consolidation", path: "/consolidation", Icon: BarChart3 },
                { label: "Bulk Import", path: "/bulk-import", Icon: Upload },
                { label: "Membership Form & Files", path: "/org-files", Icon: FileText },
              ].map(({ label, path, Icon }) => (
                <Button key={label} variant="outline" className="action-tile h-auto" onClick={() => navigate(path)}>
                  <div className="action-tile-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">Open {label.toLowerCase()} tools.</p>
                  </div>
                </Button>
              ))}
            </div>
        </SectionCard>
      </main>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
