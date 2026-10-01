import { useState } from "react";
import { Building2, ClipboardCheck, UserCog, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderWithLogout from "@/components/HeaderWithLogout";
import { MetricCard } from "@/components/app/AppShell";
import { ActionQueue } from "@/components/dashboard/ActionQueue";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { DistrictDrilldownSheet } from "@/components/dashboard/DistrictDrilldownSheet";
import { HierarchyScorecard } from "@/components/dashboard/HierarchyScorecard";
import { meetingItems, requestItem, silentChildrenItem, transferItem, uncoveredAreasItem } from "@/components/dashboard/actionItems";
import { formatNumber, percent, profilesDetail, reportingDetail } from "@/components/dashboard/chartTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardOverview, useDashboardSummary, type HierarchyRow } from "@/hooks/useDashboardOverview";

const SCORECARD_ID = "district-scorecard";

const StateAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const overviewQuery = useDashboardOverview(user?.id);
  const summaryQuery = useDashboardSummary(user?.id);
  const overview = overviewQuery.data;
  const summary = summaryQuery.data;
  const [drillDistrict, setDrillDistrict] = useState<HierarchyRow | null>(null);

  // A failed load must read as unknown, never as a real zero.
  const show = (value: string) => (overviewQuery.isPending ? "…" : overviewQuery.isError ? "—" : value);
  const note = (text: string) => (overviewQuery.isPending ? "Loading…" : overviewQuery.isError ? "Couldn't load" : text);

  const members = overview?.members;
  const profiles = overview?.profiles;
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
        subtitle="State overview · every district"
        showTitleOnMobile
      />

      <main className="app-main space-y-4 pb-28 pt-4 sm:space-y-6">
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Key figures">
          <MetricCard
            title="Members"
            value={show(formatNumber(members?.total ?? 0))}
            detail={note(`${percent(members?.active ?? 0, members?.total ?? 0)}% active`)}
            icon={Users}
            tone="primary"
            onClick={() => navigate("/members")}
          />
          <MetricCard
            title="Areas"
            value={show(formatNumber(overview?.areas.total ?? 0))}
            detail={note(`Across ${overview?.children.rows.length ?? 0} districts`)}
            icon={Building2}
            tone="neutral"
            onClick={() => navigate("/state-admin/groups")}
          />
          <MetricCard
            title="Admins"
            value={show(formatNumber(overview?.admins.total ?? 0))}
            detail={note(reportingDetail(overview?.admins.reporting ?? 0, overview?.activity.reportingWindow))}
            icon={UserCog}
            tone="warning"
            onClick={() => navigate("/state-admin/users")}
          />
          <MetricCard
            title="Profiles complete"
            value={show(`${percent(profiles?.complete ?? 0, profiles?.total ?? 0)}%`)}
            detail={note(profilesDetail(profiles))}
            icon={ClipboardCheck}
            tone="success"
            onClick={() => navigate("/members")}
          />
        </section>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
          <ActionQueue
            className="lg:col-span-2"
            items={actions}
            loading={summaryQuery.isPending || overviewQuery.isPending}
            error={summaryQuery.isError || overviewQuery.isError}
            onRetry={() => { summaryQuery.refetch(); overviewQuery.refetch(); }}
          />
          <ActivityCard
            className="lg:col-span-3"
            overview={overview}
            loading={overviewQuery.isPending}
            error={overviewQuery.isError}
            onRetry={() => overviewQuery.refetch()}
          />
        </div>

        <section id={SCORECARD_ID} className="scroll-mt-20">
          <ChartCard
            title="District overview"
            description="Tap a district to see its areas"
            error={overviewQuery.isError}
            onRetry={() => overviewQuery.refetch()}
            contentClassName="p-0 pt-0 sm:p-0 sm:pt-0"
          >
            <HierarchyScorecard
              rows={overview?.children.rows ?? []}
              level="district"
              loading={overviewQuery.isPending}
              onSelect={setDrillDistrict}
            />
          </ChartCard>
        </section>
      </main>

      <DistrictDrilldownSheet accountId={user?.id} district={drillDistrict} onClose={() => setDrillDistrict(null)} />
    </div>
  );
};

export default StateAdmin;
