import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Package, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";

export interface OutputExtrasData {
  poQty: number;
  totalOutput: number; // Total Carton from finishing
  extras: number; // max(totalOutput - poQty, 0) - auto calculated
  extrasConsumed: number; // Sum of ledger transactions
  remaining: number; // max(poQty - totalOutput, 0)
}

export type ProductionStatus = 'underproduced' | 'on_target' | 'overproduced';

interface OutputExtrasCardProps {
  data: OutputExtrasData;
  poNumber?: string;
  onViewLedger?: () => void;
  compact?: boolean;
}

export function getProductionStatus(data: OutputExtrasData): ProductionStatus {
  if (data.extras > 0) return 'overproduced';
  if (data.remaining > 0 && data.totalOutput > 0) return 'on_target'; // In progress
  if (data.remaining === 0 && data.totalOutput >= data.poQty) return 'on_target';
  return 'underproduced';
}

export function getStatusBadge(status: ProductionStatus) {
  switch (status) {
    case 'overproduced':
      return { label: 'Completed', variant: 'success' as const, icon: Minus };
    case 'on_target':
      return { label: 'On Target', variant: 'success' as const, icon: Minus };
    case 'underproduced':
      return { label: 'In Progress', variant: 'secondary' as const, icon: TrendingDown };
  }
}

export function OutputExtrasCard({ data, poNumber, onViewLedger, compact = false }: OutputExtrasCardProps) {
  const status = getProductionStatus(data);
  const statusInfo = getStatusBadge(status);
  const StatusIcon = statusInfo.icon;
  
  const extrasAvailable = data.extras - data.extrasConsumed;
  const progressPercent = data.poQty > 0 ? Math.min((data.totalOutput / data.poQty) * 100, 100) : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-lg font-bold">{data.totalOutput.toLocaleString()}</span>
            <span className="text-muted-foreground text-sm">/ {data.poQty.toLocaleString()}</span>
            <Badge variant={statusInfo.variant} className="ml-auto">
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
          {extrasAvailable > 0 && (
            <p className="text-xs text-warning mt-1">
              {extrasAvailable.toLocaleString()} extras available
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Output & Extras
          </span>
          <Badge variant={statusInfo.variant}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </CardTitle>
        {poNumber && (
          <p className="text-sm text-muted-foreground font-mono">{poNumber}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Production Progress</span>
            <span className="font-mono">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">PO Qty</p>
            <p className="text-xl font-bold font-mono">{data.poQty.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Output</p>
            <p className="text-xl font-bold font-mono text-primary">{data.totalOutput.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-warning/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Extras (Auto)</p>
            <p className="text-xl font-bold font-mono text-warning">{data.extras.toLocaleString()}</p>
            {data.extrasConsumed > 0 && (
              <p className="text-xs text-muted-foreground">
                Available: {extrasAvailable.toLocaleString()}
              </p>
            )}
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-xl font-bold font-mono">{data.remaining.toLocaleString()}</p>
          </div>
        </div>

        {/* Ledger button */}
        {onViewLedger && (
          <Button variant="outline" className="w-full" onClick={onViewLedger}>
            <FileText className="h-4 w-4 mr-2" />
            View Extras Ledger
            {data.extrasConsumed > 0 && (
              <Badge variant="secondary" className="ml-2">
                {data.extrasConsumed.toLocaleString()} consumed
              </Badge>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to calculate output/extras data from raw values
export function calculateOutputExtras(
  poQty: number,
  totalCartonOutput: number,
  totalLedgerConsumed: number
): OutputExtrasData {
  const extras = Math.max(totalCartonOutput - poQty, 0);
  const remaining = Math.max(poQty - totalCartonOutput, 0);
  
  return {
    poQty,
    totalOutput: totalCartonOutput,
    extras,
    extrasConsumed: totalLedgerConsumed,
    remaining,
  };
}
