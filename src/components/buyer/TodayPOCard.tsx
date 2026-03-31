import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/live-dot";
import { ChevronDown, ChevronRight, ChevronUp, Scissors, TrendingUp, PackageCheck, Warehouse } from "lucide-react";
import { computeHealth, healthColors, type HealthStatus, POAggregates } from "@/lib/buyer-health";
import { formatTimeInTimezone } from "@/lib/date-utils";
import { BuyerWorkOrder } from "@/hooks/useBuyerPOAccess";

interface DeptEntry {
  department: string;
  label: string;
  time: string | null;
}

interface TodayPOCardProps {
  wo: BuyerWorkOrder;
  aggregates: POAggregates;
  timeline: DeptEntry[];
  timezone: string;
  lastSubmittedAt?: string | null;
}

const healthAccent: Record<HealthStatus, string> = {
  healthy: "from-emerald-400 to-emerald-500",
  watch: "from-amber-400 to-amber-500",
  at_risk: "from-red-400 to-red-500",
  no_deadline: "from-slate-300 to-slate-400",
  completed: "from-blue-400 to-blue-500",
};

const DEPT_COLORS: Record<string, string> = {
  sewing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  cutting: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  finishing: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800",
  storage: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
};

const DEPT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sewing: TrendingUp,
  cutting: Scissors,
  finishing: PackageCheck,
  storage: Warehouse,
};

const DEPT_DOT_COLOR: Record<string, string> = {
  sewing: "bg-blue-500",
  cutting: "bg-emerald-500",
  finishing: "bg-violet-500",
  storage: "bg-orange-500",
};

export function TodayPOCard({ wo, aggregates, timeline, timezone, lastSubmittedAt }: TodayPOCardProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const health = computeHealth(wo, aggregates);
  const accent = healthAccent[health.status] || healthAccent.no_deadline;

  const hasStorageEntries = timeline.some(e => e.department === "storage");
  const storageSummary = hasStorageEntries ? { label: "Storage", value: `${timeline.filter(e => e.department === "storage").length} txn`, dept: "storage" } : null;
  const cuttingSummary = aggregates.cuttingTotal > 0 ? { label: "Cutting", value: aggregates.cuttingTotal.toLocaleString(), dept: "cutting" } : null;
  const sewingSummary = aggregates.sewingOutput > 0 ? { label: "Sewing", value: `${aggregates.sewingOutput.toLocaleString()} good`, dept: "sewing" } : null;
  const finishingSummary = aggregates.finishingCarton > 0 ? { label: "Finishing", value: `${aggregates.finishingCarton.toLocaleString()} packed`, dept: "finishing" } : null;

  const summaryParts = [storageSummary, cuttingSummary, sewingSummary, finishingSummary].filter(Boolean) as { label: string; value: string; dept: string }[];

  return (
    <Card
      className="overflow-hidden group hover:shadow-lg transition-all duration-300 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className={`h-1 bg-gradient-to-r ${accent}`} />
      <CardContent className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/buyer/po/${wo.id}`); }}
              className="text-base font-bold hover:underline text-primary decoration-primary/30 underline-offset-2"
            >
              {wo.po_number}
            </button>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${healthColors[health.status]}`}>
              {health.label}
            </Badge>
            <LiveDot lastUpdate={lastSubmittedAt ?? null} />
            <span className="text-sm text-muted-foreground truncate">
              {wo.style}{wo.color ? ` \u2014 ${wo.color}` : ""}
            </span>
          </div>
          <div className="h-8 w-8 flex items-center justify-center shrink-0 rounded-full text-muted-foreground group-hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Summary chips */}
        {summaryParts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {summaryParts.map((part) => {
              const Icon = DEPT_ICONS[part.dept];
              return (
                <div
                  key={part.dept}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${DEPT_COLORS[part.dept] || ""}`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  <span className="opacity-70">{part.label}:</span>
                  <span className="font-semibold">{part.value}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/20 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            No submissions today
          </div>
        )}

        {/* Expanded timeline */}
        {expanded && timeline.length > 0 && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {timeline.map((entry, i) => {
              const Icon = DEPT_ICONS[entry.department];
              const dotColor = DEPT_DOT_COLOR[entry.department] || "bg-gray-400";
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center mt-1">
                    <div className={`h-2.5 w-2.5 rounded-full ${dotColor} ring-2 ring-background`} />
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1 min-h-[16px]" />}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${DEPT_COLORS[entry.department] || ""}`}
                      >
                        {Icon && <Icon className="h-2.5 w-2.5 mr-1" />}
                        {entry.department}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.time ? formatTimeInTimezone(entry.time, timezone) : "\u2014"}
                      </span>
                    </div>
                    <div className="text-xs text-foreground/80">{entry.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {expanded && timeline.length === 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs text-muted-foreground text-center py-2">No detailed entries</div>
          </div>
        )}

        {/* View details button */}
        <div className="mt-3 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-sm font-medium"
            onClick={(e) => { e.stopPropagation(); navigate(`/buyer/po/${wo.id}`); }}
          >
            View details
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
