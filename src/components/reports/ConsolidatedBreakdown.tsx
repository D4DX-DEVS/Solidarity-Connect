import { Fragment, useState } from "react";
import { CheckCircle2, ChevronDown, CircleDashed, Eye, LockOpen, XCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { langOf } from "@/lib/malayalam";
import { formatDate, groupBySection, type ReportLevel } from "@/lib/reportForm";
import type { Consolidated, DistrictRow, NumberColumn, ReportSummary } from "@/services/monthlyReportService";

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
    <Badge variant="outline" className="shrink-0 gap-1 whitespace-nowrap border-success/40 text-success"><CheckCircle2 className="size-3.5" />Submitted</Badge>
  ) : (
    <Badge variant="outline" className="shrink-0 gap-1 whitespace-nowrap border-destructive/40 text-destructive"><XCircle className="size-3.5" />Not submitted</Badge>
  );
}

/** Year view: how many of the year's months were submitted — green when all, amber when some. */
function MonthsBadge({ submitted, total }: { submitted: number; total: number }) {
  const complete = total > 0 && submitted >= total;
  const tone = complete ? "border-success/40 text-success" : submitted > 0 ? "border-warning/50 text-warning" : "border-destructive/40 text-destructive";
  const Icon = complete ? CheckCircle2 : submitted > 0 ? CircleDashed : XCircle;
  return (
    <Badge variant="outline" className={`shrink-0 gap-1 whitespace-nowrap tabular-nums ${tone}`}>
      <Icon className="size-3.5" />{submitted}/{total} months
    </Badge>
  );
}

/** Submitted / Not submitted for a month; months submitted for a year. */
export function ReportStatus({ data, report }: { data: Consolidated; report: ReportSummary }) {
  return data.span === "year"
    ? <MonthsBadge submitted={report.monthsSubmitted ?? 0} total={data.months} />
    : <SubmittedBadge report={report} />;
}

/** Areas column: areas submitted for a month; monthly area reports for a year. */
const areaCount = (data: Consolidated, d: DistrictRow) =>
  data.span === "year"
    ? { submitted: d.areaMonthsSubmitted ?? 0, total: d.areas.length * data.months }
    : { submitted: d.areasSubmitted, total: d.areas.length };

