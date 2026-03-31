import { BuyerWorkOrder } from "@/hooks/useBuyerPOAccess";
import { POAggregates } from "@/lib/buyer-health";

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertType =
  | "no_update_today"
  | "qc_reject_high"
  | "packing_behind"
  | "ex_factory_at_risk"
  | "output_below_target";

export interface BuyerAlert {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  poId: string;
  poNumber: string;
}

interface AlertThresholds {
  qcRejectPct?: number;       // default 5
  packingBehindPct?: number;  // default 0.7 (finishing < sewing * this)
}

const DEFAULT_THRESHOLDS: Required<AlertThresholds> = {
  qcRejectPct: 5,
  packingBehindPct: 0.7,
};

interface HistoryEntry {
  production_date: string;
  good_today?: number;
}

export function computeBuyerAlerts(
  wo: BuyerWorkOrder,
  agg: POAggregates,
  sewingHistory?: HistoryEntry[],
  thresholds?: AlertThresholds
): BuyerAlert[] {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const alerts: BuyerAlert[] = [];

  // 1. No update today
  if (!agg.hasEodToday && wo.status !== "completed") {
    alerts.push({
      type: "no_update_today",
      severity: "warning",
      title: "No update today",
      message: `${wo.po_number} has no production submissions today.`,
      poId: wo.id,
      poNumber: wo.po_number,
    });
  }

  // 2. QC reject rate high
  const totalProduced = agg.cumulativeGood + agg.rejectTotal;
  if (totalProduced > 0) {
    const rejectPct = (agg.rejectTotal / totalProduced) * 100;
    if (rejectPct > t.qcRejectPct) {
      alerts.push({
        type: "qc_reject_high",
        severity: "critical",
        title: "High reject rate",
        message: `${wo.po_number} has a ${rejectPct.toFixed(1)}% reject rate (${agg.rejectTotal.toLocaleString()} rejects).`,
        poId: wo.id,
        poNumber: wo.po_number,
      });
    }
  }

  // 3. Packing behind sewing
  if (agg.cumulativeGood > 100 && agg.finishingCarton < agg.cumulativeGood * t.packingBehindPct) {
    const gap = agg.cumulativeGood - agg.finishingCarton;
    alerts.push({
      type: "packing_behind",
      severity: "warning",
      title: "Packing behind sewing",
      message: `${wo.po_number} has ${gap.toLocaleString()} units sewn but not yet packed.`,
      poId: wo.id,
      poNumber: wo.po_number,
    });
  }

  // 4. Ex-factory at risk
  if (wo.planned_ex_factory && wo.order_qty > 0 && agg.cumulativeGood < wo.order_qty) {
    const deadline = new Date(wo.planned_ex_factory);
    const now = new Date();
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining > 0 && sewingHistory && sewingHistory.length >= 3) {
      const recentDays = sewingHistory.slice(-7);
      const avgDailyOutput = recentDays.reduce((s, d) => s + (d.good_today || 0), 0) / recentDays.length;

      if (avgDailyOutput > 0) {
        const remaining = wo.order_qty - agg.cumulativeGood;
        const daysNeeded = Math.ceil(remaining / avgDailyOutput);

        if (daysNeeded > daysRemaining) {
          alerts.push({
            type: "ex_factory_at_risk",
            severity: "critical",
            title: "Ex-factory at risk",
            message: `${wo.po_number} needs ~${daysNeeded} days to complete but only ${daysRemaining} days remain.`,
            poId: wo.id,
            poNumber: wo.po_number,
          });
        }
      }
    } else if (daysRemaining < 0) {
      alerts.push({
        type: "ex_factory_at_risk",
        severity: "critical",
        title: "Deadline passed",
        message: `${wo.po_number} ex-factory date has passed with ${(wo.order_qty - agg.cumulativeGood).toLocaleString()} units remaining.`,
        poId: wo.id,
        poNumber: wo.po_number,
      });
    }
  }

  return alerts;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function sortAlerts(alerts: BuyerAlert[]): BuyerAlert[] {
  return [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
