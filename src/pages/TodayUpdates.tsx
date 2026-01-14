import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Loader2, Factory, Package, Search, Download, RefreshCw, Scissors, Archive, CalendarDays } from "lucide-react";
import { SubmissionDetailModal } from "@/components/SubmissionDetailModal";
import { CuttingDetailModal } from "@/components/CuttingDetailModal";
import { StorageBinCardDetailModal } from "@/components/StorageBinCardDetailModal";
import { ExportSubmissionsDialog } from "@/components/ExportSubmissionsDialog";

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

interface FinishingDailyLog {
  id: string;
  line_id: string;
  production_date: string;
  submitted_at: string;
  log_type: 'TARGET' | 'OUTPUT';
  thread_cutting: number | null;
  inside_check: number | null;
  top_side_check: number | null;
  buttoning: number | null;
  iron: number | null;
  get_up: number | null;
  poly: number | null;
  carton: number | null;
  remarks: string | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string } | null;
}

interface CuttingActual {
  id: string;
  line_id: string;
  work_order_id: string;
  day_cutting: number;
  day_input: number;
  total_cutting: number | null;
  total_input: number | null;
  balance: number | null;
  submitted_at: string | null;
  production_date: string;
  colour: string | null;
  order_qty: number | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string } | null;
}

interface CuttingTarget {
  id: string;
  line_id: string;
  work_order_id: string;
  production_date: string;
  man_power: number;
  marker_capacity: number;
  lay_capacity: number;
  cutting_capacity: number;
  under_qty: number | null;
}

