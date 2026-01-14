import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SewingTarget {
  id: string;
  production_date: string;
  per_hour_target: number;
  manpower_planned: number;
  ot_hours_planned: number;
  remarks?: string | null;
}

interface EditSewingTargetModalProps {
  target: SewingTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditSewingTargetModal({ target, open, onOpenChange, onSaved }: EditSewingTargetModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (target) {
      setFormData({ ...target });
    }
  }, [target]);

  if (!target) return null;

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
        .from('sewing_targets')
        .update({
          per_hour_target: formData.per_hour_target ?? 0,
          manpower_planned: formData.manpower_planned ?? 0,
          ot_hours_planned: formData.ot_hours_planned ?? 0,
          remarks: formData.remarks,
        })
        .eq('id', target.id);

      if (error) throw error;

      toast.success("Target updated successfully");
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      console.error('Error updating target:', error);
      toast.error(error.message || "Failed to update target");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" />
            Edit Sewing Target
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="per_hour_target">Per Hour Target</Label>
            <Input
              id="per_hour_target"
              type="number"
              value={formData.per_hour_target ?? ''}
              onChange={(e) => handleNumberChange('per_hour_target', e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manpower_planned">Manpower Planned</Label>
              <Input
                id="manpower_planned"
                type="number"
                value={formData.manpower_planned ?? ''}
                onChange={(e) => handleNumberChange('manpower_planned', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ot_hours_planned">OT Hours Planned</Label>
              <Input
                id="ot_hours_planned"
                type="number"
                step="0.5"
                value={formData.ot_hours_planned ?? ''}
                onChange={(e) => handleNumberChange('ot_hours_planned', e.target.value)}
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
