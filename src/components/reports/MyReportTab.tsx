import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2, Lock, Save } from "lucide-react";
import { SectionCard } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPicker } from "@/components/ui/month-picker";
import { EmptyState, ErrorState } from "@/components/shared/StateMessage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ReportFormView } from "./ReportFormView";
import { ReportHistory } from "./ReportHistory";
import {
  LEVEL_LABELS, MONTH_NAMES, answersForSubmit, formatDate, formatDateTime, fromMonthValue,
  periodLabel, toMonthValue, validateReport, type Answers,
} from "@/lib/reportForm";
import { monthlyReportService, type MyReport, type ReportApiError } from "@/services/monthlyReportService";

const SHORT_MONTHS = MONTH_NAMES.map(m => m.slice(0, 3));

/** The caller's own monthly report: pick a month, see who filled it, fill or edit it. */
export function MyReportTab({ month, onMonthChange }: { month: string; onMonthChange: (value: string) => void }) {
  const { toast } = useToast();
  const { year, month: monthNumber } = fromMonthValue(month);
  const [data, setData] = useState<MyReport | null>(null);
  const [status, setStatus] = useState<{ month: number; submitted: boolean }[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setErrors({});
    try {
      const [mine, months] = await Promise.all([
        monthlyReportService.getMine(year, monthNumber),
        monthlyReportService.getStatus(year),
      ]);
      setData(mine);
      setStatus(months);
      setAnswers(mine.report?.answers || {});
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the report");
    } finally {
      setLoading(false);
    }
  }, [year, monthNumber]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(
    () => JSON.stringify(answers) !== JSON.stringify(data?.report?.answers || {}),
    [answers, data],
  );

  const save = async () => {
    if (!data?.form) return;
    const found = validateReport(data.form.fields, answers);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast({ title: "Check the highlighted answers", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const report = await monthlyReportService.saveMine(
        year, monthNumber, answersForSubmit(data.form.fields, answers), data.report?.submitted ? data.report.updatedAt : undefined,
      );
      setData({ ...data, report });
      setAnswers(report.answers);
      setStatus(prev => prev.map(s => (s.month === monthNumber ? { ...s, submitted: true } : s)));
      toast({ title: data.report?.submitted ? "Report updated" : "Report submitted", description: periodLabel(year, monthNumber) });
    } catch (error) {
      const err = error as ReportApiError;
      if (err.data?.errors?.length) setErrors(Object.fromEntries(err.data.errors.map(e => [e.fieldId, e.message])));
      toast({ title: "Not saved", description: err.message, variant: "destructive" });
      if (err.status === 409) load();
    } finally {
      setSaving(false);
    }
  };

  const monthStrip = (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label={`Months of ${year}`}>
      {SHORT_MONTHS.map((label, i) => {
        const m = i + 1;
        const done = status.find(s => s.month === m)?.submitted;
        const selected = m === monthNumber;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onMonthChange(toMonthValue(year, m))}
            aria-pressed={selected}
            aria-label={`${MONTH_NAMES[i]}${done ? ", submitted" : ""}`}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-lg border text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary bg-primary text-primary-foreground"
                : done ? "border-success/40 bg-success/10 text-success" : "hover:bg-muted",
            )}
          >
            {label}
            {done ? <CheckCircle2 className="mt-0.5 size-3" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionCard
        title={data ? `${data.scopeLabel} · ${LEVEL_LABELS[data.level]} report` : "My report"}
        description="One shared report per month. Any admin of your scope can fill or update it."
        action={<MonthPicker value={month} onChange={onMonthChange} className="w-40" />}
      >
        {monthStrip}
      </SectionCard>

      {loading ? (
        <SectionCard title={periodLabel(year, monthNumber)}>
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-11 w-48" /></div>
            ))}
          </div>
        </SectionCard>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={load} />
      ) : data && !data.form ? (
        <EmptyState title="No report form yet" description="The state admin has not published this report form. Check back later." />
      ) : data && data.form ? (
        <SectionCard
          title={periodLabel(year, monthNumber)}
          description={data.form.title || undefined}
          action={<StatusBadge data={data} />}
        >
          <div className="space-y-5">
            <StatusLine data={data} />

            {data.canEdit ? (
              <>
                <ReportFormView fields={data.form.fields} answers={answers} onChange={setAnswers} errors={errors} disabled={saving} />
                <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
                  <Button onClick={save} disabled={saving || (data.report?.submitted && !dirty)} className="min-h-11 gap-2 shadow-lg">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {data.report?.submitted ? "Save changes" : "Submit report"}
                  </Button>
                </div>
              </>
            ) : data.report?.submitted ? (
              <ReportFormView fields={data.form.fields} answers={data.report.answers} />
            ) : (
              <EmptyState
                title="Not submitted"
                description={data.canFill ? "This month can no longer be filled." : "Your area admin has not filled this month's report yet."}
              />
            )}

            {data.report ? <ReportHistory history={data.report.history} fields={data.form.fields} /> : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function StatusBadge({ data }: { data: MyReport }) {
  if (data.report?.submitted) {
    return <Badge className="gap-1 bg-success text-success-foreground hover:bg-success"><CheckCircle2 className="size-3.5" />Submitted</Badge>;
  }
  return <Badge variant="outline" className="gap-1"><Clock className="size-3.5" />Not submitted</Badge>;
}

function StatusLine({ data }: { data: MyReport }) {
  const r = data.report;
  const lines: string[] = [];
  if (r?.submitted && r.submittedBy) lines.push(`Submitted by ${r.submittedBy.name} on ${formatDateTime(r.submittedAt)}`);
  if (r?.lastEditedBy) lines.push(`Last edited by ${r.lastEditedBy.name} on ${formatDateTime(r.lastEditedAt)}`);

  return (
    <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
      {lines.map(line => <p key={line}>{line}</p>)}
      {data.future ? (
        <p className="flex items-center gap-1.5 text-muted-foreground"><Lock className="size-3.5" />This month has not started yet.</p>
      ) : data.locked ? (
        <p className="flex items-center gap-1.5 text-muted-foreground"><Lock className="size-3.5" />Locked since {formatDate(data.deadline)}. A higher level can unlock it.</p>
      ) : data.canFill ? (
        <p className="flex items-center gap-1.5 text-muted-foreground"><Clock className="size-3.5" />Editable until {formatDate(data.editableUntil)}.</p>
      ) : (
        <p className="text-muted-foreground">You can view this report. Only area admins fill it.</p>
      )}
    </div>
  );
}
