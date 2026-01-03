import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Factory, Package, Search, Download, RefreshCw, History, Calendar } from "lucide-react";
import { SubmissionDetailModal } from "@/components/SubmissionDetailModal";
import { toast } from "sonner";

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

interface FinishingUpdate {
  id: string;
  line_id: string;
  day_qc_pass: number | null;
  total_qc_pass: number | null;
  m_power: number | null;
  day_poly: number | null;
  total_poly: number | null;
  per_hour_target: number | null;
  average_production: number | null;
  day_over_time: number | null;
  total_over_time: number | null;
  day_hour: number | null;
  total_hour: number | null;
  day_carton: number | null;
  total_carton: number | null;
  order_quantity: number | null;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  blocker_status: string | null;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  buyer_name: string | null;
  style_no: string | null;
  item_name: string | null;
  unit_name: string | null;
  floor_name: string | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string } | null;
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
  buyer_name?: string | null;
  style_no?: string | null;
  item_name?: string | null;
  order_quantity?: number | null;
  unit_name?: string | null;
  floor_name?: string | null;
  m_power?: number | null;
  per_hour_target?: number | null;
  day_qc_pass?: number | null;
  total_qc_pass?: number | null;
  day_poly?: number | null;
  total_poly?: number | null;
  average_production?: number | null;
  day_over_time?: number | null;
  total_over_time?: number | null;
  day_hour?: number | null;
  total_hour?: number | null;
  day_carton?: number | null;
  total_carton?: number | null;
  remarks?: string | null;
};

