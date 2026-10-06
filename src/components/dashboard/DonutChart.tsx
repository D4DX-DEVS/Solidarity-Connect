import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { formatNumber } from "./chartTheme";

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
}

/**
 * Generic donut — recharts lives in its own lazy chunk (PWA 2 MiB cap). Size comes from `className`.
 * No centre label: it only ever held the member total, which the Members tile already shows.
 */
export default function DonutChart({ segments, className, showTooltip = true }: {
  segments: DonutSegment[];
  className?: string;
  /** Off for the grey placeholder ring, which must not report a value. */
  showTooltip?: boolean;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className={cn("relative h-40 w-40 shrink-0", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={segments} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="100%" strokeWidth={2} stroke="hsl(var(--card))" paddingAngle={total > 0 ? 1 : 0}>
            {segments.map((s) => <Cell key={s.name} fill={s.color} />)}
          </Pie>
          {showTooltip ? <Tooltip formatter={(v: number | undefined, name: string | undefined) => [formatNumber(Number(v ?? 0)), name ?? ""]} /> : null}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
