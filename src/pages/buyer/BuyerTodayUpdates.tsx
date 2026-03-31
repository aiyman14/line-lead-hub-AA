import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useBuyerPOAccess } from "@/hooks/useBuyerPOAccess";
import { EMPTY_AGGREGATES, POAggregates } from "@/lib/buyer-health";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { TodayPOCard } from "@/components/buyer/TodayPOCard";
import { Loader2, CalendarDays, Package, Calendar as CalendarIcon, AlertCircle, PackageCheck, TrendingUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { getTodayInTimezone, formatTimeInTimezone } from "@/lib/date-utils";
import { motion } from "framer-motion";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

interface SewingRow {
  id: string;
  work_order_id: string;
  production_date: string;
  good_today: number;
  reject_today: number;
  rework_today: number;
  cumulative_good_total: number;
  submitted_at: string | null;
  work_orders: { po_number: string; style: string } | null;
}

interface CuttingRow {
  id: string;
  work_order_id: string;
  production_date: string;
  day_cutting: number;
  day_input: number;
  balance: number | null;
  submitted_at: string | null;
  work_orders: { po_number: string; style: string } | null;
}

interface FinishingRow {
  id: string;
  work_order_id: string;
  production_date: string;
  day_carton: number | null;
  day_poly: number | null;
  day_qc_pass: number | null;
  total_carton: number | null;
  total_poly: number | null;
  total_qc_pass: number | null;
  submitted_at: string | null;
  work_orders: { po_number: string; style: string } | null;
}

interface StorageTransaction {
  id: string;
  bin_card_id: string;
  transaction_date: string;
  receive_qty: number;
  issue_qty: number;
  balance_qty: number;
  remarks: string | null;
  created_at: string | null;
  storage_bin_cards: {
    id: string;
    work_order_id: string;
    buyer: string | null;
    style: string | null;
    work_orders: { po_number: string } | null;
  } | null;
}

export default function BuyerTodayUpdates() {
  const { factory } = useAuth();
  const { workOrderIds, workOrders, loading: accessLoading } = useBuyerPOAccess();

  const timezone = factory?.timezone || "Asia/Dhaka";
  const todayStr = getTodayInTimezone(timezone);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date(todayStr + "T00:00:00"));
  const [poFilter, setPoFilter] = useState<string>("all");
  const [tab, setTab] = useState("all");

  const [sewingData, setSewingData] = useState<SewingRow[]>([]);
  const [cuttingData, setCuttingData] = useState<CuttingRow[]>([]);
  const [finishingData, setFinishingData] = useState<FinishingRow[]>([]);
  const [storageData, setStorageData] = useState<StorageTransaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    if (accessLoading || workOrderIds.length === 0) {
      setDataLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setDataLoading(true);

      const filterIds = poFilter === "all" ? workOrderIds : [poFilter];

      const [sewingRes, cuttingRes, finishingRes, storageRes] = await Promise.all([
        supabase
          .from("sewing_actuals")
          .select("id, work_order_id, production_date, good_today, reject_today, rework_today, cumulative_good_total, submitted_at, work_orders(po_number, style)")
          .in("work_order_id", filterIds)
          .eq("production_date", dateStr)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("cutting_actuals")
          .select("id, work_order_id, production_date, day_cutting, day_input, balance, submitted_at, work_orders(po_number, style)")
          .in("work_order_id", filterIds)
          .eq("production_date", dateStr)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("finishing_actuals")
          .select("id, work_order_id, production_date, day_carton, day_poly, day_qc_pass, total_carton, total_poly, total_qc_pass, submitted_at, work_orders(po_number, style)")
          .in("work_order_id", filterIds)
          .eq("production_date", dateStr)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("storage_bin_card_transactions")
          .select("id, bin_card_id, transaction_date, receive_qty, issue_qty, balance_qty, remarks, created_at, storage_bin_cards(id, work_order_id, buyer, style, work_orders(po_number))")
          .eq("transaction_date", dateStr)
          .order("created_at", { ascending: false }),
      ]);

      if (cancelled) return;

      // TODO: REMOVE — fake demo data for visual preview only (no DB writes)
      const DEMO_MODE = true;
      const realSewing = (sewingRes.data as unknown as SewingRow[]) || [];
      const realCutting = (cuttingRes.data as unknown as CuttingRow[]) || [];
      const realFinishing = (finishingRes.data as unknown as FinishingRow[]) || [];
      const allStorage = (storageRes.data as unknown as StorageTransaction[]) || [];
      const filterSet = new Set(filterIds);
      const realStorage = allStorage.filter(t => t.storage_bin_cards?.work_order_id && filterSet.has(t.storage_bin_cards.work_order_id));

      if (DEMO_MODE) {
        const now = new Date().toISOString();
        const fakeWOs = filterIds.map((woId, i) => {
          const wo = workOrders.find(w => w.id === woId);
          const po = wo?.po_number || "PO";
          const style = wo?.style || "Style";
          return { woId, po, style, i };
        });
        const fakeSewing: SewingRow[] = fakeWOs.map(({ woId, po, style, i }) => ({
          id: `demo-sew-${woId}`,
          work_order_id: woId,
          production_date: dateStr,
          good_today: i === 0 ? 520 : 680,
          reject_today: i === 0 ? 12 : 8,
          rework_today: i === 0 ? 5 : 3,
          cumulative_good_total: i === 0 ? 4155 : 9878,
          submitted_at: now,
          work_orders: { po_number: po, style },
        }));
        const fakeCutting: CuttingRow[] = fakeWOs.slice(0, 1).map(({ woId, po, style }) => ({
          id: `demo-cut-${woId}`,
          work_order_id: woId,
          production_date: dateStr,
          day_cutting: 600,
          day_input: 580,
          balance: 245,
          submitted_at: now,
          work_orders: { po_number: po, style },
        }));
        const fakeFinishing: FinishingRow[] = fakeWOs.map(({ woId, po, style, i }) => ({
          id: `demo-fin-${woId}`,
          work_order_id: woId,
          production_date: dateStr,
          day_carton: i === 0 ? 340 : 410,
          day_poly: i === 0 ? 350 : 420,
          day_qc_pass: i === 0 ? 330 : 400,
          total_carton: i === 0 ? 2728 : 5072,
          total_poly: i === 0 ? 2750 : 5100,
          total_qc_pass: i === 0 ? 2700 : 5000,
          submitted_at: now,
          work_orders: { po_number: po, style },
        }));
        setSewingData([...realSewing, ...fakeSewing]);
        setCuttingData([...realCutting, ...fakeCutting]);
        setFinishingData([...realFinishing, ...fakeFinishing]);
        setStorageData(realStorage);
      } else {
        setSewingData(realSewing);
        setCuttingData(realCutting);
        setFinishingData(realFinishing);
        setStorageData(realStorage);
      }
      setDataLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [accessLoading, workOrderIds, dateStr, poFilter]);

  const loading = accessLoading || dataLoading;
  const isToday = dateStr === todayStr;

  // KPI snapshot
  const kpiSnapshot = useMemo(() => {
    const updatedPOIds = new Set([
      ...sewingData.map((r) => r.work_order_id),
      ...cuttingData.map((r) => r.work_order_id),
      ...finishingData.map((r) => r.work_order_id),
      ...storageData.filter(t => t.storage_bin_cards?.work_order_id).map(t => t.storage_bin_cards!.work_order_id),
    ]);

    const totalSewn = sewingData.reduce((s, r) => s + (r.good_today || 0), 0);
    const totalPacked = finishingData.reduce((s, r) => s + (r.day_carton || 0), 0);

    const allTimes = [
      ...sewingData.map(r => r.submitted_at),
      ...cuttingData.map(r => r.submitted_at),
      ...finishingData.map(r => r.submitted_at),
      ...storageData.map(r => r.created_at),
    ].filter(Boolean) as string[];

    const lastUpdate = allTimes.length > 0
      ? allTimes.sort().reverse()[0]
      : null;

    return {
      posUpdated: updatedPOIds.size,
      totalSewn,
      totalPacked,
      lastUpdate,
    };
  }, [sewingData, cuttingData, finishingData, storageData]);

  // Per-PO aggregates and timelines for the "All Stages" tab
  const allStagesData = useMemo(() => {
    const filterIds = poFilter === "all" ? workOrderIds : [poFilter];
    const filteredWOs = workOrders.filter(wo => filterIds.includes(wo.id));

    return filteredWOs.map(wo => {
      const agg: POAggregates = { ...EMPTY_AGGREGATES };

      for (const row of sewingData.filter(r => r.work_order_id === wo.id)) {
        agg.sewingOutput += row.good_today || 0;
        agg.rejectTotal += row.reject_today || 0;
        agg.reworkTotal += row.rework_today || 0;
        if ((row.cumulative_good_total || 0) > agg.cumulativeGood) {
          agg.cumulativeGood = row.cumulative_good_total || 0;
        }
        agg.hasEodToday = true;
      }

      for (const row of cuttingData.filter(r => r.work_order_id === wo.id)) {
        agg.cuttingTotal += row.day_cutting || 0;
        agg.cuttingInput += row.day_input || 0;
      }

      for (const row of finishingData.filter(r => r.work_order_id === wo.id)) {
        agg.finishingCarton += row.day_carton || 0;
        agg.finishingPoly += row.day_poly || 0;
        agg.finishingQcPass += row.day_qc_pass || 0;
      }

      const timeline: { department: string; label: string; time: string | null }[] = [];

      for (const row of storageData.filter(t => t.storage_bin_cards?.work_order_id === wo.id)) {
        const parts: string[] = [];
        if (row.receive_qty > 0) parts.push(`Received: ${row.receive_qty.toLocaleString()}`);
        if (row.issue_qty > 0) parts.push(`Issued: ${row.issue_qty.toLocaleString()}`);
        timeline.push({ department: "storage", label: parts.join(", ") || "Transaction", time: row.created_at });
      }

      for (const row of cuttingData.filter(r => r.work_order_id === wo.id)) {
        timeline.push({ department: "cutting", label: `Cut: ${row.day_cutting.toLocaleString()} | Input: ${row.day_input.toLocaleString()}`, time: row.submitted_at });
      }

      for (const row of sewingData.filter(r => r.work_order_id === wo.id)) {
        timeline.push({ department: "sewing", label: `Good: ${row.good_today.toLocaleString()} | Reject: ${row.reject_today || 0} | Cumulative: ${row.cumulative_good_total.toLocaleString()}`, time: row.submitted_at });
      }

      for (const row of finishingData.filter(r => r.work_order_id === wo.id)) {
        timeline.push({ department: "finishing", label: `Carton: ${(row.day_carton || 0).toLocaleString()} | Poly: ${(row.day_poly || 0).toLocaleString()} | QC: ${(row.day_qc_pass || 0).toLocaleString()}`, time: row.submitted_at });
      }

      timeline.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return b.time.localeCompare(a.time);
      });

      return { wo, aggregates: agg, timeline };
    });
  }, [workOrders, workOrderIds, sewingData, cuttingData, finishingData, storageData, poFilter]);

  // POs with no submissions today
  const posWithNoUpdate = useMemo(() => {
    if (!isToday) return [];
    const updatedPOIds = new Set([
      ...sewingData.map((r) => r.work_order_id),
      ...cuttingData.map((r) => r.work_order_id),
      ...finishingData.map((r) => r.work_order_id),
    ]);
    return workOrders.filter(
      (wo) =>
        (poFilter === "all" || wo.id === poFilter) &&
        !updatedPOIds.has(wo.id) &&
        wo.status !== "completed"
    );
  }, [isToday, sewingData, cuttingData, finishingData, workOrders, poFilter]);

  const kpiCards = [
    {
      title: "POs Updated",
      value: kpiSnapshot.posUpdated,
      subtitle: `of ${workOrders.length} total`,
      icon: Package,
      gradient: "from-slate-500 to-slate-600",
      bg: "bg-slate-50 dark:bg-slate-950/30",
      iconBg: "bg-slate-500/10",
      iconColor: "text-slate-600 dark:text-slate-400",
    },
    {
      title: "Total Sewn Today",
      value: kpiSnapshot.totalSewn,
      icon: TrendingUp,
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Total Packed Today",
      value: kpiSnapshot.totalPacked,
      icon: PackageCheck,
      gradient: "from-violet-500 to-purple-600",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Last Update",
      value: null as number | null,
      displayValue: kpiSnapshot.lastUpdate ? formatTimeInTimezone(kpiSnapshot.lastUpdate, timezone) : "\u2014",
      icon: Clock,
      gradient: "from-amber-500 to-orange-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
  ];

  const tabCounts = {
    storage: storageData.length,
    cutting: cuttingData.length,
    sewing: sewingData.length,
    finishing: finishingData.length,
  };

  return (
    <div className="py-4 lg:py-6 space-y-6">
      {/* Hero banner */}
      <motion.div
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-500 to-cyan-500 p-6 md:p-8 text-white"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6TTAgMzR2Mkgydi0ySDB6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Today Updates</h1>
            <p className="text-blue-100 mt-1 text-sm md:text-base">
              Daily production submissions for your POs
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={poFilter} onValueChange={setPoFilter}>
              <SelectTrigger className="w-[180px] bg-white/15 border-white/20 text-white hover:bg-white/25 [&>svg]:text-white">
                <SelectValue placeholder="Filter by PO" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All POs</SelectItem>
                {workOrders.map((wo) => (
                  <SelectItem key={wo.id} value={wo.id}>
                    {wo.po_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 bg-white/15 border-white/20 text-white hover:bg-white/25 hover:text-white">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <CalendarDays className="h-40 w-40" />
        </div>
      </motion.div>

      {/* KPI Cards */}
      {!loading && (
        <motion.div
          className="grid gap-4 grid-cols-2 lg:grid-cols-4"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {kpiCards.map((kpi) => (
            <motion.div key={kpi.title} variants={fadeUp}>
              <div className={`relative overflow-hidden rounded-xl border ${kpi.bg} p-4 md:p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5`}>
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.gradient}`} />
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {kpi.title}
                    </p>
                    <p className="font-mono text-2xl md:text-3xl font-bold tracking-tight">
                      {kpi.value !== null ? (
                        <AnimatedNumber value={kpi.value} />
                      ) : (
                        kpi.displayValue
                      )}
                    </p>
                    {kpi.subtitle && (
                      <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                    )}
                  </div>
                  <div className={`rounded-xl ${kpi.iconBg} p-2.5`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* No update alerts */}
      {posWithNoUpdate.length > 0 && (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {posWithNoUpdate.map((wo) => (
            <div
              key={wo.id}
              className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3"
            >
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm">{wo.po_number}</span>
                <span className="text-sm text-muted-foreground"> — {wo.style}</span>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                No update today
              </Badge>
            </div>
          ))}
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/60">
          <TabsTrigger value="all" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            All Stages
          </TabsTrigger>
          {(["storage", "cutting", "sewing", "finishing"] as const).map((stage) => (
            <TabsTrigger
              key={stage}
              value={stage}
              className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              {stage.charAt(0).toUpperCase() + stage.slice(1)}
              {tabCounts[stage] > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5">
                  {tabCounts[stage]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {loading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* All Stages tab */}
            <TabsContent value="all">
              {allStagesData.length === 0 ? (
                <EmptyTab label="production" date={dateStr} />
              ) : (
                <motion.div
                  className="space-y-3 mt-2"
                  variants={stagger}
                  initial="hidden"
                  animate="show"
                >
                  {allStagesData.map(({ wo, aggregates: agg, timeline }) => (
                    <motion.div key={wo.id} variants={fadeUp}>
                      <TodayPOCard
                        wo={wo}
                        aggregates={agg}
                        timeline={timeline}
                        timezone={timezone}
                        lastSubmittedAt={timeline[0]?.time ?? null}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </TabsContent>

            {/* Sewing tab */}
            <TabsContent value="sewing">
              {sewingData.length === 0 ? (
                <EmptyTab label="sewing" date={dateStr} />
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>PO</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="text-right">Good Today</TableHead>
                        <TableHead className="text-right">Reject</TableHead>
                        <TableHead className="text-right">Rework</TableHead>
                        <TableHead className="text-right">Cumulative</TableHead>
                        <TableHead className="text-right">Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewingData.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-primary">
                            {row.work_orders?.po_number || "\u2014"}
                          </TableCell>
                          <TableCell>{row.work_orders?.style || "\u2014"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {row.good_today.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-amber-600 tabular-nums">
                            {row.reject_today || 0}
                          </TableCell>
                          <TableCell className="text-right text-amber-600 tabular-nums">
                            {row.rework_today || 0}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.cumulative_good_total.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.submitted_at
                              ? formatTimeInTimezone(row.submitted_at, timezone)
                              : "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Cutting tab */}
            <TabsContent value="cutting">
              {cuttingData.length === 0 ? (
                <EmptyTab label="cutting" date={dateStr} />
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>PO</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="text-right">Day Cutting</TableHead>
                        <TableHead className="text-right">Day Input</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cuttingData.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-primary">
                            {row.work_orders?.po_number || "\u2014"}
                          </TableCell>
                          <TableCell>{row.work_orders?.style || "\u2014"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {row.day_cutting.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.day_input.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.balance != null ? row.balance.toLocaleString() : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.submitted_at
                              ? formatTimeInTimezone(row.submitted_at, timezone)
                              : "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Finishing tab */}
            <TabsContent value="finishing">
              {finishingData.length === 0 ? (
                <EmptyTab label="finishing" date={dateStr} />
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>PO</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="text-right">Poly</TableHead>
                        <TableHead className="text-right">Carton</TableHead>
                        <TableHead className="text-right">QC Pass</TableHead>
                        <TableHead className="text-right">Total Poly</TableHead>
                        <TableHead className="text-right">Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {finishingData.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-primary">
                            {row.work_orders?.po_number || "\u2014"}
                          </TableCell>
                          <TableCell>{row.work_orders?.style || "\u2014"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {(row.day_poly || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(row.day_carton || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(row.day_qc_pass || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(row.total_poly || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.submitted_at
                              ? formatTimeInTimezone(row.submitted_at, timezone)
                              : "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Storage tab */}
            <TabsContent value="storage">
              {storageData.length === 0 ? (
                <EmptyTab label="storage" date={dateStr} />
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>PO</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Issued</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storageData.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-primary">
                            {row.storage_bin_cards?.work_orders?.po_number || "\u2014"}
                          </TableCell>
                          <TableCell>{row.storage_bin_cards?.style || "\u2014"}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600 tabular-nums">
                            {row.receive_qty > 0 ? `+${row.receive_qty.toLocaleString()}` : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right text-red-600 tabular-nums">
                            {row.issue_qty > 0 ? `-${row.issue_qty.toLocaleString()}` : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {row.balance_qty.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.created_at
                              ? formatTimeInTimezone(row.created_at, timezone)
                              : "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function EmptyTab({ label, date }: { label: string; date: string }) {
  return (
    <Card className="mt-4 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <CalendarDays className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No {label} submissions for {format(new Date(date + "T00:00:00"), "MMM d, yyyy")}
        </p>
      </CardContent>
    </Card>
  );
}
