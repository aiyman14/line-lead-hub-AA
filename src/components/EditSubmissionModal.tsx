import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Package } from "lucide-react";
import { SewingMachine } from "@/components/icons/SewingMachine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SewingSubmission {
  id: string;
  type: 'sewing';
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
  notes: string | null;
}

interface FinishingSubmission {
  id: string;
  type: 'finishing';
  m_power: number | null;
  per_hour_target: number | null;
  day_qc_pass: number | null;
  total_qc_pass: number | null;
  day_poly: number | null;
  total_poly: number | null;
  day_carton: number | null;
  total_carton: number | null;
  has_blocker: boolean;
  blocker_description: string | null;
  remarks: string | null;
}

type Submission = SewingSubmission | FinishingSubmission;

interface EditSubmissionModalProps {
  submission: Submission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditSubmissionModal({ submission, open, onOpenChange, onSaved }: EditSubmissionModalProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (submission) {
      setFormData({ ...submission });
    }
  }, [submission]);

  if (!submission) return null;

  const isSewing = submission.type === 'sewing';

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNumberChange = (field: string, value: string) => {
    const num = value === '' ? null : parseFloat(value);
    setFormData(prev => ({ ...prev, [field]: num }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const tableName = isSewing ? 'production_updates_sewing' : 'production_updates_finishing';
      
      // Build update object excluding non-editable fields
      const updateData: Record<string, any> = {};
      
      if (isSewing) {
        updateData.output_qty = formData.output_qty ?? 0;
        updateData.target_qty = formData.target_qty;
        updateData.manpower = formData.manpower;
        updateData.reject_qty = formData.reject_qty;
        updateData.rework_qty = formData.rework_qty;
        updateData.stage_progress = formData.stage_progress;
        updateData.ot_hours = formData.ot_hours;
        updateData.ot_manpower = formData.ot_manpower;
        updateData.has_blocker = formData.has_blocker ?? false;
        updateData.blocker_description = formData.blocker_description;
        updateData.notes = formData.notes;
      } else {
        updateData.m_power = formData.m_power;
        updateData.per_hour_target = formData.per_hour_target;
        updateData.day_qc_pass = formData.day_qc_pass;
        updateData.total_qc_pass = formData.total_qc_pass;
        updateData.day_poly = formData.day_poly;
        updateData.total_poly = formData.total_poly;
        updateData.day_carton = formData.day_carton;
        updateData.total_carton = formData.total_carton;
        updateData.has_blocker = formData.has_blocker ?? false;
        updateData.blocker_description = formData.blocker_description;
        updateData.remarks = formData.remarks;
      }

      const { error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', submission.id);

      if (error) throw error;

      toast.success(t('modals.submissionUpdatedSuccess'));
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      console.error('Error updating submission:', error);
      toast.error(error?.message || t('modals.failedToUpdateSubmission'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSewing ? (
              <SewingMachine className="h-5 w-5 text-primary" />
            ) : (
              <Package className="h-5 w-5 text-info" />
            )}
            {t(isSewing ? 'modals.editSewingSubmission' : 'modals.editFinishingSubmission')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isSewing ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="output_qty">{t('modals.outputQty')}</Label>
                  <Input
                    id="output_qty"
                    type="number"
                    value={formData.output_qty ?? ''}
                    onChange={(e) => handleNumberChange('output_qty', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target_qty">{t('modals.targetQty')}</Label>
                  <Input
                    id="target_qty"
                    type="number"
                    value={formData.target_qty ?? ''}
                    onChange={(e) => handleNumberChange('target_qty', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manpower">{t('modals.manpower')}</Label>
                  <Input
                    id="manpower"
                    type="number"
                    value={formData.manpower ?? ''}
                    onChange={(e) => handleNumberChange('manpower', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage_progress">{t('modals.progressPct')}</Label>
                  <Input
                    id="stage_progress"
                    type="number"
                    value={formData.stage_progress ?? ''}
                    onChange={(e) => handleNumberChange('stage_progress', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reject_qty">{t('modals.rejectQty')}</Label>
                  <Input
                    id="reject_qty"
                    type="number"
                    value={formData.reject_qty ?? ''}
                    onChange={(e) => handleNumberChange('reject_qty', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rework_qty">{t('modals.reworkQty')}</Label>
                  <Input
                    id="rework_qty"
                    type="number"
                    value={formData.rework_qty ?? ''}
                    onChange={(e) => handleNumberChange('rework_qty', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ot_hours">{t('modals.otHours')}</Label>
                  <Input
                    id="ot_hours"
                    type="number"
                    step="0.5"
                    value={formData.ot_hours ?? ''}
                    onChange={(e) => handleNumberChange('ot_hours', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ot_manpower">{t('modals.otManpower')}</Label>
                  <Input
                    id="ot_manpower"
                    type="number"
                    value={formData.ot_manpower ?? ''}
                    onChange={(e) => handleNumberChange('ot_manpower', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t('modals.notes')}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes ?? ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="m_power">{t('modals.mPower')}</Label>
                  <Input
                    id="m_power"
                    type="number"
                    value={formData.m_power ?? ''}
                    onChange={(e) => handleNumberChange('m_power', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="per_hour_target">{t('modals.perHourTarget')}</Label>
                  <Input
                    id="per_hour_target"
                    type="number"
                    value={formData.per_hour_target ?? ''}
                    onChange={(e) => handleNumberChange('per_hour_target', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="day_qc_pass">{t('modals.dayQcPass')}</Label>
                  <Input
                    id="day_qc_pass"
                    type="number"
                    value={formData.day_qc_pass ?? ''}
                    onChange={(e) => handleNumberChange('day_qc_pass', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_qc_pass">{t('modals.totalQcPass')}</Label>
                  <Input
                    id="total_qc_pass"
                    type="number"
                    value={formData.total_qc_pass ?? ''}
                    onChange={(e) => handleNumberChange('total_qc_pass', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="day_poly">{t('modals.dayPoly')}</Label>
                  <Input
                    id="day_poly"
                    type="number"
                    value={formData.day_poly ?? ''}
                    onChange={(e) => handleNumberChange('day_poly', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_poly">{t('modals.totalPoly')}</Label>
                  <Input
                    id="total_poly"
                    type="number"
                    value={formData.total_poly ?? ''}
                    onChange={(e) => handleNumberChange('total_poly', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="day_carton">{t('modals.dayCarton')}</Label>
                  <Input
                    id="day_carton"
                    type="number"
                    value={formData.day_carton ?? ''}
                    onChange={(e) => handleNumberChange('day_carton', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_carton">{t('modals.totalCarton')}</Label>
                  <Input
                    id="total_carton"
                    type="number"
                    value={formData.total_carton ?? ''}
                    onChange={(e) => handleNumberChange('total_carton', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">{t('modals.remarks')}</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks ?? ''}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Blocker section */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="has_blocker">{t('modals.hasBlocker')}</Label>
              <Switch
                id="has_blocker"
                checked={formData.has_blocker ?? false}
                onCheckedChange={(checked) => handleChange('has_blocker', checked)}
              />
            </div>
            {formData.has_blocker && (
              <div className="space-y-2">
                <Label htmlFor="blocker_description">{t('modals.blockerDescription')}</Label>
                <Textarea
                  id="blocker_description"
                  value={formData.blocker_description ?? ''}
                  onChange={(e) => handleChange('blocker_description', e.target.value)}
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('modals.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('modals.saving')}</>
            ) : (
              t('modals.saveChanges')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
