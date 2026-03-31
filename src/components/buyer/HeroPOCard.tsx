import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { LiveDot } from "@/components/ui/live-dot";
import { Sparkline } from "@/components/ui/sparkline";
import { healthColors, type HealthStatus, type POAggregates } from "@/lib/buyer-health";
import { formatTimeInTimezone } from "@/lib/date-utils";
import { formatDistanceToNow } from "date-fns";
import { BuyerWorkOrder } from "@/hooks/useBuyerPOAccess";
import {
  Clock,
  TrendingUp,
  PackageCheck,
  Scissors,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface HeroPOCardProps {
  wo: BuyerWorkOrder;
  agg: POAggregates;
  health: { status: HealthStatus; label: string };
  lastSubmittedAt: string | null;
  dailySewingData: number[];
  dailyFinishingData: number[];
  timezone: string;
  onClick: () => void;
}

export function HeroPOCard({
  wo,
  agg,
  health,
  lastSubmittedAt,
  dailySewingData,
  dailyFinishingData,
  timezone,
  onClick,
}: HeroPOCardProps) {
  const sewPct =
    wo.order_qty > 0
      ? Math.min(100, Math.round((agg.cumulativeGood / wo.order_qty) * 100))
      : 0;
  const packPct =
    wo.order_qty > 0
      ? Math.min(100, Math.round((agg.finishingCarton / wo.order_qty) * 100))
      : 0;
  const sewBalance = Math.max(0, wo.order_qty - agg.cumulativeGood);
  const packBalance = Math.max(0, wo.order_qty - agg.finishingCarton);

  const timeStr = lastSubmittedAt
    ? `${formatTimeInTimezone(lastSubmittedAt, timezone)} · ${formatDistanceToNow(new Date(lastSubmittedAt), { addSuffix: true })}`
    : "No updates yet";

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-300 border-primary/20"
      onClick={onClick}
    >
      <CardContent className="p-5 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-xl font-bold">{wo.po_number}</h2>
              <Badge
                variant="outline"
                className={healthColors[health.status]}
              >
                {health.label}
              </Badge>
              {wo.status && (
                <Badge variant="secondary" className="text-xs">
                  {wo.status.replace("_", " ")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {wo.style}
              {wo.color && ` — ${wo.color}`}
              {wo.item && ` — ${wo.item}`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LiveDot lastUpdate={lastSubmittedAt} />
            <Clock className="h-3.5 w-3.5" />
            <span>{timeStr}</span>
          </div>
        </div>

        {/* Progress section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {/* Sewing progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Sewn
              </span>
              <span className="text-muted-foreground font-medium">{sewPct}%</span>
            </div>
            <Progress value={sewPct} className="h-2.5 mb-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <AnimatedNumber value={agg.cumulativeGood} /> / {wo.order_qty.toLocaleString()}
              </span>
              <div className="flex items-center gap-3">
                <span>Balance: {sewBalance.toLocaleString()}</span>
                {dailySewingData.length >= 3 && (
                  <Sparkline
                    data={dailySewingData}
                    width={80}
                    height={24}
                    color="hsl(var(--primary))"
                    className="hidden sm:inline-flex"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Packing progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="font-medium flex items-center gap-1.5">
                <PackageCheck className="h-4 w-4 text-emerald-500" />
                Packed
              </span>
              <span className="text-muted-foreground font-medium">{packPct}%</span>
            </div>
            <Progress value={packPct} className="h-2.5 mb-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                <AnimatedNumber value={agg.finishingCarton} /> / {wo.order_qty.toLocaleString()}
              </span>
              <div className="flex items-center gap-3">
                <span>Balance: {packBalance.toLocaleString()}</span>
                {dailyFinishingData.length >= 3 && (
                  <Sparkline
                    data={dailyFinishingData}
                    width={80}
                    height={24}
                    color="#10b981"
                    className="hidden sm:inline-flex"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="flex items-center gap-4 pt-4 border-t text-sm flex-wrap">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Scissors className="h-3.5 w-3.5" />
            <span>Cut:</span>
            <span className="font-medium text-foreground">
              {agg.cuttingTotal.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {agg.rejectTotal > 0 ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Reject:</span>
                <span className="font-medium text-amber-600">
                  {agg.rejectTotal.toLocaleString()}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-medium text-emerald-600">No rejects</span>
              </>
            )}
          </div>
          {agg.reworkTotal > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span>Rework:</span>
              <span className="font-medium text-foreground">
                {agg.reworkTotal.toLocaleString()}
              </span>
            </div>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            Order: {wo.order_qty.toLocaleString()} pcs
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
