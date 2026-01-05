import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, TrendingUp, TrendingDown, Minus, Factory, Package, ChevronLeft, ChevronRight } from "lucide-react";

interface DailyStats {
  date: string;
  dayName: string;
  sewingTarget: number;
  sewingOutput: number;
  finishingTarget: number;
  finishingQcPass: number;
  sewingUpdates: number;
  finishingUpdates: number;
  blockers: number;
}

export default function ThisWeek() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week, etc.
  const [weekStats, setWeekStats] = useState<DailyStats[]>([]);
  const [totals, setTotals] = useState({
    sewingOutput: 0,
    finishingQcPass: 0,
    totalUpdates: 0,
    totalBlockers: 0,
  });

  useEffect(() => {
    if (profile?.factory_id) {
      fetchWeekData();
    }
  }, [profile?.factory_id, weekOffset]);

  async function fetchWeekData() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      const today = new Date();
      const currentWeekStart = new Date(today);
      currentWeekStart.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
      
      // Apply week offset
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() + (weekOffset * 7));
      const days: DailyStats[] = [];
      let totalSewing = 0;
      let totalFinishing = 0;
      let totalUpdates = 0;
      let totalBlockers = 0;

      for (let i = 0; i <= 6; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (date > today) {
          days.push({
            date: dateStr,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            sewingTarget: 0,
            sewingOutput: 0,
            finishingTarget: 0,
            finishingQcPass: 0,
            sewingUpdates: 0,
            finishingUpdates: 0,
            blockers: 0,
          });
          continue;
        }

        const [sewingRes, finishingRes, sewingTargetsRes, finishingTargetsRes] = await Promise.all([
          supabase
            .from('production_updates_sewing')
            .select('output_qty, has_blocker')
            .eq('factory_id', profile.factory_id)
            .eq('production_date', dateStr),
          supabase
            .from('production_updates_finishing')
            .select('day_qc_pass, has_blocker')
            .eq('factory_id', profile.factory_id)
            .eq('production_date', dateStr),
          supabase
            .from('sewing_targets')
            .select('per_hour_target, manpower_planned')
            .eq('factory_id', profile.factory_id)
            .eq('production_date', dateStr),
          supabase
            .from('finishing_targets')
            .select('per_hour_target, m_power_planned, day_hour_planned')
            .eq('factory_id', profile.factory_id)
            .eq('production_date', dateStr),
        ]);

        const sewingData = sewingRes.data || [];
        const finishingData = finishingRes.data || [];
        const sewingTargetsData = sewingTargetsRes.data || [];
        const finishingTargetsData = finishingTargetsRes.data || [];

        const daySewingOutput = sewingData.reduce((sum, u) => sum + (u.output_qty || 0), 0);
        const dayFinishingQc = finishingData.reduce((sum, u) => sum + (u.day_qc_pass || 0), 0);
        const dayBlockers = sewingData.filter(u => u.has_blocker).length + finishingData.filter(u => u.has_blocker).length;

        // Calculate targets (per_hour_target * 8 hours as daily estimate)
        const daySewingTarget = sewingTargetsData.reduce((sum, t) => sum + ((t.per_hour_target || 0) * 8), 0);
        const dayFinishingTarget = finishingTargetsData.reduce((sum, t) => sum + ((t.per_hour_target || 0) * (t.day_hour_planned || 8)), 0);

        totalSewing += daySewingOutput;
        totalFinishing += dayFinishingQc;
        totalUpdates += sewingData.length + finishingData.length;
        totalBlockers += dayBlockers;

        days.push({
          date: dateStr,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          sewingTarget: daySewingTarget,
          sewingOutput: daySewingOutput,
          finishingTarget: dayFinishingTarget,
          finishingQcPass: dayFinishingQc,
          sewingUpdates: sewingData.length,
          finishingUpdates: finishingData.length,
          blockers: dayBlockers,
        });
      }

      setWeekStats(days);
      setTotals({
        sewingOutput: totalSewing,
        finishingQcPass: totalFinishing,
        totalUpdates,
        totalBlockers,
      });
    } catch (error) {
      console.error('Error fetching week data:', error);
    } finally {
      setLoading(false);
    }
  }

  const maxSewing = Math.max(...weekStats.map(d => Math.max(d.sewingOutput, d.sewingTarget)), 1);
  const maxFinishing = Math.max(...weekStats.map(d => Math.max(d.finishingQcPass, d.finishingTarget)), 1);

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return { icon: Minus, color: 'text-muted-foreground' };
    const change = ((current - previous) / previous) * 100;
    if (change > 5) return { icon: TrendingUp, color: 'text-success' };
    if (change < -5) return { icon: TrendingDown, color: 'text-destructive' };
    return { icon: Minus, color: 'text-muted-foreground' };
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  // Get week date range for display
  const getWeekRange = () => {
    const today = new Date();
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay());
    
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() + (weekOffset * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
  };

  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            {isCurrentWeek ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} Weeks Ago`}
          </h1>
          <p className="text-muted-foreground">{getWeekRange()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset(prev => prev - 1)}
            disabled={loading || weekOffset <= -4}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(0)}
            disabled={loading || isCurrentWeek}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setWeekOffset(prev => prev + 1)}
            disabled={loading || isCurrentWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Week Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Factory className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{totals.sewingOutput.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Sewing Output</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono">{totals.finishingQcPass.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total QC Pass</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{totals.totalUpdates}</p>
            <p className="text-xs text-muted-foreground">Total Updates</p>
          </CardContent>
        </Card>
        <Card className={totals.totalBlockers > 0 ? 'border-warning/30' : ''}>
          <CardContent className="p-4">
            <p className={`text-2xl font-bold ${totals.totalBlockers > 0 ? 'text-warning' : ''}`}>{totals.totalBlockers}</p>
            <p className="text-xs text-muted-foreground">Total Blockers</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown */}
      <Tabs defaultValue="sewing">
        <TabsList>
          <TabsTrigger value="sewing">Sewing Output</TabsTrigger>
          <TabsTrigger value="finishing">Finishing QC Pass</TabsTrigger>
        </TabsList>

        <TabsContent value="sewing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Sewing Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {weekStats.map((day, index) => {
                  const isToday = day.date === today;
                  const isFuture = new Date(day.date) > new Date();
                  const outputBarHeight = isFuture ? 0 : (day.sewingOutput / maxSewing) * 100;
                  const targetBarHeight = isFuture ? 0 : (day.sewingTarget / maxSewing) * 100;
                  const previousDay = weekStats[index - 1];
                  const trend = previousDay && !isFuture ? getTrend(day.sewingOutput, previousDay.sewingOutput) : null;
                  const TrendIcon = trend?.icon;
                  
                  return (
                    <div key={day.date} className={`text-center ${isToday ? 'bg-primary/5 rounded-lg p-2 -m-2' : ''}`}>
                      <p className={`text-xs font-medium mb-2 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {day.dayName}
                      </p>
                      <div className="h-24 flex items-end justify-center gap-1 mb-2">
                        <div
                          className={`w-3 rounded-t transition-all ${isFuture ? 'bg-muted' : 'bg-muted-foreground/30'}`}
                          style={{ height: `${Math.max(targetBarHeight, 4)}%` }}
                          title={`Target: ${day.sewingTarget.toLocaleString()}`}
                        />
                        <div
                          className={`w-5 rounded-t transition-all ${isFuture ? 'bg-muted' : isToday ? 'bg-primary' : 'bg-primary/60'}`}
                          style={{ height: `${Math.max(outputBarHeight, 4)}%` }}
                          title={`Output: ${day.sewingOutput.toLocaleString()}`}
                        />
                      </div>
                      <p className={`text-sm font-mono font-bold ${isFuture ? 'text-muted-foreground' : ''}`}>
                        {isFuture ? '-' : day.sewingOutput.toLocaleString()}
                      </p>
                      {TrendIcon && !isFuture && index > 0 && (
                        <TrendIcon className={`h-3 w-3 mx-auto mt-1 ${trend?.color}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-muted-foreground/30" />
                  <span>Target</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary/60" />
                  <span>Output</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finishing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily Finishing QC Pass</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {weekStats.map((day, index) => {
                  const isToday = day.date === today;
                  const isFuture = new Date(day.date) > new Date();
                  const outputBarHeight = isFuture ? 0 : (day.finishingQcPass / maxFinishing) * 100;
                  const targetBarHeight = isFuture ? 0 : (day.finishingTarget / maxFinishing) * 100;
                  const previousDay = weekStats[index - 1];
                  const trend = previousDay && !isFuture ? getTrend(day.finishingQcPass, previousDay.finishingQcPass) : null;
                  const TrendIcon = trend?.icon;
                  
                  return (
                    <div key={day.date} className={`text-center ${isToday ? 'bg-info/5 rounded-lg p-2 -m-2' : ''}`}>
                      <p className={`text-xs font-medium mb-2 ${isToday ? 'text-info' : 'text-muted-foreground'}`}>
                        {day.dayName}
                      </p>
                      <div className="h-24 flex items-end justify-center gap-1 mb-2">
                        <div
                          className={`w-3 rounded-t transition-all ${isFuture ? 'bg-muted' : 'bg-muted-foreground/30'}`}
                          style={{ height: `${Math.max(targetBarHeight, 4)}%` }}
                          title={`Target: ${day.finishingTarget.toLocaleString()}`}
                        />
                        <div
                          className={`w-5 rounded-t transition-all ${isFuture ? 'bg-muted' : isToday ? 'bg-info' : 'bg-info/60'}`}
                          style={{ height: `${Math.max(outputBarHeight, 4)}%` }}
                          title={`QC Pass: ${day.finishingQcPass.toLocaleString()}`}
                        />
                      </div>
                      <p className={`text-sm font-mono font-bold ${isFuture ? 'text-muted-foreground' : ''}`}>
                        {isFuture ? '-' : day.finishingQcPass.toLocaleString()}
                      </p>
                      {TrendIcon && !isFuture && index > 0 && (
                        <TrendIcon className={`h-3 w-3 mx-auto mt-1 ${trend?.color}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-muted-foreground/30" />
                  <span>Target</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-info/60" />
                  <span>QC Pass</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Daily Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Day</th>
                  <th className="text-right py-2 font-medium">Sewing Output</th>
                  <th className="text-right py-2 font-medium">QC Pass</th>
                  <th className="text-right py-2 font-medium">Updates</th>
                  <th className="text-right py-2 font-medium">Blockers</th>
                </tr>
              </thead>
              <tbody>
                {weekStats.map((day) => {
                  const isToday = day.date === today;
                  const isFuture = new Date(day.date) > new Date();
                  return (
                    <tr key={day.date} className={`border-b ${isToday ? 'bg-primary/5' : ''} ${isFuture ? 'text-muted-foreground' : ''}`}>
                      <td className="py-3">
                        <span className="font-medium">{day.dayName}</span>
                        {isToday && <span className="ml-2 text-xs text-primary">(Today)</span>}
                      </td>
                      <td className="text-right font-mono">{isFuture ? '-' : day.sewingOutput.toLocaleString()}</td>
                      <td className="text-right font-mono">{isFuture ? '-' : day.finishingQcPass.toLocaleString()}</td>
                      <td className="text-right">{isFuture ? '-' : day.sewingUpdates + day.finishingUpdates}</td>
                      <td className={`text-right ${day.blockers > 0 ? 'text-warning font-medium' : ''}`}>
                        {isFuture ? '-' : day.blockers}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
