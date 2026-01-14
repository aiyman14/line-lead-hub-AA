import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinishingLogDetailModal } from "@/components/FinishingLogDetailModal";
import {
  Package,
  Clock,
  Plus,
  ChevronRight,
  ClipboardList,
  Target,
  TrendingUp,
} from "lucide-react";

interface DailyLogSummary {
  id: string;
  line_id: string;
  line_name: string;
  work_order_id: string | null;
  po_number: string | null;
  style: string | null;
  log_type: "TARGET" | "OUTPUT";
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
  submitted_at: string;
}

interface FinishingStats {
  totalTargets: number;
  totalOutputs: number;
  totalPoly: number;
  totalCarton: number;
}

export function FinishingDashboard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [logs, setLogs] = useState<DailyLogSummary[]>([]);
  const [stats, setStats] = useState<FinishingStats>({
    totalTargets: 0,
    totalOutputs: 0,
    totalPoly: 0,
    totalCarton: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"targets" | "outputs">("targets");
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFinishingData();
    }
  }, [profile?.factory_id]);

  async function fetchFinishingData() {
    if (!profile?.factory_id) return;
    
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Fetch today's daily logs from new table
      const { data: logsData } = await supabase
        .from('finishing_daily_logs')
        .select('*, lines(id, line_id, name), work_orders(po_number, style)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today)
        .order('submitted_at', { ascending: false });

      // Format logs
      const formattedLogs: DailyLogSummary[] = (logsData || []).map((log: any) => ({
        id: log.id,
        line_id: log.lines?.line_id || 'Unknown',
        line_name: log.lines?.name || log.lines?.line_id || 'Unknown',
        work_order_id: log.work_order_id,
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
      }));

      // Calculate stats
      const targets = formattedLogs.filter(l => l.log_type === 'TARGET');
      const outputs = formattedLogs.filter(l => l.log_type === 'OUTPUT');
      
      const totalStats: FinishingStats = {
        totalTargets: targets.length,
        totalOutputs: outputs.length,
        totalPoly: outputs.reduce((sum, l) => sum + l.poly, 0),
        totalCarton: outputs.reduce((sum, l) => sum + l.carton, 0),
      };

      setLogs(formattedLogs);
      setStats(totalStats);
    } catch (error) {
      console.error('Error fetching finishing data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString(i18n.language === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredLogs = logs.filter(log => 
    activeTab === "targets" ? log.log_type === "TARGET" : log.log_type === "OUTPUT"
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

        <TabsContent value={activeTab} className="mt-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Today's Submissions</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-3xl font-bold">{stats.totalTargets}</p>
                    <p className="text-sm text-muted-foreground">Targets Set</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{stats.totalOutputs}</p>
                    <p className="text-sm text-muted-foreground">Outputs Logged</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Today's Output</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-3xl font-bold text-success">{stats.totalPoly.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Poly Packed</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-warning">{stats.totalCarton.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Cartons Packed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Logs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Today's {activeTab === "targets" ? "Targets" : "Outputs"}
              </CardTitle>
              <div className="flex gap-2">
                <Link to={activeTab === "targets" ? "/finishing/daily-target" : "/finishing/daily-output"}>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New {activeTab === "targets" ? "Target" : "Output"}
                  </Button>
                </Link>
                <Link to="/finishing/my-submissions">
                  <Button variant="ghost" size="sm">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {filteredLogs.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      onClick={() => {
                        setSelectedLog({
                          id: log.id,
                          production_date: new Date().toISOString().split('T')[0],
                          line_id: log.line_id,
                          work_order_id: log.work_order_id,
                          log_type: log.log_type,
                          shift: null,
                          thread_cutting: log.thread_cutting,
                          inside_check: log.inside_check,
                          top_side_check: log.top_side_check,
                          buttoning: log.buttoning,
                          iron: log.iron,
                          get_up: log.get_up,
                          poly: log.poly,
                          carton: log.carton,
                          remarks: null,
                          submitted_at: log.submitted_at,
                          is_locked: false,
                          line: {
                            line_id: log.line_id,
                            name: log.line_name,
                          },
                          work_order: log.po_number ? {
                            po_number: log.po_number,
                            style: log.style || '',
                            buyer: '',
                          } : null,
                        });
                        setDetailModalOpen(true);
                      }}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          {activeTab === "targets" ? (
                            <Target className="h-6 w-6 text-primary" />
                          ) : (
                            <Package className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{log.line_name}</span>
                            <Badge variant={activeTab === "targets" ? "secondary" : "default"} className="text-xs">
                              {activeTab === "targets" ? "Target" : "Output"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {log.po_number || 'No PO'} • {log.style || 'No Style'}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            Submitted {formatTime(log.submitted_at)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex gap-4">
                          <div>
                            <p className="font-mono font-bold text-lg text-success">{log.poly.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">poly</p>
                          </div>
                          <div>
                            <p className="font-mono font-bold text-lg text-warning">{log.carton.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">carton</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No {activeTab === "targets" ? "targets" : "outputs"} today</p>
                  <p className="text-sm mb-4">Start tracking finishing {activeTab === "targets" ? "targets" : "production"}</p>
                  <Link to={activeTab === "targets" ? "/finishing/daily-target" : "/finishing/daily-output"}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create {activeTab === "targets" ? "Target" : "Output"}
                    </Button>
                  </Link>
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
