import * as XLSX from "xlsx";
import { columnLabel, periodLabel } from "@/lib/reportForm";
import { consolidatedSections, nestItems } from "@/lib/consolidatedSummary";
import type { Consolidated, NumberColumn, ReportSummary } from "@/services/monthlyReportService";

type Row = (string | number)[];

const status = (r: ReportSummary) => (r.submitted ? "Submitted" : "Not submitted");
const values = (columns: NumberColumn[], numbers: Record<string, number>, submitted = true): Row =>
  columns.map(c => (submitted ? numbers[c.id] ?? 0 : ""));

/** The consolidated view as a workbook: totals, districts, areas and who is missing. */
export function exportConsolidated(data: Consolidated, { includeState = true }: { includeState?: boolean } = {}) {
  const { year, month } = data.period;
  const wb = XLSX.utils.book_new();
  const { columns } = data;

  const summary: Row[] = [["Monthly report", periodLabel(year, month)], []];
  if (data.viewer.view !== "area") summary.push(["Districts submitted", `${data.counts.districts.submitted} of ${data.counts.districts.total}`]);
  summary.push(["Areas submitted", `${data.counts.areas.submitted} of ${data.counts.areas.total}`]);
  if (data.state && includeState) summary.push(["State report", status(data.state)]);
  // Same sections and numbering as the page; follow-up counts indented under their item.
  for (const section of consolidatedSections(data, { includeState })) {
    summary.push([], [section.title, section.source ?? ""]);
    nestItems(section.items).forEach(({ item, children }, i) => {
      summary.push([`${i + 1}. ${item.label}`, item.value ?? ""]);
      for (const child of children) summary.push([`    ${child.label}`, child.value ?? ""]);
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  if (data.viewer.view !== "area") {
    const header: Row = ["District", "District report", "Areas submitted", ...columns.district.map(columnLabel), ...columns.area.map(c => `Areas: ${columnLabel(c)}`)];
    const rows: Row[] = data.districts.map(d => [
      d.name, status(d.report), `${d.areasSubmitted} of ${d.areas.length}`,
      ...values(columns.district, d.report.numbers, d.report.submitted),
      ...values(columns.area, d.areaTotals),
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Districts");
  }

  const areaHeader: Row = ["District", "Area", "Status", ...columns.area.map(columnLabel)];
  const areaRows: Row[] = data.districts.flatMap(d => d.areas.map(a => [
    d.name, a.name, status(a.report), ...values(columns.area, a.report.numbers, a.report.submitted),
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([areaHeader, ...areaRows]), "Areas");

  const missing: Row[] = [["Level", "District", "Area"]];
  if (data.state && !data.state.submitted) missing.push(["State", "", ""]);
  for (const d of data.districts) {
    if (data.viewer.view !== "area" && !d.report.submitted) missing.push(["District", d.name, ""]);
    for (const a of d.areas) if (!a.report.submitted) missing.push(["Area", d.name, a.name]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(missing), "Not submitted");

  XLSX.writeFile(wb, `monthly-report-${year}-${String(month).padStart(2, "0")}.xlsx`);
}
