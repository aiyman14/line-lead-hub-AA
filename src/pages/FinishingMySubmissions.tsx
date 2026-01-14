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
import { FileText, Eye, Clock, Target, TrendingUp, Search, Package } from "lucide-react";

interface FinishingTarget {
  id: string;
  production_date: string;
  line_id: string;
  work_order_id: string;
  buyer_name: string | null;
  style_no: string | null;
  item_name: string | null;
  order_qty: number | null;
  per_hour_target: number;
  m_power_planned: number;
  day_hour_planned: number;
  day_over_time_planned: number;
  remarks: string | null;
  submitted_at: string | null;
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

interface FinishingActual {
  id: string;
  production_date: string;
  line_id: string;
  work_order_id: string;
  buyer_name: string | null;
  style_no: string | null;
  item_name: string | null;
  order_qty: number | null;
  day_qc_pass: number;
  total_qc_pass: number;
  day_poly: number;
  total_poly: number;
  day_carton: number;
  total_carton: number;
  m_power_actual: number;
  day_hour_actual: number;
  day_over_time_actual: number;
  remarks: string | null;
  submitted_at: string | null;
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
  const [targets, setTargets] = useState<FinishingTarget[]>([]);
  const [actuals, setActuals] = useState<FinishingActual[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"targets" | "outputs">("targets");

  useEffect(() => {
    if (profile?.factory_id && user) {
      fetchMySubmissions();
    }
  }, [profile?.factory_id, user]);

  const fetchMySubmissions = async () => {
    try {
      const [targetsRes, actualsRes] = await Promise.all([
        supabase
          .from("finishing_targets")
          .select(`
            *,
            line:lines(line_id, name),
            work_order:work_orders(po_number, style, buyer)
          `)
          .eq("factory_id", profile!.factory_id!)
          .eq("submitted_by", user!.id)
          .order("production_date", { ascending: false })
          .order("submitted_at", { ascending: false }),
        supabase
          .from("finishing_actuals")
          .select(`
            *,
            line:lines(line_id, name),
            work_order:work_orders(po_number, style, buyer)
          `)
          .eq("factory_id", profile!.factory_id!)
          .eq("submitted_by", user!.id)
          .order("production_date", { ascending: false })
          .order("submitted_at", { ascending: false }),
      ]);

      if (targetsRes.error) throw targetsRes.error;
      if (actualsRes.error) throw actualsRes.error;

      setTargets(targetsRes.data as FinishingTarget[]);
      setActuals(actualsRes.data as FinishingActual[]);
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const targetsThisWeek = targets.filter((t) => {
      const date = parseISO(t.production_date);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
    });

    const actualsThisWeek = actuals.filter((a) => {
      const date = parseISO(a.production_date);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
    });

    const totalOTPlanned = targetsThisWeek.reduce((sum, t) => sum + (t.day_over_time_planned || 0), 0);
    const totalOTActual = actualsThisWeek.reduce((sum, a) => sum + (a.day_over_time_actual || 0), 0);
    const avgTarget = targetsThisWeek.length > 0 
      ? Math.round(targetsThisWeek.reduce((sum, t) => sum + t.per_hour_target, 0) / targetsThisWeek.length)
      : 0;
    const avgQcPass = actualsThisWeek.length > 0
      ? Math.round(actualsThisWeek.reduce((sum, a) => sum + a.day_qc_pass, 0) / actualsThisWeek.length)
      : 0;

    return {
      submissionsThisWeek: activeTab === "targets" ? targetsThisWeek.length : actualsThisWeek.length,
      otHoursThisWeek: activeTab === "targets" ? totalOTPlanned : totalOTActual,
      avgPerHour: activeTab === "targets" ? avgTarget : avgQcPass,
    };
  }, [targets, actuals, activeTab]);

  // Filter targets
  const filteredTargets = useMemo(() => {
    let result = targets;

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
          item.style_no?.toLowerCase().includes(query) ||
          item.buyer_name?.toLowerCase().includes(query) ||
          item.line?.line_id?.toLowerCase().includes(query) ||
          item.line?.name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [targets, dateFilter, searchQuery]);

  // Filter actuals
  const filteredActuals = useMemo(() => {
    let result = actuals;

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
          item.style_no?.toLowerCase().includes(query) ||
          item.buyer_name?.toLowerCase().includes(query) ||
          item.line?.line_id?.toLowerCase().includes(query) ||
          item.line?.name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [actuals, dateFilter, searchQuery]);

  const handleNewSubmission = () => {
    if (activeTab === "targets") {
      navigate("/finishing/daily-target");
    } else {
      navigate("/finishing/daily-output");
    }
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
            Daily Targets
          </TabsTrigger>
          <TabsTrigger value="outputs" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Daily Outputs
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
                    <p className="text-sm text-muted-foreground">
                      {activeTab === "targets" ? "OT Planned" : "OT Actual"} (Week)
                    </p>
                    <p className="text-2xl font-bold">{stats.otHoursThisWeek}h</p>
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
                    <p className="text-sm text-muted-foreground">
                      {activeTab === "targets" ? "Avg Target/hr" : "Avg QC Pass/day"}
                    </p>
                    <p className="text-2xl font-bold">{stats.avgPerHour.toLocaleString()}</p>
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
              {(activeTab === "targets" ? filteredTargets : filteredActuals).length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No {activeTab === "targets" ? "target" : "output"} submissions found</p>
                  <p className="text-sm mt-2">
                    {searchQuery || dateFilter !== "all"
                      ? "Try adjusting your filters"
                      : `Create a new ${activeTab === "targets" ? "target" : "output"} to start`}
                  </p>
                </div>
              ) : activeTab === "targets" && filteredTargets.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>PO / Style</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead className="text-right">Target/hr</TableHead>
                      <TableHead className="text-right">M Power</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">OT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTargets.map((target) => {
                      const date = parseISO(target.production_date);
                      const isTodaySubmission = isToday(date);

                      return (
                        <TableRow key={target.id}>
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
                              {target.line?.line_id || "—"}
                            </span>
                            {target.line?.name && (
                              <span className="text-muted-foreground ml-1">
                                ({target.line.name})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {target.work_order?.po_number || "—"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {target.style_no || target.work_order?.style || "—"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {target.buyer_name || target.work_order?.buyer || "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {target.per_hour_target.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {target.m_power_planned}
                          </TableCell>
                          <TableCell className="text-right">
                            {target.day_hour_planned}h
                          </TableCell>
                          <TableCell className="text-right">
                            {target.day_over_time_planned}h
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>PO / Style</TableHead>
                      <TableHead className="text-right">QC Pass</TableHead>
                      <TableHead className="text-right">Poly</TableHead>
                      <TableHead className="text-right">Carton</TableHead>
                      <TableHead className="text-right">M Power</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActuals.map((actual) => {
                      const date = parseISO(actual.production_date);
                      const isTodaySubmission = isToday(date);

                      return (
                        <TableRow key={actual.id}>
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
                              {actual.line?.line_id || "—"}
                            </span>
                            {actual.line?.name && (
                              <span className="text-muted-foreground ml-1">
                                ({actual.line.name})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {actual.work_order?.po_number || "—"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {actual.style_no || actual.work_order?.style || "—"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="font-medium">{actual.day_qc_pass.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              Total: {actual.total_qc_pass.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{actual.day_poly.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              Total: {actual.total_poly.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{actual.day_carton.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">
                              Total: {actual.total_carton.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {actual.m_power_actual}
                          </TableCell>
                          <TableCell className="text-right">
                            {actual.day_hour_actual}h
                            {actual.day_over_time_actual > 0 && (
                              <span className="text-muted-foreground ml-1">
                                (+{actual.day_over_time_actual}h OT)
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
