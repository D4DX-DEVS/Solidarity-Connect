import { CheckCircle2, Eye, LockOpen, XCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, groupBySection, type ReportLevel } from "@/lib/reportForm";
import type { Consolidated, NumberColumn, ReportSummary } from "@/services/monthlyReportService";

export interface UnlockTarget {
  level: ReportLevel;
  scopeId?: string;
  name: string;
}

interface BreakdownProps {
  data: Consolidated;
  onView: (reportId: string) => void;
  onUnlock: (target: UnlockTarget) => void;
}

export function SubmittedBadge({ report }: { report: ReportSummary }) {
  return report.submitted ? (
    <Badge variant="outline" className="gap-1 border-success/40 text-success"><CheckCircle2 className="size-3.5" />Submitted</Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive"><XCircle className="size-3.5" />Not submitted</Badge>
  );
}

/** Whether the viewer may unlock this row: past its deadline, not already unlocked. */
function unlockable(data: Consolidated, level: ReportLevel, report: ReportSummary) {
  const now = Date.now();
  if (!data.canUnlock[level]) return false;
  if (now <= new Date(data.deadlines[level]).getTime()) return false;
  return !(report.unlockedUntil && new Date(report.unlockedUntil).getTime() > now);
}

export function RowActions({ data, level, report, scopeId, name, onView, onUnlock }: BreakdownProps & {
  level: ReportLevel; report: ReportSummary; scopeId?: string; name: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {report.unlockedUntil && new Date(report.unlockedUntil).getTime() > Date.now() ? (
        <span className="text-xs text-muted-foreground">Unlocked till {formatDate(report.unlockedUntil)}</span>
      ) : null}
      {report.submitted && report.reportId ? (
        <Button variant="ghost" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" onClick={() => onView(report.reportId!)}>
          <Eye className="size-4" />View
        </Button>
      ) : null}
      {unlockable(data, level, report) ? (
        <Button variant="outline" size="sm" className="min-h-11 gap-1.5 sm:min-h-9" onClick={() => onUnlock({ level, scopeId, name })}>
          <LockOpen className="size-4" />Unlock
        </Button>
      ) : null}
    </div>
  );
}

function NumberList({ columns, numbers }: { columns: NumberColumn[]; numbers: Record<string, number> }) {
  return (
    <div className="space-y-3">
      {groupBySection(columns).map((group, i) => (
        <div key={`${group.section}-${i}`} className="space-y-1">
          {group.section ? <p className="text-xs font-semibold text-foreground/70">{group.section}</p> : null}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {group.items.map(c => (
              <div key={c.id} className="flex items-baseline justify-between gap-3 border-b border-dashed py-1">
                <dt className="text-sm text-muted-foreground">{c.label}{c.retired ? " (removed)" : ""}</dt>
                <dd className="text-sm font-semibold tabular-nums">{numbers[c.id] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function AreaTable({ data, districtId, onView, onUnlock }: BreakdownProps & { districtId: string }) {
  const district = data.districts.find(d => d.id === districtId)!;
  const columns = data.columns.area;
  if (district.areas.length === 0) return <p className="text-sm text-muted-foreground">No areas in this district.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[9rem]">Area</TableHead>
            <TableHead>Status</TableHead>
            {columns.map(c => (
              <TableHead key={c.id} className="hidden min-w-[6rem] text-right md:table-cell">
                {c.section ? <span className="block text-xs font-normal">{c.section}</span> : null}
                {c.label}
              </TableHead>
            ))}
            <TableHead className="text-right"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {district.areas.map(area => (
            <TableRow key={area.id}>
              <TableCell className="font-medium">{area.name}</TableCell>
              <TableCell><SubmittedBadge report={area.report} /></TableCell>
              {columns.map(c => (
                <TableCell key={c.id} className="hidden text-right tabular-nums md:table-cell">
                  {area.report.submitted ? area.report.numbers[c.id] ?? 0 : "—"}
                </TableCell>
              ))}
              <TableCell>
                <RowActions data={data} level="area" report={area.report} scopeId={area.id} name={area.name} onView={onView} onUnlock={onUnlock} />
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 font-semibold">
            <TableCell>Total</TableCell>
            <TableCell className="text-xs text-muted-foreground">{district.areasSubmitted} of {district.areas.length}</TableCell>
            {columns.map(c => <TableCell key={c.id} className="hidden text-right tabular-nums md:table-cell">{district.areaTotals[c.id] ?? 0}</TableCell>)}
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/** Each district with its own report and its areas. */
export function ConsolidatedBreakdown(props: BreakdownProps) {
  const { data, onView, onUnlock } = props;
  const single = data.districts.length === 1;
  return (
    <Accordion type="multiple" defaultValue={single ? [data.districts[0].id] : []} className="space-y-2">
      {data.districts.map(d => (
        <AccordionItem key={d.id} value={d.id} className="rounded-xl border px-3">
          <AccordionTrigger className="gap-2 py-3 hover:no-underline">
            <div className="flex flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 pr-2 text-left">
              <span className="font-semibold">{d.name}</span>
              <div className="flex flex-wrap items-center gap-2">
                <SubmittedBadge report={d.report} />
                <Badge variant="secondary" className="whitespace-nowrap tabular-nums">Areas {d.areasSubmitted}/{d.areas.length}</Badge>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="space-y-2 rounded-lg bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">District report</span>
                <RowActions {...props} level="district" report={d.report} scopeId={d.id} name={d.name} />
              </div>
              {/* With one district the totals above are already its numbers. */}
              {!d.report.submitted ? <p className="text-sm text-muted-foreground">Not submitted yet.</p> : single ? null : (
                <NumberList columns={data.columns.district} numbers={d.report.numbers} />
              )}
            </div>
            <AreaTable data={data} districtId={d.id} onView={onView} onUnlock={onUnlock} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

