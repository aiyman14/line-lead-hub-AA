import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ClipboardList, Search, Calendar, Package } from "lucide-react";

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
  produced_qty: number;
  qc_pass_qty: number;
}

export default function WorkOrdersView() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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

      // Fetch production totals for each work order
      const workOrderIds = workOrdersData?.map(wo => wo.id) || [];
      
      const [sewingRes, finishingRes] = await Promise.all([
        supabase
          .from('production_updates_sewing')
          .select('work_order_id, output_qty')
          .eq('factory_id', profile.factory_id)
          .in('work_order_id', workOrderIds),
        supabase
          .from('finishing_daily_sheets')
          .select('work_order_id, finishing_hourly_logs(poly_actual, carton_actual)')
          .eq('factory_id', profile.factory_id)
          .in('work_order_id', workOrderIds),
      ]);

      // Aggregate production by work order
      const sewingByWo = new Map<string, number>();
      sewingRes.data?.forEach(u => {
        const current = sewingByWo.get(u.work_order_id || '') || 0;
        sewingByWo.set(u.work_order_id || '', current + (u.output_qty || 0));
      });

      // QC Pass = Total Poly + Total Carton from hourly logs
      const finishingByWo = new Map<string, number>();
      finishingRes.data?.forEach((sheet: any) => {
        const logs = sheet.finishing_hourly_logs || [];
        const totalPoly = logs.reduce((sum: number, l: any) => sum + (l.poly_actual || 0), 0);
        const totalCarton = logs.reduce((sum: number, l: any) => sum + (l.carton_actual || 0), 0);
        const qcPass = totalPoly + totalCarton;
        const current = finishingByWo.get(sheet.work_order_id || '') || 0;
        finishingByWo.set(sheet.work_order_id || '', current + qcPass);
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
        qc_pass_qty: finishingByWo.get(wo.id) || 0,
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
  const totalQcPass = workOrders.reduce((sum, wo) => sum + wo.qc_pass_qty, 0);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <p className="text-sm text-muted-foreground">Total Produced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold font-mono text-success">{totalQcPass.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total QC Pass</p>
          </CardContent>
        </Card>
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
                  <TableHead className="text-right">Order Qty</TableHead>
                  <TableHead className="text-right">Produced</TableHead>
                  <TableHead className="text-right">QC Pass</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Ex-Factory</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkOrders.map((wo) => {
                  const progressPercent = wo.order_qty > 0 ? Math.min((wo.qc_pass_qty / wo.order_qty) * 100, 100) : 0;
                  return (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono font-medium">{wo.po_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{wo.buyer}</p>
                          <p className="text-xs text-muted-foreground">{wo.style}</p>
                        </div>
                      </TableCell>
                      <TableCell>{wo.line_name || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{wo.order_qty.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-primary">{wo.produced_qty.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-success">{wo.qc_pass_qty.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress value={progressPercent} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1 text-center">{Math.round(progressPercent)}%</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(wo.planned_ex_factory)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={getStatusVariant(wo.status) as any} size="sm">
                          {wo.status || 'active'}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredWorkOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No work orders found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
