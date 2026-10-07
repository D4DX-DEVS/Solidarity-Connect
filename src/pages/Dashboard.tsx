import { useEffect } from "react";
import { UserCheck, UserCog, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { HierarchyScorecard } from "@/components/dashboard/HierarchyScorecard";
import {
  DashboardToolbar, KpiSparkCard, MembershipTrendCard, MemberStatusCard, QueueTrendLayout, RecentActivityCard,
} from "@/components/dashboard/DashboardWidgets";
import { meetingItems, reportItems, requestItem } from "@/components/dashboard/actionItems";
import { adminsDetail, formatNumber, percent } from "@/components/dashboard/chartTheme";
import { useAuth } from "@/contexts/AuthContext";
import { hasTrend, useDashboardOverview, useDashboardSummary, useMembershipTrend, useRecentActivity } from "@/hooks/useDashboardOverview";

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
  const showTrend = hasTrend(trendQuery.data) || trendQuery.isError;
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

  const actions = [...reportItems(overview), ...requestItem(summary), ...meetingItems(summary, "/meetings")];

  return (
    <div className="app-page">
      <HeaderWithLogout
        title={`Welcome back, ${user?.name?.trim().split(" ")[0] || "Admin"}`}
        subtitle={districtName ? `${areaName} area · ${districtName}` : `${areaName} area`}
        showTitleOnMobile
      />

      <main className="app-main space-y-3 pb-28 pt-3 sm:space-y-4 sm:pt-4">
        <DashboardToolbar report={overview?.report} loading={overviewQuery.isPending} />

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
            detail={note(adminsDetail(overview, "area"))}
            icon={UserCog}
            tone="warning"
            delta={deltas?.admins}
            deltaWindowDays={deltas?.windowDays}
            loading={overviewQuery.isPending}
            onClick={() => navigate("/leaders")}
          />
        </section>

        {/* An area has one donut's worth of breakdown, so it shares the row with the newest members */}
        <QueueTrendLayout
          queue={(
            <ActionQueue
              items={actions}
              loading={summaryQuery.isPending || overviewQuery.isPending}
              error={summaryQuery.isError || overviewQuery.isError}
              onRetry={() => { summaryQuery.refetch(); overviewQuery.refetch(); }}
            />
          )}
          trend={showTrend ? (
            <MembershipTrendCard
              points={trendQuery.data ?? []}
              error={trendQuery.isError}
              onRetry={() => trendQuery.refetch()}
            />
          ) : null}
        >
          <MemberStatusCard {...overviewState} stackAtLg={!showTrend} />
          <RecentActivityCard
            stacked
            items={recentQuery.data ?? []}
            loading={recentQuery.isPending}
            error={recentQuery.isError}
            onRetry={() => recentQuery.refetch()}
            onViewAll={() => navigate("/members")}
          />
        </QueueTrendLayout>

        {groupRows.length > 1 ? (
          <ChartCard
            title="Group Performance"
            description="Members, active rate and admin status by group"
            contentClassName="p-0 pt-0 sm:p-0 sm:pt-0"
          >
            <HierarchyScorecard rows={groupRows} level="area" />
          </ChartCard>
        ) : null}
      </main>
    </div>
  );
};

export default Dashboard;
