import { Card } from "@/components/ui/card";
import { LineCardItem } from "./LineCardItem";
import type { LinePerformanceData, TimeRange } from "./types";

interface LinePerformanceCardsProps {
  lines: LinePerformanceData[];
  loading: boolean;
  timeRange: TimeRange;
  onLineClick: (lineId: string) => void;
}

function CardSkeleton() {
  return (
    <Card>
      <div className="py-4 px-5 space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-5 w-28 bg-muted rounded" />
            <div className="h-4 w-20 bg-muted rounded hidden sm:block" />
          </div>
          <div className="h-5 w-16 bg-muted rounded-full" />
        </div>
        <div className="flex gap-8">
          <div className="space-y-1">
            <div className="h-3 w-10 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
          <div className="space-y-1">
            <div className="h-3 w-10 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded" />
          </div>
          <div className="space-y-1">
            <div className="h-3 w-16 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        </div>
        <div className="h-2.5 w-full bg-muted rounded-full" />
        <div className="h-4 w-40 bg-muted rounded" />
      </div>
    </Card>
  );
}

export function LinePerformanceCards({ lines, loading, timeRange, onLineClick }: LinePerformanceCardsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <Card>
        <div className="text-center py-16 text-sm text-muted-foreground">
          No lines found. Try adjusting your search or filters.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {lines.map((line) => (
        <LineCardItem
          key={line.id}
          line={line}
          timeRange={timeRange}
          onClick={() => onLineClick(line.id)}
        />
      ))}
    </div>
  );
}
