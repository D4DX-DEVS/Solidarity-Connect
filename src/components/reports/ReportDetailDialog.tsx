import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/StateMessage";
import { ReportFormView } from "./ReportFormView";
import { ReportHistory } from "./ReportHistory";
import { LEVEL_LABELS, formatDateTime, periodLabel } from "@/lib/reportForm";
import { monthlyReportService, type ReportDetail } from "@/services/monthlyReportService";

/** One submitted report: every answer on the form version it was filled on, plus its activity. */
export function ReportDetailDialog({ reportId, onClose }: { reportId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    monthlyReportService.getReport(reportId)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the report"); });
    return () => { cancelled = true; };
  }, [reportId, attempt]);

  const report = detail?.report;

  return (
    <Dialog open={Boolean(reportId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {detail ? `${detail.scopeLabel} · ${LEVEL_LABELS[report!.level]}` : "Report"}
          </DialogTitle>
          <DialogDescription>
            {report ? `${periodLabel(report.year, report.month)}${detail?.districtName && report.level === "area" ? ` · ${detail.districtName}` : ""}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <ErrorState message={error} onRetry={() => setAttempt(a => a + 1)} />
        ) : !detail || !report ? (
          <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
              {report.submittedBy ? <p>Submitted by {report.submittedBy.name} on {formatDateTime(report.submittedAt)}</p> : <p>Not submitted</p>}
              {report.lastEditedBy ? <p>Last edited by {report.lastEditedBy.name} on {formatDateTime(report.lastEditedAt)}</p> : null}
            </div>
            {detail.form ? <ReportFormView fields={detail.form.fields} answers={report.answers} /> : null}
            <ReportHistory history={report.history} fields={detail.form?.fields || []} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
