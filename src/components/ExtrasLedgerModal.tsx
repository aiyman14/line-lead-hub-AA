import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Plus, Loader2, Package, AlertCircle, ShoppingCart, Truck, RefreshCw, Trash2, Gift, Settings } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type ExtrasTransactionType = Database["public"]["Enums"]["extras_transaction_type"];

interface LedgerEntry {
  id: string;
  transaction_type: ExtrasTransactionType;
  quantity: number;
  notes: string | null;
  reference_number: string | null;
  is_admin_adjustment: boolean;
  created_at: string;
  created_by: string;
}

interface ExtrasLedgerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  poNumber: string;
  extrasAvailable: number;
  onLedgerChange?: () => void;
}

const TRANSACTION_TYPES: { value: ExtrasTransactionType; label: string; icon: typeof ShoppingCart; description: string }[] = [
  { value: 'transferred_to_stock', label: 'Transferred to Stock', icon: Package, description: 'Moved to inventory/stock' },
  { value: 'sold', label: 'Sold', icon: ShoppingCart, description: 'Sold to buyer or customer' },
  { value: 'replacement_shipment', label: 'Replacement Shipment', icon: Truck, description: 'Sent as replacement for defects' },
  { value: 'scrapped', label: 'Scrapped', icon: Trash2, description: 'Defective or unusable' },
  { value: 'donated', label: 'Donated', icon: Gift, description: 'Given away' },
  { value: 'adjustment', label: 'Adjustment (Admin)', icon: Settings, description: 'Admin correction' },
];

export function ExtrasLedgerModal({
  open,
  onOpenChange,
  workOrderId,
  poNumber,
  extrasAvailable,
  onLedgerChange,
}: ExtrasLedgerModalProps) {
  const { profile, user, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [transactionType, setTransactionType] = useState<ExtrasTransactionType>('sold');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');

  const isAdmin = isAdminOrHigher();

  useEffect(() => {
    if (open && workOrderId) {
      fetchEntries();
    }
  }, [open, workOrderId]);

  async function fetchEntries() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('extras_ledger')
        .select('*')
        .eq('work_order_id', workOrderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      toast.error('Failed to load ledger entries');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.factory_id || !user?.id) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    // Validation: cannot consume more than available (except admin adjustment)
    const isAdjustment = transactionType === 'adjustment';
    if (!isAdjustment && qty > extrasAvailable) {
      toast.error(`Cannot consume more than available extras (${extrasAvailable})`);
      return;
    }

    if (isAdjustment && !isAdmin) {
      toast.error('Only admins can make adjustments');
      return;
    }

    if (isAdjustment && !notes.trim()) {
      toast.error('Reason is required for adjustments');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('extras_ledger')
        .insert({
          work_order_id: workOrderId,
          factory_id: profile.factory_id,
          transaction_type: transactionType,
          quantity: qty,
          notes: notes.trim() || null,
          reference_number: referenceNumber.trim() || null,
          is_admin_adjustment: isAdjustment,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success('Ledger entry added');
      setShowForm(false);
      setQuantity('');
      setNotes('');
      setReferenceNumber('');
      setTransactionType('sold');
      fetchEntries();
      onLedgerChange?.();
    } catch (error) {
      console.error('Error adding entry:', error);
      toast.error('Failed to add entry');
    } finally {
      setSubmitting(false);
    }
  }

  const getTypeInfo = (type: ExtrasTransactionType) => {
    return TRANSACTION_TYPES.find(t => t.value === type) || TRANSACTION_TYPES[0];
  };

  const totalConsumed = entries.reduce((sum, e) => sum + e.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Extras Ledger
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-mono">{poNumber}</p>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-xl font-bold font-mono text-warning">{extrasAvailable.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Consumed</p>
            <p className="text-xl font-bold font-mono">{totalConsumed.toLocaleString()}</p>
          </div>
        </div>

        <Separator />

        {/* Add entry form */}
        {showForm ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={transactionType} onValueChange={(v) => setTransactionType(v as ExtrasTransactionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.filter(t => t.value !== 'adjustment' || isAdmin).map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getTypeInfo(transactionType).description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Quantity *</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                min={1}
                max={transactionType === 'adjustment' ? undefined : extrasAvailable}
              />
              {transactionType !== 'adjustment' && extrasAvailable > 0 && (
                <p className="text-xs text-muted-foreground">
                  Max: {extrasAvailable.toLocaleString()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Invoice #, shipment ID, etc."
              />
            </div>

            <div className="space-y-2">
              <Label>{transactionType === 'adjustment' ? 'Reason *' : 'Notes'}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={transactionType === 'adjustment' ? 'Reason for adjustment (required)' : 'Optional notes'}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Entry
              </Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setShowForm(true)} disabled={extrasAvailable <= 0 && !isAdmin}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        )}

        {extrasAvailable <= 0 && !showForm && !isAdmin && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            No extras available to consume
          </div>
        )}

        <Separator />

        {/* Ledger entries list */}
        <div className="flex-1 overflow-hidden">
          <h4 className="text-sm font-medium mb-2">Transaction History</h4>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No entries yet</p>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-4">
                {entries.map((entry) => {
                  const typeInfo = getTypeInfo(entry.transaction_type);
                  const Icon = typeInfo.icon;
                  return (
                    <div key={entry.id} className="p-3 border rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{typeInfo.label}</span>
                          {entry.is_admin_adjustment && (
                            <Badge variant="outline" className="text-xs">Admin</Badge>
                          )}
                        </div>
                        <span className="font-mono font-bold">-{entry.quantity.toLocaleString()}</span>
                      </div>
                      {entry.reference_number && (
                        <p className="text-xs text-muted-foreground">Ref: {entry.reference_number}</p>
                      )}
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground">{entry.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
