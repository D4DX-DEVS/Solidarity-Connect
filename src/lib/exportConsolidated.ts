import * as XLSX from "xlsx";
import { columnLabel, periodLabel, yearSpanLabel } from "@/lib/reportForm";
import { consolidatedSections, nestItems } from "@/lib/consolidatedSummary";
import type { Consolidated, DistrictRow, NumberColumn, ReportSummary } from "@/services/monthlyReportService";

type Row = (string | number)[];

// Nothing submitted means a blank cell, never a 0 that reads like a real count.
const values = (columns: NumberColumn[], numbers: Record<string, number>, submitted: boolean): Row =>
  columns.map(c => (submitted ? numbers[c.id] ?? 0 : ""));

/** A sheet whose columns are wide enough for their longest cell (Malayalam headers included), within reason. */
function sheet(rows: Row[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const columnCount = Math.max(0, ...rows.map(r => r.length));
  ws["!cols"] = Array.from({ length: columnCount }, (_, i) => ({
    wch: Math.min(48, Math.max(8, ...rows.map(r => String(r[i] ?? "").length)) + 2),
  }));
  return ws;
}

/** The consolidated view as a workbook: totals, districts, areas and who is missing. Month or whole year. */
export function exportConsolidated(data: Consolidated, { includeState = true }: { includeState?: boolean } = {}) {
  const { year, month } = data.period;
  const yearly = data.span === "year";
  const wb = XLSX.utils.book_new();
  const { columns } = data;

  // A month says Submitted / Not submitted; a year says how many of its months came in.
  const status = (r: ReportSummary) =>
    yearly ? `${r.monthsSubmitted ?? 0} of ${data.months} months` : r.submitted ? "Submitted" : "Not submitted";
  const anyAreaIn = (d: DistrictRow) => (yearly ? (d.areaMonthsSubmitted ?? 0) > 0 : d.areasSubmitted > 0);
  const areasCell = (d: DistrictRow) =>
    yearly ? `${d.areaMonthsSubmitted ?? 0} of ${d.areas.length * data.months} reports` : `${d.areasSubmitted} of ${d.areas.length}`;
  const missing = (r: ReportSummary) => (yearly ? (r.monthsSubmitted ?? 0) < data.months : !r.submitted);

  const summary: Row[] = [[yearly ? "Yearly report" : "Monthly report", yearly ? yearSpanLabel(year, data.months) : periodLabel(year, month ?? 1)], []];
  if (yearly && data.counts.months) {
    const { district, area, state } = data.counts.months;
    if (data.viewer.view !== "area") summary.push(["District reports", `${district.submitted} of ${district.total}`]);
    summary.push(["Area reports", `${area.submitted} of ${area.total}`]);
    if (state && includeState) summary.push(["State reports", `${state.submitted} of ${state.total}`]);
  } else {
    if (data.viewer.view !== "area") summary.push(["Districts submitted", `${data.counts.districts.submitted} of ${data.counts.districts.total}`]);
    summary.push(["Areas submitted", `${data.counts.areas.submitted} of ${data.counts.areas.total}`]);
    if (data.state && includeState) summary.push(["State report", status(data.state)]);
  }
  // Same sections and numbering as the page; follow-up counts indented under their item.
  for (const section of consolidatedSections(data, { includeState })) {
    summary.push([], [section.title, section.source ?? ""]);
    nestItems(section.items).forEach(({ item, children }, i) => {
      summary.push([`${i + 1}. ${item.label}`, item.value ?? ""]);
      for (const child of children) summary.push([`    ${child.label}`, child.value ?? ""]);
    });
  }
  XLSX.utils.book_append_sheet(wb, sheet(summary), "Summary");

  if (data.viewer.view !== "area") {
    const header: Row = [
      "District", yearly ? "District months" : "District report", yearly ? "Area reports" : "Areas submitted",
      ...columns.district.map(columnLabel), ...columns.area.map(c => `Areas: ${columnLabel(c)}`),
    ];
    const rows: Row[] = data.districts.map(d => [
      d.name, status(d.report), areasCell(d),
      ...values(columns.district, d.report.numbers, d.report.submitted),
      ...values(columns.area, d.areaTotals, anyAreaIn(d)),
    ]);
    XLSX.utils.book_append_sheet(wb, sheet([header, ...rows]), "Districts");
  }

  const areaHeader: Row = ["District", "Area", yearly ? "Months" : "Status", ...columns.area.map(columnLabel)];
  const areaRows: Row[] = data.districts.flatMap(d => d.areas.map(a => [
    d.name, a.name, status(a.report), ...values(columns.area, a.report.numbers, a.report.submitted),
  ]));
  XLSX.utils.book_append_sheet(wb, sheet([areaHeader, ...areaRows]), "Areas");

  const gaps: Row[] = [yearly ? ["Level", "District", "Area", "Months submitted"] : ["Level", "District", "Area"]];
  const gap = (level: string, district: string, area: string, r: ReportSummary): Row =>
    yearly ? [level, district, area, status(r)] : [level, district, area];
  if (data.state && missing(data.state)) gaps.push(gap("State", "", "", data.state));
  for (const d of data.districts) {
    if (data.viewer.view !== "area" && missing(d.report)) gaps.push(gap("District", d.name, "", d.report));
    for (const a of d.areas) if (missing(a.report)) gaps.push(gap("Area", d.name, a.name, a.report));
  }
  XLSX.utils.book_append_sheet(wb, sheet(gaps), yearly ? "Months missing" : "Not submitted");

  XLSX.writeFile(wb, yearly ? `yearly-report-${year}.xlsx` : `monthly-report-${year}-${String(month).padStart(2, "0")}.xlsx`);
}
