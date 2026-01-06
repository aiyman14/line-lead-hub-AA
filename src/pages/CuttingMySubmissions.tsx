import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Loader2, FileText, CheckCircle2, Filter, CalendarIcon, Clock, Crosshair, ClipboardCheck, Scissors } from "lucide-react";
import { format, subDays, startOfDay, isWithinInterval, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface CuttingTarget {
  id: string;
  production_date: string;
  submitted_at: string;
  cutting_section_id: string;
  line_id: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  colour: string | null;
  order_qty: number | null;
  man_power: number;
  marker_capacity: number;
  lay_capacity: number;
  cutting_capacity: number;
  under_qty: number | null;
  lines?: { line_id: string; name: string | null };
  cutting_sections?: { cutting_no: string };
}

interface CuttingActual {
  id: string;
  production_date: string;
  submitted_at: string;
  cutting_section_id: string;
  line_id: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  colour: string | null;
  order_qty: number | null;
  day_cutting: number;
  total_cutting: number | null;
  day_input: number;
  total_input: number | null;
  balance: number | null;
  lines?: { line_id: string; name: string | null };
  cutting_sections?: { cutting_no: string };
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export default function CuttingMySubmissions() {
  const { t } = useTranslation();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"targets" | "actuals">("targets");
  
  // Filter states
  const [selectedLineId, setSelectedLineId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  
  // Data states
  const [cuttingTargets, setCuttingTargets] = useState<CuttingTarget[]>([]);
  const [cuttingActuals, setCuttingActuals] = useState<CuttingActual[]>([]);
  const [lines, setLines] = useState<{id: string; name: string}[]>([]);
  
  // Deadline times
  const [morningTargetCutoff, setMorningTargetCutoff] = useState<string | null>(null);
  const [eveningActualCutoff, setEveningActualCutoff] = useState<string | null>(null);

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
      
      const [
        targetsRes,
        actualsRes,
        linesRes,
        factoryRes
      ] = await Promise.all([
        supabase
          .from('cutting_targets')
          .select('*, lines(line_id, name), cutting_sections(cutting_no)')
          .eq('submitted_by', user.id)
          .gte('production_date', thirtyDaysAgo)
          .order('production_date', { ascending: false }),
        supabase
          .from('cutting_actuals')
          .select('*, lines(line_id, name), cutting_sections(cutting_no)')
          .eq('submitted_by', user.id)
          .gte('production_date', thirtyDaysAgo)
          .order('production_date', { ascending: false }),
        supabase
          .from('lines')
          .select('id, line_id, name')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true),
        supabase
          .from('factory_accounts')
          .select('morning_target_cutoff, evening_actual_cutoff')
          .eq('id', profile.factory_id)
          .single()
      ]);

      if (factoryRes.data) {
        setMorningTargetCutoff(factoryRes.data.morning_target_cutoff);
        setEveningActualCutoff(factoryRes.data.evening_actual_cutoff);
      }

      setCuttingTargets(targetsRes.data || []);
      setCuttingActuals(actualsRes.data || []);
      setLines((linesRes.data || []).map(l => ({ id: l.id, name: l.name || l.line_id })));
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTargets = useMemo(() => {
    return cuttingTargets.filter(s => {
      if (selectedLineId !== "all" && s.line_id !== selectedLineId) return false;
      if (dateRange.from && dateRange.to) {
        const date = parseISO(s.production_date);
        if (!isWithinInterval(date, { start: startOfDay(dateRange.from), end: startOfDay(dateRange.to) })) {
          return false;
        }
      }
      return true;
    });
  }, [cuttingTargets, selectedLineId, dateRange]);

  const filteredActuals = useMemo(() => {
    return cuttingActuals.filter(s => {
      if (selectedLineId !== "all" && s.line_id !== selectedLineId) return false;
      if (dateRange.from && dateRange.to) {
        const date = parseISO(s.production_date);
        if (!isWithinInterval(date, { start: startOfDay(dateRange.from), end: startOfDay(dateRange.to) })) {
          return false;
        }
      }
      return true;
    });
  }, [cuttingActuals, selectedLineId, dateRange]);

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Scissors className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Cutting Submissions</h1>
            <p className="text-muted-foreground">
              Track your cutting targets and daily reports
            </p>
          </div>
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
              <span className="text-sm font-medium">Filter:</span>
            </div>
            
            <Select value={selectedLineId} onValueChange={setSelectedLineId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Lines" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lines</SelectItem>
                {lines.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Targets</p>
                <p className="text-2xl font-bold">{filteredTargets.length}</p>
                <p className="text-xs text-muted-foreground">In selected range</p>
              </div>
              <Crosshair className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Actuals</p>
                <p className="text-2xl font-bold">{filteredActuals.length}</p>
                <p className="text-xs text-muted-foreground">In selected range</p>
              </div>
              <ClipboardCheck className="h-8 w-8 text-success/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Day Cutting</p>
                <p className="text-2xl font-bold">
                  {filteredActuals.reduce((acc, s) => acc + (s.day_cutting || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total pieces</p>
              </div>
              <Scissors className="h-8 w-8 text-info/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Day Input</p>
                <p className="text-2xl font-bold">
                  {filteredActuals.reduce((acc, s) => acc + (s.day_input || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total pieces</p>
              </div>
              <FileText className="h-8 w-8 text-warning/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "targets" | "actuals")}>
        <TabsList>
          <TabsTrigger value="targets">
            <Crosshair className="h-4 w-4 mr-2" />
            Morning Targets ({filteredTargets.length})
          </TabsTrigger>
          <TabsTrigger value="actuals">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            End of Day ({filteredActuals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="space-y-4">
          {filteredTargets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Crosshair className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No cutting targets found for the selected filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTargets.map((submission) => (
                <Card key={submission.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                          <Crosshair className="h-5 w-5 text-warning" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {submission.lines?.name || 'Unknown Line'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Cutting {submission.cutting_sections?.cutting_no}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(submission.production_date), 'MMM d, yyyy')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {submission.po_no} • {submission.buyer} • {submission.style}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="font-semibold">{submission.cutting_capacity}</p>
                          <p className="text-xs text-muted-foreground">Cutting Cap</p>
                        </div>
                        <div>
                          <p className="font-semibold">{submission.man_power}</p>
                          <p className="text-xs text-muted-foreground">Man Power</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="actuals" className="space-y-4">
          {filteredActuals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No cutting actuals found for the selected filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredActuals.map((submission) => (
                <Card key={submission.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                          <ClipboardCheck className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {submission.lines?.name || 'Unknown Line'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Cutting {submission.cutting_sections?.cutting_no}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(submission.production_date), 'MMM d, yyyy')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {submission.po_no} • {submission.buyer} • {submission.style}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="font-semibold">{submission.day_cutting?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Day Cutting</p>
                        </div>
                        <div>
                          <p className="font-semibold">{submission.day_input?.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Day Input</p>
                        </div>
                        <div>
                          <p className="font-semibold">{submission.balance?.toLocaleString() || 0}</p>
                          <p className="text-xs text-muted-foreground">Balance</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
