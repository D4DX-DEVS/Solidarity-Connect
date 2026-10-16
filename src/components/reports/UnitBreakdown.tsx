import { langOf } from "@/lib/malayalam";
import type { NumberColumn, UnitNumbers } from "@/services/monthlyReportService";

interface UnitBreakdownProps {
  /** Add-up columns to show; pass them through unitColumnsOf. */
  columns: NumberColumn[];
  units: UnitNumbers[];
  /** e.g. "Kozhikode · Medical College" for screen readers. */
  caption?: string;
}

/** An area's numbers unit by unit: one row per unit, a column per question, totals at the foot. */
export function UnitBreakdown({ columns, units, caption }: UnitBreakdownProps) {
  if (units.length === 0 || columns.length === 0) return null;
  const total = (id: number) => units.reduce((sum, u) => sum + (u.numbers[id] ?? 0), 0);
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-2 py-2 sm:px-3 text-left font-medium">Unit</th>
            {columns.map(c => (
              <th key={c.id} scope="col" className="px-2 py-2 sm:px-3 text-right align-bottom font-medium">
                <span className="ml-auto block min-w-14 max-w-36 text-balance leading-snug" lang={langOf(c.label)}>{c.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {units.map(unit => (
            <tr key={unit.name} className="border-t">
              <th scope="row" className="px-2 py-2 sm:px-3 text-left font-medium">{unit.name}</th>
              {columns.map(c => <td key={c.id} className="px-2 py-2 sm:px-3 text-right tabular-nums">{unit.numbers[c.id] ?? 0}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t bg-muted/20 font-semibold">
          <tr>
            <th scope="row" className="px-2 py-2 sm:px-3 text-left">
              Total
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{units.length} {units.length === 1 ? "unit" : "units"}</span>
            </th>
            {columns.map(c => <td key={c.id} className="px-2 py-2 sm:px-3 text-right tabular-nums">{total(c.id)}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
