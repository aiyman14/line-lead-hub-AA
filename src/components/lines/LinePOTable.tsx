import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Target,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import type { POBreakdown, TimeRange } from "./types";
import type { PODateEntry } from "./useLineSubmissions";

interface LinePOTableProps {
  poBreakdown: POBreakdown[];
  lineTotal: { target: number; output: number };
  lineAvgDailyOutput: number;
  timeRange: TimeRange;
  submissionsLoading: boolean;
  getDateEntries: (workOrderId: string) => PODateEntry[];
  onPOClick: (workOrderId: string, date?: string) => void;
}

const DEFAULT_VISIBLE = 5;

function ContributionBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[60px]">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right shrink-0">
        {pct}%
      </span>
    </div>
  );
}

/** Expanded per-date rows for multi-day mode */
function DateEntryList({
  entries,
  workOrderId,
  onDateClick,
}: {
  entries: PODateEntry[];
  workOrderId: string;
  onDateClick: (workOrderId: string, date: string) => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={8} className="p-0">
        <div className="ml-6 mr-4 border-l-2 border-muted pl-4 py-2 space-y-1">
          {entries.map((entry) => (
            <button
              key={entry.date}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 transition-colors cursor-pointer text-left group"
              onClick={() => onDateClick(workOrderId, entry.date)}
            >
              <span className="text-sm font-medium min-w-[56px]">{entry.displayDate}</span>

              <div className="flex items-center gap-1.5">
                {entry.hasTarget && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/30">
                    <Target className="h-2.5 w-2.5 mr-0.5" />
                    Target
                  </Badge>
                )}
                {entry.hasActual && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30">
                    <ClipboardCheck className="h-2.5 w-2.5 mr-0.5" />
                    EOD
                  </Badge>
                )}
              </div>

              {(entry.target > 0 || entry.output > 0) && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                  {entry.target > 0 && (
                    <span>Target: <strong className="text-blue-600 dark:text-blue-400 font-mono">{entry.target.toLocaleString()}</strong></span>
                  )}
                  {entry.output > 0 && (
                    <span>Output: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{entry.output.toLocaleString()}</strong></span>
                  )}
                </div>
              )}

              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
            </button>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function LinePOTable({
  poBreakdown,
  lineTotal,
  lineAvgDailyOutput,
  timeRange,
  submissionsLoading,
  getDateEntries,
  onPOClick,
}: LinePOTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);

  const isDaily = timeRange === "daily";

  if (poBreakdown.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No PO activity for this period
      </div>
    );
  }

  const visible = showAll ? poBreakdown : poBreakdown.slice(0, DEFAULT_VISIBLE);
  const hasMore = poBreakdown.length > DEFAULT_VISIBLE;

  function handleRowClick(po: POBreakdown) {
    if (submissionsLoading) return;

    if (isDaily) {
      // Daily mode: open submission modal directly
      onPOClick(po.workOrderId);
    } else {
      // Multi-day mode: toggle expand/collapse
      setExpandedPO((prev) => (prev === po.workOrderId ? null : po.workOrderId));
    }
  }

  return (
    <div>
      {submissionsLoading && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground border-b">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading submissions...
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {!isDaily && <TableHead className="w-[32px]" />}
              <TableHead>PO Number</TableHead>
              <TableHead className="hidden sm:table-cell">Buyer / Style</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Output</TableHead>
              <TableHead className="text-right">Achievement</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Avg/Day</TableHead>
              <TableHead className="w-[140px]">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((po) => {
              const isExpanded = expandedPO === po.workOrderId;
              const entries = isExpanded ? getDateEntries(po.workOrderId) : [];

              return (
                <PORow
                  key={po.workOrderId}
                  po={po}
                  isDaily={isDaily}
                  isExpanded={isExpanded}
                  entries={entries}
                  onRowClick={() => handleRowClick(po)}
                  onDateClick={onPOClick}
                />
              );
            })}

            {/* Totals row */}
            <TableRow className="bg-muted/30 font-semibold">
              {!isDaily && <TableCell />}
              <TableCell>Total</TableCell>
              <TableCell className="hidden sm:table-cell" />
              <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400">
                {lineTotal.target > 0 ? lineTotal.target.toLocaleString() : "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                {lineTotal.output > 0 ? lineTotal.output.toLocaleString() : "—"}
              </TableCell>
              <TableCell className={cn(
                "text-right font-mono font-bold",
                lineTotal.target > 0
                  ? Math.round((lineTotal.output / lineTotal.target) * 100) >= 90
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              )}>
                {lineTotal.target > 0
                  ? `${Math.round((lineTotal.output / lineTotal.target) * 100)}%`
                  : "—"
                }
              </TableCell>
              <TableCell className="text-right font-mono text-foreground hidden sm:table-cell">
                {lineAvgDailyOutput > 0 ? lineAvgDailyOutput.toLocaleString() : "—"}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Show all toggle */}
      {hasMore && (
        <div className="px-4 py-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="text-xs gap-1"
          >
            {showAll ? (
              <>Show less <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>+{poBreakdown.length - DEFAULT_VISIBLE} more POs <ChevronDown className="h-3 w-3" /></>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Individual PO row + optional expanded date entries */
function PORow({
  po,
  isDaily,
  isExpanded,
  entries,
  onRowClick,
  onDateClick,
}: {
  po: POBreakdown;
  isDaily: boolean;
  isExpanded: boolean;
  entries: PODateEntry[];
  onRowClick: () => void;
  onDateClick: (workOrderId: string, date: string) => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onRowClick}
      >
        {/* Expand chevron for multi-day */}
        {!isDaily && (
          <TableCell className="w-[32px] pr-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </TableCell>
        )}

        <TableCell className="font-mono font-medium">
          {po.poNumber}
        </TableCell>
        <TableCell className="hidden sm:table-cell text-muted-foreground">
          {[po.buyer, po.style].filter(Boolean).join(" · ") || "—"}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
          {po.target > 0 ? po.target.toLocaleString() : "—"}
        </TableCell>
        <TableCell className="text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          {po.output > 0 ? po.output.toLocaleString() : "—"}
        </TableCell>
        <TableCell className={cn(
          "text-right font-mono font-bold",
          po.target > 0
            ? po.achievementPct >= 90
              ? "text-emerald-600 dark:text-emerald-400"
              : po.achievementPct >= 70
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400"
            : "text-muted-foreground"
        )}>
          {po.target > 0 ? `${po.achievementPct}%` : "—"}
        </TableCell>
        <TableCell className="text-right font-mono text-muted-foreground hidden sm:table-cell">
          {po.avgDailyOutput > 0 ? po.avgDailyOutput.toLocaleString() : "—"}
        </TableCell>
        <TableCell>
          <ContributionBar
            pct={po.outputContributionPct}
            color="bg-emerald-500/70"
          />
        </TableCell>
      </TableRow>

      {/* Expanded date list for multi-day mode */}
      {!isDaily && isExpanded && entries.length > 0 && (
        <DateEntryList
          entries={entries}
          workOrderId={po.workOrderId}
          onDateClick={onDateClick}
        />
      )}
    </>
  );
}
