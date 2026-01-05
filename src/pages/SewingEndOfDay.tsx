import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
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

export default function SewingEndOfDay() {
  const navigate = useNavigate();
  const { user, profile, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Master data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [progressOptions, setProgressOptions] = useState<DropdownOption[]>([]);

  // Form state
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [goodToday, setGoodToday] = useState("");
  const [rejectToday, setRejectToday] = useState("");
  const [reworkToday, setReworkToday] = useState("");
  const [cumulativeGoodTotal, setCumulativeGoodTotal] = useState("");
  const [manpowerActual, setManpowerActual] = useState("");
  const [otHoursActual, setOtHoursActual] = useState("0");
  const [actualStageId, setActualStageId] = useState("");
  const [actualStageProgress, setActualStageProgress] = useState("");
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
      const [
        linesRes, workOrdersRes, unitsRes, floorsRes, stagesRes,
        progressRes, assignmentsRes
      ] = await Promise.all([
        supabase.from("lines").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("work_orders").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("units").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("floors").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("stages").select("*").eq("factory_id", profile.factory_id).eq("is_active", true).order("sequence"),
        supabase.from("stage_progress_options").select("*").eq("factory_id", profile.factory_id).eq("is_active", true).order("sort_order"),
        supabase.from("user_line_assignments").select("line_id").eq("user_id", user?.id || ""),
      ]);

      let availableLines = linesRes.data || [];
      
      if (!isAdminOrHigher() && assignmentsRes.data && assignmentsRes.data.length > 0) {
        const assignedLineIds = assignmentsRes.data.map(a => a.line_id);
        availableLines = availableLines.filter(l => assignedLineIds.includes(l.id));
      }

      setLines(availableLines);
      setWorkOrders(workOrdersRes.data || []);
      setUnits(unitsRes.data || []);
      setFloors(floorsRes.data || []);
      setStages(stagesRes.data || []);
      setProgressOptions(progressRes.data || []);
    } catch (error) {
      console.error("Error fetching form data:", error);
      toast.error("Failed to load form data");
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedLineId) newErrors.line = "Line is required";
    if (!selectedWorkOrderId) newErrors.workOrder = "PO is required";
    if (!goodToday || parseInt(goodToday) < 0) newErrors.goodToday = "Good output is required";
    if (!rejectToday || parseInt(rejectToday) < 0) newErrors.rejectToday = "Reject count is required";
    if (!reworkToday || parseInt(reworkToday) < 0) newErrors.reworkToday = "Rework count is required";
    if (!cumulativeGoodTotal || parseInt(cumulativeGoodTotal) < 0) newErrors.cumulativeGoodTotal = "Cumulative total is required";
    if (!manpowerActual || parseInt(manpowerActual) <= 0) newErrors.manpowerActual = "Manpower is required";
    if (otHoursActual === "" || parseFloat(otHoursActual) < 0) newErrors.otHoursActual = "OT hours must be 0 or more";
    if (!actualStageId) newErrors.actualStage = "Stage is required";
    if (!actualStageProgress) newErrors.actualStageProgress = "Stage progress is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!profile?.factory_id || !user?.id) {
      toast.error("Missing user or factory information");
      return;
    }

    setSubmitting(true);

    try {
      const insertData = {
        factory_id: profile.factory_id,
        production_date: format(new Date(), "yyyy-MM-dd"),
        submitted_by: user.id,
        line_id: selectedLineId,
        work_order_id: selectedWorkOrderId,
        unit_name: unitName,
        floor_name: floorName,
        buyer_name: selectedWorkOrder?.buyer || "",
        style_code: selectedWorkOrder?.style || "",
        item_name: selectedWorkOrder?.item || "",
        order_qty: selectedWorkOrder?.order_qty || 0,
        good_today: parseInt(goodToday),
        reject_today: parseInt(rejectToday),
        rework_today: parseInt(reworkToday),
        cumulative_good_total: parseInt(cumulativeGoodTotal),
        manpower_actual: parseInt(manpowerActual),
        ot_hours_actual: parseFloat(otHoursActual),
        actual_stage_id: actualStageId,
        actual_stage_progress: parseInt(actualStageProgress),
        remarks: remarks || null,
      };

      const { error } = await supabase.from("sewing_actuals").insert(insertData as any);

      if (error) {
        if (error.code === "23505") {
          toast.error("Actuals already submitted for this line and PO today");
        } else {
          throw error;
        }
        return;
      }

      toast.success("End of day actuals submitted successfully!");
      
      if (isAdminOrHigher()) {
        navigate("/dashboard");
      } else {
        navigate("/my-submissions");
      }
    } catch (error: any) {
      console.error("Error submitting actuals:", error);
      toast.error(error.message || "Failed to submit actuals");
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
        <p className="text-muted-foreground">No factory assigned to your account.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-4 px-4 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Sewing — End of Day Output</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line & PO Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Line & PO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Line No. *</Label>
              <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                <SelectTrigger className={errors.line ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select line" />
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
              <Label>PO Number *</Label>
              <Select value={selectedWorkOrderId} onValueChange={setSelectedWorkOrderId}>
                <SelectTrigger className={errors.workOrder ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select PO" />
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
              <CardTitle className="text-base">Order Details (Auto-filled)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Buyer:</span>
                  <p className="font-medium">{selectedWorkOrder.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Style:</span>
                  <p className="font-medium">{selectedWorkOrder.style}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Item:</span>
                  <p className="font-medium">{selectedWorkOrder.item || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Order Qty:</span>
                  <p className="font-medium">{selectedWorkOrder.order_qty.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Unit:</span>
                  <p className="font-medium">{unitName || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Floor:</span>
                  <p className="font-medium">{floorName || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actual Output */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today's Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Good Output *</Label>
                <Input
                  type="number"
                  value={goodToday}
                  onChange={(e) => setGoodToday(e.target.value)}
                  placeholder="0"
                  className={errors.goodToday ? "border-destructive" : ""}
                />
                {errors.goodToday && <p className="text-sm text-destructive">{errors.goodToday}</p>}
              </div>

              <div className="space-y-2">
                <Label>Reject *</Label>
                <Input
                  type="number"
                  value={rejectToday}
                  onChange={(e) => setRejectToday(e.target.value)}
                  placeholder="0"
                  className={errors.rejectToday ? "border-destructive" : ""}
                />
                {errors.rejectToday && <p className="text-sm text-destructive">{errors.rejectToday}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rework *</Label>
                <Input
                  type="number"
                  value={reworkToday}
                  onChange={(e) => setReworkToday(e.target.value)}
                  placeholder="0"
                  className={errors.reworkToday ? "border-destructive" : ""}
                />
                {errors.reworkToday && <p className="text-sm text-destructive">{errors.reworkToday}</p>}
              </div>

              <div className="space-y-2">
                <Label>Cumulative Good Total *</Label>
                <Input
                  type="number"
                  value={cumulativeGoodTotal}
                  onChange={(e) => setCumulativeGoodTotal(e.target.value)}
                  placeholder="0"
                  className={errors.cumulativeGoodTotal ? "border-destructive" : ""}
                />
                {errors.cumulativeGoodTotal && <p className="text-sm text-destructive">{errors.cumulativeGoodTotal}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Manpower Actual *</Label>
                <Input
                  type="number"
                  value={manpowerActual}
                  onChange={(e) => setManpowerActual(e.target.value)}
                  placeholder="0"
                  className={errors.manpowerActual ? "border-destructive" : ""}
                />
                {errors.manpowerActual && <p className="text-sm text-destructive">{errors.manpowerActual}</p>}
              </div>

              <div className="space-y-2">
                <Label>OT Hours Actual *</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={otHoursActual}
                  onChange={(e) => setOtHoursActual(e.target.value)}
                  placeholder="0"
                  className={errors.otHoursActual ? "border-destructive" : ""}
                />
                {errors.otHoursActual && <p className="text-sm text-destructive">{errors.otHoursActual}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage & Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stage & Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Actual Stage *</Label>
              <Select value={actualStageId} onValueChange={setActualStageId}>
                <SelectTrigger className={errors.actualStage ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.actualStage && <p className="text-sm text-destructive">{errors.actualStage}</p>}
            </div>

            <div className="space-y-2">
              <Label>Stage Progress *</Label>
              <Select value={actualStageProgress} onValueChange={setActualStageProgress}>
                <SelectTrigger className={errors.actualStageProgress ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select progress" />
                </SelectTrigger>
                <SelectContent>
                  {progressOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.label}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.actualStageProgress && <p className="text-sm text-destructive">{errors.actualStageProgress}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Optional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t z-50">
          <div className="max-w-2xl mx-auto px-4">
            <Button type="submit" className="w-full h-12 text-base font-medium" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit End of Day Actuals"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
