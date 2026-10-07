import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Download, Landmark, LockOpen, MapPin } from "lucide-react";
import { MetricCard, SectionCard } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPicker } from "@/components/ui/month-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/StateMessage";
import { useToast } from "@/hooks/use-toast";
import { useDistricts } from "@/hooks/useDistricts";
import { exportConsolidated } from "@/lib/exportConsolidated";
import { consolidatedSections } from "@/lib/consolidatedSummary";
import { currentIstPeriod, fromMonthValue, periodLabel, toMonthValue, yearSpanLabel } from "@/lib/reportForm";
import { monthlyReportService, type Consolidated, type ConsolidatedSpan } from "@/services/monthlyReportService";
import { ConsolidatedBreakdown, ReportStatus, RowActions, type UnlockTarget } from "./ConsolidatedBreakdown";
import { ReportTotals } from "./ReportTotals";
import { ReportDetailDialog } from "./ReportDetailDialog";

const YEARS_SHOWN = 3;

/** Every report of a month (or a whole year) in the viewer's scope, with numbers added up the hierarchy. */
export function ConsolidatedTab({ month, onMonthChange, span, onSpanChange, isStateAdmin }: {
  month: string;
  onMonthChange: (value: string) => void;
  span: ConsolidatedSpan;
  onSpanChange: (span: ConsolidatedSpan) => void;
  isStateAdmin: boolean;
}) {
  const { toast } = useToast();
  const { year, month: monthNumber } = fromMonthValue(month);
  const now = currentIstPeriod();
  const yearly = span === "year";
  // Recent years, plus whatever year the URL holds so the Select never shows blank
  const years = [...new Set([...Array.from({ length: YEARS_SHOWN }, (_, i) => now.year - i), year])].sort((a, b) => b - a);
  // Keep the month part valid when switching years, so Monthly opens on a month that exists.
  const pickYear = (value: string) => {
    const nextYear = Number(value);
    onMonthChange(toMonthValue(nextYear, nextYear === now.year ? Math.min(monthNumber, now.month) : monthNumber));
  };
  const [district, setDistrict] = useState("all");
  const [data, setData] = useState<Consolidated | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<UnlockTarget | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const { data: districtsData } = useDistricts({ sort: "name", limit: 100 });
  const districts = isStateAdmin ? districtsData?.data || [] : [];

  // Switching month, year or district quickly: only the latest request may update the page.
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const next = await monthlyReportService.getConsolidated(year, monthNumber, district, span);
      if (request === latestRequest.current) setData(next);
    } catch (e) {
      if (request === latestRequest.current) setError(e instanceof Error ? e.message : "Could not load the consolidated report");
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [year, monthNumber, district, span]);

  useEffect(() => { load(); }, [load]);

  const unlock = async () => {
    if (!unlockTarget) return;
    setUnlocking(true);
    try {
      const { unlockedUntil } = await monthlyReportService.unlock({ level: unlockTarget.level, scopeId: unlockTarget.scopeId, year, month: monthNumber });
      toast({ title: `${unlockTarget.name} unlocked`, description: `They can edit ${periodLabel(year, monthNumber)} until ${new Date(unlockedUntil).toLocaleDateString("en-IN")}.` });
      setUnlockTarget(null);
      load();
    } catch (e) {
      toast({ title: "Could not unlock", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setUnlocking(false);
    }
  };

  const view = data?.viewer.view;
  // A state admin narrowed to one district sees that district's totals, without the state report.
  const narrowed = isStateAdmin && district !== "all";
  const ownArea = view === "area" ? data?.districts[0]?.areas[0] : undefined;
  const scopeName = ownArea?.name ?? (view === "district" || narrowed ? data?.districts[0]?.name : "State");

  return (
    <div className="space-y-4">
      <SectionCard
        title={`Consolidated · ${yearly ? year : periodLabel(year, monthNumber)}`}
        description={yearly
          ? `${yearSpanLabel(year, data?.span === "year" ? data.months : 12)}: every monthly report added together.`
          : view === "area" ? "Your area's monthly report." : view === "district" ? "Numbers add up from your areas to the district." : "Numbers add up from areas to districts to the state."}
        action={
          <Button variant="outline" size="sm" className="min-h-11 gap-2 sm:min-h-9" disabled={!data} onClick={() => data && exportConsolidated(data, { includeState: !narrowed })}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Export Excel</span>
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Tabs value={span} onValueChange={(v) => onSpanChange(v as ConsolidatedSpan)} className="col-span-2 sm:col-span-1">
            <TabsList className="grid h-10 w-full grid-cols-2 sm:w-52">
              <TabsTrigger value="month">Monthly</TabsTrigger>
              <TabsTrigger value="year">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
          {yearly ? (
            <Select value={String(year)} onValueChange={pickYear}>
              <SelectTrigger aria-label="Year" className="h-10 w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <MonthPicker value={month} onChange={onMonthChange} className="w-full sm:w-44" />
          )}
          {isStateAdmin ? (
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger aria-label="District" className="h-10 w-full sm:w-56"><SelectValue placeholder="All districts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All districts</SelectItem>
                {districts.map(d => <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </SectionCard>

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>
          <Skeleton className="h-64" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : data ? (
        <div className={loading ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"} aria-busy={loading}>
          {view !== "area" && data.span === "year" && data.counts.months ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              <MetricCard title="District reports" value={`${data.counts.months.district.submitted}/${data.counts.months.district.total}`} icon={Building2} tone="primary" />
              <MetricCard title="Area reports" value={`${data.counts.months.area.submitted}/${data.counts.months.area.total}`} icon={MapPin} tone="success" />
              {data.counts.months.state && !narrowed ? (
                <MetricCard title="State reports" value={`${data.counts.months.state.submitted}/${data.counts.months.state.total}`} icon={Landmark} tone="warning" />
              ) : null}
            </div>
          ) : view !== "area" ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {data.counts.districts.total === 1 ? (
                <MetricCard title="District report" value={data.counts.districts.submitted ? "Submitted" : "Pending"} icon={Building2} tone={data.counts.districts.submitted ? "success" : "warning"} />
              ) : (
                <MetricCard title="Districts submitted" value={`${data.counts.districts.submitted}/${data.counts.districts.total}`} icon={Building2} tone="primary" />
              )}
              <MetricCard title="Areas submitted" value={`${data.counts.areas.submitted}/${data.counts.areas.total}`} icon={MapPin} tone="success" />
              {data.state && !narrowed ? (
                <MetricCard title="State report" value={data.state.submitted ? "Submitted" : "Pending"} icon={Landmark} tone={data.state.submitted ? "success" : "warning"} />
              ) : null}
            </div>
          ) : null}

          <SectionCard
            title={`${scopeName} total`}
            description={ownArea ? undefined : data.span === "year" ? "Added up from every month's submitted reports." : "Added up from submitted reports."}
            action={ownArea ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <ReportStatus data={data} report={ownArea.report} />
                <RowActions data={data} level="area" report={ownArea.report} scopeId={ownArea.id} name={ownArea.name} onView={setDetailId} onUnlock={setUnlockTarget} />
              </div>
            ) : undefined}
          >
            <ReportTotals
              sections={consolidatedSections(data, { includeState: !narrowed })}
              actions={data.state && !narrowed ? {
                "state-0": <RowActions data={data} level="state" report={data.state} name="State report" onView={setDetailId} onUnlock={setUnlockTarget} />,
              } : undefined}
            />
          </SectionCard>

          {view !== "area" ? (
            <SectionCard title="By district and area" description="Open a district to see its own report and every area's.">
              <ConsolidatedBreakdown data={data} onView={setDetailId} onUnlock={setUnlockTarget} />
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      <ReportDetailDialog reportId={detailId} onClose={() => setDetailId(null)} />

      <ConfirmDialog
        open={Boolean(unlockTarget)}
        onOpenChange={(open) => { if (!open) setUnlockTarget(null); }}
        busy={unlocking}
        tone="warning"
        icon={LockOpen}
        title={`Unlock ${unlockTarget?.name ?? ""}?`}
        description={`Its admins can submit or edit the ${periodLabel(year, monthNumber)} report for the next 7 days. The change is logged.`}
        confirmLabel="Unlock for 7 days"
        onConfirm={unlock}
      />
    </div>
  );
}
