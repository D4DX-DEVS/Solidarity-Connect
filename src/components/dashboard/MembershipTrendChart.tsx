import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { formatNumber } from "./chartTheme";

/** 12-month running member total — recharts lives in its own lazy chunk (PWA 2 MiB cap). */
export default function MembershipTrendChart({ data, className }: { data: { label: string; value: number; added: number }[]; className?: string }) {
  return (
    <ChartContainer config={{ value: { label: "Members" } }} className={cn("aspect-auto h-full w-full", className)}>
      <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="members-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2a78d6" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#2a78d6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 11 }} interval={1} />
        <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
        <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent indicator="line" />} />
        <Area type="monotone" dataKey="value" name="Members" stroke="#2a78d6" strokeWidth={2} fill="url(#members-fill)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ChartContainer>
  );
}
