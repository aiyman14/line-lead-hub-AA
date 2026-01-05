import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, TrendingUp, Factory, Package } from "lucide-react";

interface TargetData {
  line_id: string;
  line_name: string;
  po_number: string | null;
  per_hour_target: number;
  manpower_planned?: number | null;
  m_power_planned?: number | null;
}

interface ActualData {
  line_id: string;
  line_name: string;
  po_number: string | null;
  output: number;
  manpower?: number | null;
  m_power?: number | null;
  has_blocker: boolean;
}

interface TargetVsActualComparisonProps {
  targets: TargetData[];
  actuals: ActualData[];
  type: 'sewing' | 'finishing';
  loading?: boolean;
}

interface ComparisonRow {
  line_id: string;
  line_name: string;
  po_number: string | null;
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

export function TargetVsActualComparison({ targets, actuals, type, loading }: TargetVsActualComparisonProps) {
  // Merge targets and actuals by line_id
  const comparisonData: ComparisonRow[] = [];
  const processedLines = new Set<string>();

  // First add all lines with targets
  targets.forEach(target => {
    const actual = actuals.find(a => a.line_id === target.line_id);
    processedLines.add(target.line_id);
    
    comparisonData.push({
      line_id: target.line_id,
      line_name: target.line_name,
      po_number: target.po_number,
      targetPerHour: target.per_hour_target,
      plannedManpower: target.manpower_planned || target.m_power_planned || 0,
      actualOutput: actual?.output || 0,
      actualManpower: actual?.manpower || actual?.m_power || 0,
      hasBlocker: actual?.has_blocker || false,
      hasTarget: true,
      hasActual: !!actual,
    });
  });

  // Then add lines with actuals but no targets
  actuals.forEach(actual => {
    if (!processedLines.has(actual.line_id)) {
      comparisonData.push({
        line_id: actual.line_id,
        line_name: actual.line_name,
        po_number: actual.po_number,
        targetPerHour: 0,
        plannedManpower: 0,
        actualOutput: actual.output,
        actualManpower: actual.manpower || actual.m_power || 0,
        hasBlocker: actual.has_blocker,
        hasTarget: false,
        hasActual: true,
      });
    }
  });

  // Sort by line name
  comparisonData.sort((a, b) => a.line_name.localeCompare(b.line_name));

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

  if (comparisonData.length === 0) {
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
            <p>No data to compare</p>
            <p className="text-sm">Submit morning targets and end of day reports to see comparison</p>
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
            <PerformanceBadge percent={overallPerformance.percent} trend={overallPerformance.trend} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-3 py-2 bg-muted/30 rounded-lg sticky top-0">
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
                key={row.line_id}
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
                  <p className="text-xs text-muted-foreground truncate">
                    {row.po_number || 'No PO'}
                  </p>
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
                    ) : (
                      <span className="text-muted-foreground">{row.plannedManpower || '-'}</span>
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
                  ) : (
                    <Badge variant="secondary" className="text-xs">Awaiting EOD</Badge>
                  )}
                </div>
              </div>
            );
          })}

          {/* Summary Row */}
          <div className="grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-lg bg-primary/5 border border-primary/20 mt-2">
            <div className="col-span-3 font-medium">Total</div>
            <div className="col-span-2 text-right font-mono font-medium">
              {totals.targetOutput.toLocaleString()}
            </div>
            <div className="col-span-2 text-right font-mono font-bold text-lg">
              {totals.actualOutput.toLocaleString()}
            </div>
            <div className="col-span-2 text-right font-mono">
              {totals.actualManpower} / {totals.plannedManpower}
            </div>
            <div className="col-span-3 text-right">
              <PerformanceBadge percent={overallPerformance.percent} trend={overallPerformance.trend} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
