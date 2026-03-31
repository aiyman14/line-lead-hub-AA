import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface Segment {
  value: number;
  color: string;
  label?: string;
}

interface StackedBarProps {
  segments: Segment[];
  height?: string;
  className?: string;
}

export function StackedBar({
  segments,
  height = "h-2",
  className,
}: StackedBarProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "flex w-full rounded-full overflow-hidden bg-muted/50",
          height,
          className
        )}
      >
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          if (pct === 0) return null;
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className={cn(seg.color, "transition-all duration-500")}
                  style={{ width: `${pct}%` }}
                />
              </TooltipTrigger>
              {seg.label && (
                <TooltipContent side="top" className="text-xs">
                  {seg.label}: {seg.value.toLocaleString()} (
                  {pct.toFixed(1)}%)
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
