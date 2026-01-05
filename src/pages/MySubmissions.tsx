import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Loader2, FileText, AlertCircle, Calendar, CheckCircle2, XCircle, Filter, CalendarIcon, Target, Package, TrendingUp, TrendingDown, Clock, Crosshair, ClipboardCheck } from "lucide-react";
import { format, subDays, startOfDay, isWithinInterval, parseISO } from "date-fns";
import { SubmissionDetailModal } from "@/components/SubmissionDetailModal";
import { cn } from "@/lib/utils";

interface SewingSubmission {
  id: string;
  production_date: string;
  submitted_at: string;
  line_id: string;
  output_qty: number;
  target_qty: number | null;
  reject_qty: number | null;
  rework_qty: number | null;
  has_blocker: boolean | null;
  blocker_impact: string | null;
  buyer_name: string | null;
  style_code: string | null;
  po_number: string | null;
  lines?: { line_id: string; name: string | null };
  submission_type: 'morning_target' | 'end_of_day';
}

interface FinishingSubmission {
  id: string;
  production_date: string;
  submitted_at: string;
  line_id: string;
  qc_pass_qty: number;
  day_poly: number | null;
  day_carton: number | null;
  has_blocker: boolean | null;
  blocker_impact: string | null;
  buyer_name: string | null;
  style_no: string | null;
  lines?: { line_id: string; name: string | null };
  submission_type: 'morning_target' | 'end_of_day';
}

