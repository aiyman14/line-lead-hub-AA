import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, Target, Users, AlertTriangle, Factory, Package, BarChart3 } from "lucide-react";

interface InsightData {
  avgDailyOutput: number;
  avgDailyQcPass: number;
  avgEfficiency: number;
  topPerformingLine: string | null;
  totalBlockersThisMonth: number;
  avgManpower: number;
  daysWithData: number;
}

export default function Insights() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightData>({
    avgDailyOutput: 0,
    avgDailyQcPass: 0,
    avgEfficiency: 0,
    topPerformingLine: null,
    totalBlockersThisMonth: 0,
    avgManpower: 0,
    daysWithData: 0,
  });

  useEffect(() => {
    if (profile?.factory_id) {
      fetchInsights();
    }
  }, [profile?.factory_id]);

  async function fetchInsights() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      // Fetch this month's sewing data
      const { data: sewingData } = await supabase
        .from('production_updates_sewing')
        .select('production_date, output_qty, target_qty, manpower, has_blocker, line_id, lines(name, line_id)')
        .eq('factory_id', profile.factory_id)
        .gte('production_date', firstOfMonth)
        .lte('production_date', today);

      // Fetch this month's finishing data
      const { data: finishingData } = await supabase
        .from('production_updates_finishing')
        .select('production_date, day_qc_pass, m_power, has_blocker')
        .eq('factory_id', profile.factory_id)
        .gte('production_date', firstOfMonth)
        .lte('production_date', today);

      // Calculate insights
      const totalOutput = sewingData?.reduce((sum, u) => sum + (u.output_qty || 0), 0) || 0;
      const totalTarget = sewingData?.reduce((sum, u) => sum + (u.target_qty || 0), 0) || 0;
      const totalQcPass = finishingData?.reduce((sum, u) => sum + (u.day_qc_pass || 0), 0) || 0;
      const totalManpower = sewingData?.reduce((sum, u) => sum + (u.manpower || 0), 0) || 0;
      
      const uniqueDates = new Set([
        ...(sewingData || []).map(u => u.production_date),
        ...(finishingData || []).map(u => u.production_date),
      ]);
      const daysWithData = uniqueDates.size;

      // Calculate efficiency
      const avgEfficiency = totalTarget > 0 ? (totalOutput / totalTarget) * 100 : 0;

      // Find top performing line
      const lineOutput = new Map<string, { name: string; total: number }>();
      sewingData?.forEach(u => {
        const lineName = u.lines?.name || u.lines?.line_id || 'Unknown';
        const existing = lineOutput.get(u.line_id) || { name: lineName, total: 0 };
        lineOutput.set(u.line_id, { name: lineName, total: existing.total + (u.output_qty || 0) });
      });
      
      let topLine: string | null = null;
      let topOutput = 0;
      lineOutput.forEach((data, _) => {
        if (data.total > topOutput) {
          topOutput = data.total;
          topLine = data.name;
        }
      });

      // Count blockers
      const sewingBlockers = sewingData?.filter(u => u.has_blocker).length || 0;
      const finishingBlockers = finishingData?.filter(u => u.has_blocker).length || 0;

      setInsights({
        avgDailyOutput: daysWithData > 0 ? Math.round(totalOutput / daysWithData) : 0,
        avgDailyQcPass: daysWithData > 0 ? Math.round(totalQcPass / daysWithData) : 0,
        avgEfficiency: Math.round(avgEfficiency),
        topPerformingLine: topLine,
        totalBlockersThisMonth: sewingBlockers + finishingBlockers,
        avgManpower: sewingData && sewingData.length > 0 ? Math.round(totalManpower / sewingData.length) : 0,
        daysWithData,
      });
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  }

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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="h-6 w-6" />
          Insights
        </h1>
        <p className="text-muted-foreground">Production analytics and performance metrics</p>
      </div>

      {/* Period Selector */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">Showing data for: <strong>This Month</strong></span>
            <span className="text-xs text-muted-foreground">({insights.daysWithData} days with data)</span>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Factory className="h-4 w-4" />
              Avg Daily Sewing Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{insights.avgDailyOutput.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">pieces per day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Avg Daily QC Pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold font-mono">{insights.avgDailyQcPass.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">pieces per day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Avg Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${insights.avgEfficiency >= 90 ? 'text-success' : insights.avgEfficiency >= 70 ? 'text-warning' : 'text-destructive'}`}>
              {insights.avgEfficiency}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">vs target</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Avg Manpower
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{insights.avgManpower}</p>
            <p className="text-xs text-muted-foreground mt-1">workers per line</p>
          </CardContent>
        </Card>

        <Card className={insights.totalBlockersThisMonth > 10 ? 'border-warning/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Total Blockers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${insights.totalBlockersThisMonth > 10 ? 'text-warning' : ''}`}>
              {insights.totalBlockersThisMonth}
            </p>
            <p className="text-xs text-muted-foreground mt-1">this month</p>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Top Performing Line
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{insights.topPerformingLine || 'N/A'}</p>
            <p className="text-xs text-muted-foreground mt-1">highest output this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {insights.avgEfficiency >= 90 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10">
              <div className="h-8 w-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="font-medium text-success">Excellent Efficiency</p>
                <p className="text-sm text-muted-foreground">Your factory is performing above target. Keep up the great work!</p>
              </div>
            </div>
          )}
          
          {insights.avgEfficiency < 90 && insights.avgEfficiency >= 70 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10">
              <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
                <Target className="h-4 w-4 text-warning" />
              </div>
              <div>
                <p className="font-medium text-warning">Room for Improvement</p>
                <p className="text-sm text-muted-foreground">Efficiency is slightly below target. Review blocker trends to identify bottlenecks.</p>
              </div>
            </div>
          )}

          {insights.totalBlockersThisMonth > 10 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10">
              <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">High Blocker Count</p>
                <p className="text-sm text-muted-foreground">You have {insights.totalBlockersThisMonth} blockers this month. Consider reviewing the root causes.</p>
              </div>
            </div>
          )}

          {insights.daysWithData < 5 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
              <div className="h-8 w-8 rounded-full bg-muted-foreground/20 flex items-center justify-center shrink-0">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Limited Data</p>
                <p className="text-sm text-muted-foreground">More data is needed for accurate insights. Keep submitting daily updates!</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
