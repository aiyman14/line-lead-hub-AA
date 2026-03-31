import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBuyerPOAccess, BuyerWorkOrder } from "@/hooks/useBuyerPOAccess";
import { POAggregates, EMPTY_AGGREGATES } from "@/lib/buyer-health";
import { subDays, format } from "date-fns";
import { getTodayInTimezone } from "@/lib/date-utils";

export interface SewingHistoryRow {
  id: string;
  production_date: string;
  good_today: number;
  reject_today: number;
  rework_today: number;
  cumulative_good_total: number;
  submitted_at: string | null;
  has_blocker: boolean | null;
}

export interface CuttingHistoryRow {
  id: string;
  production_date: string;
  day_cutting: number;
  day_input: number;
  total_cutting: number | null;
  total_input: number | null;
  balance: number | null;
  submitted_at: string | null;
}

export interface FinishingHistoryRow {
  id: string;
  production_date: string;
  day_carton: number | null;
  day_poly: number | null;
  day_qc_pass: number | null;
  total_carton: number | null;
  total_poly: number | null;
  total_qc_pass: number | null;
  submitted_at: string | null;
  has_blocker: boolean | null;
}

export interface StorageHistoryRow {
  id: string;
  transaction_date: string;
  receive_qty: number;
  issue_qty: number;
  balance_qty: number;
  created_at: string | null;
}

export interface SewingTargetRow {
  production_date: string;
  per_hour_target: number | null;
  hours_planned: number | null;
}

