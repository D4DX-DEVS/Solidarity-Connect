import type { ReactNode } from "react";
import { nestItems, type TotalSection } from "@/lib/consolidatedSummary";

const shown = (value: number | null) => (value === null ? "—" : value.toLocaleString("en-IN"));

/**
 * Report totals as titled sections of numbered tiles. A follow-up count (the
 * attendee count under Members Meet) sits inside its parent's tile.
 */
export function ReportTotals({ sections, actions = {} }: { sections: TotalSection[]; actions?: Record<string, ReactNode> }) {
  return (
    <div className="space-y-5">
      {sections.map(section => (
        <section key={section.key} className="space-y-2">
          {section.title || actions[section.key] ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-sm font-semibold">{section.title}</h3>
                {section.source ? <span className="text-xs text-muted-foreground">{section.source}</span> : null}
              </div>
              {actions[section.key]}
            </div>
          ) : null}
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {nestItems(section.items).map(({ item, children }, i) => (
              <li key={item.id} className="flex h-full flex-col justify-between gap-2 rounded-xl border bg-card p-3">
                <span className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                  {i + 1}. {item.label}{item.retired ? " (removed)" : ""}
                </span>
                <span className="text-lg font-bold tabular-nums sm:text-2xl">{shown(item.value)}</span>
                {children.map(child => (
                  <span key={child.id} className="flex items-baseline justify-between gap-2 border-t pt-1.5 text-xs text-muted-foreground">
                    <span className="line-clamp-2">{child.label}</span>
                    <span className="font-semibold tabular-nums text-foreground">{shown(child.value)}</span>
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
