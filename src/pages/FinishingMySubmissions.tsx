import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { FileText, Eye, Clock, Timer, Target, TrendingUp, Search } from "lucide-react";

interface HourlyLog {
  id: string;
  hour_slot: string;
  sheet_id: string;
  thread_cutting_target: number;
  thread_cutting_actual: number;
  inside_check_target: number;
  inside_check_actual: number;
  top_side_check_target: number;
  top_side_check_actual: number;
  buttoning_target: number;
  buttoning_actual: number;
  iron_target: number;
  iron_actual: number;
  get_up_target: number;
  get_up_actual: number;
  poly_target: number;
  poly_actual: number;
  carton_target: number;
  carton_actual: number;
}

interface FinishingSheet {
  id: string;
  production_date: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  item: string | null;
  color: string | null;
  finishing_no: string | null;
  created_at: string | null;
  line_id: string;
  work_order_id: string;
  line: {
    line_id: string;
    name: string | null;
  } | null;
  work_order: {
    po_number: string;
    style: string;
    buyer: string;
    order_qty: number;
  } | null;
  hourly_logs_count: number;
  hourly_logs: HourlyLog[];
}

export default function FinishingMySubmissions() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<FinishingSheet[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");

  useEffect(() => {
    if (profile?.factory_id && user) {
      fetchMySheets();
    }
  }, [profile?.factory_id, user]);

  const fetchMySheets = async () => {
    try {
      // Fetch sheets created by current user
      const { data: sheetsData, error } = await supabase
        .from("finishing_daily_sheets")
        .select(`
          id,
          production_date,
          buyer,
          style,
          po_no,
          item,
          color,
          finishing_no,
          created_at,
          line_id,
          work_order_id,
          line:lines(line_id, name),
          work_order:work_orders(po_number, style, buyer, order_qty)
        `)
        .eq("factory_id", profile!.factory_id!)
        .eq("created_by", user!.id)
        .order("production_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each sheet, get hourly logs with data
      const sheetsWithLogs = await Promise.all(
        (sheetsData || []).map(async (sheet) => {
          const { data: logs, count } = await supabase
            .from("finishing_hourly_logs")
            .select("*", { count: "exact" })
            .eq("sheet_id", sheet.id);

          return {
            ...sheet,
            hourly_logs_count: count || 0,
            hourly_logs: logs || [],
          };
        })
      );

      setSheets(sheetsWithLogs as FinishingSheet[]);
    } catch (error) {
      console.error("Error fetching sheets:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    let totalOTHoursThisWeek = 0;
    let totalTargetSum = 0;
    let totalActualSum = 0;
    let totalHoursCount = 0;

    sheets.forEach((sheet) => {
      const sheetDate = parseISO(sheet.production_date);
      const isThisWeek = isWithinInterval(sheetDate, { start: weekStart, end: weekEnd });

      sheet.hourly_logs.forEach((log) => {
        // Count OT hours this week
        if (isThisWeek && log.hour_slot.startsWith("OT-")) {
          totalOTHoursThisWeek++;
        }

        // Sum all targets and actuals for averages (using carton as the main metric)
        const hourTarget =
          log.thread_cutting_target +
          log.inside_check_target +
          log.top_side_check_target +
          log.buttoning_target +
          log.iron_target +
          log.get_up_target +
          log.poly_target +
          log.carton_target;

        const hourActual =
          log.thread_cutting_actual +
          log.inside_check_actual +
          log.top_side_check_actual +
          log.buttoning_actual +
          log.iron_actual +
          log.get_up_actual +
          log.poly_actual +
          log.carton_actual;

        totalTargetSum += hourTarget;
        totalActualSum += hourActual;
        totalHoursCount++;
      });
    });

    return {
      otHoursThisWeek: totalOTHoursThisWeek,
      avgHourlyTarget: totalHoursCount > 0 ? Math.round(totalTargetSum / totalHoursCount) : 0,
      avgHourlyActual: totalHoursCount > 0 ? Math.round(totalActualSum / totalHoursCount) : 0,
    };
  }, [sheets]);

  // Filtered sheets
  const filteredSheets = useMemo(() => {
    let result = sheets;

    // Date filter
    if (dateFilter === "today") {
      result = result.filter((s) => isToday(parseISO(s.production_date)));
    } else if (dateFilter === "week") {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      result = result.filter((s) =>
        isWithinInterval(parseISO(s.production_date), { start: weekStart, end: weekEnd })
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.po_no?.toLowerCase().includes(query) ||
          s.style?.toLowerCase().includes(query) ||
          s.buyer?.toLowerCase().includes(query) ||
          s.line?.line_id?.toLowerCase().includes(query) ||
          s.line?.name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [sheets, dateFilter, searchQuery]);

  const handleViewSheet = (sheet: FinishingSheet) => {
    navigate(`/finishing/daily-sheet?line=${sheet.line_id}&po=${sheet.work_order_id}`);
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
        <Button onClick={() => navigate("/finishing/daily-sheet")}>
          + New Daily Sheet
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Timer className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">OT Hours This Week</p>
                <p className="text-2xl font-bold">{stats.otHoursThisWeek}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Hourly Target</p>
                <p className="text-2xl font-bold">{stats.avgHourlyTarget.toLocaleString()}</p>
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
                <p className="text-sm text-muted-foreground">Avg Hourly Actual</p>
                <p className="text-2xl font-bold">{stats.avgHourlyActual.toLocaleString()}</p>
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
          <CardTitle>Submission History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSheets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No submissions found</p>
              <p className="text-sm mt-2">
                {searchQuery || dateFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Create a new daily sheet to start logging hourly production"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead>PO / Style</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead className="text-center">Hours Logged</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSheets.map((sheet) => {
                  const date = parseISO(sheet.production_date);
                  const isTodaySheet = isToday(date);
                  const hoursProgress = sheet.hourly_logs_count;
                  const otHours = sheet.hourly_logs.filter((l) =>
                    l.hour_slot.startsWith("OT-")
                  ).length;

                  return (
                    <TableRow key={sheet.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{format(date, "MMM dd, yyyy")}</span>
                          {isTodaySheet && (
                            <Badge variant="secondary" className="text-xs">
                              Today
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {sheet.line?.line_id || "—"}
                        </span>
                        {sheet.line?.name && (
                          <span className="text-muted-foreground ml-1">
                            ({sheet.line.name})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {sheet.po_no || sheet.work_order?.po_number || "—"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {sheet.style || sheet.work_order?.style || "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {sheet.buyer || sheet.work_order?.buyer || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Badge
                            variant={
                              hoursProgress >= 10
                                ? "default"
                                : hoursProgress > 0
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {hoursProgress}
                          </Badge>
                          {otHours > 0 && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              +{otHours} OT
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewSheet(sheet)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {isTodaySheet ? "Continue" : "View"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}