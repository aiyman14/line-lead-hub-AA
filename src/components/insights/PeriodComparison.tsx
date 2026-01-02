import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown, Target, Package, Users, AlertTriangle } from "lucide-react";

interface PeriodData {
  totalOutput: number;
  totalQcPass: number;
  avgEfficiency: number;
  totalBlockers: number;
  avgManpower: number;
  daysWithData: number;
}

interface PeriodComparisonProps {
  currentPeriod: PeriodData;
  previousPeriod: PeriodData;
  periodDays: number;
}

function calculateChange(current: number, previous: number): { value: number; trend: 'up' | 'down' | 'stable' } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, trend: current > 0 ? 'up' : 'stable' };
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(change)),
    trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
  };
}

function TrendBadge({ trend, value, inverse = false }: { trend: 'up' | 'down' | 'stable'; value: number; inverse?: boolean }) {
  const isPositive = inverse ? trend === 'down' : trend === 'up';
  const isNegative = inverse ? trend === 'up' : trend === 'down';
  
  if (trend === 'stable') {
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-sm">
        <Minus className="h-4 w-4" />
        <span>No change</span>
      </div>
    );
  }
  
  return (
    <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-success' : isNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
      {trend === 'up' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      <span>{value}%</span>
    </div>
  );
}

export function PeriodComparison({ currentPeriod, previousPeriod, periodDays }: PeriodComparisonProps) {
  const outputChange = calculateChange(currentPeriod.totalOutput, previousPeriod.totalOutput);
  const qcPassChange = calculateChange(currentPeriod.totalQcPass, previousPeriod.totalQcPass);
  const efficiencyChange = calculateChange(currentPeriod.avgEfficiency, previousPeriod.avgEfficiency);
  const blockerChange = calculateChange(currentPeriod.totalBlockers, previousPeriod.totalBlockers);
  const manpowerChange = calculateChange(currentPeriod.avgManpower, previousPeriod.avgManpower);

  const metrics = [
    {
      label: "Total Output",
      icon: TrendingUp,
      current: currentPeriod.totalOutput,
      previous: previousPeriod.totalOutput,
      change: outputChange,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: "Total QC Pass",
      icon: Package,
      current: currentPeriod.totalQcPass,
      previous: previousPeriod.totalQcPass,
      change: qcPassChange,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: "Avg Efficiency",
      icon: Target,
      current: currentPeriod.avgEfficiency,
      previous: previousPeriod.avgEfficiency,
      change: efficiencyChange,
      format: (v: number) => `${v}%`,
    },
    {
      label: "Blockers",
      icon: AlertTriangle,
      current: currentPeriod.totalBlockers,
      previous: previousPeriod.totalBlockers,
      change: blockerChange,
      format: (v: number) => v.toString(),
      inverse: true,
    },
    {
      label: "Avg Manpower",
      icon: Users,
      current: currentPeriod.avgManpower,
      previous: previousPeriod.avgManpower,
      change: manpowerChange,
      format: (v: number) => v.toString(),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Period Comparison
          <span className="text-sm font-normal text-muted-foreground ml-2">
            Current {periodDays} days vs Previous {periodDays} days
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="space-y-2 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Icon className="h-4 w-4" />
                  <span>{metric.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Current</p>
                    <p className="text-lg font-bold font-mono">{metric.format(metric.current)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Previous</p>
                    <p className="text-lg font-mono text-muted-foreground">{metric.format(metric.previous)}</p>
                  </div>
                </div>
                <TrendBadge trend={metric.change.trend} value={metric.change.value} inverse={metric.inverse} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
