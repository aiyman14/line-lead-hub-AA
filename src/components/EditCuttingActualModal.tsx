import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Scissors } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CuttingActual {
  id: string;
  production_date: string;
  day_cutting: number;
  day_input: number;
  total_cutting: number | null;
  total_input: number | null;
  balance: number | null;
  order_qty: number | null;
}

interface EditCuttingActualModalProps {
  submission: CuttingActual | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditCuttingActualModal({ submission, open, onOpenChange, onSaved }: EditCuttingActualModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (submission) {
      setFormData({ ...submission });
    }
  }, [submission]);

  if (!submission) return null;

  const handleNumberChange = (field: string, value: string) => {
    const num = value === '' ? 0 : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: num }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('cutting_actuals')
        .update({
          day_cutting: formData.day_cutting ?? 0,
          day_input: formData.day_input ?? 0,
          total_cutting: formData.total_cutting,
          total_input: formData.total_input,
          balance: formData.balance,
        })
        .eq('id', submission.id);

      if (error) throw error;

      toast.success("Submission updated successfully");
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      console.error('Error updating submission:', error);
      toast.error(error.message || "Failed to update submission");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Edit Cutting Submission
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="day_cutting">Day Cutting</Label>
              <Input
                id="day_cutting"
                type="number"
                value={formData.day_cutting ?? ''}
                onChange={(e) => handleNumberChange('day_cutting', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="day_input">Day Input</Label>
              <Input
                id="day_input"
                type="number"
                value={formData.day_input ?? ''}
                onChange={(e) => handleNumberChange('day_input', e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_cutting">Total Cutting</Label>
              <Input
                id="total_cutting"
                type="number"
                value={formData.total_cutting ?? ''}
                onChange={(e) => handleNumberChange('total_cutting', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_input">Total Input</Label>
              <Input
                id="total_input"
                type="number"
                value={formData.total_input ?? ''}
                onChange={(e) => handleNumberChange('total_input', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance">Balance</Label>
            <Input
              id="balance"
              type="number"
              value={formData.balance ?? ''}
              onChange={(e) => handleNumberChange('balance', e.target.value)}
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
