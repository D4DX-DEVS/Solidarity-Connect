import { History } from "lucide-react";
import { formatDateTime, type ReportField } from "@/lib/reportForm";
import type { HistoryEntry } from "@/services/monthlyReportService";

const ACTION_LABELS: Record<HistoryEntry["action"], string> = {
  submitted: "submitted the report",
  edited: "edited",
  unlocked: "unlocked the month",
};

/** Who did what to a report, newest first, naming the questions each edit changed. */
export function ReportHistory({ history, fields }: { history: HistoryEntry[]; fields: ReportField[] }) {
  if (history.length === 0) return null;
  const labels = new Map(fields.map(f => [f.id, f.label]));

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="size-4 text-muted-foreground" />
        Activity
      </h4>
      <ol className="space-y-2">
        {[...history].reverse().map((entry, i) => {
          const changed = entry.action === "edited"
            ? entry.changed.map(id => labels.get(id) || `Question ${id}`).join(", ")
            : "";
          return (
            <li key={`${entry.at}-${i}`} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{entry.by?.name || "Someone"}</span>{" "}
                <span className="text-muted-foreground">{ACTION_LABELS[entry.action]}</span>
                {changed ? <span className="text-muted-foreground"> {changed}</span> : null}
              </div>
              <div className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