export function useBuyerPODetails(poId: string | undefined) {
  const { factory } = useAuth();
  const { workOrderIds, workOrders, loading: accessLoading } = useBuyerPOAccess();

  const [sewingHistory, setSewingHistory] = useState<SewingHistoryRow[]>([]);
  const [cuttingHistory, setCuttingHistory] = useState<CuttingHistoryRow[]>([]);
  const [finishingHistory, setFinishingHistory] = useState<FinishingHistoryRow[]>([]);
  const [storageHistory, setStorageHistory] = useState<StorageHistoryRow[]>([]);
  const [sewingTargets, setSewingTargets] = useState<SewingTargetRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timezone = factory?.timezone || "Asia/Dhaka";
  const todayStr = getTodayInTimezone(timezone);

  // Validate PO access
  const isAuthorized = !accessLoading && poId ? workOrderIds.includes(poId) : false;
  const workOrder = workOrders.find((wo) => wo.id === poId) || null;

  useEffect(() => {
    if (accessLoading || !poId) return;

    if (!isAuthorized) {
      setError("You do not have access to this PO.");
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    const startDate = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const safePoId = poId!;

    async function fetchData() {
      setDataLoading(true);
      setError(null);

      const [sewingRes, sewingTargetRes, cuttingRes, finishingRes, storageRes] = await Promise.all([
        supabase
          .from("sewing_actuals")
          .select("id, production_date, good_today, reject_today, rework_today, cumulative_good_total, submitted_at, has_blocker")
          .eq("work_order_id", safePoId)
          .gte("production_date", startDate)
          .order("production_date", { ascending: true }),
        supabase
          .from("sewing_targets")
          .select("production_date, per_hour_target, hours_planned")
          .eq("work_order_id", safePoId)
          .gte("production_date", startDate),
        supabase
          .from("cutting_actuals")
          .select("id, production_date, day_cutting, day_input, total_cutting, total_input, balance, submitted_at")
          .eq("work_order_id", safePoId)
          .gte("production_date", startDate)
          .order("production_date", { ascending: true }),
        supabase
          .from("finishing_actuals")
          .select("id, production_date, day_carton, day_poly, day_qc_pass, total_carton, total_poly, total_qc_pass, submitted_at, has_blocker")
          .eq("work_order_id", safePoId)
          .gte("production_date", startDate)
          .order("production_date", { ascending: true }),
        supabase
          .from("storage_bin_card_transactions")
          .select("id, transaction_date, receive_qty, issue_qty, balance_qty, created_at, storage_bin_cards!inner(work_order_id)")
          .eq("storage_bin_cards.work_order_id", safePoId)
          .gte("transaction_date", startDate)
          .order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      setSewingHistory((sewingRes.data as unknown as SewingHistoryRow[]) || []);
      setSewingTargets((sewingTargetRes.data as unknown as SewingTargetRow[]) || []);
      setCuttingHistory((cuttingRes.data as unknown as CuttingHistoryRow[]) || []);
      setFinishingHistory((finishingRes.data as unknown as FinishingHistoryRow[]) || []);
      setStorageHistory((storageRes.data as unknown as StorageHistoryRow[]) || []);
      setDataLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [accessLoading, poId, isAuthorized]);

  // Compute aggregates from history
  const aggregates = useMemo((): POAggregates => {
    const agg = { ...EMPTY_AGGREGATES };

    for (const row of sewingHistory) {
      agg.sewingOutput += row.good_today || 0;
      agg.rejectTotal += row.reject_today || 0;
      agg.reworkTotal += row.rework_today || 0;
      if ((row.cumulative_good_total || 0) > agg.cumulativeGood) {
        agg.cumulativeGood = row.cumulative_good_total || 0;
      }
      if (row.production_date === todayStr) agg.hasEodToday = true;
    }

    for (const row of finishingHistory) {
      agg.finishingCarton += row.day_carton || 0;
      agg.finishingPoly += row.day_poly || 0;
      agg.finishingQcPass += row.day_qc_pass || 0;
    }

    for (const row of cuttingHistory) {
      agg.cuttingTotal += row.day_cutting || 0;
      agg.cuttingInput += row.day_input || 0;
    }

    return agg;
  }, [sewingHistory, cuttingHistory, finishingHistory, todayStr]);

  // Trend chart data
  const trendData = useMemo(() => {
    const map = new Map<string, { date: string; displayDate: string; sewingOutput: number; finishingOutput: number }>();

    for (const row of sewingHistory) {
      const d = row.production_date;
      if (!map.has(d)) {
        map.set(d, { date: d, displayDate: format(new Date(d + "T00:00:00"), "MMM d"), sewingOutput: 0, finishingOutput: 0 });
      }
      map.get(d)!.sewingOutput += row.good_today || 0;
    }

    for (const row of finishingHistory) {
      const d = row.production_date;
      if (!map.has(d)) {
        map.set(d, { date: d, displayDate: format(new Date(d + "T00:00:00"), "MMM d"), sewingOutput: 0, finishingOutput: 0 });
      }
      map.get(d)!.finishingOutput += (row.day_poly || 0);
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [sewingHistory, finishingHistory]);

  // Today's submissions for timeline
  const todayTimeline = useMemo(() => {
    const entries: Array<{
      department: "sewing" | "cutting" | "finishing" | "storage";
      time: string | null;
      label: string;
    }> = [];

    for (const row of sewingHistory.filter((r) => r.production_date === todayStr)) {
      entries.push({
        department: "sewing",
        time: row.submitted_at,
        label: `Good: ${(row.good_today || 0).toLocaleString()} | Reject: ${row.reject_today || 0} | Rework: ${row.rework_today || 0}`,
      });
    }

    for (const row of cuttingHistory.filter((r) => r.production_date === todayStr)) {
      entries.push({
        department: "cutting",
        time: row.submitted_at,
        label: `Cut: ${(row.day_cutting || 0).toLocaleString()} | Input: ${(row.day_input || 0).toLocaleString()}`,
      });
    }

    for (const row of finishingHistory.filter((r) => r.production_date === todayStr)) {
      entries.push({
        department: "finishing",
        time: row.submitted_at,
        label: `Carton: ${(row.day_carton || 0).toLocaleString()} | Poly: ${(row.day_poly || 0).toLocaleString()} | QC: ${(row.day_qc_pass || 0).toLocaleString()}`,
      });
    }

    for (const row of storageHistory.filter((r) => r.transaction_date === todayStr)) {
      entries.push({
        department: "storage",
        time: row.created_at,
        label: `Received: ${row.receive_qty > 0 ? "+" + row.receive_qty.toLocaleString() : "—"} | Issued: ${row.issue_qty > 0 ? "-" + row.issue_qty.toLocaleString() : "—"} | Balance: ${row.balance_qty.toLocaleString()}`,
      });
    }

    return entries.sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
  }, [sewingHistory, cuttingHistory, finishingHistory, storageHistory, todayStr]);

  // Stage card summaries
  const stageData = useMemo(() => {
    const todaySewing = sewingHistory.filter((r) => r.production_date === todayStr);
    const todayCutting = cuttingHistory.filter((r) => r.production_date === todayStr);
    const todayFinishing = finishingHistory.filter((r) => r.production_date === todayStr);
    const todayStorage = storageHistory.filter((r) => r.transaction_date === todayStr);

    return {
      storage: {
        todayReceived: todayStorage.reduce((s, r) => s + r.receive_qty, 0),
        todayIssued: todayStorage.reduce((s, r) => s + r.issue_qty, 0),
        balance: todayStorage.length > 0 ? todayStorage[todayStorage.length - 1].balance_qty : (storageHistory.length > 0 ? storageHistory[storageHistory.length - 1].balance_qty : 0),
        lastUpdate: todayStorage.length > 0 ? todayStorage[todayStorage.length - 1].created_at : null,
      },
      cutting: {
        todayCut: todayCutting.reduce((s, r) => s + (r.day_cutting || 0), 0),
        todayInput: todayCutting.reduce((s, r) => s + (r.day_input || 0), 0),
        totalCut: aggregates.cuttingTotal,
        lastUpdate: todayCutting.length > 0 ? todayCutting[todayCutting.length - 1].submitted_at : null,
      },
      sewing: {
        todayOutput: todaySewing.reduce((s, r) => s + (r.good_today || 0), 0),
        cumulative: aggregates.cumulativeGood,
        todayReject: todaySewing.reduce((s, r) => s + (r.reject_today || 0), 0),
        lastUpdate: todaySewing.length > 0 ? todaySewing[todaySewing.length - 1].submitted_at : null,
      },
      finishing: {
        todayPoly: todayFinishing.reduce((s, r) => s + (r.day_poly || 0), 0),
        todayCarton: todayFinishing.reduce((s, r) => s + (r.day_carton || 0), 0),
        todayQcPass: todayFinishing.reduce((s, r) => s + (r.day_qc_pass || 0), 0),
        totalPoly: aggregates.finishingPoly,
        totalCarton: aggregates.finishingCarton,
        lastUpdate: todayFinishing.length > 0 ? todayFinishing[todayFinishing.length - 1].submitted_at : null,
      },
    };
  }, [sewingHistory, cuttingHistory, finishingHistory, storageHistory, aggregates, todayStr]);

  const loading = accessLoading || dataLoading;

  return {
    workOrder,
    aggregates,
    trendData,
    todayTimeline,
    stageData,
    sewingHistory,
    sewingTargets,
    loading,
    error,
    isAuthorized,
    timezone,
    todayStr,
  };
}
