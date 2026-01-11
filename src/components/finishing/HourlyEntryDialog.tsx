import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface HourlyLog {
  id: string;
  sheet_id: string;
  hour_slot: string;
  thread_cutting_target: number;
  thread_cutting_actual: number;
  inside_check_target: number;
  inside_check_actual: number;
  top_side_check_target: number;
  top_side_check_actual: number;
  buttoning_target: number;
  buttoning_actual: number;
  iron_target: number;
  iron_actual: number;
  get_up_target: number;
  get_up_actual: number;
  poly_target: number;
  poly_actual: number;
  carton_target: number;
  carton_actual: number;
  remarks: string | null;
  is_locked: boolean;
  submitted_at: string;
  submitted_by: string;
}

interface HourlyEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hourSlot: string;
  existingLog: HourlyLog | null;
  onSave: (data: Partial<HourlyLog>) => Promise<void>;
  isAdmin: boolean;
}

const PROCESSES = [
  { key: "thread_cutting", label: "Thread Cutting" },
  { key: "inside_check", label: "Inside Check" },
  { key: "top_side_check", label: "Top Side Check" },
  { key: "buttoning", label: "Buttoning" },
  { key: "iron", label: "Iron" },
  { key: "get_up", label: "Get-up" },
  { key: "poly", label: "Poly" },
  { key: "carton", label: "Carton" },
];

export function HourlyEntryDialog({
  open,
  onOpenChange,
  hourSlot,
  existingLog,
  onSave,
  isAdmin,
}: HourlyEntryDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, number | string>>({});

  useEffect(() => {
    if (open) {
      if (existingLog) {
        setFormData({
          thread_cutting_target: existingLog.thread_cutting_target,
          thread_cutting_actual: existingLog.thread_cutting_actual,
          inside_check_target: existingLog.inside_check_target,
          inside_check_actual: existingLog.inside_check_actual,
          top_side_check_target: existingLog.top_side_check_target,
          top_side_check_actual: existingLog.top_side_check_actual,
          buttoning_target: existingLog.buttoning_target,
          buttoning_actual: existingLog.buttoning_actual,
          iron_target: existingLog.iron_target,
          iron_actual: existingLog.iron_actual,
          get_up_target: existingLog.get_up_target,
          get_up_actual: existingLog.get_up_actual,
          poly_target: existingLog.poly_target,
          poly_actual: existingLog.poly_actual,
          carton_target: existingLog.carton_target,
          carton_actual: existingLog.carton_actual,
          remarks: existingLog.remarks || "",
        });
      } else {
        // Initialize with zeros
        const initial: Record<string, number | string> = { remarks: "" };
        PROCESSES.forEach(p => {
          initial[`${p.key}_target`] = 0;
          initial[`${p.key}_actual`] = 0;
        });
        setFormData(initial);
      }
    }
  }, [open, existingLog]);

  const handleChange = (key: string, value: string) => {
    if (key === "remarks") {
      setFormData(prev => ({ ...prev, [key]: value }));
    } else {
      setFormData(prev => ({ ...prev, [key]: parseInt(value) || 0 }));
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(formData as any);
    } finally {
      setSaving(false);
    }
  };

  const isLocked = existingLog?.is_locked && !isAdmin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingLog ? "Edit" : "Log"} Hour: {hourSlot}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLocked && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200">
              This hour is locked. Contact an admin to make changes.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {PROCESSES.map(process => (
              <div key={process.key} className="border rounded-lg p-3">
                <Label className="font-medium mb-2 block">{process.label}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Target</Label>
                    <Input
                      type="number"
                      value={formData[`${process.key}_target`] || 0}
                      onChange={(e) => handleChange(`${process.key}_target`, e.target.value)}
                      disabled={isLocked}
                      min={0}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Actual</Label>
                    <Input
                      type="number"
                      value={formData[`${process.key}_actual`] || 0}
                      onChange={(e) => handleChange(`${process.key}_actual`, e.target.value)}
                      disabled={isLocked}
                      min={0}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Remarks (Optional)</Label>
            <Textarea
              value={formData.remarks as string || ""}
              onChange={(e) => handleChange("remarks", e.target.value)}
              placeholder="Any notes for this hour..."
              rows={2}
              disabled={isLocked}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || isLocked}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Hour"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
