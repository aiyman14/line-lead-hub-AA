export type TimeRange = "daily" | "7" | "14" | "21" | "30";

export type AnomalyFlag = "no-output" | "critically-low" | "unusually-high" | null;

/**
 * Describes what data has been submitted for a line in the selected period.
 * - "no-target"   : neither target nor EOD submitted
 * - "awaiting-eod": target submitted, EOD not yet submitted
 * - "eod-submitted": both target and EOD submitted — metrics are meaningful
 * - "output-only" : EOD submitted but no target — can show output, not variance/achievement
 */
export type DataState = "no-target" | "awaiting-eod" | "eod-submitted" | "output-only";

export interface POBreakdown {
  workOrderId: string;
  poNumber: string;
  buyer: string;
  style: string;
  item: string;
  isActive: boolean;
  target: number;
  output: number;
  achievementPct: number;
  avgDailyOutput: number;
  activeDays: number;
  targetContributionPct: number;
  outputContributionPct: number;
}

export interface LinePerformanceData {
  id: string;
  lineId: string;
  name: string | null;
  unitName: string | null;
  floorName: string | null;
  isActive: boolean;

  totalTarget: number;
  totalOutput: number;
  achievementPct: number;
  variance: number;
  avgManpower: number;
  totalOtHours: number;
  totalOtManpower: number;
  totalBlockers: number;
  avgDailyOutput: number;
  avgDailyOutputDays: number;

  targetSubmitted: boolean;
  eodSubmitted: boolean;
  dataState: DataState;
  anomaly: AnomalyFlag;

  poBreakdown: POBreakdown[];
}

export interface DailyTrendPoint {
  date: string;
  displayDate: string;
  target: number;
  output: number;
  achievementPct: number;
  manpower: number;
  blockers: number;
}

export interface LineTrendData {
  daily: DailyTrendPoint[];
  poDaily: Record<string, { poNumber: string; points: DailyTrendPoint[] }>;
}

export interface LineFilters {
  searchTerm: string;
  unitFilter: string | null;
  floorFilter: string | null;
}

export interface FactorySummary {
  totalTarget: number;
  totalOutput: number;
  overallAchievement: number;
  linesOnTarget: number;
  linesBelowTarget: number;
  bestLine: { name: string; pct: number } | null;
  worstLine: { name: string; pct: number } | null;
}
