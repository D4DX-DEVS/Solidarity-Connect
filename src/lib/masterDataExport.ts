import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { districtsApi, District, DistrictFilters } from "./districts";
import { groupsApi, Group, GroupFilters } from "./groups";

export type ExportFormat = "excel" | "pdf";

interface ExportTable {
  title: string;
  filename: string;
  headers: string[];
  colWidths: number[];
  rows: (string | number)[][];
}

const PAGE_LIMIT = 100; // API caps page size at 100

/** Walk every page of a list endpoint, keeping the caller's filters. */
async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ data?: T[]; pagination?: { totalPages?: number } }>,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await fetchPage(page);
    all.push(...(res.data || []));
    totalPages = res.pagination?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}

function writeTable(table: ExportTable, format: ExportFormat): void {
  const filename = `${table.filename}-${new Date().toISOString().split("T")[0]}`;
  if (format === "excel") {
    const sheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
    sheet["!cols"] = table.colWidths.map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, table.title);
    XLSX.writeFile(wb, `${filename}.xlsx`);
    return;
  }
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(table.title, 14, 14);
  doc.setFontSize(9);
  doc.text(`${table.rows.length} records · ${new Date().toLocaleDateString("en-IN")}`, 14, 20);
  autoTable(doc, {
    head: [table.headers],
    body: table.rows,
    startY: 25,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [39, 39, 42] },
  });
  doc.save(`${filename}.pdf`);
}

/** Exports every district matching the filters; returns the row count. */
export async function exportDistricts(filters: DistrictFilters, format: ExportFormat): Promise<number> {
  const districts = await fetchAllPages<District>((page) =>
    districtsApi.getDistricts({ ...filters, page, limit: PAGE_LIMIT }),
  );
  writeTable(
    {
      title: "Districts",
      filename: "districts",
      headers: ["#", "District", "Code", "Areas", "Members"],
      colWidths: [5, 28, 10, 8, 10],
      rows: districts.map((d, i) => [
        i + 1,
        d.name,
        d.code,
        d.statistics?.totalGroups || 0,
        d.statistics?.totalMembers || 0,
      ]),
    },
    format,
  );
  return districts.length;
}

/** Exports every area matching the filters; returns the row count. */
export async function exportAreas(filters: GroupFilters, format: ExportFormat): Promise<number> {
  const areas = await fetchAllPages<Group>((page) => groupsApi.getGroups({ ...filters, page, limit: PAGE_LIMIT }));
  writeTable(
    {
      title: "Areas",
      filename: "areas",
      headers: ["#", "Area", "District", "Code", "Members"],
      colWidths: [5, 28, 24, 10, 10],
      rows: areas.map((a, i) => [
        i + 1,
        a.name,
        a.district?.name || "—",
        a.code,
        a.statistics?.totalMembers || 0,
      ]),
    },
    format,
  );
  return areas.length;
}
