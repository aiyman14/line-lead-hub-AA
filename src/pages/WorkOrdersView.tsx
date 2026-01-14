import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ClipboardList, Search, Calendar, Package, TrendingUp, Archive } from "lucide-react";
import { OutputExtrasCard, calculateOutputExtras, getProductionStatus, getStatusBadge, type OutputExtrasData } from "@/components/OutputExtrasCard";
import { ExtrasLedgerModal } from "@/components/ExtrasLedgerModal";
import { ExtrasOverviewModal } from "@/components/ExtrasOverviewModal";

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  color: string | null;
  order_qty: number;
  status: string | null;
  planned_ex_factory: string | null;
  line_name: string | null;
  produced_qty: number; // Sewing output
  totalCartonOutput: number; // Finishing carton output (single source of truth)
  extrasConsumed: number; // From ledger
}

export default function WorkOrdersView() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showLedger, setShowLedger] = useState(false);
  const [showExtrasOverview, setShowExtrasOverview] = useState(false);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchWorkOrders();
    }
  }, [profile?.factory_id]);

  async function fetchWorkOrders() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      // Fetch work orders with line info
      const { data: workOrdersData } = await supabase
        .from('work_orders')
        .select('*, lines(name, line_id)')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true)
        .order('po_number');

      const workOrderIds = workOrdersData?.map(wo => wo.id) || [];
      
      // Fetch production data in parallel
      const [sewingRes, finishingLogsRes, ledgerRes] = await Promise.all([
        // Sewing output (for reference)
        supabase
          .from('production_updates_sewing')
          .select('work_order_id, output_qty')
          .eq('factory_id', profile.factory_id)
          .in('work_order_id', workOrderIds),
        // Finishing daily logs - OUTPUT type, carton only (single source of truth)
        supabase
          .from('finishing_daily_logs')
          .select('work_order_id, carton')
          .eq('factory_id', profile.factory_id)
          .eq('log_type', 'OUTPUT')
          .in('work_order_id', workOrderIds),
        // Extras ledger consumption
        supabase
          .from('extras_ledger')
          .select('work_order_id, quantity')
          .eq('factory_id', profile.factory_id)
          .in('work_order_id', workOrderIds),
      ]);

      // Aggregate sewing by work order
      const sewingByWo = new Map<string, number>();
      sewingRes.data?.forEach(u => {
        const current = sewingByWo.get(u.work_order_id || '') || 0;
        sewingByWo.set(u.work_order_id || '', current + (u.output_qty || 0));
      });

      // Aggregate carton output by work order (single source of truth for finished goods)
      const cartonByWo = new Map<string, number>();
      finishingLogsRes.data?.forEach((log: any) => {
        const current = cartonByWo.get(log.work_order_id || '') || 0;
        cartonByWo.set(log.work_order_id || '', current + (log.carton || 0));
      });

      // Aggregate ledger consumption by work order
      const ledgerByWo = new Map<string, number>();
      ledgerRes.data?.forEach((entry: any) => {
        const current = ledgerByWo.get(entry.work_order_id || '') || 0;
        ledgerByWo.set(entry.work_order_id || '', current + (entry.quantity || 0));
      });

      const formattedWorkOrders: WorkOrder[] = (workOrdersData || []).map(wo => ({
        id: wo.id,
        po_number: wo.po_number,
        buyer: wo.buyer,
        style: wo.style,
        item: wo.item,
        color: wo.color,
        order_qty: wo.order_qty,
        status: wo.status,
        planned_ex_factory: wo.planned_ex_factory,
        line_name: wo.lines?.name || wo.lines?.line_id || null,
        produced_qty: sewingByWo.get(wo.id) || 0,
        totalCartonOutput: cartonByWo.get(wo.id) || 0,
        extrasConsumed: ledgerByWo.get(wo.id) || 0,
      }));

      setWorkOrders(formattedWorkOrders);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredWorkOrders = workOrders.filter(wo =>
    wo.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wo.buyer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wo.style.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOrderQty = workOrders.reduce((sum, wo) => sum + wo.order_qty, 0);
  const totalProduced = workOrders.reduce((sum, wo) => sum + wo.produced_qty, 0);
  const totalCartonOutput = workOrders.reduce((sum, wo) => sum + wo.totalCartonOutput, 0);
  const totalExtras = workOrders.reduce((sum, wo) => sum + Math.max(wo.totalCartonOutput - wo.order_qty, 0), 0);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusVariant = (status: string | null) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'on_hold': return 'warning';
      default: return 'neutral';
    }
  };

  const handleViewLedger = (wo: WorkOrder) => {
    setSelectedWorkOrder(wo);
    setShowLedger(true);
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
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Work Orders
        </h1>
        <p className="text-muted-foreground">Track active work orders and production progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-3xl font-bold">{workOrders.length}</p>
            <p className="text-sm text-muted-foreground">Active Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold font-mono">{totalOrderQty.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Order Qty</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold font-mono text-primary">{totalProduced.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Sewing Output</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-success" />
              <p className="text-2xl font-bold font-mono text-success">{totalCartonOutput.toLocaleString()}</p>
            </div>
            <p className="text-sm text-muted-foreground">Finished Output (Carton)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-warning" />
              <p className="text-2xl font-bold font-mono text-warning">{totalExtras.toLocaleString()}</p>
            </div>
            <p className="text-sm text-muted-foreground">Total Extras</p>
          </CardContent>
        </Card>
      </div>

      {/* Extras Overview Button */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setShowExtrasOverview(true)} className="gap-2">
          <Archive className="h-4 w-4" />
          View All Leftovers
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by PO, buyer, or style..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Work Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Buyer / Style</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead className="text-right">PO Qty</TableHead>
                  <TableHead className="text-right">Finished Output</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ex-Factory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkOrders.map((wo) => {
                  const outputData = calculateOutputExtras(wo.order_qty, wo.totalCartonOutput, wo.extrasConsumed);
                  const status = getProductionStatus(outputData);
                  const statusInfo = getStatusBadge(status);
                  const StatusIcon = statusInfo.icon;
                  const progressPercent = wo.order_qty > 0 ? Math.min((wo.totalCartonOutput / wo.order_qty) * 100, 100) : 0;
                  
                  return (
                    <TableRow 
                      key={wo.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewLedger(wo)}
                    >
                      <TableCell className="font-mono font-medium">{wo.po_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{wo.buyer}</p>
                          <p className="text-xs text-muted-foreground">{wo.style}</p>
                        </div>
                      </TableCell>
                      <TableCell>{wo.line_name || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{wo.order_qty.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-success font-medium">
                        {wo.totalCartonOutput.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {outputData.extras > 0 ? (
                          <Badge variant="warning" className="font-mono">
                            +{outputData.extras.toLocaleString()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {outputData.remaining > 0 ? outputData.remaining.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={progressPercent} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1 text-center">{Math.round(progressPercent)}%</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusInfo.variant}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(wo.planned_ex_factory)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredWorkOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No work orders found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Extras Ledger Modal */}
      {selectedWorkOrder && (
        <ExtrasLedgerModal
          open={showLedger}
          onOpenChange={setShowLedger}
          workOrderId={selectedWorkOrder.id}
          poNumber={selectedWorkOrder.po_number}
          extrasAvailable={
            Math.max(selectedWorkOrder.totalCartonOutput - selectedWorkOrder.order_qty, 0) - selectedWorkOrder.extrasConsumed
          }
          onLedgerChange={fetchWorkOrders}
        />
      )}

      {/* Extras Overview Modal */}
      <ExtrasOverviewModal
        open={showExtrasOverview}
        onOpenChange={setShowExtrasOverview}
      />
    </div>
  );
}
