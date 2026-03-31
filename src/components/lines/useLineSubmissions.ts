import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { SewingTargetData, SewingActualData } from "@/components/SewingSubmissionView";

interface RawTarget {
  id: string;
  line_id: string;
  work_order_id: string;
  production_date: string;
  per_hour_target: number;
  manpower_planned: number | null;
  hours_planned: number | null;
  target_total_planned: number | null;
  ot_hours_planned: number | null;
  planned_stage_progress: number | null;
  next_milestone: string | null;
  estimated_ex_factory: string | null;
  remarks: string | null;
  submitted_at: string | null;
  stages: { name: string } | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

interface RawActual {
  id: string;
  line_id: string;
  work_order_id: string;
  production_date: string;
  good_today: number;
  reject_today: number;
  rework_today: number;
  cumulative_good_total: number;
  manpower_actual: number;
  hours_actual: number | null;
  actual_per_hour: number | null;
  ot_hours_actual: number;
  ot_manpower_actual: number | null;
  actual_stage_progress: number | null;
  remarks: string | null;
  submitted_at: string | null;
  has_blocker: boolean | null;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  stages: { name: string } | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

/** A single date entry for a PO — what the user sees in multi-day expanded view */
export interface PODateEntry {
  date: string;
  displayDate: string;
  hasTarget: boolean;
  hasActual: boolean;
  target: number;
  output: number;
  /** key into rawTargets/rawActuals to build modal data */
  targetId: string | null;
  actualId: string | null;
}

function buildTargetData(t: RawTarget): SewingTargetData {
  return {
    id: t.id,
    production_date: t.production_date,
    line_name: t.lines?.name || t.lines?.line_id || "Unknown",
    po_number: t.work_orders?.po_number || null,
    buyer: t.work_orders?.buyer || null,
    style: t.work_orders?.style || null,
    order_qty: t.work_orders?.order_qty ?? null,
    submitted_at: t.submitted_at,
    per_hour_target: t.per_hour_target,
    manpower_planned: t.manpower_planned,
    hours_planned: t.hours_planned,
    target_total_planned: t.target_total_planned,
    ot_hours_planned: t.ot_hours_planned,
    stage_name: t.stages?.name || null,
    planned_stage_progress: t.planned_stage_progress,
    next_milestone: t.next_milestone,
    estimated_ex_factory: t.estimated_ex_factory,
    remarks: t.remarks,
  };
}

function buildActualData(a: RawActual): SewingActualData {
  return {
    id: a.id,
    production_date: a.production_date,
    line_name: a.lines?.name || a.lines?.line_id || "Unknown",
    po_number: a.work_orders?.po_number || null,
    buyer: a.work_orders?.buyer || null,
    style: a.work_orders?.style || null,
    order_qty: a.work_orders?.order_qty ?? null,
    submitted_at: a.submitted_at,
    good_today: a.good_today,
    reject_today: a.reject_today,
    rework_today: a.rework_today,
    cumulative_good_total: a.cumulative_good_total,
    manpower_actual: a.manpower_actual,
    hours_actual: a.hours_actual,
    actual_per_hour: a.actual_per_hour,
    ot_hours_actual: a.ot_hours_actual,
    ot_manpower_actual: a.ot_manpower_actual,
    stage_name: a.stages?.name || null,
    actual_stage_progress: a.actual_stage_progress,
    remarks: a.remarks,
    has_blocker: a.has_blocker,
    blocker_description: a.blocker_description,
    blocker_impact: a.blocker_impact,
    blocker_owner: a.blocker_owner,
    blocker_status: null,
    estimated_cost_value: null,
    estimated_cost_currency: null,
  };
}

/**
 * Fetches detailed submission records (sewing_targets + sewing_actuals)
 * for a specific line within a date range.
 * Returns helpers to look up data for the SewingSubmissionView modal.
 */
export function useLineSubmissions(
  lineId: string | null,
  dateRange: { start: string; end: string }
) {
  const { profile } = useAuth();
  const factoryId = profile?.factory_id;

  const [loading, setLoading] = useState(false);
  const [rawTargets, setRawTargets] = useState<RawTarget[]>([]);
  const [rawActuals, setRawActuals] = useState<RawActual[]>([]);

  const fetchSubmissions = useCallback(async () => {
    if (!lineId || !factoryId) {
      setRawTargets([]);
      setRawActuals([]);
      return;
    }

    setLoading(true);
    try {
      const isDaily = dateRange.start === dateRange.end;

      let targetsQuery = supabase
        .from("sewing_targets")
        .select(
          "id, line_id, work_order_id, production_date, per_hour_target, manpower_planned, hours_planned, target_total_planned, ot_hours_planned, planned_stage_progress, next_milestone, estimated_ex_factory, remarks, submitted_at, stages:planned_stage_id(name), lines(line_id, name), work_orders(po_number, buyer, style, order_qty)"
        )
        .eq("factory_id", factoryId)
        .eq("line_id", lineId);

      let actualsQuery = supabase
        .from("sewing_actuals")
        .select(
          "id, line_id, work_order_id, production_date, good_today, reject_today, rework_today, cumulative_good_total, manpower_actual, hours_actual, actual_per_hour, ot_hours_actual, ot_manpower_actual, actual_stage_progress, remarks, submitted_at, has_blocker, blocker_description, blocker_impact, blocker_owner, stages:actual_stage_id(name), lines(line_id, name), work_orders(po_number, buyer, style, order_qty)"
        )
        .eq("factory_id", factoryId)
        .eq("line_id", lineId);

      if (isDaily) {
        targetsQuery = targetsQuery.eq("production_date", dateRange.start);
        actualsQuery = actualsQuery.eq("production_date", dateRange.start);
      } else {
        targetsQuery = targetsQuery
          .gte("production_date", dateRange.start)
          .lte("production_date", dateRange.end)
          .limit(2000);
        actualsQuery = actualsQuery
          .gte("production_date", dateRange.start)
          .lte("production_date", dateRange.end)
          .limit(2000);
      }

      const [targetsRes, actualsRes] = await Promise.all([targetsQuery, actualsQuery]);

      setRawTargets((targetsRes.data as RawTarget[]) || []);
      setRawActuals((actualsRes.data as RawActual[]) || []);
    } catch (error) {
      console.error("Error fetching line submissions:", error);
    } finally {
      setLoading(false);
    }
  }, [lineId, factoryId, dateRange.start, dateRange.end]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Index targets/actuals by work_order_id + production_date
  const targetIndex = useMemo(() => {
    const map = new Map<string, RawTarget>();
    rawTargets.forEach((t) => {
      map.set(`${t.work_order_id}|${t.production_date}`, t);
    });
    return map;
  }, [rawTargets]);

  const actualIndex = useMemo(() => {
    const map = new Map<string, RawActual>();
    rawActuals.forEach((a) => {
      map.set(`${a.work_order_id}|${a.production_date}`, a);
    });
    return map;
  }, [rawActuals]);

  // Build per-date entries for a given work_order_id (for multi-day mode)
  const getDateEntries = useCallback(
    (workOrderId: string): PODateEntry[] => {
      const dates = new Set<string>();
      rawTargets
        .filter((t) => t.work_order_id === workOrderId)
        .forEach((t) => dates.add(t.production_date));
      rawActuals
        .filter((a) => a.work_order_id === workOrderId)
        .forEach((a) => dates.add(a.production_date));

      return Array.from(dates)
        .sort((a, b) => b.localeCompare(a)) // newest first
        .map((date) => {
          const tKey = `${workOrderId}|${date}`;
          const t = targetIndex.get(tKey);
          const a = actualIndex.get(tKey);
          const target = t
            ? (t.target_total_planned ?? Math.round(t.per_hour_target * (t.hours_planned ?? 8)))
            : 0;
          const output = a?.good_today ?? 0;

          return {
            date,
            displayDate: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            hasTarget: !!t,
            hasActual: !!a,
            target,
            output,
            targetId: t?.id ?? null,
            actualId: a?.id ?? null,
          };
        });
    },
    [rawTargets, rawActuals, targetIndex, actualIndex]
  );

  // Get modal data for a specific work_order_id + production_date
  const getSubmissionData = useCallback(
    (
      workOrderId: string,
      date: string
    ): { target: SewingTargetData | null; actual: SewingActualData | null } => {
      const key = `${workOrderId}|${date}`;
      const t = targetIndex.get(key);
      const a = actualIndex.get(key);
      return {
        target: t ? buildTargetData(t) : null,
        actual: a ? buildActualData(a) : null,
      };
    },
    [targetIndex, actualIndex]
  );

  // Daily shortcut: get modal data for a given work_order_id on the single date
  const getDailySubmission = useCallback(
    (workOrderId: string) => getSubmissionData(workOrderId, dateRange.start),
    [getSubmissionData, dateRange.start]
  );

  return {
    loading,
    getDateEntries,
    getSubmissionData,
    getDailySubmission,
    refetch: fetchSubmissions,
  };
}
