import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, TrendingUp, Factory, Package } from "lucide-react";

interface LineData {
  id: string; // UUID
  line_id: string; // Display ID like "Line 4"
  name: string | null;
}

interface TargetData {
  line_uuid: string; // Actual line UUID
  line_name: string;
  per_hour_target: number;
  manpower_planned?: number | null;
  m_power_planned?: number | null;
}

interface ActualData {
  line_uuid: string; // Actual line UUID
  line_name: string;
  output: number;
  manpower?: number | null;
  m_power?: number | null;
  has_blocker: boolean;
}

interface TargetVsActualComparisonProps {
  allLines: LineData[];
  targets: TargetData[];
  actuals: ActualData[];
  type: 'sewing' | 'finishing';
  loading?: boolean;
}

interface ComparisonRow {
  line_uuid: string;
  line_name: string;
  targetPerHour: number;
  plannedManpower: number;
  actualOutput: number;
  actualManpower: number;
  hasBlocker: boolean;
  hasTarget: boolean;
  hasActual: boolean;
}

function calculatePerformance(actual: number, target: number): { percent: number; trend: 'up' | 'down' | 'stable' } {
  if (target === 0) return { percent: 0, trend: 'stable' };
  const percent = Math.round((actual / target) * 100);
  return {
    percent,
    trend: percent >= 100 ? 'up' : percent >= 80 ? 'stable' : 'down'
  };
}

function PerformanceBadge({ percent, trend }: { percent: number; trend: 'up' | 'down' | 'stable' }) {
  const Icon = trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : Minus;
  const variant = trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary';
  
  return (
    <Badge variant={variant} className="gap-1 font-mono">
      <Icon className="h-3 w-3" />
      {percent}%
    </Badge>
  );
}

