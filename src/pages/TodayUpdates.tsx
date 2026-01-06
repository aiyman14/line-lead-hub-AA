import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Factory, Package, Search, Download, RefreshCw } from "lucide-react";
import { SubmissionDetailModal } from "@/components/SubmissionDetailModal";

interface SewingUpdate {
  id: string;
  line_id: string;
  output_qty: number;
  target_qty: number | null;
  manpower: number | null;
  reject_qty: number | null;
  rework_qty: number | null;
  stage_progress: number | null;
  ot_hours: number | null;
  ot_manpower: number | null;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  blocker_status: string | null;
  notes: string | null;
  submitted_at: string;
  production_date: string;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string } | null;
}

interface FinishingDailySheet {
  id: string;
  line_id: string;
  production_date: string;
  created_at: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string } | null;
  finishing_hourly_logs: Array<{
    id: string;
    hour_slot: string;
    poly_actual: number | null;
    carton_actual: number | null;
    thread_cutting_actual: number | null;
    inside_check_actual: number | null;
    top_side_check_actual: number | null;
    buttoning_actual: number | null;
    iron_actual: number | null;
    get_up_actual: number | null;
  }>;
}

type ModalSubmission = {
  id: string;
  type: 'sewing' | 'finishing';
  line_name: string;
  po_number: string | null;
  buyer?: string | null;
  style?: string | null;
  output_qty?: number;
  target_qty?: number | null;
  manpower?: number | null;
  reject_qty?: number | null;
  rework_qty?: number | null;
  stage_progress?: number | null;
  ot_hours?: number | null;
  ot_manpower?: number | null;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  blocker_status: string | null;
  notes?: string | null;
  submitted_at: string;
  production_date: string;
  // Finishing daily sheet specific
  hours_logged?: number;
  total_poly?: number;
  total_carton?: number;
};

