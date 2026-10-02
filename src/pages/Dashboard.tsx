import { useEffect } from "react";
import { UserCheck, UserCog, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import UserTargetsSection from "@/components/UserTargetsSection";
import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { HierarchyScorecard } from "@/components/dashboard/HierarchyScorecard";
import {
  DashboardToolbar, KpiSparkCard, MembershipTrendCard, MemberStatusCard, RecentActivityCard,
} from "@/components/dashboard/DashboardWidgets";
import { meetingItems, requestItem } from "@/components/dashboard/actionItems";
import { adminsDetail, formatNumber, percent, reportingLive } from "@/components/dashboard/chartTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardOverview, useDashboardSummary, useMembershipTrend, useRecentActivity } from "@/hooks/useDashboardOverview";

/**
 * Area Admin (group_admin) dashboard — same layout as the state and district
 * views. An area has no admin-run units below it, so the area-cover cards are
 * left out. State/district admins are redirected to their own.
 */
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
  const trendQuery = useMembershipTrend(accountId, overview?.members.total);
  const recentQuery = useRecentActivity(accountId, "group");

  // A failed load must read as unknown, never as a real zero.
  const show = (value: string) => (overviewQuery.isPending ? "…" : overviewQuery.isError ? "—" : value);
  const note = (text: string) => (overviewQuery.isPending ? "Loading…" : overviewQuery.isError ? "Couldn't load" : text);
  const overviewState = { overview, loading: overviewQuery.isPending, error: overviewQuery.isError, onRetry: () => overviewQuery.refetch() };

  const members = overview?.members;
  const deltas = overview?.deltas;
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

      <main className="app-main space-y-3 pb-28 pt-3 sm:space-y-4 sm:pt-4">
        <DashboardToolbar reportingWindow={overview?.activity.reportingWindow} />

        {/* Phones: members card full width, the other two side by side; desktop: three across */}
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3" aria-label="Key figures">
          <KpiSparkCard
            className="col-span-2 lg:col-span-1"
            title="Total Members"
            value={show(formatNumber(members?.total ?? 0))}
            detail={note(`${formatNumber(members?.abroad ?? 0)} abroad`)}
            icon={Users}
            tone="primary"
            spark={(trendQuery.data ?? []).map((p) => p.total)}
            delta={deltas?.members}
            deltaWindowDays={deltas?.windowDays}
            loading={overviewQuery.isPending}
            onClick={() => navigate("/members")}
          />
          <KpiSparkCard
            title="Active Members"
            value={show(formatNumber(members?.active ?? 0))}
            detail={note(`${percent(members?.active ?? 0, members?.total ?? 0)}% of members`)}
            icon={UserCheck}
            tone="neutral"
            loading={overviewQuery.isPending}
            onClick={() => navigate("/members")}
          />
          <KpiSparkCard
            title="Admins"
            value={show(formatNumber(overview?.admins.total ?? 0))}
            detail={note(adminsDetail(overview))}
            icon={UserCog}
            tone="warning"
            delta={deltas?.admins}
            deltaWindowDays={deltas?.windowDays}
            loading={overviewQuery.isPending}
            onClick={() => navigate("/leaders")}
          />
        </section>

        {/* Queue is first in the DOM so it leads on phones; on desktop it sits right of the trend (3:2) */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-5">
          <ActionQueue
            className="lg:order-last lg:col-span-2"
            items={actions}
            loading={summaryQuery.isPending}
            error={summaryQuery.isError}
            onRetry={() => summaryQuery.refetch()}
          />
          <MembershipTrendCard
            className="lg:col-span-3"
            points={trendQuery.data ?? []}
            // The trend waits on the overview total; if that fails it never starts, so show the error, not a skeleton.
            loading={overviewQuery.isPending || (trendQuery.isPending && !overviewQuery.isError)}
            error={trendQuery.isError || overviewQuery.isError}
            onRetry={() => { trendQuery.refetch(); overviewQuery.refetch(); }}
          />
        </div>

        {/* An area has one donut's worth of breakdown, so it shares the row with the newest members */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          <MemberStatusCard {...overviewState} />
          <RecentActivityCard
            stacked
            items={recentQuery.data ?? []}
            loading={recentQuery.isPending}
            error={recentQuery.isError}
            onRetry={() => recentQuery.refetch()}
            onViewAll={() => navigate("/members")}
          />
        </div>

        {groupRows.length > 1 ? (
          <ChartCard
            title="Group Performance"
            description="Members, active rate and admin status by group"
            contentClassName="p-0 pt-0 sm:p-0 sm:pt-0"
          >
            <HierarchyScorecard rows={groupRows} level="area" reporting={reportingLive(overview)} />
          </ChartCard>
        ) : null}

        <UserTargetsSection />
      </main>
    </div>
  );
};

export default Dashboard;