interface MissedDay {
  date: string;
  lineId: string;
  lineName: string;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export default function MySubmissions() {
  const { profile, user, hasRole, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sewing" | "finishing">("sewing");
  
  // Filter states
  const [selectedLineId, setSelectedLineId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  // Data states
  const [sewingSubmissions, setSewingSubmissions] = useState<SewingSubmission[]>([]);
  const [finishingSubmissions, setFinishingSubmissions] = useState<FinishingSubmission[]>([]);
  const [totalSewingAllTime, setTotalSewingAllTime] = useState(0);
  const [totalFinishingAllTime, setTotalFinishingAllTime] = useState(0);
  const [missedDays, setMissedDays] = useState<MissedDay[]>([]);
  const [assignedLines, setAssignedLines] = useState<{id: string; name: string}[]>([]);
  
  // Today's data for workers
  const [todaysDailyTarget, setTodaysDailyTarget] = useState(0);
  const [todaysOutput, setTodaysOutput] = useState(0);
  
  // Deadline times
  const [morningTargetCutoff, setMorningTargetCutoff] = useState<string | null>(null);
  const [eveningActualCutoff, setEveningActualCutoff] = useState<string | null>(null);
  
  // Modal state
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Check if user is a worker
  const isWorker = (profile?.department != null) || (hasRole('worker') && !hasRole('supervisor') && !isAdminOrHigher());

  useEffect(() => {
    if (profile?.factory_id && user?.id) {
      fetchData();
    }
  }, [profile?.factory_id, user?.id]);

  async function fetchData() {
    if (!profile?.factory_id || !user?.id) return;
    setLoading(true);

    try {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Fetch all data in parallel
      const [
        sewingRes,
        finishingRes,
        sewingTargetsRes,
        finishingTargetsRes,
        sewingCountRes,
        finishingCountRes,
        lineAssignmentsRes,
        allLinesRes,
        todaySewingTargetsRes,
        todayFinishingTargetsRes,
        todaySewingActualsRes,
        todayFinishingActualsRes,
        factoryRes
      ] = await Promise.all([
        // Last 30 days sewing submissions (end of day)
        supabase
          .from('production_updates_sewing')
          .select('*, lines(line_id, name)')
          .eq('submitted_by', user.id)
          .gte('production_date', thirtyDaysAgo)
          .order('production_date', { ascending: false }),
        // Last 30 days finishing submissions (end of day)
        supabase
          .from('production_updates_finishing')
          .select('*, lines(line_id, name)')
          .eq('submitted_by', user.id)
          .gte('production_date', thirtyDaysAgo)
          .order('production_date', { ascending: false }),
        // Last 30 days sewing morning targets
        supabase
          .from('sewing_targets')
          .select('*, lines(line_id, name)')
          .eq('submitted_by', user.id)
          .gte('production_date', thirtyDaysAgo)
          .order('production_date', { ascending: false }),
        // Last 30 days finishing morning targets
        supabase
          .from('finishing_targets')
          .select('*, lines(line_id, name)')
          .eq('submitted_by', user.id)
          .gte('production_date', thirtyDaysAgo)
          .order('production_date', { ascending: false }),
        // All-time sewing count (both types)
        supabase
          .from('production_updates_sewing')
          .select('id', { count: 'exact', head: true })
          .eq('submitted_by', user.id),
        // All-time finishing count (both types)
        supabase
          .from('production_updates_finishing')
          .select('id', { count: 'exact', head: true })
          .eq('submitted_by', user.id),
        // User's assigned lines
        supabase
          .from('user_line_assignments')
          .select('line_id')
          .eq('user_id', user.id)
          .eq('factory_id', profile.factory_id),
        // All lines for reference
        supabase
          .from('lines')
          .select('id, line_id, name')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true),
        // Today's sewing targets (include hours to calculate daily target)
        supabase
          .from('sewing_targets')
          .select('per_hour_target, manpower_planned, ot_hours_planned')
          .eq('submitted_by', user.id)
          .eq('production_date', today),
        // Today's finishing targets (include hours to calculate daily target)
        supabase
          .from('finishing_targets')
          .select('per_hour_target, day_hour_planned, day_over_time_planned')
          .eq('submitted_by', user.id)
          .eq('production_date', today),
        // Today's sewing actuals (output)
        supabase
          .from('production_updates_sewing')
          .select('output_qty')
          .eq('submitted_by', user.id)
          .eq('production_date', today),
        // Today's finishing actuals (output)
        supabase
          .from('production_updates_finishing')
          .select('qc_pass_qty')
          .eq('submitted_by', user.id)
          .eq('production_date', today),
        // Factory settings for deadlines
        supabase
          .from('factory_accounts')
          .select('morning_target_cutoff, evening_actual_cutoff')
          .eq('id', profile.factory_id)
          .single()
      ]);

      // Set deadline times
      if (factoryRes.data) {
        setMorningTargetCutoff(factoryRes.data.morning_target_cutoff);
        setEveningActualCutoff(factoryRes.data.evening_actual_cutoff);
      }

      // Combine end-of-day and morning target submissions with type markers
      const sewingEndOfDay = (sewingRes.data || []).map(s => ({
        ...s,
        submission_type: 'end_of_day' as const
      }));
      const sewingMorning = (sewingTargetsRes.data || []).map(s => ({
        id: s.id,
        production_date: s.production_date,
        submitted_at: s.submitted_at,
        line_id: s.line_id,
        output_qty: 0, // Morning targets don't have output
        target_qty: s.per_hour_target,
        reject_qty: null,
        rework_qty: null,
        has_blocker: false,
        blocker_impact: null,
        buyer_name: s.buyer_name,
        style_code: s.style_code,
        po_number: null,
        lines: s.lines,
        submission_type: 'morning_target' as const
      }));
      
      const finishingEndOfDay = (finishingRes.data || []).map(s => ({
        ...s,
        submission_type: 'end_of_day' as const
      }));
      const finishingMorning = (finishingTargetsRes.data || []).map(s => ({
        id: s.id,
        production_date: s.production_date,
        submitted_at: s.submitted_at,
        line_id: s.line_id,
        qc_pass_qty: 0, // Morning targets don't have output
        day_poly: null,
        day_carton: null,
        has_blocker: false,
        blocker_impact: null,
        buyer_name: s.buyer_name,
        style_no: s.style_no,
        lines: s.lines,
        submission_type: 'morning_target' as const
      }));

      // Combine and sort by date/time
      const combinedSewing = [...sewingEndOfDay, ...sewingMorning].sort((a, b) => {
        const dateCompare = new Date(b.production_date).getTime() - new Date(a.production_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
      
      const combinedFinishing = [...finishingEndOfDay, ...finishingMorning].sort((a, b) => {
        const dateCompare = new Date(b.production_date).getTime() - new Date(a.production_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });

      setSewingSubmissions(combinedSewing);
      setFinishingSubmissions(combinedFinishing);
      setTotalSewingAllTime(sewingCountRes.count || 0);
      setTotalFinishingAllTime(finishingCountRes.count || 0);
      
      // Calculate today's daily target (hourly target × total hours for the day)
      // Sewing: use 8 standard hours + OT hours
      const sewingDailyTarget = (todaySewingTargetsRes.data || []).reduce((acc, t) => {
        const standardHours = 8; // Standard work hours
        const otHours = t.ot_hours_planned || 0;
        const totalHours = standardHours + otHours;
        return acc + ((t.per_hour_target || 0) * totalHours);
      }, 0);
      
      // Finishing: use day_hour_planned + OT hours
      const finishingDailyTarget = (todayFinishingTargetsRes.data || []).reduce((acc, t) => {
        const dayHours = t.day_hour_planned || 8;
        const otHours = t.day_over_time_planned || 0;
        const totalHours = dayHours + otHours;
        return acc + ((t.per_hour_target || 0) * totalHours);
      }, 0);
      
      setTodaysDailyTarget(profile.department === 'finishing' ? finishingDailyTarget : sewingDailyTarget);
      
      // Calculate today's output
      const sewingOutputSum = (todaySewingActualsRes.data || []).reduce((acc, s) => acc + (s.output_qty || 0), 0);
      const finishingOutputSum = (todayFinishingActualsRes.data || []).reduce((acc, s) => acc + (s.qc_pass_qty || 0), 0);
      setTodaysOutput(profile.department === 'finishing' ? finishingOutputSum : sewingOutputSum);

      // Calculate assigned lines
      const assignedLineIds = (lineAssignmentsRes.data || []).map(a => a.line_id);
      const allLines = allLinesRes.data || [];
      const userLines = assignedLineIds.length > 0 
        ? allLines.filter(l => assignedLineIds.includes(l.id))
        : allLines;
      
      setAssignedLines(userLines.map(l => ({ id: l.id, name: l.name || l.line_id })));

      // Calculate missed days (last 30 days where no submission was made for assigned lines)
      const allSubmissions = [...(sewingRes.data || []), ...(finishingRes.data || [])];
      const submittedDates = new Set(allSubmissions.map(s => `${s.production_date}-${s.line_id}`));
      
      const missed: MissedDay[] = [];
      const todayDate = startOfDay(new Date());
      
      for (let i = 1; i <= 30; i++) {
        const date = format(subDays(todayDate, i), 'yyyy-MM-dd');
        for (const line of userLines) {
          const key = `${date}-${line.id}`;
          if (!submittedDates.has(key)) {
            missed.push({
              date,
              lineId: line.id,
              lineName: line.name || line.line_id
            });
          }
        }
      }
      
      setMissedDays(missed);
      
      // Set default tab based on department
      if (profile.department === 'finishing') {
        setActiveTab('finishing');
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter submissions based on selected filters
  const filteredSewingSubmissions = useMemo(() => {
    return sewingSubmissions.filter(s => {
      // Line filter
      if (selectedLineId !== "all" && s.line_id !== selectedLineId) return false;
      
      // Date range filter
      if (dateRange.from && dateRange.to) {
        const date = parseISO(s.production_date);
        if (!isWithinInterval(date, { start: startOfDay(dateRange.from), end: startOfDay(dateRange.to) })) {
          return false;
        }
      }
      
      return true;
    });
  }, [sewingSubmissions, selectedLineId, dateRange]);

  const filteredFinishingSubmissions = useMemo(() => {
    return finishingSubmissions.filter(s => {
      // Line filter
      if (selectedLineId !== "all" && s.line_id !== selectedLineId) return false;
      
      // Date range filter
      if (dateRange.from && dateRange.to) {
        const date = parseISO(s.production_date);
        if (!isWithinInterval(date, { start: startOfDay(dateRange.from), end: startOfDay(dateRange.to) })) {
          return false;
        }
      }
      
      return true;
    });
  }, [finishingSubmissions, selectedLineId, dateRange]);

  const stats = {
    sewing: {
      last30Days: filteredSewingSubmissions.length,
      allTime: totalSewingAllTime,
      totalOutput: filteredSewingSubmissions.reduce((acc, s) => acc + (s.output_qty || 0), 0),
      withBlockers: filteredSewingSubmissions.filter(s => s.has_blocker).length,
    },
    finishing: {
      last30Days: filteredFinishingSubmissions.length,
      allTime: totalFinishingAllTime,
      totalOutput: filteredFinishingSubmissions.reduce((acc, s) => acc + (s.qc_pass_qty || 0), 0),
      withBlockers: filteredFinishingSubmissions.filter(s => s.has_blocker).length,
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Format time for display (e.g., "09:00" -> "9:00 AM")
  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">My Submissions</h1>
          <p className="text-muted-foreground">
            Track your production updates and submissions history
          </p>
        </div>
        
        {/* Deadline Times */}
        {(morningTargetCutoff || eveningActualCutoff) && (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {morningTargetCutoff && (
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Morning Target:</span>
                <span>{formatTime(morningTargetCutoff)}</span>
              </div>
            )}
            {eveningActualCutoff && (
              <div className="flex items-center gap-2 bg-warning/10 text-warning px-3 py-1.5 rounded-full">
                <Clock className="h-4 w-4" />
                <span className="font-medium">End of Day:</span>
                <span>{formatTime(eveningActualCutoff)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            
            {/* Line Filter */}
            <Select value={selectedLineId} onValueChange={setSelectedLineId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lines</SelectItem>
                {assignedLines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>

            {/* Reset Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedLineId("all");
                setDateRange({ from: subDays(new Date(), 30), to: new Date() });
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isWorker ? (
          <>
            {/* Today's Target Card */}
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Today's Target</p>
                    <p className="text-2xl font-bold">{todaysDailyTarget.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Daily output</p>
                  </div>
                  <Target className="h-8 w-8 text-primary/30" />
                </div>
              </CardContent>
            </Card>

            {/* Today's Output Card with Progress */}
            <Card className={cn(
              "border-l-4",
              todaysDailyTarget > 0 && todaysOutput >= todaysDailyTarget 
                ? "border-l-success" 
                : todaysOutput > 0 
                  ? "border-l-warning" 
                  : "border-l-muted"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Today's Output</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      todaysDailyTarget > 0 && todaysOutput >= todaysDailyTarget 
                        ? "text-success" 
                        : todaysOutput > 0 && todaysOutput < todaysDailyTarget 
                          ? "text-warning" 
                          : ""
                    )}>
                      {todaysOutput.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {todaysDailyTarget > 0 ? (
                        todaysOutput >= todaysDailyTarget ? (
                          <>
                            <TrendingUp className="h-3 w-3 text-success" />
                            <span className="text-xs text-success font-medium">On target</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-3 w-3 text-warning" />
                            <span className="text-xs text-warning font-medium">
                              {Math.round((todaysOutput / todaysDailyTarget) * 100)}% of target
                            </span>
                          </>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">No target set</span>
                      )}
                    </div>
                  </div>
                  <Package className={cn(
                    "h-8 w-8",
                    todaysDailyTarget > 0 && todaysOutput >= todaysDailyTarget 
                      ? "text-success/30" 
                      : todaysOutput > 0 
                        ? "text-warning/30" 
                        : "text-muted-foreground/30"
                  )} />
                </div>
                {/* Progress Bar */}
                {todaysDailyTarget > 0 && (
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        todaysOutput >= todaysDailyTarget ? "bg-success" : "bg-warning"
                      )}
                      style={{ 
                        width: `${Math.min((todaysOutput / todaysDailyTarget) * 100, 100)}%` 
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Filtered</p>
                    <p className="text-2xl font-bold">{stats[activeTab].last30Days}</p>
                    <p className="text-xs text-muted-foreground">Submissions</p>
                  </div>
                  <FileText className="h-8 w-8 text-primary/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-success">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">All Time</p>
                    <p className="text-2xl font-bold">{stats[activeTab].allTime}</p>
                    <p className="text-xs text-muted-foreground">Total submissions</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-success/30" />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Missed</p>
                <p className="text-2xl font-bold">{missedDays.length}</p>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </div>
              <AlertCircle className="h-8 w-8 text-warning/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Output</p>
                <p className="text-2xl font-bold">{stats[activeTab].totalOutput.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">In selected range</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-info/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Sewing/Finishing */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "sewing" | "finishing")}>
        <TabsList>
          <TabsTrigger value="sewing">Sewing ({filteredSewingSubmissions.length})</TabsTrigger>
          <TabsTrigger value="finishing">Finishing ({filteredFinishingSubmissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sewing" className="space-y-4">
          {filteredSewingSubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No sewing submissions found for the selected filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSewingSubmissions.map((submission) => (
                <Card 
                  key={`${submission.id}-${submission.submission_type}`} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedSubmission({ ...submission, type: 'sewing' });
                    setIsDetailOpen(true);
                  }}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center",
                          submission.submission_type === 'morning_target' 
                            ? "bg-warning/10" 
                            : "bg-primary/10"
                        )}>
                          {submission.submission_type === 'morning_target' ? (
                            <Crosshair className="h-5 w-5 text-warning" />
                          ) : (
                            <ClipboardCheck className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {submission.lines?.name || 'Unknown Line'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(submission.production_date), 'MMM d, yyyy')}
                            </Badge>
                            {submission.submission_type === 'morning_target' ? (
                              <Badge className="text-xs bg-warning/20 text-warning border-warning/30 hover:bg-warning/30">
                                <Crosshair className="h-3 w-3 mr-1" />
                                Morning Target
                              </Badge>
                            ) : (
                              <Badge className="text-xs bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">
                                <ClipboardCheck className="h-3 w-3 mr-1" />
                                End of Day
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {submission.po_number} • {submission.buyer_name} • {submission.style_code}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {submission.submission_type === 'morning_target' ? (
                            <>
                              <p className="font-semibold">{submission.target_qty?.toLocaleString() || 0}/hr</p>
                              <p className="text-xs text-muted-foreground">Target</p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold">{submission.output_qty?.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">Output</p>
                            </>
                          )}
                        </div>
                        {submission.has_blocker && (
                          <Badge variant="destructive" className="text-xs">
                            Blocker
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="finishing" className="space-y-4">
          {filteredFinishingSubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No finishing submissions found for the selected filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredFinishingSubmissions.map((submission) => (
                <Card 
                  key={`${submission.id}-${submission.submission_type}`} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setSelectedSubmission({ ...submission, type: 'finishing' });
                    setIsDetailOpen(true);
                  }}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center",
                          submission.submission_type === 'morning_target' 
                            ? "bg-warning/10" 
                            : "bg-info/10"
                        )}>
                          {submission.submission_type === 'morning_target' ? (
                            <Crosshair className="h-5 w-5 text-warning" />
                          ) : (
                            <ClipboardCheck className="h-5 w-5 text-info" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {submission.lines?.name || 'Unknown Line'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(submission.production_date), 'MMM d, yyyy')}
                            </Badge>
                            {submission.submission_type === 'morning_target' ? (
                              <Badge className="text-xs bg-warning/20 text-warning border-warning/30 hover:bg-warning/30">
                                <Crosshair className="h-3 w-3 mr-1" />
                                Morning Target
                              </Badge>
                            ) : (
                              <Badge className="text-xs bg-info/20 text-info border-info/30 hover:bg-info/30">
                                <ClipboardCheck className="h-3 w-3 mr-1" />
                                End of Day
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {submission.buyer_name} • {submission.style_no}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {submission.submission_type === 'morning_target' ? (
                            <>
                              <p className="font-semibold">Target Set</p>
                              <p className="text-xs text-muted-foreground">Morning</p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold">{submission.qc_pass_qty?.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">QC Pass</p>
                            </>
                          )}
                        </div>
                        {submission.has_blocker && (
                          <Badge variant="destructive" className="text-xs">
                            Blocker
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Missed Submissions Section */}
      {missedDays.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" />
              Missed Submissions ({missedDays.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {missedDays.slice(0, 10).map((missed, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-4 w-4 text-warning" />
                    <span className="font-medium">{missed.lineName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(missed.date), 'MMM d, yyyy')}
                  </span>
                </div>
              ))}
              {missedDays.length > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  +{missedDays.length - 10} more missed submissions
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onDeleted={fetchData}
          onUpdated={fetchData}
        />
      )}
    </div>
  );
}