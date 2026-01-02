import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, TrendingUp, TrendingDown, Target, Users, AlertTriangle, 
  Factory, Package, BarChart3, Calendar, ArrowUp, ArrowDown, 
  Minus, Zap, Clock, CheckCircle2, XCircle, Activity, ChevronRight
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { PeriodComparison } from "@/components/insights/PeriodComparison";
import { LineDrillDown } from "@/components/insights/LineDrillDown";
import { ExportInsights } from "@/components/insights/ExportInsights";
import { EmailScheduleSettings } from "@/components/insights/EmailScheduleSettings";
import { LineEfficiencyTargets } from "@/components/insights/LineEfficiencyTargets";
import { NotificationPreferences } from "@/components/NotificationPreferences";

interface DailyData {
  date: string;
  displayDate: string;
  sewingOutput: number;
  sewingTarget: number;
  finishingQcPass: number;
  efficiency: number;
  blockers: number;
  manpower: number;
}

interface LinePerformance {
  lineName: string;
  lineId: string;
  totalOutput: number;
  totalTarget: number;
  efficiency: number;
  avgManpower: number;
  submissions: number;
  blockers: number;
}

interface BlockerBreakdown {
  type: string;
  count: number;
  impact: string;
}

interface WorkOrderProgress {
  poNumber: string;
  buyer: string;
  style: string;
  orderQty: number;
  totalOutput: number;
  progress: number;
  lineName: string | null;
}

interface InsightSummary {
  totalSewingOutput: number;
  totalFinishingQcPass: number;
  avgDailyOutput: number;
  avgDailyQcPass: number;
  avgEfficiency: number;
  totalBlockers: number;
  openBlockers: number;
  resolvedBlockers: number;
  avgManpower: number;
  daysWithData: number;
  topPerformingLine: string | null;
  worstPerformingLine: string | null;
  mostCommonBlockerType: string | null;
  efficiencyTrend: 'up' | 'down' | 'stable';
  outputTrend: 'up' | 'down' | 'stable';
  previousPeriodEfficiency: number;
  previousPeriodOutput: number;
}

interface PreviousPeriodData {
  totalOutput: number;
  totalQcPass: number;
  avgEfficiency: number;
  totalBlockers: number;
  avgManpower: number;
  daysWithData: number;
}

