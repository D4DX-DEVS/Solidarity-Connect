import { LEVEL_LABELS, groupBySection } from "@/lib/reportForm";
import type { Consolidated, NumberColumn } from "@/services/monthlyReportService";

export interface TotalItem extends NumberColumn {
  /** null while nothing behind it has been submitted. */
  value: number | null;
}

export interface TotalSection {
  key: string;
  title: string;
  /** Where the numbers come from, e.g. "From area reports". */
  source?: string;
  items: TotalItem[];
}

/** One form's add-up columns split at its headings; a form without headings is one section. */
export function sectionsFrom(
  columns: NumberColumn[],
  values: Record<string, number> | null,
  { title, source, key }: { title: string; source?: string; key: string },
): TotalSection[] {
  return groupBySection(columns).map((group, i) => ({
    key: `${key}-${i}`,
    title: group.section ?? title,
    source,
    items: group.items.map(c => ({ ...c, value: values ? values[c.id] ?? 0 : null })),
  }));
}

/**
 * The viewer's totals in the committee's order: the area form's sections (units,
 * then the area itself), then districts, then the state.
 */
export function consolidatedSections(data: Consolidated, { includeState }: { includeState: boolean }): TotalSection[] {
  const { columns, totals, counts } = data;
  const areaSource = counts.areas.total > 1 ? "From area reports" : "Area report";
  const districtSource = counts.districts.total > 1 ? "From district reports" : "District report";
  return [
    ...sectionsFrom(columns.area, counts.areas.submitted ? totals.area : null, { title: LEVEL_LABELS.area, source: areaSource, key: "area" }),
    ...sectionsFrom(columns.district, counts.districts.submitted ? totals.district : null, { title: LEVEL_LABELS.district, source: districtSource, key: "district" }),
    ...(includeState && data.state
      ? sectionsFrom(columns.state, data.state.submitted ? data.state.numbers : null, { title: LEVEL_LABELS.state, source: "State report", key: "state" })
      : []),
  ];
}

/** Top-level items numbered in order, each with the follow-up counts shown under it. */
export function nestItems(items: TotalItem[]): { item: TotalItem; children: TotalItem[] }[] {
  const ids = new Set(items.map(i => i.id));
  return items
    .filter(i => !(i.parentId && ids.has(i.parentId)))
    .map(item => ({ item, children: items.filter(c => c.parentId === item.id) }));
}
