import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SewingActual {
  id: string;
  production_date: string;
  good_today: number;
  reject_today: number;
  rework_today: number;
  manpower_actual: number;
  ot_hours_actual: number;
  cumulative_good_total: number;
  remarks?: string | null;
}

interface EditSewingActualModalProps {
  submission: SewingActual | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditSewingActualModal({ submission, open, onOpenChange, onSaved }: EditSewingActualModalProps) {
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

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('sewing_actuals')
        .update({
          good_today: formData.good_today ?? 0,
          reject_today: formData.reject_today ?? 0,
          rework_today: formData.rework_today ?? 0,
          manpower_actual: formData.manpower_actual ?? 0,
          ot_hours_actual: formData.ot_hours_actual ?? 0,
          remarks: formData.remarks,
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
            <Factory className="h-5 w-5 text-primary" />
            Edit Sewing Submission
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="good_today">Good Today</Label>
              <Input
                id="good_today"
                type="number"
                value={formData.good_today ?? ''}
                onChange={(e) => handleNumberChange('good_today', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject_today">Reject Today</Label>
              <Input
                id="reject_today"
                type="number"
                value={formData.reject_today ?? ''}
                onChange={(e) => handleNumberChange('reject_today', e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rework_today">Rework Today</Label>
              <Input
                id="rework_today"
                type="number"
                value={formData.rework_today ?? ''}
                onChange={(e) => handleNumberChange('rework_today', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manpower_actual">Manpower</Label>
              <Input
                id="manpower_actual"
                type="number"
                value={formData.manpower_actual ?? ''}
                onChange={(e) => handleNumberChange('manpower_actual', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ot_hours_actual">OT Hours</Label>
            <Input
              id="ot_hours_actual"
              type="number"
              step="0.5"
              value={formData.ot_hours_actual ?? ''}
              onChange={(e) => handleNumberChange('ot_hours_actual', e.target.value)}
            />
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