export default function Insights() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7' | '14' | '30'>('7');
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [linePerformance, setLinePerformance] = useState<LinePerformance[]>([]);
  const [blockerBreakdown, setBlockerBreakdown] = useState<BlockerBreakdown[]>([]);
  const [workOrderProgress, setWorkOrderProgress] = useState<WorkOrderProgress[]>([]);
  const [previousPeriodData, setPreviousPeriodData] = useState<PreviousPeriodData>({
    totalOutput: 0,
    totalQcPass: 0,
    avgEfficiency: 0,
    totalBlockers: 0,
    avgManpower: 0,
    daysWithData: 0,
  });
  const [summary, setSummary] = useState<InsightSummary>({
    totalSewingOutput: 0,
    totalFinishingQcPass: 0,
    avgDailyOutput: 0,
    avgDailyQcPass: 0,
    avgEfficiency: 0,
    totalBlockers: 0,
    openBlockers: 0,
    resolvedBlockers: 0,
    avgManpower: 0,
    daysWithData: 0,
    topPerformingLine: null,
    worstPerformingLine: null,
    mostCommonBlockerType: null,
    efficiencyTrend: 'stable',
    outputTrend: 'stable',
    previousPeriodEfficiency: 0,
    previousPeriodOutput: 0,
  });

  // Line drill-down state
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedLineName, setSelectedLineName] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (profile?.factory_id) {
      fetchInsights();
    }
  }, [profile?.factory_id, period]);

  async function fetchInsights() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      const now = new Date();
      const days = parseInt(period);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      // Store date range for drill-down
      setDateRange({ start: startDateStr, end: today });

      // Previous period for comparison
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);
      const prevStartDateStr = prevStartDate.toISOString().split('T')[0];

      // Fetch sewing data
      const { data: sewingData } = await supabase
        .from('production_updates_sewing')
        .select('*, lines(name, line_id), work_orders(po_number, buyer, style, order_qty), blocker_types(name)')
        .eq('factory_id', profile.factory_id)
        .gte('production_date', startDateStr)
        .lte('production_date', today)
        .order('production_date', { ascending: true });

      // Fetch previous period sewing data
      const { data: prevSewingData } = await supabase
        .from('production_updates_sewing')
        .select('output_qty, target_qty, manpower, has_blocker')
        .eq('factory_id', profile.factory_id)
        .gte('production_date', prevStartDateStr)
        .lt('production_date', startDateStr);

      // Fetch finishing data
      const { data: finishingData } = await supabase
        .from('production_updates_finishing')
        .select('*, lines(name, line_id), work_orders(po_number, buyer, style, order_qty), blocker_types(name)')
        .eq('factory_id', profile.factory_id)
        .gte('production_date', startDateStr)
        .lte('production_date', today)
        .order('production_date', { ascending: true });

      // Fetch previous period finishing data
      const { data: prevFinishingData } = await supabase
        .from('production_updates_finishing')
        .select('day_qc_pass, has_blocker')
        .eq('factory_id', profile.factory_id)
        .gte('production_date', prevStartDateStr)
        .lt('production_date', startDateStr);

      // Fetch work orders for progress tracking
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select('*, lines(name, line_id)')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true);

      // Process daily data
      const dailyMap = new Map<string, DailyData>();
      
      sewingData?.forEach(u => {
        const existing = dailyMap.get(u.production_date) || {
          date: u.production_date,
          displayDate: new Date(u.production_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sewingOutput: 0,
          sewingTarget: 0,
          finishingQcPass: 0,
          efficiency: 0,
          blockers: 0,
          manpower: 0,
        };
        existing.sewingOutput += u.output_qty || 0;
        existing.sewingTarget += u.target_qty || 0;
        if (u.has_blocker) existing.blockers += 1;
        existing.manpower += u.manpower || 0;
        dailyMap.set(u.production_date, existing);
      });

      finishingData?.forEach(u => {
        const existing = dailyMap.get(u.production_date) || {
          date: u.production_date,
          displayDate: new Date(u.production_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sewingOutput: 0,
          sewingTarget: 0,
          finishingQcPass: 0,
          efficiency: 0,
          blockers: 0,
          manpower: 0,
        };
        existing.finishingQcPass += u.day_qc_pass || 0;
        if (u.has_blocker) existing.blockers += 1;
        dailyMap.set(u.production_date, existing);
      });

      // Calculate daily efficiency
      const dailyDataArray = Array.from(dailyMap.values()).map(d => ({
        ...d,
        efficiency: d.sewingTarget > 0 ? Math.round((d.sewingOutput / d.sewingTarget) * 100) : 0,
      })).sort((a, b) => a.date.localeCompare(b.date));

      setDailyData(dailyDataArray);

      // Process line performance
      const lineMap = new Map<string, LinePerformance>();
      sewingData?.forEach(u => {
        const lineId = u.line_id;
        const lineName = u.lines?.name || u.lines?.line_id || 'Unknown';
        const existing = lineMap.get(lineId) || {
          lineName,
          lineId,
          totalOutput: 0,
          totalTarget: 0,
          efficiency: 0,
          avgManpower: 0,
          submissions: 0,
          blockers: 0,
        };
        existing.totalOutput += u.output_qty || 0;
        existing.totalTarget += u.target_qty || 0;
        existing.avgManpower += u.manpower || 0;
        existing.submissions += 1;
        if (u.has_blocker) existing.blockers += 1;
        lineMap.set(lineId, existing);
      });

      const linePerformanceArray = Array.from(lineMap.values()).map(l => ({
        ...l,
        efficiency: l.totalTarget > 0 ? Math.round((l.totalOutput / l.totalTarget) * 100) : 0,
        avgManpower: l.submissions > 0 ? Math.round(l.avgManpower / l.submissions) : 0,
      })).sort((a, b) => b.efficiency - a.efficiency);

      setLinePerformance(linePerformanceArray);

      // Process blocker breakdown
      const blockerMap = new Map<string, { count: number; impact: string }>();
      const allBlockers = [
        ...(sewingData?.filter(u => u.has_blocker) || []),
        ...(finishingData?.filter(u => u.has_blocker) || []),
      ];

      allBlockers.forEach(b => {
        const typeName = b.blocker_types?.name || 'Other';
        const existing = blockerMap.get(typeName) || { count: 0, impact: b.blocker_impact || 'medium' };
        existing.count += 1;
        blockerMap.set(typeName, existing);
      });

      const blockerBreakdownArray = Array.from(blockerMap.entries())
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.count - a.count);

      setBlockerBreakdown(blockerBreakdownArray);

      // Process work order progress
      const woProgressMap = new Map<string, WorkOrderProgress>();
      workOrders?.forEach(wo => {
        woProgressMap.set(wo.id, {
          poNumber: wo.po_number,
          buyer: wo.buyer,
          style: wo.style,
          orderQty: wo.order_qty,
          totalOutput: 0,
          progress: 0,
          lineName: wo.lines?.name || null,
        });
      });

      sewingData?.forEach(u => {
        if (u.work_order_id && woProgressMap.has(u.work_order_id)) {
          const wo = woProgressMap.get(u.work_order_id)!;
          wo.totalOutput += u.output_qty || 0;
          wo.progress = wo.orderQty > 0 ? Math.round((wo.totalOutput / wo.orderQty) * 100) : 0;
        }
      });

      const woProgressArray = Array.from(woProgressMap.values())
        .filter(wo => wo.totalOutput > 0)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 10);

      setWorkOrderProgress(woProgressArray);

      // Calculate summary
      const totalSewingOutput = sewingData?.reduce((sum, u) => sum + (u.output_qty || 0), 0) || 0;
      const totalSewingTarget = sewingData?.reduce((sum, u) => sum + (u.target_qty || 0), 0) || 0;
      const totalFinishingQcPass = finishingData?.reduce((sum, u) => sum + (u.day_qc_pass || 0), 0) || 0;
      const totalManpower = sewingData?.reduce((sum, u) => sum + (u.manpower || 0), 0) || 0;
      
      const prevTotalOutput = prevSewingData?.reduce((sum, u) => sum + (u.output_qty || 0), 0) || 0;
      const prevTotalTarget = prevSewingData?.reduce((sum, u) => sum + (u.target_qty || 0), 0) || 0;
      const prevTotalQcPass = prevFinishingData?.reduce((sum, u) => sum + (u.day_qc_pass || 0), 0) || 0;
      const prevEfficiency = prevTotalTarget > 0 ? (prevTotalOutput / prevTotalTarget) * 100 : 0;
      const prevTotalBlockers = (prevSewingData?.filter(u => u.has_blocker).length || 0) + (prevFinishingData?.filter(u => u.has_blocker).length || 0);
      const prevTotalManpower = prevSewingData?.reduce((sum, u) => sum + (u.manpower || 0), 0) || 0;
      const prevDaysWithData = new Set(prevSewingData?.map(u => u.output_qty) || []).size;

      // Set previous period data for comparison
      setPreviousPeriodData({
        totalOutput: prevTotalOutput,
        totalQcPass: prevTotalQcPass,
        avgEfficiency: Math.round(prevEfficiency),
        totalBlockers: prevTotalBlockers,
        avgManpower: prevSewingData && prevSewingData.length > 0 ? Math.round(prevTotalManpower / prevSewingData.length) : 0,
        daysWithData: prevDaysWithData,
      });

      const openBlockers = allBlockers.filter(b => b.blocker_status !== 'resolved').length;
      const resolvedBlockers = allBlockers.filter(b => b.blocker_status === 'resolved').length;

      const avgEfficiency = totalSewingTarget > 0 ? (totalSewingOutput / totalSewingTarget) * 100 : 0;
      
      let efficiencyTrend: 'up' | 'down' | 'stable' = 'stable';
      if (avgEfficiency > prevEfficiency + 5) efficiencyTrend = 'up';
      else if (avgEfficiency < prevEfficiency - 5) efficiencyTrend = 'down';

      let outputTrend: 'up' | 'down' | 'stable' = 'stable';
      if (totalSewingOutput > prevTotalOutput * 1.1) outputTrend = 'up';
      else if (totalSewingOutput < prevTotalOutput * 0.9) outputTrend = 'down';

      setSummary({
        totalSewingOutput,
        totalFinishingQcPass,
        avgDailyOutput: dailyDataArray.length > 0 ? Math.round(totalSewingOutput / dailyDataArray.length) : 0,
        avgDailyQcPass: dailyDataArray.length > 0 ? Math.round(totalFinishingQcPass / dailyDataArray.length) : 0,
        avgEfficiency: Math.round(avgEfficiency),
        totalBlockers: allBlockers.length,
        openBlockers,
        resolvedBlockers,
        avgManpower: sewingData && sewingData.length > 0 ? Math.round(totalManpower / sewingData.length) : 0,
        daysWithData: dailyDataArray.length,
        topPerformingLine: linePerformanceArray[0]?.lineName || null,
        worstPerformingLine: linePerformanceArray[linePerformanceArray.length - 1]?.lineName || null,
        mostCommonBlockerType: blockerBreakdownArray[0]?.type || null,
        efficiencyTrend,
        outputTrend,
        previousPeriodEfficiency: Math.round(prevEfficiency),
        previousPeriodOutput: prevTotalOutput,
      });

    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  }

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--info))', 'hsl(var(--success))'];

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <ArrowUp className="h-4 w-4 text-success" />;
    if (trend === 'down') return <ArrowDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const handleLineDrillDown = (lineId: string, lineName: string) => {
    setSelectedLineId(lineId);
    setSelectedLineName(lineName);
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
      {/* Line Drill-Down Modal */}
      {selectedLineId && profile?.factory_id && (
        <LineDrillDown
          lineId={selectedLineId}
          lineName={selectedLineName}
          factoryId={profile.factory_id}
          startDate={dateRange.start}
          endDate={dateRange.end}
          onClose={() => {
            setSelectedLineId(null);
            setSelectedLineName(null);
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Production Insights
          </h1>
          <p className="text-muted-foreground">Deep-dive analytics and performance trends</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as '7' | '14' | '30')}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <ExportInsights
            data={{
              summary: {
                totalSewingOutput: summary.totalSewingOutput,
                totalFinishingQcPass: summary.totalFinishingQcPass,
                avgEfficiency: summary.avgEfficiency,
                totalBlockers: summary.totalBlockers,
                openBlockers: summary.openBlockers,
                resolvedBlockers: summary.resolvedBlockers,
                avgManpower: summary.avgManpower,
                daysWithData: summary.daysWithData,
                topPerformingLine: summary.topPerformingLine,
                worstPerformingLine: summary.worstPerformingLine,
              },
              linePerformance: linePerformance.map(l => ({
                lineName: l.lineName,
                totalOutput: l.totalOutput,
                totalTarget: l.totalTarget,
                efficiency: l.efficiency,
                avgManpower: l.avgManpower,
                blockers: l.blockers,
              })),
              dailyData: dailyData.map(d => ({
                date: d.date,
                sewingOutput: d.sewingOutput,
                sewingTarget: d.sewingTarget,
                finishingQcPass: d.finishingQcPass,
                efficiency: d.efficiency,
                blockers: d.blockers,
              })),
              blockerBreakdown: blockerBreakdown.map(b => ({
                type: b.type,
                count: b.count,
              })),
              workOrderProgress: workOrderProgress.map(wo => ({
                poNumber: wo.poNumber,
                buyer: wo.buyer,
                style: wo.style,
                orderQty: wo.orderQty,
                totalOutput: wo.totalOutput,
                progress: wo.progress,
              })),
              periodDays: parseInt(period),
              exportDate: new Date().toISOString().split('T')[0],
              factoryName: profile?.factory_id || 'Unknown',
            }}
          />
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Factory className="h-4 w-4" />
              Total Sewing Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold font-mono">{summary.totalSewingOutput.toLocaleString()}</p>
              <TrendIcon trend={summary.outputTrend} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.avgDailyOutput.toLocaleString()} avg/day
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-info/5 rounded-bl-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total QC Pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{summary.totalFinishingQcPass.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.avgDailyQcPass.toLocaleString()} avg/day
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-success/5 rounded-bl-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Avg Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className={`text-3xl font-bold ${summary.avgEfficiency >= 90 ? 'text-success' : summary.avgEfficiency >= 70 ? 'text-warning' : 'text-destructive'}`}>
                {summary.avgEfficiency}%
              </p>
              <TrendIcon trend={summary.efficiencyTrend} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs {summary.previousPeriodEfficiency}% prev period
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-warning/5 rounded-bl-full" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Blockers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.totalBlockers}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                {summary.openBlockers} open
              </Badge>
              <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                {summary.resolvedBlockers} resolved
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period Comparison */}
      <PeriodComparison
        currentPeriod={{
          totalOutput: summary.totalSewingOutput,
          totalQcPass: summary.totalFinishingQcPass,
          avgEfficiency: summary.avgEfficiency,
          totalBlockers: summary.totalBlockers,
          avgManpower: summary.avgManpower,
          daysWithData: summary.daysWithData,
        }}
        previousPeriod={previousPeriodData}
        periodDays={parseInt(period)}
      />

      {/* Trends Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Trends
        </h2>

        {/* Output Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Daily Output & Efficiency Trend
            </CardTitle>
            <CardDescription>Sewing output vs target over time</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="displayDate" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Area type="monotone" dataKey="sewingOutput" name="Output" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorOutput)" strokeWidth={2} />
                  <Area type="monotone" dataKey="sewingTarget" name="Target" stroke="hsl(var(--muted-foreground))" fillOpacity={1} fill="url(#colorTarget)" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available for this period
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Efficiency Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-5 w-5 text-warning" />
                Daily Efficiency %
              </CardTitle>
              <CardDescription>Target achievement rate by day</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="displayDate" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 150]} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar 
                      dataKey="efficiency" 
                      name="Efficiency %" 
                      radius={[4, 4, 0, 0]}
                      fill="hsl(var(--primary))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No data available for this period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Finishing vs Sewing Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-info" />
                Sewing Output vs Finishing QC Pass
              </CardTitle>
              <CardDescription>Daily comparison of production stages</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="displayDate" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="sewingOutput" name="Sewing" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="finishingQcPass" name="Finishing QC" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No data available for this period
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lines Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Factory className="h-5 w-5 text-primary" />
          Line Performance
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Line Efficiency Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Line Performance Ranking
              </CardTitle>
              <CardDescription>Click on a line to see daily breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {linePerformance.length > 0 ? linePerformance.map((line, idx) => (
                <div 
                  key={line.lineId} 
                  className="space-y-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                  onClick={() => handleLineDrillDown(line.lineId, line.lineName)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-success/20 text-success' : 
                        idx === linePerformance.length - 1 ? 'bg-destructive/20 text-destructive' : 
                        'bg-muted text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-medium">{line.lineName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {line.totalOutput.toLocaleString()} pcs
                      </span>
                      <Badge variant={line.efficiency >= 90 ? 'default' : line.efficiency >= 70 ? 'secondary' : 'destructive'}>
                        {line.efficiency}%
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <Progress value={Math.min(line.efficiency, 100)} className="h-2" />
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  No line data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Output Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Output by Line
              </CardTitle>
              <CardDescription>Total output comparison</CardDescription>
            </CardHeader>
            <CardContent>
              {linePerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={linePerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis dataKey="lineName" type="category" width={50} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar 
                      dataKey="totalOutput" 
                      name="Output" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(data) => handleLineDrillDown(data.lineId, data.lineName)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No line data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Line Stats Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detailed Line Statistics</CardTitle>
            <CardDescription>Click on a row for daily breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Line</th>
                    <th className="text-right py-3 px-2 font-medium">Output</th>
                    <th className="text-right py-3 px-2 font-medium">Target</th>
                    <th className="text-right py-3 px-2 font-medium">Efficiency</th>
                    <th className="text-right py-3 px-2 font-medium">Avg MP</th>
                    <th className="text-right py-3 px-2 font-medium">Blockers</th>
                    <th className="text-right py-3 px-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {linePerformance.map(line => (
                    <tr 
                      key={line.lineId} 
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleLineDrillDown(line.lineId, line.lineName)}
                    >
                      <td className="py-3 px-2 font-medium">{line.lineName}</td>
                      <td className="py-3 px-2 text-right font-mono">{line.totalOutput.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-mono text-muted-foreground">{line.totalTarget.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right">
                        <Badge variant={line.efficiency >= 90 ? 'default' : line.efficiency >= 70 ? 'secondary' : 'destructive'}>
                          {line.efficiency}%
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right">{line.avgManpower}</td>
                      <td className="py-3 px-2 text-right">
                        {line.blockers > 0 ? (
                          <Badge variant="destructive" className="text-xs">{line.blockers}</Badge>
                        ) : (
                          <span className="text-success">0</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blockers Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Blockers Analysis
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Blocker Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Blocker Type Distribution
              </CardTitle>
              <CardDescription>Most common blocker categories</CardDescription>
            </CardHeader>
            <CardContent>
              {blockerBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={blockerBreakdown}
                      dataKey="count"
                      nameKey="type"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ type, count }) => `${type}: ${count}`}
                      labelLine={false}
                    >
                      {blockerBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-2 text-success" />
                  <p>No blockers in this period!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Blocker Summary Cards */}
          <div className="space-y-4">
            <Card className="border-success/30 bg-success/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-success">{summary.resolvedBlockers}</p>
                    <p className="text-sm text-muted-foreground">Blockers Resolved</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-warning">{summary.openBlockers}</p>
                    <p className="text-sm text-muted-foreground">Still Open</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {summary.mostCommonBlockerType && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                      <XCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-destructive">{summary.mostCommonBlockerType}</p>
                      <p className="text-sm text-muted-foreground">Most Common Issue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Blocker List */}
        {blockerBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Blocker Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {blockerBreakdown.map((blocker, idx) => (
                  <div key={blocker.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="font-medium">{blocker.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{blocker.count} occurrences</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Work Orders Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Work Order Progress
        </h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Orders and Completion Status</CardTitle>
          </CardHeader>
          <CardContent>
            {workOrderProgress.length > 0 ? (
              <div className="space-y-4">
                {workOrderProgress.map(wo => (
                  <div key={wo.poNumber} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{wo.poNumber}</p>
                        <p className="text-sm text-muted-foreground">{wo.buyer} • {wo.style}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold">{wo.totalOutput.toLocaleString()} / {wo.orderQty.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{wo.lineName || 'Unassigned'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(wo.progress, 100)} className="h-2 flex-1" />
                      <span className={`text-sm font-medium ${wo.progress >= 100 ? 'text-success' : wo.progress >= 50 ? 'text-warning' : 'text-muted-foreground'}`}>
                        {wo.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No work order progress data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card className="bg-gradient-to-br from-primary/5 via-transparent to-info/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Key Takeaways
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.topPerformingLine && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10">
              <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="font-medium text-success">Top Performer</p>
                <p className="text-sm text-muted-foreground">{summary.topPerformingLine} leads with highest efficiency</p>
              </div>
            </div>
          )}

          {summary.worstPerformingLine && summary.worstPerformingLine !== summary.topPerformingLine && linePerformance.length > 1 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10">
              <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                <TrendingDown className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="font-medium text-warning">Needs Attention</p>
                <p className="text-sm text-muted-foreground">{summary.worstPerformingLine} has lowest efficiency this period</p>
              </div>
            </div>
          )}

          {summary.efficiencyTrend === 'up' && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10">
              <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                <ArrowUp className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="font-medium text-success">Improving Trend</p>
                <p className="text-sm text-muted-foreground">Efficiency is up vs previous period</p>
              </div>
            </div>
          )}

          {summary.efficiencyTrend === 'down' && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
              <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <ArrowDown className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">Declining Trend</p>
                <p className="text-sm text-muted-foreground">Efficiency is down vs previous period</p>
              </div>
            </div>
          )}

          {summary.mostCommonBlockerType && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
              <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">Common Issue</p>
                <p className="text-sm text-muted-foreground">"{summary.mostCommonBlockerType}" is the top blocker type</p>
              </div>
            </div>
          )}

          {summary.daysWithData < 5 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <div className="h-8 w-8 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Limited Data</p>
                <p className="text-sm text-muted-foreground">Only {summary.daysWithData} days of data. Keep submitting for better insights!</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LineEfficiencyTargets 
          linePerformance={linePerformance.map(l => ({
            lineId: l.lineId,
            lineName: l.lineName,
            efficiency: l.efficiency,
          }))}
        />
        <EmailScheduleSettings />
      </div>

      {/* Notification Preferences */}
      <NotificationPreferences />
    </div>
  );
}
