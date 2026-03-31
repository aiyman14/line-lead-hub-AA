import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { LineTrendData, POBreakdown } from "./types";

interface LineDrilldownTrendProps {
  trendData: LineTrendData;
  poBreakdown: POBreakdown[];
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  padding: "8px 12px",
};

export function LineDrilldownTrend({ trendData }: LineDrilldownTrendProps) {
  const { daily } = trendData;

  // Compute average target for reference line
  const avgTarget = useMemo(() => {
    const withTarget = daily.filter((d) => d.target > 0);
    if (withTarget.length === 0) return 0;
    return Math.round(withTarget.reduce((s, d) => s + d.target, 0) / withTarget.length);
  }, [daily]);

  if (daily.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={daily} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="outputGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="displayDate"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={45}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {avgTarget > 0 && (
          <ReferenceLine
            y={avgTarget}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{
              value: `Avg target: ${avgTarget.toLocaleString()}`,
              position: "insideTopRight",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 11,
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="output"
          name="Output"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#outputGradient)"
          dot={{ r: 3, fill: "hsl(var(--primary))" }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
