import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useEditPermission } from "@/hooks/useEditPermission";

interface Line {
  id: string;
  line_id: string;
  name: string | null;
  unit_id: string | null;
  floor_id: string | null;
}

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  order_qty: number;
  line_id: string | null;
}

interface Unit {
  id: string;
  name: string;
}

interface Floor {
  id: string;
  name: string;
  unit_id: string;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

interface DropdownOption {
  id: string;
  label: string;
}

export default function SewingMorningTargets() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, profile, factory, isAdminOrHigher } = useAuth();
  const { canEditSubmission } = useEditPermission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const dateLocale = i18n.language === 'bn' ? 'bn-BD' : 'en-US';

  // Master data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [milestoneOptions, setMilestoneOptions] = useState<DropdownOption[]>([]);
  const [progressOptions, setProgressOptions] = useState<DropdownOption[]>([]);

  // Form state
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [perHourTarget, setPerHourTarget] = useState("");
  const [manpowerPlanned, setManpowerPlanned] = useState("");
  const [otHoursPlanned, setOtHoursPlanned] = useState("0");
  const [plannedStageId, setPlannedStageId] = useState("");
  const [plannedStageProgress, setPlannedStageProgress] = useState("");
  const [nextMilestone, setNextMilestone] = useState("");
  const [estimatedExFactory, setEstimatedExFactory] = useState("");
  const [remarks, setRemarks] = useState("");

  // Auto-filled
  const [unitName, setUnitName] = useState("");
  const [floorName, setFloorName] = useState("");

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredWorkOrders = useMemo(() => {
    if (!selectedLineId) return workOrders;
    return workOrders.filter(wo => wo.line_id === selectedLineId || !wo.line_id);
  }, [workOrders, selectedLineId]);

  const selectedWorkOrder = useMemo(() => {
    return workOrders.find(wo => wo.id === selectedWorkOrderId);
  }, [workOrders, selectedWorkOrderId]);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    }
  }, [profile?.factory_id]);

  useEffect(() => {
    if (selectedLineId) {
      const line = lines.find(l => l.id === selectedLineId);
      if (line) {
        const unit = units.find(u => u.id === line.unit_id);
        const floor = floors.find(f => f.id === line.floor_id);
        setUnitName(unit?.name || "");
        setFloorName(floor?.name || "");
      }
    } else {
      setUnitName("");
      setFloorName("");
    }
  }, [selectedLineId, lines, units, floors]);

  async function fetchFormData() {
    if (!profile?.factory_id) return;

    try {
      const [linesRes, workOrdersRes, unitsRes, floorsRes, stagesRes, milestonesRes, progressRes, assignmentsRes] = await Promise.all([
        supabase.from("lines").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("work_orders").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("units").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("floors").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("stages").select("*").eq("factory_id", profile.factory_id).eq("is_active", true).order("sequence"),
        supabase.from("next_milestone_options").select("*").eq("factory_id", profile.factory_id).eq("is_active", true).order("sort_order"),
        supabase.from("stage_progress_options").select("*").eq("factory_id", profile.factory_id).eq("is_active", true).order("sort_order"),
        supabase.from("user_line_assignments").select("line_id").eq("user_id", user?.id || ""),
      ]);

      let availableLines = linesRes.data || [];
      
      // Filter lines by assignment for non-admins
      if (!isAdminOrHigher() && assignmentsRes.data && assignmentsRes.data.length > 0) {
        const assignedLineIds = assignmentsRes.data.map(a => a.line_id);
        availableLines = availableLines.filter(l => assignedLineIds.includes(l.id));
      }

      setLines(availableLines);
      setWorkOrders(workOrdersRes.data || []);
      setUnits(unitsRes.data || []);
      setFloors(floorsRes.data || []);
      setStages(stagesRes.data || []);
      setMilestoneOptions(milestonesRes.data || []);
      setProgressOptions(progressRes.data || []);
    } catch (error) {
      console.error("Error fetching form data:", error);
      toast.error(t("common.submissionFailed"));
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedLineId) newErrors.line = t("forms.lineRequired");
    if (!selectedWorkOrderId) newErrors.workOrder = t("forms.poRequired");
    if (!perHourTarget || parseInt(perHourTarget) <= 0) newErrors.perHourTarget = t("forms.targetRequired");
    if (!manpowerPlanned || parseInt(manpowerPlanned) <= 0) newErrors.manpowerPlanned = t("forms.manpowerRequired");
    if (otHoursPlanned === "" || parseFloat(otHoursPlanned) < 0) newErrors.otHoursPlanned = t("forms.otHoursRequired");
    if (!plannedStageId) newErrors.plannedStage = t("forms.stageRequired");
    if (!plannedStageProgress) newErrors.plannedStageProgress = t("forms.progressRequired");
    if (!nextMilestone) newErrors.nextMilestone = t("forms.milestoneRequired");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(t("common.fillRequiredFields"));
      return;
    }

    if (!profile?.factory_id || !user?.id) {
      toast.error(t("common.submissionFailed"));
      return;
    }

    setSubmitting(true);

    try {
      // Check if submission is late based on morning_target_cutoff
      let isLate = false;
      if (factory?.morning_target_cutoff) {
        const now = new Date();
        const [cutoffHour, cutoffMinute] = factory.morning_target_cutoff.split(':').map(Number);
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffHour, cutoffMinute, 0, 0);
        isLate = now > cutoffTime;
      }

      const productionDate = format(new Date(), "yyyy-MM-dd");

      const insertData = {
        factory_id: profile.factory_id,
        production_date: productionDate,
        submitted_by: user.id,
        line_id: selectedLineId,
        work_order_id: selectedWorkOrderId,
        unit_name: unitName,
        floor_name: floorName,
        buyer_name: selectedWorkOrder?.buyer || "",
        style_code: selectedWorkOrder?.style || "",
        item_name: selectedWorkOrder?.item || "",
        order_qty: selectedWorkOrder?.order_qty || 0,
        per_hour_target: parseInt(perHourTarget),
        manpower_planned: parseInt(manpowerPlanned),
        ot_hours_planned: parseFloat(otHoursPlanned),
        planned_stage_id: plannedStageId,
        planned_stage_progress: parseInt(plannedStageProgress),
        next_milestone: nextMilestone,
        estimated_ex_factory: estimatedExFactory || null,
        remarks: remarks || null,
        is_late: isLate,
      };

      // If a submission already exists for today+line+PO, update it (only if still within edit window)
      const { data: existing, error: existingError } = await supabase
        .from("sewing_targets")
        .select("id")
        .eq("factory_id", profile.factory_id)
        .eq("production_date", productionDate)
        .eq("line_id", selectedLineId)
        .eq("work_order_id", selectedWorkOrderId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        const { canEdit, reason } = canEditSubmission(productionDate, user.id);
        if (!canEdit) {
          toast.error(reason || t("common.submissionFailed"));
          setSubmitting(false);
          return;
        }

        const { error: updateError } = await supabase
          .from("sewing_targets")
          .update(insertData)
          .eq("id", existing.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("sewing_targets")
          .insert(insertData);

        if (insertError) throw insertError;
      }
      toast.success(t("common.submissionSuccess"));
      
      if (isAdminOrHigher()) {
        navigate("/dashboard");
      } else {
        navigate("/my-submissions");
      }
    } catch (error: any) {
      console.error("Error submitting targets:", error);
      toast.error(t("common.submissionFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <p className="text-muted-foreground">{t("common.noFactoryAssigned")}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-4 px-4 pb-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{t("forms.sewingMorningTargets")}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line & PO Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("forms.selectLinePO")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("forms.lineNo")} *</Label>
              <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                <SelectTrigger className={errors.line ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("forms.selectLine")} />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name || line.line_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.line && <p className="text-sm text-destructive">{errors.line}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("forms.poNumber")} *</Label>
              <Select value={selectedWorkOrderId} onValueChange={setSelectedWorkOrderId}>
                <SelectTrigger className={errors.workOrder ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("forms.selectPO")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredWorkOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.po_number} - {wo.style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.workOrder && <p className="text-sm text-destructive">{errors.workOrder}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Auto-filled Details */}
        {selectedWorkOrder && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("forms.orderDetailsAuto")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("forms.buyer")}:</span>
                  <p className="font-medium">{selectedWorkOrder.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.style")}:</span>
                  <p className="font-medium">{selectedWorkOrder.style}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.item")}:</span>
                  <p className="font-medium">{selectedWorkOrder.item || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.orderQty")}:</span>
                  <p className="font-medium">{selectedWorkOrder.order_qty.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.unit")}:</span>
                  <p className="font-medium">{unitName || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("forms.floor")}:</span>
                  <p className="font-medium">{floorName || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Target Fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("forms.todaysTargets")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("forms.perHourTarget")} *</Label>
                <Input
                  type="number"
                  value={perHourTarget}
                  onChange={(e) => setPerHourTarget(e.target.value)}
                  placeholder="0"
                  className={errors.perHourTarget ? "border-destructive" : ""}
                />
                {errors.perHourTarget && <p className="text-sm text-destructive">{errors.perHourTarget}</p>}
              </div>

              <div className="space-y-2">
                <Label>{t("forms.manpowerPlanned")} *</Label>
                <Input
                  type="number"
                  value={manpowerPlanned}
                  onChange={(e) => setManpowerPlanned(e.target.value)}
                  placeholder="0"
                  className={errors.manpowerPlanned ? "border-destructive" : ""}
                />
                {errors.manpowerPlanned && <p className="text-sm text-destructive">{errors.manpowerPlanned}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("forms.otHoursPlanned")} *</Label>
              <Input
                type="number"
                step="0.5"
                value={otHoursPlanned}
                onChange={(e) => setOtHoursPlanned(e.target.value)}
                placeholder="0"
                className={errors.otHoursPlanned ? "border-destructive" : ""}
              />
              {errors.otHoursPlanned && <p className="text-sm text-destructive">{errors.otHoursPlanned}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Stage & Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("forms.stageProgress")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("forms.plannedStage")} *</Label>
              <Select value={plannedStageId} onValueChange={setPlannedStageId}>
                <SelectTrigger className={errors.plannedStage ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("forms.selectStage")} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.plannedStage && <p className="text-sm text-destructive">{errors.plannedStage}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("forms.stageProgressLabel")} *</Label>
              <Select value={plannedStageProgress} onValueChange={setPlannedStageProgress}>
                <SelectTrigger className={errors.plannedStageProgress ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("forms.selectProgress")} />
                </SelectTrigger>
                <SelectContent>
                  {progressOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.label}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.plannedStageProgress && <p className="text-sm text-destructive">{errors.plannedStageProgress}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("forms.nextMilestone")} *</Label>
              <Select value={nextMilestone} onValueChange={setNextMilestone}>
                <SelectTrigger className={errors.nextMilestone ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("forms.selectMilestone")} />
                </SelectTrigger>
                <SelectContent>
                  {milestoneOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.label}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.nextMilestone && <p className="text-sm text-destructive">{errors.nextMilestone}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("forms.estimatedExFactory")}</Label>
              <Input
                type="date"
                value={estimatedExFactory}
                onChange={(e) => setEstimatedExFactory(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Optional Fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("forms.optional")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>{t("forms.remarks")}</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={t("forms.addAnyNotes")}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("forms.submitting")}
            </>
          ) : (
            t("forms.submitTargets")
          )}
        </Button>
      </form>
    </div>
  );
}
