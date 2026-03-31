import { BuyerWorkOrder } from "@/hooks/useBuyerPOAccess";

export interface POAggregates {
  sewingOutput: number;
  cumulativeGood: number;
  rejectTotal: number;
  reworkTotal: number;
  finishingCarton: number;
  finishingPoly: number;
  finishingQcPass: number;
  cuttingTotal: number;
  cuttingInput: number;
  hasEodToday: boolean;
}

export type HealthStatus = "healthy" | "watch" | "at_risk" | "no_deadline" | "completed";

export function computeHealth(
  wo: BuyerWorkOrder,
  agg: POAggregates
): { status: HealthStatus; label: string } {
  const progressPct = wo.order_qty > 0 ? (agg.cumulativeGood / wo.order_qty) * 100 : 0;

  if (progressPct >= 100) return { status: "completed", label: "Completed" };

  if (!wo.planned_ex_factory) return { status: "no_deadline", label: "No deadline" };

  const deadline = new Date(wo.planned_ex_factory);
  const now = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { status: "at_risk", label: "Deadline passed" };
  if (daysLeft <= 7 && progressPct < 80) return { status: "at_risk", label: "At risk" };
  if (daysLeft <= 14 && progressPct < 60) return { status: "watch", label: "Watch" };
  if (!agg.hasEodToday) return { status: "watch", label: "No update today" };

  return { status: "healthy", label: "On track" };
}

export const healthColors: Record<HealthStatus, string> = {
  healthy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  watch: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  at_risk: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  no_deadline: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export const EMPTY_AGGREGATES: POAggregates = {
  sewingOutput: 0,
  cumulativeGood: 0,
  rejectTotal: 0,
  reworkTotal: 0,
  finishingCarton: 0,
  finishingPoly: 0,
  finishingQcPass: 0,
  cuttingTotal: 0,
  cuttingInput: 0,
  hasEodToday: false,
};
