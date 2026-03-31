import { differenceInDays, addDays, format } from "date-fns";

// ── Workflow state ────────────────────────────────────────────────────────────

export type POWorkflowState = "not_started" | "planned" | "running" | "completed";

export type POCluster =
  | "due_soon"
  | "behind_plan"
  | "on_track"
  | "missing_updates"
  | "no_deadline";

export type POWorkflowTab =
  | "running"
  | "not_started"
  | "at_risk"
  | "completed";

/**
 * Derive the lifecycle state of a PO.
 *
 * Priority (highest wins):
 *   1. remaining <= 0  → completed
 *   2. hasAnyActual    → running  (first sewing EOD output = "started")
 *   3. hasLine || hasTarget → planned
 *   4. else            → not_started
 */
export function computeWorkflowState(params: {
  hasAnyActual: boolean;
  hasTarget: boolean;
  hasLine: boolean;
  remaining: number;
}): POWorkflowState {
  const { hasAnyActual, hasTarget, hasLine, remaining } = params;
  if (remaining <= 0) return "completed";
  if (hasAnyActual) return "running";
  if (hasLine || hasTarget) return "planned";
  return "not_started";
}

// ── Velocity calculations ─────────────────────────────────────────────────────

export interface AvgPerDayResult {
  avg3d: number;
  avg7d: number;
  /** 3-day avg if any data exists in last 3 days, otherwise 7-day avg */
  effective: number;
}

/**
 * Compute rolling average daily sewing output.
 * @param actuals  All sewing_actuals rows for this PO (needs good_today + production_date)
 * @param today    YYYY-MM-DD factory today
 */
export function computeAvgPerDay(
  actuals: { good_today: number; production_date: string }[],
  today: string
): AvgPerDayResult {
  let sum3 = 0;
  let count3 = 0;
  let sum7 = 0;
  let count7 = 0;

  for (const a of actuals) {
    const daysAgo = differenceInDays(new Date(today), new Date(a.production_date));
    if (daysAgo >= 0 && daysAgo < 7) {
      sum7 += a.good_today;
      count7++;
      if (daysAgo < 3) {
        sum3 += a.good_today;
        count3++;
      }
    }
  }

  const avg3d = sum3 / 3; // divide by window, not count (includes zero days)
  const avg7d = sum7 / 7;
  const effective = count3 > 0 ? avg3d : avg7d;

  return { avg3d, avg7d, effective };
}

/**
 * How many units need to be produced per day to meet ex-factory date.
 * Falls back to remaining / 7 if no ex-factory date set.
 */
export function computeNeededPerDay(
  remaining: number,
  exFactory: string | null,
  today: string
): number {
  if (remaining <= 0) return 0;
  if (!exFactory) return remaining / 7;

  const daysLeft = differenceInDays(new Date(exFactory), new Date(today));
  return remaining / Math.max(1, daysLeft);
}

/**
 * Estimate completion date based on current pace.
 * Returns null if avgPerDay is 0 (no pace data).
 */
export function computeForecastFinish(
  remaining: number,
  avgPerDay: number,
  today: string
): string | null {
  if (avgPerDay <= 0 || remaining <= 0) return null;
  const daysNeeded = Math.ceil(remaining / avgPerDay);
  return format(addDays(new Date(today), daysNeeded), "yyyy-MM-dd");
}

// ── Cluster ───────────────────────────────────────────────────────────────────

/**
 * Assign a running PO to a display cluster.
 *
 * Priority (highest wins):
 *   1. no_deadline    — no exFactory set
 *   2. due_soon       — daysToEx ≤ 7 AND remaining > 0
 *   3. behind_plan    — forecastFinish > exFactory OR neededPerDay > avgPerDay (when avgPerDay > 0)
 *   4. missing_updates — no EOD submitted today
 *   5. on_track       — everything else
 */
export function computeCluster(params: {
  exFactory: string | null;
  remaining: number;
  neededPerDay: number;
  avgPerDay: number;
  forecastFinish: string | null;
  hasEodToday: boolean;
  today: string;
}): POCluster {
  const {
    exFactory,
    remaining,
    neededPerDay,
    avgPerDay,
    forecastFinish,
    hasEodToday,
    today,
  } = params;

  if (!exFactory) return "no_deadline";

  const daysToEx = differenceInDays(new Date(exFactory), new Date(today));

  if (remaining > 0 && daysToEx <= 7) return "due_soon";

  const forecastBehind =
    forecastFinish != null && forecastFinish > exFactory;
  const paceBehind = avgPerDay > 0 && neededPerDay > avgPerDay;

  if (forecastBehind || paceBehind) return "behind_plan";

  if (!hasEodToday) return "missing_updates";

  return "on_track";
}