/** Whether the viewer may unlock this row: past its deadline, not already unlocked. */
function unlockable(data: Consolidated, level: ReportLevel, report: ReportSummary) {
  const now = Date.now();
  const deadline = data.deadlines[level];
  if (!data.canUnlock[level] || !deadline) return false;
  if (now <= new Date(deadline).getTime()) return false;
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
  const groups = groupBySection(columns);
  // Phones hide the number columns; an area opens to show its numbers instead.
  const [openArea, setOpenArea] = useState<string | null>(null);
  const counted = areaCount(data, district);
  const totalCount = `${counted.submitted} of ${counted.total}${data.span === "year" ? " reports" : ""}`;
  if (district.areas.length === 0) return <p className="text-sm text-muted-foreground">No areas in this district.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          {/* Section names span their columns once, instead of repeating above every label */}
          {groups.some(g => g.section) ? (
            <TableRow className="hidden border-b-0 hover:bg-transparent md:table-row">
              <TableHead className="h-auto bg-card md:sticky md:left-0 md:z-10" />
              <TableHead className="h-auto" />
              {groups.map((g, i) => (
                <TableHead key={`${g.section}-${i}`} colSpan={g.items.length} className="h-auto px-3 pb-0 pt-3">
                  {g.section ? (
                    <span className="block border-b pb-1.5 text-center text-xs font-semibold text-foreground/80" lang={langOf(g.section)}>
                      {g.section}
                    </span>
                  ) : null}
                </TableHead>
              ))}
              <TableHead className="h-auto" />
            </TableRow>
          ) : null}
          <TableRow>
            {/* Area stays pinned while many number columns scroll sideways */}
            <TableHead className="h-auto bg-card py-2.5 align-bottom md:sticky md:left-0 md:z-10">Area</TableHead>
            <TableHead className="hidden h-auto py-2.5 align-bottom md:table-cell">Status</TableHead>
            {columns.map(c => (
              <TableHead key={c.id} className="hidden h-auto py-2.5 text-right align-bottom md:table-cell">
                <span className="ml-auto block min-w-20 max-w-36 text-balance text-xs leading-snug" lang={langOf(c.label)}>
                  {c.label}
                </span>
              </TableHead>
            ))}
            <TableHead className="h-auto py-2.5 text-right align-bottom"><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {district.areas.map(area => {
            const open = openArea === area.id;
            return (
              <Fragment key={area.id}>
                <TableRow>
                  <TableCell className="bg-card font-medium md:sticky md:left-0 md:z-10 md:whitespace-nowrap">
                    {area.name}
                    <div className="mt-1.5 md:hidden"><ReportStatus data={data} report={area.report} /></div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell"><ReportStatus data={data} report={area.report} /></TableCell>
                  {columns.map(c => (
                    <TableCell key={c.id} className="hidden text-right tabular-nums md:table-cell">
                      {area.report.submitted ? area.report.numbers[c.id] ?? 0 : "—"}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {area.report.submitted && columns.length ? (
                        <Button
                          variant="ghost" size="icon" className="size-11 md:hidden"
                          aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} numbers for ${area.name}`}
                          onClick={() => setOpenArea(open ? null : area.id)}
                        >
                          <ChevronDown className={`size-5 transition-transform ${open ? "rotate-180" : ""}`} />
                        </Button>
                      ) : null}
                      <RowActions data={data} level="area" report={area.report} scopeId={area.id} name={area.name} onView={onView} onUnlock={onUnlock} />
                    </div>
                  </TableCell>
                </TableRow>
                {open ? (
                  <TableRow className="hover:bg-transparent md:hidden">
                    <TableCell colSpan={columns.length + 3} className="bg-muted/30">
                      <NumberList columns={columns} numbers={area.report.numbers} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
          <TableRow className="bg-muted/40 font-semibold">
            <TableCell className="bg-muted md:sticky md:left-0 md:z-10">
              Total
              <span className="block text-xs font-normal text-muted-foreground md:hidden">{totalCount}</span>
            </TableCell>
            <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">{totalCount}</TableCell>
            {columns.map(c => <TableCell key={c.id} className="hidden text-right tabular-nums md:table-cell">{district.areaTotals[c.id] ?? 0}</TableCell>)}
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// Fixed widths so the badges form columns under the header, whatever the counts
const STATUS_SLOT = "w-36 shrink-0";
const AREAS_SLOT = "w-32 shrink-0";

/** Each district with its own report and its areas. */
export function ConsolidatedBreakdown(props: BreakdownProps) {
  const { data, onView, onUnlock } = props;
  const single = data.districts.length === 1;
  return (
    <div className="space-y-2">
      {/* Column titles for the badges; widths match the slots in each row so they line up */}
      <div className="hidden items-center gap-2 border border-transparent px-3 text-xs font-medium text-muted-foreground sm:flex">
        <div className="flex flex-1 items-center justify-between gap-3 pr-2">
          <span>District</span>
          <div className="flex items-center gap-2">
            <span className={`${STATUS_SLOT} text-center`}>District report</span>
            <span className={`${AREAS_SLOT} text-center`}>{data.span === "year" ? "Area reports" : "Areas submitted"}</span>
          </div>
        </div>
        <span className="size-4 shrink-0" aria-hidden />
      </div>
      <Accordion type="multiple" defaultValue={single ? [data.districts[0].id] : []} className="space-y-2">
        {data.districts.map(d => (
          <AccordionItem key={d.id} value={d.id} className="rounded-xl border px-3">
            <AccordionTrigger className="gap-2 py-3 hover:no-underline">
              <div className="flex flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 pr-2 text-left">
                <span className="font-semibold">{d.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`${STATUS_SLOT} flex justify-center`}><ReportStatus data={data} report={d.report} /></span>
                  <span className={`${AREAS_SLOT} flex justify-center`}>
                    <Badge variant="secondary" className="whitespace-nowrap tabular-nums">
                      <span className="sm:hidden">Areas&nbsp;</span>{areaCount(data, d).submitted}/{areaCount(data, d).total}
                    </Badge>
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{data.span === "year" ? "District reports, added up" : "District report"}</span>
                  <RowActions {...props} level="district" report={d.report} scopeId={d.id} name={d.name} />
                </div>
                {/* With one district the totals above are already its numbers. */}
                {!d.report.submitted ? <p className="text-sm text-muted-foreground">{data.span === "year" ? "No month submitted yet." : "Not submitted yet."}</p> : single ? null : (
                  <NumberList columns={data.columns.district} numbers={d.report.numbers} />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                  <span className="text-sm font-semibold">Area reports</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {areaCount(data, d).submitted} of {areaCount(data, d).total} {data.span === "year" ? "monthly reports" : "submitted"}
                  </span>
                </div>
                <AreaTable data={data} districtId={d.id} onView={onView} onUnlock={onUnlock} />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

