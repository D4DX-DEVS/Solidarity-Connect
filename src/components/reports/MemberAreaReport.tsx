import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { SectionCard } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPicker } from "@/components/ui/month-picker";
import { EmptyState, ErrorState } from "@/components/shared/StateMessage";
import { memberAuthAPI } from "@/utils/api";
import { currentIstPeriod, formatDate, fromMonthValue, toMonthValue } from "@/lib/reportForm";
import { sectionsFrom } from "@/lib/consolidatedSummary";
import { ReportTotals } from "./ReportTotals";

interface AreaReport {
  area: string;
  year: number;
  month: number;
  submitted: boolean;
  submittedAt: string | null;
  items: { fieldId: number; label: string; section?: string | null; parentId?: number | null; value: number | null }[];
}

/** Member view: their own area's monthly totals — numbers only. */
export function MemberAreaReport() {
  const now = currentIstPeriod();
  const [month, setMonth] = useState(toMonthValue(now.year, now.month));
  const [data, setData] = useState<AreaReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { year, month: m } = fromMonthValue(month);
    setLoading(true);
    setError(null);
    try {
      const result = await memberAuthAPI.getAreaReport({ year, month: m });
      setData(result.data as AreaReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your area report");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  return (
    <SectionCard
      title={data ? `${data.area} · Area report` : "Area report"}
      description="Monthly totals from your area admins"
      action={<MonthPicker value={month} onChange={setMonth} className="w-40" />}
    >
      {loading ? (
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No area report yet" description="Your area's monthly numbers will appear here." />
      ) : (
        <div className="space-y-3">
          {data.submitted ? (
            <Badge variant="outline" className="gap-1 border-success/40 text-success">
              <CheckCircle2 className="size-3.5" />Submitted {formatDate(data.submittedAt)}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1"><Clock className="size-3.5" />Not submitted yet</Badge>
          )}
          <ReportTotals sections={sectionsFrom(
            data.items.map(({ fieldId, ...item }) => ({ id: fieldId, ...item })),
            data.submitted ? Object.fromEntries(data.items.map(i => [i.fieldId, i.value ?? 0])) : null,
            { title: "", key: "area" },
          )} />
        </div>
      )}
    </SectionCard>
  );
}
