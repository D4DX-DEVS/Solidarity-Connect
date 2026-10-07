import { Building2, UserCog, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { HierarchyScorecard } from "@/components/dashboard/HierarchyScorecard";
import {
  DashboardToolbar, KpiSparkCard, MembersByUnitCard, MembershipTrendCard, MemberStatusCard, QueueTrendLayout,
  RecentActivityCard,
} from "@/components/dashboard/DashboardWidgets";
import { meetingItems, reportItems, requestItem, transferItem, uncoveredAreasItem } from "@/components/dashboard/actionItems";
import { adminsDetail, formatNumber, percent } from "@/components/dashboard/chartTheme";
import { useAuth } from "@/contexts/AuthContext";
import { hasTrend, useDashboardOverview, useDashboardSummary, useMembershipTrend, useRecentActivity } from "@/hooks/useDashboardOverview";

const SCORECARD_ID = "area-scorecard";

/** District admin dashboard — same layout as the state view, one level down (areas instead of districts). */
const DistrictAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const overviewQuery = useDashboardOverview(user?.id);
  const summaryQuery = useDashboardSummary(user?.id);
  const overview = overviewQuery.data;
  const summary = summaryQuery.data;
  const trendQuery = useMembershipTrend(user?.id, overview?.members.total);
  const showTrend = hasTrend(trendQuery.data) || trendQuery.isError;
  const recentQuery = useRecentActivity(user?.id, "group");

  // A failed load must read as unknown, never as a real zero.
  const show = (value: string) => (overviewQuery.isPending ? "…" : overviewQuery.isError ? "—" : value);
  const note = (text: string) => (overviewQuery.isPending ? "Loading…" : overviewQuery.isError ? "Couldn't load" : text);
  const overviewState = { overview, loading: overviewQuery.isPending, error: overviewQuery.isError, onRetry: () => overviewQuery.refetch() };

  const members = overview?.members;
  const deltas = overview?.deltas;
  const areasWithMembers = overview?.children.rows.filter((a) => a.total > 0).length ?? 0;
  const scrollToScorecard = () => document.getElementById(SCORECARD_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const actions = [
    ...transferItem(summary, "district"),
    ...requestItem(summary),
    ...reportItems(overview, scrollToScorecard),
    ...uncoveredAreasItem(overview, "/role-management"),
    ...meetingItems(summary, "/admin/meetings-view"),
  ];

  return (
    <div className="app-page">
      <HeaderWithLogout
        title={`Welcome back, ${user?.name?.trim().split(" ")[0] || "Admin"}`}
        subtitle={`${overview?.scope.name || user?.district?.name || "District"} district overview`}
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
            detail={note(`${percent(members?.active ?? 0, members?.total ?? 0)}% active`)}
            icon={Users}
            tone="primary"
            spark={(trendQuery.data ?? []).map((p) => p.total)}
            delta={deltas?.members}
            deltaWindowDays={deltas?.windowDays}
            loading={overviewQuery.isPending}
            onClick={() => navigate("/members")}
          />
          <KpiSparkCard
            title="Areas"
            value={show(formatNumber(overview?.areas.total ?? 0))}
            detail={note(`${areasWithMembers} with members`)}
            icon={Building2}
            tone="neutral"
            delta={deltas?.areas}
            deltaWindowDays={deltas?.windowDays}
            loading={overviewQuery.isPending}
            onClick={() => navigate("/state-admin/master-data")}
          />
          <KpiSparkCard
            title="Admins"
            value={show(formatNumber(overview?.admins.total ?? 0))}
            detail={note(adminsDetail(overview, "district"))}
            icon={UserCog}
            tone="warning"
            delta={deltas?.admins}
            deltaWindowDays={deltas?.windowDays}
            loading={overviewQuery.isPending}
            onClick={() => navigate("/role-management")}
          />
        </section>

        {/* Admin cover and monthly report gaps live in the queue only (no separate coverage card) */}
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
          <MembersByUnitCard {...overviewState} unit="Area" stackAtLg={!showTrend} />
          <MemberStatusCard {...overviewState} stackAtLg={!showTrend} />
        </QueueTrendLayout>

        <section id={SCORECARD_ID} className="scroll-mt-20">
          <ChartCard
            title="Area Performance"
            description="Members, active rate and monthly report by area"
            error={overviewQuery.isError}
            onRetry={() => overviewQuery.refetch()}
            contentClassName="p-0 pt-0 sm:p-0 sm:pt-0"
          >
            <HierarchyScorecard rows={overview?.children.rows ?? []} level="area" loading={overviewQuery.isPending} report={overview?.report} />
          </ChartCard>
        </section>

        <RecentActivityCard
          items={recentQuery.data ?? []}
          loading={recentQuery.isPending}
          error={recentQuery.isError}
          onRetry={() => recentQuery.refetch()}
          onViewAll={() => navigate("/members")}
        />
      </main>
    </div>
  );
};

export default DistrictAdmin;
