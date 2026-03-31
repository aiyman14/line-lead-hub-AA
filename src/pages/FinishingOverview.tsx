import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMidnightRefresh } from "@/hooks/useMidnightRefresh";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Clock, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { getTodayInTimezone } from "@/lib/date-utils";

interface SheetSummary {
  id: string;
  line_id: string;
  line_name: string;
  work_order_id: string;
  po_no: string;
  style: string;
  buyer: string;
  slots_submitted: number;
  has_targets: boolean;
  has_outputs: boolean;
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

export default function FinishingOverview() {
  const navigate = useNavigate();
  const { profile, factory, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [linesWithoutSheet, setLinesWithoutSheet] = useState<Line[]>([]);
  const [activeTab, setActiveTab] = useState<"targets" | "outputs">("targets");

  useEffect(() => {
    if (profile?.factory_id && isAdminOrHigher()) {
      fetchOverviewData();
    }
  }, [profile?.factory_id]);

  // Auto-refresh at midnight (factory timezone) and on tab refocus
  useMidnightRefresh(useCallback(() => {
    if (profile?.factory_id && isAdminOrHigher()) {
      fetchOverviewData();
    }
  }, [profile?.factory_id]));

  async function fetchOverviewData() {
    if (!profile?.factory_id) return;
    const today = getTodayInTimezone(factory?.timezone || "Asia/Dhaka");

    try {
      // Fetch all lines
      const { data: linesData } = await supabase
        .from("lines")
        .select("id, line_id, name")
        .eq("factory_id", profile.factory_id)
        .eq("is_active", true);

      setLines(linesData || []);

      // Fetch today's sheets with hourly log counts and data
      const { data: sheetsData, error } = await supabase
        .from("finishing_daily_sheets")
        .select(`
          id,
          line_id,
          work_order_id,
          po_no,
          style,
          buyer,
          finishing_hourly_logs(id, poly_target, poly_actual)
        `)
        .eq("factory_id", profile.factory_id)
        .eq("production_date", today);

      if (error) throw error;

      const summaries: SheetSummary[] = (sheetsData || []).map((sheet: any) => {
        const line = linesData?.find(l => l.id === sheet.line_id);
        const logs = sheet.finishing_hourly_logs || [];
        const hasTargets = logs.some((l: any) => (l.poly_target || 0) > 0);
        const hasOutputs = logs.some((l: any) => (l.poly_actual || 0) > 0);
        
        return {
          id: sheet.id,
          line_id: sheet.line_id,
          line_name: line?.name || line?.line_id || "Unknown",
          work_order_id: sheet.work_order_id,
          po_no: sheet.po_no || "-",
          style: sheet.style || "-",
          buyer: sheet.buyer || "-",
          slots_submitted: logs.length,
          has_targets: hasTargets,
          has_outputs: hasOutputs,
        };
      });

      setSheets(summaries);

      // Find lines without sheets today
      const linesWithSheets = new Set(summaries.map(s => s.line_id));
      setLinesWithoutSheet((linesData || []).filter(l => !linesWithSheets.has(l.id)));
    } catch (error) {
      console.error("Error fetching overview:", error);
      toast.error("Failed to load overview data");
    } finally {
      setLoading(false);
    }
  }

  if (!isAdminOrHigher()) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-muted-foreground">Access denied. Supervisor or Admin only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filter sheets based on active tab
  const filteredSheets = sheets.filter(s => 
    activeTab === "targets" ? s.has_targets : s.has_outputs
  );

  const totalSlotsPossible = filteredSheets.length * 10;
  const totalSlotsSubmitted = filteredSheets.reduce((acc, s) => acc + s.slots_submitted, 0);
  const overallProgress = totalSlotsPossible > 0 ? (totalSlotsSubmitted / totalSlotsPossible) * 100 : 0;

  const handleSheetClick = (sheet: SheetSummary) => {
    if (activeTab === "targets") {
      navigate(`/finishing/daily-target?line=${sheet.line_id}&po=${sheet.work_order_id}`);
    } else {
      navigate(`/finishing/daily-output?line=${sheet.line_id}&po=${sheet.work_order_id}`);
    }
  };

  return (
    <div className="container max-w-4xl py-4 px-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Finishing — Today Overview</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Tabs for Targets vs Outputs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "targets" | "outputs")} className="mb-6">
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

        <TabsContent value={activeTab} className="mt-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredSheets.length}</p>
                    <p className="text-sm text-muted-foreground">
                      Active {activeTab === "targets" ? "Target" : "Output"} Sheets
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/10 rounded-full">
                    <Clock className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalSlotsSubmitted} / {totalSlotsPossible}</p>
                    <p className="text-sm text-muted-foreground">Hours Logged</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 rounded-full">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{linesWithoutSheet.length}</p>
                    <p className="text-sm text-muted-foreground">Lines Without Sheet</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overall Progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Overall Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={overallProgress} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {overallProgress.toFixed(0)}% of expected hourly logs submitted
              </p>
            </CardContent>
          </Card>

          {/* Active Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {activeTab === "targets" ? (
                  <Target className="h-4 w-4 text-primary" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-primary" />
                )}
                Active {activeTab === "targets" ? "Target" : "Output"} Sheets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSheets.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No {activeTab === "targets" ? "target" : "output"} sheets created today
                </div>
              ) : (
                <div className="divide-y">
                  {filteredSheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="p-4 flex items-center justify-between hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleSheetClick(sheet)}
                    >
                      <div>
                        <p className="font-medium">{sheet.line_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {sheet.po_no} • {sheet.style} • {sheet.buyer}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            sheet.slots_submitted >= 10
                              ? "default"
                              : sheet.slots_submitted > 0
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {sheet.slots_submitted}/10 hours
                        </Badge>
                        <Progress value={(sheet.slots_submitted / 10) * 100} className="w-20 h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lines Without Sheet */}
          {linesWithoutSheet.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Lines Without Today's Sheet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {linesWithoutSheet.map((line) => (
                    <Badge key={line.id} variant="outline" className="text-amber-600 border-amber-300">
                      {line.name || line.line_id}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
