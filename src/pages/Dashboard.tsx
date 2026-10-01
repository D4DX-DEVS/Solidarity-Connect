import { useEffect } from "react";
import { ClipboardCheck, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { MetricCard } from "@/components/app/AppShell";
import UserTargetsSection from "@/components/UserTargetsSection";
import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { HierarchyScorecard } from "@/components/dashboard/HierarchyScorecard";
import { meetingItems, requestItem } from "@/components/dashboard/actionItems";
import { formatNumber, percent } from "@/components/dashboard/chartTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardOverview, useDashboardSummary } from "@/hooks/useDashboardOverview";

/** Area Admin (group_admin) dashboard. State/district admins are redirected to their own. */
const Dashboard = () => {
  const { userRole, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole === "state_admin") navigate("/state-admin");
    else if (userRole === "district_admin") navigate("/district-admin");
  }, [userRole, navigate]);

  const accountId = userRole === "group_admin" ? user?.id : undefined;
  const overviewQuery = useDashboardOverview(accountId);
  const summaryQuery = useDashboardSummary(accountId);
  const overview = overviewQuery.data;
  const summary = summaryQuery.data;

  // A failed load must read as unknown, never as a real zero.
  const show = (value: string) => (overviewQuery.isPending ? "…" : overviewQuery.isError ? "—" : value);
  const note = (text: string) => (overviewQuery.isPending ? "Loading…" : overviewQuery.isError ? "Couldn't load" : text);

  const members = overview?.members;
  const profiles = overview?.profiles;
  const incomplete = (profiles?.total ?? 0) - (profiles?.complete ?? 0);
  const areaName = overview?.scope.name || user?.group?.name || "Area";
  const districtName = overview?.scope.parentName || user?.district?.name;
  // An area spanning several groups gets the same scorecard one level down.
  const groupRows = overview?.children.rows ?? [];

  const actions = [...requestItem(summary), ...meetingItems(summary, "/meetings")];

  return (
    <div className="app-page">
      <HeaderWithLogout
        title={`Welcome back, ${user?.name?.trim().split(" ")[0] || "Admin"}`}
        subtitle={districtName ? `${areaName} area · ${districtName}` : `${areaName} area`}
        showTitleOnMobile
      />

      <main className="app-main space-y-4 pb-28 pt-4 sm:space-y-6">
        <section className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Key figures">
          <MetricCard
            title="Members"
            value={show(formatNumber(members?.total ?? 0))}
            detail={note(`${percent(members?.active ?? 0, members?.total ?? 0)}% active`)}
            icon={Users}
            tone="primary"
            onClick={() => navigate("/members")}
          />
          <MetricCard
            // Three tiles share a phone row here, so titles and captions stay short.
            title="Profiles"
            value={show(`${percent(profiles?.complete ?? 0, profiles?.total ?? 0)}%`)}
            detail={note(!profiles?.total ? "No members" : incomplete > 0 ? `${formatNumber(incomplete)} to fix` : "All complete")}
            icon={ClipboardCheck}
            tone="success"
            onClick={() => navigate("/members")}
          />
          <MetricCard
            title="Admins"
            value={show(formatNumber(overview?.admins.total ?? 0))}
            detail={note(`${overview?.admins.reporting ?? 0} reported`)}
            icon={ShieldCheck}
            tone="warning"
            onClick={() => navigate("/leaders")}
          />
        </section>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
          <ActionQueue
            className="lg:col-span-2"
            items={actions}
            loading={summaryQuery.isPending}
            error={summaryQuery.isError}
            onRetry={() => summaryQuery.refetch()}
          />
          <ActivityCard
            className="lg:col-span-3"
            overview={overview}
            loading={overviewQuery.isPending}
            error={overviewQuery.isError}
            onRetry={() => overviewQuery.refetch()}
          />
        </div>

        {groupRows.length > 1 ? (
          <ChartCard title="Groups in your area" contentClassName="p-0 pt-0 sm:p-0 sm:pt-0">
            <HierarchyScorecard rows={groupRows} level="area" />
          </ChartCard>
        ) : null}

        <UserTargetsSection />
      </main>
    </div>
  );
};

export default Dashboard;
