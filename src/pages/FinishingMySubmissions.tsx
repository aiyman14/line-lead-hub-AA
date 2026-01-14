import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isToday, parseISO, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { FileText, Clock, Target, TrendingUp, Search, Package, Edit2, Eye } from "lucide-react";
import { FinishingLogDetailModal } from "@/components/FinishingLogDetailModal";

interface FinishingDailyLog {
  id: string;
  production_date: string;
  line_id: string;
  work_order_id: string | null;
  log_type: "TARGET" | "OUTPUT";
  shift: string | null;
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
  remarks: string | null;
  submitted_at: string;
  is_locked: boolean;
  line: {
    line_id: string;
    name: string | null;
  } | null;
  work_order: {
    po_number: string;
    style: string;
    buyer: string;
  } | null;
}

export default function FinishingMySubmissions() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<FinishingDailyLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"targets" | "outputs">("targets");
  const [selectedLog, setSelectedLog] = useState<FinishingDailyLog | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    if (profile?.factory_id && user) {
      fetchMySubmissions();
    }
  }, [profile?.factory_id, user]);

  const fetchMySubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from("finishing_daily_logs")
        .select(`
          *,
          line:lines(line_id, name),
          work_order:work_orders(po_number, style, buyer)
        `)
        .eq("factory_id", profile!.factory_id!)
        .eq("submitted_by", user!.id)
        .order("production_date", { ascending: false })
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setLogs(data as FinishingDailyLog[]);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Split logs by type
  const targets = useMemo(() => logs.filter(l => l.log_type === "TARGET"), [logs]);
  const outputs = useMemo(() => logs.filter(l => l.log_type === "OUTPUT"), [logs]);

  // Calculate stats
  const stats = useMemo(() => {
    const currentLogs = activeTab === "targets" ? targets : outputs;
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const logsThisWeek = currentLogs.filter((log) => {
      const date = parseISO(log.production_date);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
    });

    const totalPcs = logsThisWeek.reduce((sum, log) => {
      return sum + log.thread_cutting + log.inside_check + log.top_side_check + 
             log.buttoning + log.iron + log.get_up + log.poly + log.carton;
    }, 0);

    const avgPerDay = logsThisWeek.length > 0 
      ? Math.round(totalPcs / logsThisWeek.length)
      : 0;

    return {
      submissionsThisWeek: logsThisWeek.length,
      totalPcsThisWeek: totalPcs,
      avgPerDay,
    };
  }, [targets, outputs, activeTab]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    const currentLogs = activeTab === "targets" ? targets : outputs;
    let result = currentLogs;

    if (dateFilter === "today") {
      result = result.filter((item) => isToday(parseISO(item.production_date)));
    } else if (dateFilter === "week") {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      result = result.filter((item) =>
        isWithinInterval(parseISO(item.production_date), { start: weekStart, end: weekEnd })
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.work_order?.po_number?.toLowerCase().includes(query) ||
          item.work_order?.style?.toLowerCase().includes(query) ||
          item.work_order?.buyer?.toLowerCase().includes(query) ||
          item.line?.line_id?.toLowerCase().includes(query) ||
          item.line?.name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [targets, outputs, activeTab, dateFilter, searchQuery]);

  const handleNewSubmission = () => {
    if (activeTab === "targets") {
      navigate("/finishing/daily-target");
    } else {
      navigate("/finishing/daily-output");
    }
  };

  const handleEdit = (log: FinishingDailyLog) => {
    const path = log.log_type === "TARGET" ? "/finishing/daily-target" : "/finishing/daily-output";
    const params = new URLSearchParams();
    params.set("line", log.line_id);
    if (log.work_order_id) params.set("wo", log.work_order_id);
    navigate(`${path}?${params.toString()}`);
  };

  const handleView = (log: FinishingDailyLog) => {
    setSelectedLog(log);
    setDetailModalOpen(true);
  };

  const calculateLogTotal = (log: FinishingDailyLog) => {
    return (log.poly || 0) + (log.carton || 0);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">My Finishing Submissions</h1>
        </div>
        <Button onClick={handleNewSubmission}>
          + New {activeTab === "targets" ? "Target" : "Output"}
        </Button>
      </div>

      {/* Tabs for Targets vs Outputs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "targets" | "outputs")}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="targets" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Daily Targets ({targets.length})
          </TabsTrigger>
          <TabsTrigger value="outputs" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Daily Outputs ({outputs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-2xl font-bold">{stats.submissionsThisWeek} submissions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Pcs (Week)</p>
                    <p className="text-2xl font-bold">{stats.totalPcsThisWeek.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Per Day</p>
                    <p className="text-2xl font-bold">{stats.avgPerDay.toLocaleString()} pcs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO, style, buyer, line..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {activeTab === "targets" ? "Target Submissions" : "Output Submissions"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No {activeTab === "targets" ? "target" : "output"} submissions found</p>
                  <p className="text-sm mt-2">
                    {searchQuery || dateFilter !== "all"
                      ? "Try adjusting your filters"
                      : `Create a new ${activeTab === "targets" ? "target" : "output"} to start`}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO / Style</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead className="text-right">Total Pcs</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => {
                        const date = parseISO(log.production_date);
                        const isTodaySubmission = isToday(date);
                        const total = calculateLogTotal(log);

                        return (
                          <TableRow key={log.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{format(date, "MMM dd, yyyy")}</span>
                                {isTodaySubmission && (
                                  <Badge variant="secondary" className="text-xs">
                                    Today
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {log.line?.line_id || "—"}
                              </span>
                              {log.line?.name && (
                                <span className="text-muted-foreground ml-1">
                                  ({log.line.name})
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.work_order ? (
                                <div>
                                  <div className="font-medium">
                                    {log.work_order.po_number}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {log.work_order.style}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">No PO</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.shift ? (
                                <Badge variant="outline">{log.shift}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {total.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleView(log)}
                                  title="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(log)}
                                  disabled={log.is_locked}
                                  title="Edit"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FinishingLogDetailModal
        log={selectedLog}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}
