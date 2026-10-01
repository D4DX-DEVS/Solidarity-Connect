import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { singleSeriesConfig } from "./chartTheme";

const config = singleSeriesConfig("Targets completed");

/** Completed recurring-target marks per month — the rhythm of meetings held down the hierarchy. */
export default function ActivityTrendChart({ months }: { months: { label: string; completed: number }[] }) {
  const data = months.map((m) => ({ label: m.label, value: m.completed }));
  return (
    <ChartContainer config={config} className="aspect-auto h-52 w-full">
      <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        {/* Month only on the axis so six ticks fit a phone; the tooltip shows "Sep 2026". */}
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.split(" ")[0]} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11 }} />
        <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent indicator="line" />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={2}
          fill="url(#activity-fill)"
          dot={{ r: 3, strokeWidth: 2, fill: "hsl(var(--card))" }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