interface StorageTransaction {
  id: string;
  receive_qty: number;
  issue_qty: number;
  balance_qty: number;
  transaction_date: string;
  created_at: string | null;
  storage_bin_cards: {
    id: string;
    buyer: string | null;
    style: string | null;
    work_orders: { po_number: string } | null;
  } | null;
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sewingUpdates, setSewingUpdates] = useState<SewingUpdate[]>([]);
  const [finishingDailyLogs, setFinishingDailyLogs] = useState<FinishingDailyLog[]>([]);
  const [cuttingActuals, setCuttingActuals] = useState<CuttingActual[]>([]);
  const [cuttingTargets, setCuttingTargets] = useState<CuttingTarget[]>([]);
  const [storageTransactions, setStorageTransactions] = useState<StorageTransaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<ModalSubmission | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedCutting, setSelectedCutting] = useState<any>(null);
  const [cuttingModalOpen, setCuttingModalOpen] = useState(false);
  const [selectedBinCard, setSelectedBinCard] = useState<any>(null);
  const [binCardTransactions, setBinCardTransactions] = useState<any[]>([]);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [storageLoading, setStorageLoading] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

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
      const [sewingRes, finishingRes, cuttingRes, cuttingTargetsRes, storageRes] = await Promise.all([
        supabase
          .from('production_updates_sewing')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style)')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today)
          .order('submitted_at', { ascending: false }),
        supabase
          .from('finishing_daily_logs')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style)')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today)
          .order('submitted_at', { ascending: false }),
        supabase
          .from('cutting_actuals')
          .select('*, lines!cutting_actuals_line_id_fkey(line_id, name), work_orders(po_number, buyer, style, order_qty, color)')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today)
          .order('submitted_at', { ascending: false }),
        supabase
          .from('cutting_targets')
          .select('id, line_id, work_order_id, production_date, man_power, marker_capacity, lay_capacity, cutting_capacity, under_qty')
          .eq('factory_id', profile.factory_id)
          .eq('production_date', today),
        supabase
          .from('storage_bin_card_transactions')
          .select('*, storage_bin_cards(id, buyer, style, work_orders(po_number))')
          .eq('factory_id', profile.factory_id)
          .eq('transaction_date', today)
          .order('created_at', { ascending: false }),
      ]);

      setSewingUpdates(sewingRes.data || []);
      setFinishingDailyLogs(finishingRes.data as FinishingDailyLog[] || []);
      setCuttingActuals(cuttingRes.data as any || []);
      setCuttingTargets(cuttingTargetsRes.data as any || []);
      setStorageTransactions(storageRes.data as any || []);
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

  const filteredFinishing = finishingDailyLogs.filter(s =>
    (s.lines?.name || s.lines?.line_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.work_orders?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCutting = cuttingActuals.filter(c =>
    (c.lines?.name || c.lines?.line_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.work_orders?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStorage = storageTransactions.filter(s =>
    (s.storage_bin_cards?.work_orders?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.storage_bin_cards?.style || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOutput = sewingUpdates.reduce((sum, u) => sum + (u.output_qty || 0), 0);
  
  // Total Finishing Output = Total Poly + Total Carton (from OUTPUT logs)
  const totalFinishingOutput = finishingDailyLogs
    .filter(log => log.log_type === 'OUTPUT')
    .reduce((sum, log) => sum + (log.poly || 0) + (log.carton || 0), 0);

  const totalCutting = cuttingActuals.reduce((sum, c) => sum + (c.day_cutting || 0), 0);
  const totalStorageReceived = storageTransactions.reduce((sum, s) => sum + (s.receive_qty || 0), 0);

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

  const handleFinishingClick = (log: FinishingDailyLog) => {
    if (log.log_type === 'TARGET') {
      navigate(`/finishing/daily-target?id=${log.id}`);
    } else {
      navigate(`/finishing/daily-output?id=${log.id}`);
    }
  };

  const handleCuttingClick = (cutting: CuttingActual) => {
    // Find matching target for capacity planning data
    const target = cuttingTargets.find(
      t => t.line_id === cutting.line_id && t.work_order_id === cutting.work_order_id
    );
    
    setSelectedCutting({
      id: cutting.id,
      production_date: cutting.production_date,
      line_name: cutting.lines?.name || cutting.lines?.line_id || 'Unknown',
      buyer: (cutting.work_orders as any)?.buyer || null,
      style: (cutting.work_orders as any)?.style || null,
      po_number: (cutting.work_orders as any)?.po_number || null,
      colour: cutting.colour || (cutting.work_orders as any)?.color || null,
      order_qty: cutting.order_qty || (cutting.work_orders as any)?.order_qty || null,
      man_power: target?.man_power || null,
      marker_capacity: target?.marker_capacity || null,
      lay_capacity: target?.lay_capacity || null,
      cutting_capacity: target?.cutting_capacity || null,
      under_qty: target?.under_qty || null,
      day_cutting: cutting.day_cutting,
      total_cutting: cutting.total_cutting,
      day_input: cutting.day_input,
      total_input: cutting.total_input,
      balance: cutting.balance,
      submitted_at: cutting.submitted_at,
    });
    setCuttingModalOpen(true);
  };

  const handleStorageClick = async (txn: StorageTransaction) => {
    if (!txn.storage_bin_cards?.id) {
      navigate('/storage/history');
      return;
    }

    setStorageLoading(true);
    setStorageModalOpen(true);

    try {
      // Fetch full bin card details
      const { data: binCardData, error: binCardError } = await supabase
        .from('storage_bin_cards')
        .select('*, work_orders(po_number)')
        .eq('id', txn.storage_bin_cards.id)
        .single();

      if (binCardError) throw binCardError;

      // Fetch all transactions for this bin card
      const { data: txnData, error: txnError } = await supabase
        .from('storage_bin_card_transactions')
        .select('*')
        .eq('bin_card_id', txn.storage_bin_cards.id)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (txnError) throw txnError;

      setSelectedBinCard({
        id: binCardData.id,
        buyer: binCardData.buyer,
        style: binCardData.style,
        po_number: binCardData.work_orders?.po_number || null,
        supplier_name: binCardData.supplier_name,
        description: binCardData.description,
        construction: binCardData.construction,
        color: binCardData.color,
        width: binCardData.width,
        package_qty: binCardData.package_qty,
        prepared_by: binCardData.prepared_by,
      });
      setBinCardTransactions(txnData || []);
    } catch (error) {
      console.error('Error fetching bin card details:', error);
      setStorageModalOpen(false);
    } finally {
      setStorageLoading(false);
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
            <CalendarDays className="h-6 w-6" />
            Today's Updates
          </h1>
          <p className="text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTodayUpdates}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards - Grouped Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Updates Count Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Updates</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Factory className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{sewingUpdates.length}</p>
                  <p className="text-xs text-muted-foreground">Sewing</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
                  <Package className="h-4 w-4 text-info" />
                </div>
                <div>
                  <p className="text-xl font-bold">{finishingDailyLogs.length}</p>
                  <p className="text-xs text-muted-foreground">Finishing</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Scissors className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-xl font-bold">{cuttingActuals.length}</p>
                  <p className="text-xs text-muted-foreground">Cutting</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <Archive className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-xl font-bold">{storageTransactions.length}</p>
                  <p className="text-xs text-muted-foreground">Storage</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Output Totals Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Output Totals</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-2xl font-bold font-mono text-primary">{totalOutput.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Sewing Output</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-success">{totalFinishingOutput.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Finishing Output</p>
              </div>
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
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="w-max min-w-full md:w-auto">
            <TabsTrigger value="all">All ({sewingUpdates.length + finishingDailyLogs.length + cuttingActuals.length + storageTransactions.length})</TabsTrigger>
            <TabsTrigger value="storage">Storage ({storageTransactions.length})</TabsTrigger>
            <TabsTrigger value="cutting">Cutting ({cuttingActuals.length})</TabsTrigger>
            <TabsTrigger value="sewing">Sewing ({sewingUpdates.length})</TabsTrigger>
            <TabsTrigger value="finishing">Finishing ({finishingDailyLogs.length})</TabsTrigger>
          </TabsList>
        </div>

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
                        <TableHead>Type</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Poly</TableHead>
                        <TableHead className="text-right">Carton</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFinishing.map((log) => {
                        const total = (log.poly || 0) + (log.carton || 0);
                        return (
                          <TableRow 
                            key={log.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleFinishingClick(log)}
                          >
                            <TableCell className="font-mono text-sm">{formatTime(log.submitted_at)}</TableCell>
                            <TableCell>
                              <StatusBadge variant={log.log_type === 'TARGET' ? 'info' : 'success'} size="sm">
                                {log.log_type}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="font-medium">{log.lines?.name || log.lines?.line_id}</TableCell>
                            <TableCell>{log.work_orders?.po_number || '-'}</TableCell>
                            <TableCell className="text-right font-mono">{(log.poly || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{(log.carton || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{total.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cutting Table */}
          {filteredCutting.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-warning" />
                  Cutting Updates
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
                        <TableHead className="text-right">Day Cutting</TableHead>
                        <TableHead className="text-right">Day Input</TableHead>
                        <TableHead className="text-right">Total Cutting</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCutting.map((cutting) => (
                        <TableRow 
                          key={cutting.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleCuttingClick(cutting)}
                        >
                          <TableCell className="font-mono text-sm">{cutting.submitted_at ? formatTime(cutting.submitted_at) : '-'}</TableCell>
                          <TableCell className="font-medium">{cutting.lines?.name || cutting.lines?.line_id}</TableCell>
                          <TableCell>{cutting.work_orders?.po_number || '-'}</TableCell>
                          <TableCell className="text-right font-mono">{cutting.day_cutting.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{cutting.day_input.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{cutting.total_cutting?.toLocaleString() || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Storage Table */}
          {filteredStorage.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Archive className="h-4 w-4 text-success" />
                  Storage Transactions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead className="text-right">Received</TableHead>
                        <TableHead className="text-right">Issued</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStorage.map((txn) => (
                        <TableRow 
                          key={txn.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleStorageClick(txn)}
                        >
                          <TableCell className="font-mono text-sm">{txn.created_at ? formatTime(txn.created_at) : '-'}</TableCell>
                          <TableCell>{txn.storage_bin_cards?.work_orders?.po_number || '-'}</TableCell>
                          <TableCell>{txn.storage_bin_cards?.style || '-'}</TableCell>
                          <TableCell className="text-right font-mono text-success">{txn.receive_qty > 0 ? `+${txn.receive_qty.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right font-mono text-destructive">{txn.issue_qty > 0 ? `-${txn.issue_qty.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{txn.balance_qty.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredSewing.length === 0 && filteredFinishing.length === 0 && filteredCutting.length === 0 && filteredStorage.length === 0 && (
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
                        <TableHead>Type</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Poly</TableHead>
                        <TableHead className="text-right">Carton</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFinishing.map((log) => {
                        const total = (log.poly || 0) + (log.carton || 0);
                        return (
                          <TableRow 
                            key={log.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleFinishingClick(log)}
                          >
                            <TableCell className="font-mono text-sm">{formatTime(log.submitted_at)}</TableCell>
                            <TableCell>
                              <StatusBadge variant={log.log_type === 'TARGET' ? 'info' : 'success'} size="sm">
                                {log.log_type}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="font-medium">{log.lines?.name || log.lines?.line_id}</TableCell>
                            <TableCell>{log.work_orders?.po_number || '-'}</TableCell>
                            <TableCell className="text-right font-mono">{(log.poly || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{(log.carton || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono font-bold">{total.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredFinishing.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No finishing logs today
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cutting" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead className="text-right">Day Cutting</TableHead>
                      <TableHead className="text-right">Day Input</TableHead>
                      <TableHead className="text-right">Total Cutting</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCutting.map((cutting) => (
                      <TableRow 
                        key={cutting.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleCuttingClick(cutting)}
                      >
                        <TableCell className="font-mono text-sm">{cutting.submitted_at ? formatTime(cutting.submitted_at) : '-'}</TableCell>
                        <TableCell className="font-medium">{cutting.lines?.name || cutting.lines?.line_id}</TableCell>
                        <TableCell>{cutting.work_orders?.po_number || '-'}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{cutting.day_cutting.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{cutting.day_input.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{cutting.total_cutting?.toLocaleString() || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {filteredCutting.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No cutting updates today
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>PO</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Issued</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStorage.map((txn) => (
                      <TableRow 
                        key={txn.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleStorageClick(txn)}
                      >
                        <TableCell className="font-mono text-sm">{txn.created_at ? formatTime(txn.created_at) : '-'}</TableCell>
                        <TableCell>{txn.storage_bin_cards?.work_orders?.po_number || '-'}</TableCell>
                        <TableCell>{txn.storage_bin_cards?.style || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-success">{txn.receive_qty > 0 ? `+${txn.receive_qty.toLocaleString()}` : '-'}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">{txn.issue_qty > 0 ? `-${txn.issue_qty.toLocaleString()}` : '-'}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{txn.balance_qty.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {filteredStorage.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No storage transactions today
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

      {/* Cutting Detail Modal */}
      <CuttingDetailModal
        cutting={selectedCutting}
        open={cuttingModalOpen}
        onOpenChange={setCuttingModalOpen}
      />

      {/* Storage Bin Card Detail Modal */}
      <StorageBinCardDetailModal
        binCard={selectedBinCard}
        transactions={binCardTransactions}
        open={storageModalOpen}
        onOpenChange={setStorageModalOpen}
      />

      {/* Export Dialog */}
      <ExportSubmissionsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={{
          sewingTargets: [],
          finishingTargets: [],
          sewingActuals: sewingUpdates.map(u => ({
            ...u,
            good_today: u.output_qty,
            reject_today: u.reject_qty,
            rework_today: u.rework_qty,
            cumulative_good_total: u.output_qty,
            manpower_actual: u.manpower,
            ot_hours_actual: u.ot_hours,
            actual_stage_progress: u.stage_progress,
            remarks: u.notes,
          })),
          finishingActuals: finishingDailyLogs
            .filter(log => log.log_type === 'OUTPUT')
            .map(log => ({
              ...log,
              day_poly: log.poly || 0,
              day_carton: log.carton || 0,
              total_poly: log.poly || 0,
              total_carton: log.carton || 0,
            })),
          cuttingTargets: [],
          cuttingActuals: cuttingActuals,
          storageBinCards: storageTransactions.map(t => ({
            id: t.storage_bin_cards?.id,
            created_at: t.created_at,
            buyer: t.storage_bin_cards?.buyer,
            style: t.storage_bin_cards?.style,
            work_orders: t.storage_bin_cards?.work_orders,
            totalReceived: t.receive_qty,
            totalIssued: t.issue_qty,
            balance: t.balance_qty,
          })),
        }}
        dateRange="1"
      />
    </div>
  );
}
