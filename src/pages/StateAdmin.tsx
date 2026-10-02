import { useState } from "react";
import { Building2, UserCog, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { DistrictDrilldownSheet } from "@/components/dashboard/DistrictDrilldownSheet";
import { HierarchyScorecard } from "@/components/dashboard/HierarchyScorecard";
import {
  AreaStatusCard, DashboardToolbar, KpiSparkCard, MembersByUnitCard, MembershipTrendCard, MemberStatusCard, RecentActivityCard,
} from "@/components/dashboard/DashboardWidgets";
import { meetingItems, requestItem, silentChildrenItem, transferItem, uncoveredAreasItem } from "@/components/dashboard/actionItems";
import { adminsDetail, formatNumber, percent, reportingLive } from "@/components/dashboard/chartTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDashboardOverview, useDashboardSummary, useMembershipTrend, useRecentActivity, type HierarchyRow,
} from "@/hooks/useDashboardOverview";

const SCORECARD_ID = "district-scorecard";

const StateAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const overviewQuery = useDashboardOverview(user?.id);
  const summaryQuery = useDashboardSummary(user?.id);
  const overview = overviewQuery.data;
  const summary = summaryQuery.data;
  const trendQuery = useMembershipTrend(user?.id, overview?.members.total);
  const recentQuery = useRecentActivity(user?.id, "district");
  const [drillDistrict, setDrillDistrict] = useState<HierarchyRow | null>(null);

  // A failed load must read as unknown, never as a real zero.
  const show = (value: string) => (overviewQuery.isPending ? "…" : overviewQuery.isError ? "—" : value);
  const note = (text: string) => (overviewQuery.isPending ? "Loading…" : overviewQuery.isError ? "Couldn't load" : text);
  const overviewState = { overview, loading: overviewQuery.isPending, error: overviewQuery.isError, onRetry: () => overviewQuery.refetch() };

  const members = overview?.members;
  const deltas = overview?.deltas;
  const scrollToScorecard = () => document.getElementById(SCORECARD_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const actions = [
    ...transferItem(summary, "state"),
    ...requestItem(summary),
    ...silentChildrenItem(overview, scrollToScorecard),
    ...uncoveredAreasItem(overview, "/state-admin/users"),
    ...meetingItems(summary, "/admin/meetings-view"),
  ];

  return (
    <div className="app-page">
      <HeaderWithLogout
        title={`Welcome back, ${user?.name?.trim().split(" ")[0] || "Admin"}`}
        subtitle="Here's the latest overview of your state activity"
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
            detail={note(`Across ${overview?.children.rows.length ?? 0} districts`)}
            icon={Building2}
            tone="neutral"
            delta={deltas?.areas}
            deltaWindowDays={deltas?.windowDays}
            loading={overviewQuery.isPending}
            onClick={() => navigate("/state-admin/groups")}
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
            onClick={() => navigate("/state-admin/users")}
          />
        </section>

        {/* Queue is first in the DOM so it leads on phones; on desktop it sits right of the trend (3:2) */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-5">
          <ActionQueue
            className="lg:order-last lg:col-span-2"
            items={actions}
            loading={summaryQuery.isPending || overviewQuery.isPending}
            error={summaryQuery.isError || overviewQuery.isError}
            onRetry={() => { summaryQuery.refetch(); overviewQuery.refetch(); }}
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

        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MembersByUnitCard {...overviewState} unit="District" stackAtLg />
          <MemberStatusCard {...overviewState} stackAtLg />
          <AreaStatusCard {...overviewState} stackAtLg className="md:col-span-2 lg:col-span-1" />
        </div>

        {/* Full width: the six-column table clips inside a two-thirds column */}
        <section id={SCORECARD_ID} className="scroll-mt-20">
          <ChartCard
            title="District Performance"
            description="Members, active rate and admin status by district — tap a district for its areas"
            error={overviewQuery.isError}
            onRetry={() => overviewQuery.refetch()}
            contentClassName="p-0 pt-0 sm:p-0 sm:pt-0"
          >
            <HierarchyScorecard
              rows={overview?.children.rows ?? []}
              level="district"
              loading={overviewQuery.isPending}
              onSelect={setDrillDistrict}
              reporting={reportingLive(overview)}
            />
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

      <DistrictDrilldownSheet accountId={user?.id} district={drillDistrict} onClose={() => setDrillDistrict(null)} reporting={reportingLive(overview)} />
    </div>
  );
};

export default StateAdmin;
