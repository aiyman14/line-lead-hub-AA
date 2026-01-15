import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Package, Search, ClipboardList, Eye, Target, TrendingUp } from "lucide-react";
import { FinishingLogDetailModal } from "@/components/FinishingLogDetailModal";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import type { Database } from "@/integrations/supabase/types";

type FinishingLogType = Database["public"]["Enums"]["finishing_log_type"];

interface DailyLogRow {
  id: string;
  production_date: string;
  line_name: string;
  po_number: string | null;
  style: string | null;
  log_type: FinishingLogType;
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
  submitted_at: string;
  is_locked: boolean;
}

interface FinishingDailySheetsTableProps {
  factoryId: string;
  dateRange: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function FinishingDailySheetsTable({
  factoryId,
  dateRange,
  searchTerm,
  onSearchChange,
}: FinishingDailySheetsTableProps) {
  const [logs, setLogs] = useState<DailyLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"targets" | "outputs">("targets");
  const [selectedLog, setSelectedLog] = useState<DailyLogRow | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    fetchLogs();
  }, [factoryId, dateRange]);

  async function fetchLogs() {
    setLoading(true);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));

    try {
      const { data, error } = await supabase
        .from("finishing_daily_logs")
        .select(`
          *,
          lines(id, line_id, name),
          work_orders(po_number, style)
        `)
        .eq("factory_id", factoryId)
        .gte("production_date", startDate.toISOString().split("T")[0])
        .lte("production_date", endDate.toISOString().split("T")[0])
        .order("production_date", { ascending: false })
        .order("submitted_at", { ascending: false });

      if (error) throw error;

      const formatted: DailyLogRow[] = (data || []).map((log: any) => ({
        id: log.id,
        production_date: log.production_date,
        line_name: log.lines?.name || log.lines?.line_id || "Unknown",
        po_number: log.work_orders?.po_number || null,
        style: log.work_orders?.style || null,
        log_type: log.log_type,
        thread_cutting: log.thread_cutting || 0,
        inside_check: log.inside_check || 0,
        top_side_check: log.top_side_check || 0,
        buttoning: log.buttoning || 0,
        iron: log.iron || 0,
        get_up: log.get_up || 0,
        poly: log.poly || 0,
        carton: log.carton || 0,
        submitted_at: log.submitted_at,
        is_locked: log.is_locked,
      }));

      setLogs(formatted);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesTab = activeTab === "targets" ? log.log_type === "TARGET" : log.log_type === "OUTPUT";
      if (!matchesTab) return false;
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        log.line_name.toLowerCase().includes(search) ||
        (log.po_number?.toLowerCase() || "").includes(search) ||
        (log.style?.toLowerCase() || "").includes(search)
      );
    });
  }, [logs, activeTab, searchTerm]);

  const {
    currentPage,
    totalPages,
    paginatedData,
    setCurrentPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
  } = usePagination(filteredLogs, { pageSize });
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Stats based on active tab
  const tabLogs = logs.filter(l => activeTab === "targets" ? l.log_type === "TARGET" : l.log_type === "OUTPUT");
  const totalLogs = tabLogs.length;
  const totalPoly = tabLogs.reduce((sum, l) => sum + l.poly, 0);
  const totalCarton = tabLogs.reduce((sum, l) => sum + l.carton, 0);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "targets" | "outputs")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="targets" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Daily Targets
          </TabsTrigger>
          <TabsTrigger value="outputs" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Daily Outputs
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalLogs}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeTab === "targets" ? "Targets" : "Outputs"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{totalPoly.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Poly</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{totalCarton.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Cartons</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by line, PO, or style..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {activeTab === "targets" ? (
                  <Target className="h-4 w-4 text-primary" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-primary" />
                )}
                {activeTab === "targets" ? "Daily Targets" : "Daily Outputs"}
                <Badge variant="secondary" className="ml-2">
                  {filteredLogs.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Date</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>PO / Style</TableHead>
                      <TableHead className="text-right">Poly</TableHead>
                      <TableHead className="text-right">Carton</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {paginatedData.map((log) => (
                        <TableRow 
                          key={log.id} 
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setSelectedLog(log);
                            setDetailModalOpen(true);
                          }}
                        >
                          <TableCell>
                            <div>
                              <p className="font-mono text-sm">{formatDate(log.production_date)}</p>
                              <p className="text-xs text-muted-foreground">{formatTime(log.submitted_at)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{log.line_name}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.po_number || "-"}</p>
                              <p className="text-xs text-muted-foreground">{log.style || "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-bold text-success">
                              {log.poly.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-bold text-warning">
                              {log.carton.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.is_locked ? (
                              <Badge variant="secondary">Locked</Badge>
                            ) : (
                              <Badge variant="default" className="bg-success hover:bg-success/90">
                                Submitted
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p>No {activeTab === "targets" ? "targets" : "outputs"} found</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                </Table>
              </div>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={filteredLogs.length}
                onPageChange={setCurrentPage}
                onFirstPage={goToFirstPage}
                onLastPage={goToLastPage}
                onNextPage={goToNextPage}
                onPreviousPage={goToPreviousPage}
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Finishing Log Detail Modal */}
      <FinishingLogDetailModal
        log={selectedLog ? {
          id: selectedLog.id,
          production_date: selectedLog.production_date,
          line_id: selectedLog.line_name,
          work_order_id: null,
          log_type: selectedLog.log_type,
          shift: null,
          thread_cutting: selectedLog.thread_cutting,
          inside_check: selectedLog.inside_check,
          top_side_check: selectedLog.top_side_check,
          buttoning: selectedLog.buttoning,
          iron: selectedLog.iron,
          get_up: selectedLog.get_up,
          poly: selectedLog.poly,
          carton: selectedLog.carton,
          remarks: null,
          submitted_at: selectedLog.submitted_at,
          is_locked: selectedLog.is_locked,
          line: {
            line_id: selectedLog.line_name,
            name: selectedLog.line_name
          },
          work_order: selectedLog.po_number ? {
            po_number: selectedLog.po_number,
            style: selectedLog.style || "",
            buyer: ""
          } : null
        } : null}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}