export default function TodayUpdates() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sewingUpdates, setSewingUpdates] = useState<SewingUpdate[]>([]);
  const [finishingSheets, setFinishingSheets] = useState<FinishingDailySheet[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<ModalSubmission | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchTodayUpdates();
    }
  }, [profile?.factory_id]);

  async function fetchTodayUpdates() {
    if (!profile?.factory_id) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      const [sewingRes, finishingRes] = await Promise.all([
        supabase
          .from('production_updates_sewing')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style)')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today)
          .order('submitted_at', { ascending: false }),
        supabase
          .from('finishing_daily_sheets')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style), finishing_hourly_logs(*)')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today)
          .order('created_at', { ascending: false }),
      ]);

      setSewingUpdates(sewingRes.data || []);
      // Filter to only include sheets with at least 1 hour logged
      const sheetsWithLogs = (finishingRes.data || []).filter(
        (sheet: any) => (sheet.finishing_hourly_logs || []).length > 0
      );
      setFinishingSheets(sheetsWithLogs);
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredSewing = sewingUpdates.filter(u => 
    (u.lines?.name || u.lines?.line_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.work_orders?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFinishing = finishingSheets.filter(s =>
    (s.lines?.name || s.lines?.line_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.work_orders?.po_number || s.po_no || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutput = sewingUpdates.reduce((sum, u) => sum + (u.output_qty || 0), 0);
  const totalPoly = finishingSheets.reduce((sum, s) => 
    sum + (s.finishing_hourly_logs || []).reduce((logSum, l) => logSum + (l.poly_actual || 0), 0), 0
  );

  const handleSewingClick = (update: SewingUpdate) => {
    setSelectedSubmission({
      id: update.id,
      type: 'sewing',
      line_name: update.lines?.name || update.lines?.line_id || 'Unknown',
      po_number: update.work_orders?.po_number || null,
      buyer: update.work_orders?.buyer,
      style: update.work_orders?.style,
      output_qty: update.output_qty,
      target_qty: update.target_qty,
      manpower: update.manpower,
      reject_qty: update.reject_qty,
      rework_qty: update.rework_qty,
      stage_progress: update.stage_progress,
      ot_hours: update.ot_hours,
      ot_manpower: update.ot_manpower,
      has_blocker: update.has_blocker,
      blocker_description: update.blocker_description,
      blocker_impact: update.blocker_impact,
      blocker_owner: update.blocker_owner,
      blocker_status: update.blocker_status,
      notes: update.notes,
      submitted_at: update.submitted_at,
      production_date: update.production_date,
    });
    setDetailModalOpen(true);
  };

  const handleFinishingClick = (sheet: FinishingDailySheet) => {
    const logs = sheet.finishing_hourly_logs || [];
    const totalPoly = logs.reduce((sum, l) => sum + (l.poly_actual || 0), 0);
    const totalCarton = logs.reduce((sum, l) => sum + (l.carton_actual || 0), 0);
    
    setSelectedSubmission({
      id: sheet.id,
      type: 'finishing',
      line_name: sheet.lines?.name || sheet.lines?.line_id || 'Unknown',
      po_number: sheet.work_orders?.po_number || sheet.po_no || null,
      buyer: sheet.work_orders?.buyer || sheet.buyer,
      style: sheet.work_orders?.style || sheet.style,
      hours_logged: logs.length,
      total_poly: totalPoly,
      total_carton: totalCarton,
      has_blocker: false,
      blocker_description: null,
      blocker_impact: null,
      blocker_owner: null,
      blocker_status: null,
      submitted_at: sheet.created_at,
      production_date: sheet.production_date,
    });
    setDetailModalOpen(true);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Today's Updates</h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTodayUpdates}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Factory className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sewingUpdates.length}</p>
                <p className="text-xs text-muted-foreground">Sewing Updates</p>
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
                <p className="text-2xl font-bold">{finishingSheets.length}</p>
                <p className="text-xs text-muted-foreground">Finishing Sheets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-2xl font-bold font-mono">{totalOutput.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Sewing Output</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-2xl font-bold font-mono">{totalPoly.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Poly</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by line or PO..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({sewingUpdates.length + finishingSheets.length})</TabsTrigger>
          <TabsTrigger value="sewing">Sewing ({sewingUpdates.length})</TabsTrigger>
          <TabsTrigger value="finishing">Finishing ({finishingSheets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-4">
          {/* Sewing Table */}
          {filteredSewing.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="h-4 w-4 text-primary" />
                  Sewing Updates
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Output</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSewing.map((update) => (
                        <TableRow 
                          key={update.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSewingClick(update)}
                        >
                          <TableCell className="font-mono text-sm">{formatTime(update.submitted_at)}</TableCell>
                          <TableCell className="font-medium">{update.lines?.name || update.lines?.line_id}</TableCell>
                          <TableCell>{update.work_orders?.po_number || '-'}</TableCell>
                          <TableCell className="text-right font-mono">{update.output_qty.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{update.target_qty?.toLocaleString() || '-'}</TableCell>
                          <TableCell className="text-right">
                            {update.target_qty ? (
                              <span className={`font-medium ${(update.output_qty / update.target_qty) >= 1 ? 'text-success' : (update.output_qty / update.target_qty) >= 0.8 ? 'text-warning' : 'text-destructive'}`}>
                                {Math.round((update.output_qty / update.target_qty) * 100)}%
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {update.has_blocker ? (
                              <StatusBadge variant="danger" size="sm">Blocker</StatusBadge>
                            ) : (
                              <StatusBadge variant="success" size="sm">OK</StatusBadge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Finishing Table */}
          {filteredFinishing.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-info" />
                  Finishing Updates
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Hours Logged</TableHead>
                        <TableHead className="text-right">Total Poly</TableHead>
                        <TableHead className="text-right">Total Carton</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFinishing.map((sheet) => {
                        const logs = sheet.finishing_hourly_logs || [];
                        const polyTotal = logs.reduce((s, l) => s + (l.poly_actual || 0), 0);
                        const cartonTotal = logs.reduce((s, l) => s + (l.carton_actual || 0), 0);
                        return (
                          <TableRow 
                            key={sheet.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleFinishingClick(sheet)}
                          >
                            <TableCell className="font-mono text-sm">{formatTime(sheet.created_at)}</TableCell>
                            <TableCell className="font-medium">{sheet.lines?.name || sheet.lines?.line_id}</TableCell>
                            <TableCell>{sheet.work_orders?.po_number || sheet.po_no || '-'}</TableCell>
                            <TableCell className="text-right font-mono">{logs.length}</TableCell>
                            <TableCell className="text-right font-mono">{polyTotal.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{cartonTotal.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredSewing.length === 0 && filteredFinishing.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No updates found for today</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sewing" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Manpower</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSewing.map((update) => (
                      <TableRow 
                        key={update.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSewingClick(update)}
                      >
                        <TableCell className="font-mono text-sm">{formatTime(update.submitted_at)}</TableCell>
                        <TableCell className="font-medium">{update.lines?.name || update.lines?.line_id}</TableCell>
                        <TableCell>{update.work_orders?.po_number || '-'}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{update.output_qty.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{update.target_qty?.toLocaleString() || '-'}</TableCell>
                        <TableCell className="text-right">{update.manpower || '-'}</TableCell>
                        <TableCell className="text-right">{update.stage_progress ? `${update.stage_progress}%` : '-'}</TableCell>
                        <TableCell>
                          {update.has_blocker ? (
                            <StatusBadge variant="danger" size="sm">Blocker</StatusBadge>
                          ) : (
                            <StatusBadge variant="success" size="sm">OK</StatusBadge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSewing.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No sewing updates today
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finishing" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Hours Logged</TableHead>
                        <TableHead className="text-right">Total Poly</TableHead>
                        <TableHead className="text-right">Total Carton</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFinishing.map((sheet) => {
                        const logs = sheet.finishing_hourly_logs || [];
                        const polyTotal = logs.reduce((s, l) => s + (l.poly_actual || 0), 0);
                        const cartonTotal = logs.reduce((s, l) => s + (l.carton_actual || 0), 0);
                        return (
                          <TableRow 
                            key={sheet.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleFinishingClick(sheet)}
                          >
                            <TableCell className="font-mono text-sm">{formatTime(sheet.created_at)}</TableCell>
                            <TableCell className="font-medium">{sheet.lines?.name || sheet.lines?.line_id}</TableCell>
                            <TableCell>{sheet.work_orders?.po_number || sheet.po_no || '-'}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{logs.length}</TableCell>
                            <TableCell className="text-right font-mono">{polyTotal.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{cartonTotal.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredFinishing.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No finishing sheets today
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submission Detail Modal */}
      <SubmissionDetailModal
        submission={selectedSubmission as any}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onDeleted={fetchTodayUpdates}
        onUpdated={fetchTodayUpdates}
      />
    </div>
  );
}