export function TargetVsActualComparison({ allLines, targets, actuals, type, loading }: TargetVsActualComparisonProps) {
  // Group targets by line UUID and sum values
  const targetsByLine = new Map<string, { totalTarget: number; totalManpower: number; count: number }>();
  targets.forEach(target => {
    const existing = targetsByLine.get(target.line_uuid);
    if (existing) {
      existing.totalTarget += target.per_hour_target;
      existing.totalManpower += target.manpower_planned || target.m_power_planned || 0;
      existing.count += 1;
    } else {
      targetsByLine.set(target.line_uuid, {
        totalTarget: target.per_hour_target,
        totalManpower: target.manpower_planned || target.m_power_planned || 0,
        count: 1,
      });
    }
  });

  // Group actuals by line UUID and sum values
  const actualsByLine = new Map<string, { totalOutput: number; totalManpower: number; hasBlocker: boolean; count: number }>();
  actuals.forEach(actual => {
    const existing = actualsByLine.get(actual.line_uuid);
    if (existing) {
      existing.totalOutput += actual.output;
      existing.totalManpower += actual.manpower || actual.m_power || 0;
      existing.hasBlocker = existing.hasBlocker || actual.has_blocker;
      existing.count += 1;
    } else {
      actualsByLine.set(actual.line_uuid, {
        totalOutput: actual.output,
        totalManpower: actual.manpower || actual.m_power || 0,
        hasBlocker: actual.has_blocker,
        count: 1,
      });
    }
  });

  // Build comparison data for ALL lines
  const comparisonData: ComparisonRow[] = allLines.map(line => {
    const targetData = targetsByLine.get(line.id);
    const actualData = actualsByLine.get(line.id);

    return {
      line_uuid: line.id,
      line_name: line.name || line.line_id,
      targetPerHour: targetData?.totalTarget || 0,
      plannedManpower: targetData?.totalManpower || 0,
      actualOutput: actualData?.totalOutput || 0,
      actualManpower: actualData?.totalManpower || 0,
      hasBlocker: actualData?.hasBlocker || false,
      hasTarget: !!targetData,
      hasActual: !!actualData,
    };
  });

  // Sort by line name naturally (Line 1, Line 2, Line 10, etc.)
  comparisonData.sort((a, b) => {
    const aMatch = a.line_name.match(/(\d+)/);
    const bMatch = b.line_name.match(/(\d+)/);
    if (aMatch && bMatch) {
      return parseInt(aMatch[1]) - parseInt(bMatch[1]);
    }
    return a.line_name.localeCompare(b.line_name);
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Target vs Actual Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allLines.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Target vs Actual Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No lines configured</p>
            <p className="text-sm">Add production lines to see comparison</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totals = comparisonData.reduce(
    (acc, row) => ({
      targetOutput: acc.targetOutput + (row.targetPerHour * 8), // Assuming 8-hour day
      actualOutput: acc.actualOutput + row.actualOutput,
      plannedManpower: acc.plannedManpower + row.plannedManpower,
      actualManpower: acc.actualManpower + row.actualManpower,
    }),
    { targetOutput: 0, actualOutput: 0, plannedManpower: 0, actualManpower: 0 }
  );

  const overallPerformance = calculatePerformance(totals.actualOutput, totals.targetOutput);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Target vs Actual Comparison
            <Badge variant="outline" className="ml-2 gap-1 capitalize">
              {type === 'sewing' ? <Factory className="h-3 w-3" /> : <Package className="h-3 w-3" />}
              {type}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Overall:</span>
            {totals.targetOutput > 0 ? (
              <PerformanceBadge percent={overallPerformance.percent} trend={overallPerformance.trend} />
            ) : (
              <Badge variant="secondary" className="text-xs">No targets</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-3 py-2 bg-card border-b rounded-lg sticky top-0 z-10">
            <div className="col-span-3">Line</div>
            <div className="col-span-2 text-right">Target/hr</div>
            <div className="col-span-2 text-right">Actual</div>
            <div className="col-span-2 text-right">Manpower</div>
            <div className="col-span-3 text-right">Performance</div>
          </div>

          {/* Data Rows */}
          {comparisonData.map((row) => {
            // Estimate expected output (target per hour * 8 hours)
            const expectedDayOutput = row.targetPerHour * 8;
            const performance = calculatePerformance(row.actualOutput, expectedDayOutput);

            return (
              <div
                key={row.line_uuid}
                className={`grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-lg border transition-colors ${
                  row.hasBlocker 
                    ? 'border-destructive/30 bg-destructive/5' 
                    : 'border-border/50 bg-muted/20 hover:bg-muted/40'
                }`}
              >
                {/* Line Info */}
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{row.line_name}</span>
                    {row.hasBlocker && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Blocker
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Target */}
                <div className="col-span-2 text-right">
                  {row.hasTarget ? (
                    <div>
                      <p className="font-mono font-medium">{row.targetPerHour}</p>
                      <p className="text-[10px] text-muted-foreground">~{expectedDayOutput}/day</p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No target</span>
                  )}
                </div>

                {/* Actual Output */}
                <div className="col-span-2 text-right">
                  {row.hasActual ? (
                    <p className="font-mono font-bold text-lg">{row.actualOutput.toLocaleString()}</p>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                </div>

                {/* Manpower */}
                <div className="col-span-2 text-right">
                  <div className="flex items-center justify-end gap-1 text-sm">
                    {row.hasActual ? (
                      <span className="font-mono">{row.actualManpower}</span>
                    ) : row.hasTarget ? (
                      <span className="text-muted-foreground">{row.plannedManpower}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                    {row.hasTarget && row.hasActual && row.plannedManpower > 0 && (
                      <span className="text-xs text-muted-foreground">
                        / {row.plannedManpower}
                      </span>
                    )}
                  </div>
                </div>

                {/* Performance */}
                <div className="col-span-3 text-right">
                  {row.hasTarget && row.hasActual ? (
                    <PerformanceBadge percent={performance.percent} trend={performance.trend} />
                  ) : !row.hasTarget && row.hasActual ? (
                    <Badge variant="outline" className="text-xs">No target set</Badge>
                  ) : row.hasTarget && !row.hasActual ? (
                    <Badge variant="secondary" className="text-xs">Awaiting EOD</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">No data</Badge>
                  )}
                </div>
              </div>
            );
          })}

          {/* Summary Row */}
          {(totals.targetOutput > 0 || totals.actualOutput > 0) && (
            <div className="grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-lg bg-primary/5 border border-primary/20 mt-2">
              <div className="col-span-3 font-medium">Total</div>
              <div className="col-span-2 text-right font-mono font-medium">
                {totals.targetOutput > 0 ? totals.targetOutput.toLocaleString() : '-'}
              </div>
              <div className="col-span-2 text-right font-mono font-bold text-lg">
                {totals.actualOutput > 0 ? totals.actualOutput.toLocaleString() : '-'}
              </div>
              <div className="col-span-2 text-right font-mono">
                {totals.actualManpower > 0 || totals.plannedManpower > 0 
                  ? `${totals.actualManpower} / ${totals.plannedManpower}`
                  : '-'}
              </div>
              <div className="col-span-3 text-right">
                {totals.targetOutput > 0 ? (
                  <PerformanceBadge percent={overallPerformance.percent} trend={overallPerformance.trend} />
                ) : (
                  <Badge variant="secondary" className="text-xs">-</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