export default function AllSubmissions() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sewingUpdates, setSewingUpdates] = useState<SewingUpdate[]>([]);
  const [finishingUpdates, setFinishingUpdates] = useState<FinishingUpdate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [dateRange, setDateRange] = useState("7");
  const [selectedSubmission, setSelectedSubmission] = useState<ModalSubmission | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchSubmissions();
    }
  }, [profile?.factory_id, dateRange]);

  async function fetchSubmissions() {
    if (!profile?.factory_id) return;
    setLoading(true);
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));

    try {
      const [sewingRes, finishingRes] = await Promise.all([
        supabase
          .from('production_updates_sewing')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('production_updates_finishing')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
      ]);

      setSewingUpdates(sewingRes.data || []);
      setFinishingUpdates(finishingRes.data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredSewing = sewingUpdates.filter(u => 
    (u.lines?.name || u.lines?.line_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.work_orders?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFinishing = finishingUpdates.filter(u =>
    (u.lines?.name || u.lines?.line_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.work_orders?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutput = sewingUpdates.reduce((sum, u) => sum + (u.output_qty || 0), 0);
  const totalQcPass = finishingUpdates.reduce((sum, u) => sum + (u.day_qc_pass || 0), 0);

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

  const handleFinishingClick = (update: FinishingUpdate) => {
    setSelectedSubmission({
      id: update.id,
      type: 'finishing',
      line_name: update.lines?.name || update.lines?.line_id || 'Unknown',
      po_number: update.work_orders?.po_number || null,
      buyer_name: update.buyer_name,
      style_no: update.style_no,
      item_name: update.item_name,
      order_quantity: update.order_quantity,
      unit_name: update.unit_name,
      floor_name: update.floor_name,
      m_power: update.m_power,
      per_hour_target: update.per_hour_target,
      day_qc_pass: update.day_qc_pass,
      total_qc_pass: update.total_qc_pass,
      day_poly: update.day_poly,
      total_poly: update.total_poly,
      average_production: update.average_production,
      day_over_time: update.day_over_time,
      total_over_time: update.total_over_time,
      day_hour: update.day_hour,
      total_hour: update.total_hour,
      day_carton: update.day_carton,
      total_carton: update.total_carton,
      remarks: update.remarks,
      has_blocker: update.has_blocker,
      blocker_description: update.blocker_description,
      blocker_impact: update.blocker_impact,
      blocker_owner: update.blocker_owner,
      blocker_status: update.blocker_status,
      submitted_at: update.submitted_at,
      production_date: update.production_date,
    });
    setDetailModalOpen(true);
  };

  const exportToCSV = (type: 'sewing' | 'finishing' | 'all') => {
    setExporting(true);
    try {
      const rows: string[][] = [];
      
      if (type === 'sewing' || type === 'all') {
        // Sewing header
        if (type === 'all') rows.push(['--- SEWING SUBMISSIONS ---']);
        rows.push(['ID', 'Date', 'Time', 'Line', 'PO Number', 'Buyer', 'Style', 'Output', 'Target', 'Efficiency %', 'Manpower', 'Reject', 'Rework', 'Progress %', 'OT Hours', 'Has Blocker', 'Notes']);
        
        filteredSewing.forEach(u => {
          const efficiency = u.target_qty ? Math.round((u.output_qty / u.target_qty) * 100) : 0;
          rows.push([
            u.id,
            formatDate(u.production_date),
            formatTime(u.submitted_at),
            u.lines?.name || u.lines?.line_id || '',
            u.work_orders?.po_number || '',
            u.work_orders?.buyer || '',
            u.work_orders?.style || '',
            u.output_qty.toString(),
            u.target_qty?.toString() || '',
            efficiency.toString(),
            u.manpower?.toString() || '',
            u.reject_qty?.toString() || '',
            u.rework_qty?.toString() || '',
            u.stage_progress?.toString() || '',
            u.ot_hours?.toString() || '',
            u.has_blocker ? 'Yes' : 'No',
            u.notes || '',
          ]);
        });
      }

      if (type === 'finishing' || type === 'all') {
        if (type === 'all') {
          rows.push(['']);
          rows.push(['--- FINISHING SUBMISSIONS ---']);
        }
        rows.push(['ID', 'Date', 'Time', 'Line', 'PO Number', 'Buyer', 'Style', 'Day QC Pass', 'Total QC Pass', 'Day Poly', 'Total Poly', 'M Power', 'Day Carton', 'Total Carton', 'Has Blocker', 'Remarks']);
        
        filteredFinishing.forEach(u => {
          rows.push([
            u.id,
            formatDate(u.production_date),
            formatTime(u.submitted_at),
            u.lines?.name || u.lines?.line_id || '',
            u.work_orders?.po_number || '',
            u.buyer_name || u.work_orders?.buyer || '',
            u.style_no || u.work_orders?.style || '',
            u.day_qc_pass?.toString() || '0',
            u.total_qc_pass?.toString() || '0',
            u.day_poly?.toString() || '0',
            u.total_poly?.toString() || '0',
            u.m_power?.toString() || '',
            u.day_carton?.toString() || '0',
            u.total_carton?.toString() || '0',
            u.has_blocker ? 'Yes' : 'No',
            u.remarks || '',
          ]);
        });
      }

      // Convert to CSV string
      const csvContent = rows.map(row => 
        row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `submissions_${type}_${dateRange}days_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Exported ${type === 'all' ? filteredSewing.length + filteredFinishing.length : type === 'sewing' ? filteredSewing.length : filteredFinishing.length} records`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            All Submissions
          </h1>
          <p className="text-muted-foreground">
            View and export historical submission data
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="21">Last 21 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchSubmissions}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => exportToCSV(activeTab === 'all' ? 'all' : activeTab as 'sewing' | 'finishing')}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Export CSV
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
                <p className="text-xs text-muted-foreground">Sewing Records</p>
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
                <p className="text-2xl font-bold">{finishingUpdates.length}</p>
                <p className="text-xs text-muted-foreground">Finishing Records</p>
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
              <p className="text-2xl font-bold font-mono">{totalQcPass.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total QC Pass</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by line, PO, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({sewingUpdates.length + finishingUpdates.length})</TabsTrigger>
          <TabsTrigger value="sewing">Sewing ({sewingUpdates.length})</TabsTrigger>
          <TabsTrigger value="finishing">Finishing ({finishingUpdates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-4">
          {/* Sewing Table */}
          {filteredSewing.length > 0 && (
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Factory className="h-4 w-4 text-primary" />
                  Sewing Submissions ({filteredSewing.length})
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => exportToCSV('sewing')}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
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
                      {filteredSewing.slice(0, 50).map((update) => (
                        <TableRow 
                          key={update.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSewingClick(update)}
                        >
                          <TableCell className="font-mono text-sm">{formatDate(update.production_date)}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{formatTime(update.submitted_at)}</TableCell>
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
                {filteredSewing.length > 50 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t">
                    Showing first 50 of {filteredSewing.length} records. Export to see all.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Finishing Table */}
          {filteredFinishing.length > 0 && (
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-info" />
                  Finishing Submissions ({filteredFinishing.length})
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => exportToCSV('finishing')}>
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Day QC</TableHead>
                        <TableHead className="text-right">Total QC</TableHead>
                        <TableHead className="text-right">Day Poly</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFinishing.slice(0, 50).map((update) => (
                        <TableRow 
                          key={update.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleFinishingClick(update)}
                        >
                          <TableCell className="font-mono text-sm">{formatDate(update.production_date)}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{formatTime(update.submitted_at)}</TableCell>
                          <TableCell className="font-medium">{update.lines?.name || update.lines?.line_id}</TableCell>
                          <TableCell>{update.work_orders?.po_number || '-'}</TableCell>
                          <TableCell className="text-right font-mono">{update.day_qc_pass?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-right font-mono">{update.total_qc_pass?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-right font-mono">{update.day_poly?.toLocaleString() || 0}</TableCell>
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
                {filteredFinishing.length > 50 && (
                  <div className="p-3 text-center text-sm text-muted-foreground border-t">
                    Showing first 50 of {filteredFinishing.length} records. Export to see all.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {filteredSewing.length === 0 && filteredFinishing.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No submissions found for the selected period</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sewing" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Sewing Submissions</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => exportToCSV('sewing')}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
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
                        <TableCell className="font-mono text-sm">{formatDate(update.production_date)}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{formatTime(update.submitted_at)}</TableCell>
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
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No sewing submissions found
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
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Finishing Submissions</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => exportToCSV('finishing')}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead className="text-right">Day QC</TableHead>
                      <TableHead className="text-right">Total QC</TableHead>
                      <TableHead className="text-right">M Power</TableHead>
                      <TableHead className="text-right">Day Poly</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFinishing.map((update) => (
                      <TableRow 
                        key={update.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleFinishingClick(update)}
                      >
                        <TableCell className="font-mono text-sm">{formatDate(update.production_date)}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{formatTime(update.submitted_at)}</TableCell>
                        <TableCell className="font-medium">{update.lines?.name || update.lines?.line_id}</TableCell>
                        <TableCell>{update.work_orders?.po_number || '-'}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{update.day_qc_pass?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-right font-mono">{update.total_qc_pass?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-right">{update.m_power || '-'}</TableCell>
                        <TableCell className="text-right font-mono">{update.day_poly?.toLocaleString() || 0}</TableCell>
                        <TableCell>
                          {update.has_blocker ? (
                            <StatusBadge variant="danger" size="sm">Blocker</StatusBadge>
                          ) : (
                            <StatusBadge variant="success" size="sm">OK</StatusBadge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredFinishing.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No finishing submissions found
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
        onDeleted={fetchSubmissions}
        onUpdated={fetchSubmissions}
      />
    </div>
  );
}
