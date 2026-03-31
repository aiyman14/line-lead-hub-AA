import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { HealthReason, HealthStatus } from "./types";

const CONFIG: Record<HealthStatus, { label: string; className: string; icon?: boolean }> = {
  healthy:         { label: "Healthy",  className: "bg-success/10 text-success border-success/20" },
  watch:           { label: "Watch",    className: "bg-warning/10 text-warning border-warning/20" },
  at_risk:         { label: "At Risk",  className: "bg-destructive/10 text-destructive border-destructive/20", icon: true },
  deadline_passed: { label: "Overdue",  className: "bg-destructive/10 text-destructive border-destructive/20", icon: true },
  no_deadline:     { label: "No date",  className: "bg-muted text-muted-foreground border-transparent" },
  completed:       { label: "Complete", className: "bg-success/10 text-success border-success/20" },
};

interface Props {
  health: HealthReason;
}

export function HealthBadge({ health }: Props) {
  const cfg = CONFIG[health.status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5 max-w-[100px] overflow-hidden text-ellipsis",
              cfg.className,
            )}
          >
            {cfg.icon && <AlertTriangle className="h-3 w-3 shrink-0" />}
            {cfg.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          <ul className="text-xs space-y-0.5">
            {health.reasons.map((r, i) => (
              <li key={i}>{health.reasons.length > 1 ? `• ${r}` : r}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
