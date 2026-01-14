import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StorageTransaction {
  id: string;
  transaction_date: string;
  receive_qty: number;
  issue_qty: number;
  ttl_receive: number;
  balance_qty: number;
  remarks: string | null;
}

interface EditStorageTransactionModalProps {
  transaction: StorageTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditStorageTransactionModal({ transaction, open, onOpenChange, onSaved }: EditStorageTransactionModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (transaction) {
      setFormData({ ...transaction });
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleNumberChange = (field: string, value: string) => {
    const num = value === '' ? 0 : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: num }));
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('storage_bin_card_transactions')
        .update({
          receive_qty: formData.receive_qty ?? 0,
          issue_qty: formData.issue_qty ?? 0,
          remarks: formData.remarks,
        })
        .eq('id', transaction.id);

      if (error) throw error;

      toast.success("Transaction updated successfully");
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      toast.error(error.message || "Failed to update transaction");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Edit Storage Transaction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="receive_qty">Receive Qty</Label>
              <Input
                id="receive_qty"
                type="number"
                value={formData.receive_qty ?? ''}
                onChange={(e) => handleNumberChange('receive_qty', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue_qty">Issue Qty</Label>
              <Input
                id="issue_qty"
                type="number"
                value={formData.issue_qty ?? ''}
                onChange={(e) => handleNumberChange('issue_qty', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks ?? ''}
              onChange={(e) => handleChange('remarks', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
