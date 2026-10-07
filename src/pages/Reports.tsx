import { useSearchParams } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { PageHero, PageShell } from "@/components/app/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { MyReportTab } from "@/components/reports/MyReportTab";
import { ConsolidatedTab } from "@/components/reports/ConsolidatedTab";
import { ReportSetupTab } from "@/components/reports/ReportSetupTab";
import { currentIstPeriod, toMonthValue } from "@/lib/reportForm";

const TABS = ["mine", "consolidated", "setup"] as const;
type Tab = (typeof TABS)[number];

/** Monthly reports: fill your own, see the consolidated totals, and (state admin) design the forms. */
export default function Reports() {
  const { user } = useAuth();
  const isStateAdmin = user?.role === "state_admin";
  const [params, setParams] = useSearchParams();

  const now = currentIstPeriod();
  const month = /^\d{4}-\d{2}$/.test(params.get("month") || "") ? params.get("month")! : toMonthValue(now.year, now.month);
  const span = params.get("span") === "year" ? "year" : "month";
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && TABS.includes(requested) && (requested !== "setup" || isStateAdmin) ? requested : "mine";

  // The URL holds tab, month and span so refresh, back and shared links reproduce the view.
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <PageShell>
      <PageHero title="Reports" subtitle="Monthly reports from the state, districts and areas" icon={<ClipboardList className="size-6" />} />
      <div className="container mx-auto space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <Tabs value={tab} onValueChange={(v) => setParam("tab", v)}>
          <TabsList className={`grid w-full sm:w-auto ${isStateAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="mine" className="min-h-10">My Report</TabsTrigger>
            <TabsTrigger value="consolidated" className="min-h-10">Consolidated</TabsTrigger>
            {isStateAdmin ? <TabsTrigger value="setup" className="min-h-10">Setup</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="mine" className="mt-4">
            <MyReportTab month={month} onMonthChange={(v) => setParam("month", v)} />
          </TabsContent>
          <TabsContent value="consolidated" className="mt-4">
            <ConsolidatedTab
              month={month}
              onMonthChange={(v) => setParam("month", v)}
              span={span}
              onSpanChange={(v) => setParam("span", v)}
              isStateAdmin={isStateAdmin}
            />
          </TabsContent>
          {isStateAdmin ? (
            <TabsContent value="setup" className="mt-4">
              <ReportSetupTab />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </PageShell>
  );
}
