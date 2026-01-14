import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Archive, PackageCheck } from "lucide-react";

interface ExtrasOverviewData {
  work_order_id: string;
  po_number: string;
  buyer: string;
  style: string;
  order_qty: number;
  total_carton: number;
  extras_total: number;
  stocked: number;
  consumed: number;
  available: number;
}

interface ExtrasOverviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExtrasOverviewModal({ open, onOpenChange }: ExtrasOverviewModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExtrasOverviewData[]>([]);

  useEffect(() => {
    if (open && profile?.factory_id) {
      fetchExtrasOverview();
    }
  }, [open, profile?.factory_id]);

  async function fetchExtrasOverview() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      // Fetch all active work orders
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select('id, po_number, buyer, style, order_qty')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true);

      if (!workOrders?.length) {
        setData([]);
        setLoading(false);
        return;
      }

      const workOrderIds = workOrders.map(wo => wo.id);

      // Fetch finishing carton output and ledger entries in parallel
      const [cartonRes, ledgerRes] = await Promise.all([
        supabase
          .from('finishing_daily_logs')
          .select('work_order_id, carton')
          .eq('factory_id', profile.factory_id)
          .eq('log_type', 'OUTPUT')
          .in('work_order_id', workOrderIds),
        supabase
          .from('extras_ledger')
          .select('work_order_id, quantity, transaction_type')
          .eq('factory_id', profile.factory_id)
          .in('work_order_id', workOrderIds),
      ]);

      // Aggregate carton by work order
      const cartonByWo = new Map<string, number>();
      cartonRes.data?.forEach((log: any) => {
        const current = cartonByWo.get(log.work_order_id) || 0;
        cartonByWo.set(log.work_order_id, current + (log.carton || 0));
      });

      // Aggregate ledger by work order: stocked vs consumed
      const stockedByWo = new Map<string, number>();
      const consumedByWo = new Map<string, number>();
      ledgerRes.data?.forEach((entry: any) => {
        if (entry.transaction_type === 'transferred_to_stock') {
          const current = stockedByWo.get(entry.work_order_id) || 0;
          stockedByWo.set(entry.work_order_id, current + (entry.quantity || 0));
        } else {
          const current = consumedByWo.get(entry.work_order_id) || 0;
          consumedByWo.set(entry.work_order_id, current + (entry.quantity || 0));
        }
      });

      // Build overview data - only include work orders with extras
      const overviewData: ExtrasOverviewData[] = workOrders
        .map(wo => {
          const totalCarton = cartonByWo.get(wo.id) || 0;
          const extrasTotal = Math.max(totalCarton - wo.order_qty, 0);
          const stocked = stockedByWo.get(wo.id) || 0;
          const consumed = consumedByWo.get(wo.id) || 0;
          const available = extrasTotal - stocked - consumed;

          return {
            work_order_id: wo.id,
            po_number: wo.po_number,
            buyer: wo.buyer,
            style: wo.style,
            order_qty: wo.order_qty,
            total_carton: totalCarton,
            extras_total: extrasTotal,
            stocked,
            consumed,
            available,
          };
        })
        .filter(item => item.extras_total > 0 || item.stocked > 0 || item.consumed > 0)
        .sort((a, b) => b.available - a.available);

      setData(overviewData);
    } catch (error) {
      console.error('Error fetching extras overview:', error);
    } finally {
      setLoading(false);
    }
  }

  const totals = data.reduce(
    (acc, item) => ({
      extras: acc.extras + item.extras_total,
      available: acc.available + item.available,
      stocked: acc.stocked + item.stocked,
      consumed: acc.consumed + item.consumed,
    }),
    { extras: 0, available: 0, stocked: 0, consumed: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Extras Overview - All POs
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold font-mono">{totals.extras.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Extras</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold font-mono text-warning">{totals.available.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Package className="h-3 w-3" /> Available
            </p>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold font-mono text-primary">{totals.stocked.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Archive className="h-3 w-3" /> Stocked
            </p>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-2xl font-bold font-mono text-muted-foreground">{totals.consumed.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <PackageCheck className="h-3 w-3" /> Consumed
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No POs with extras found
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Buyer / Style</TableHead>
                  <TableHead className="text-right">Order Qty</TableHead>
                  <TableHead className="text-right">Total Carton</TableHead>
                  <TableHead className="text-right">Extras</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Stocked</TableHead>
                  <TableHead className="text-right">Consumed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.work_order_id}>
                    <TableCell className="font-mono font-medium">{item.po_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.buyer}</p>
                        <p className="text-xs text-muted-foreground">{item.style}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.order_qty.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{item.total_carton.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-mono">
                        +{item.extras_total.toLocaleString()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.available > 0 ? (
                        <Badge variant="warning" className="font-mono">
                          {item.available.toLocaleString()}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground font-mono">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.stocked > 0 ? (
                        <span className="font-mono text-primary font-medium">{item.stocked.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground font-mono">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.consumed > 0 ? (
                        <span className="font-mono text-muted-foreground">{item.consumed.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground font-mono">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
