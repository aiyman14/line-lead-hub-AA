import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

export default function FinishingDailyOutput() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Master data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);

  // Form state
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [dayQcPass, setDayQcPass] = useState("");
  const [totalQcPass, setTotalQcPass] = useState("");
  const [dayPoly, setDayPoly] = useState("");
  const [totalPoly, setTotalPoly] = useState("");
  const [dayCarton, setDayCarton] = useState("");
  const [totalCarton, setTotalCarton] = useState("");
  const [averageProduction, setAverageProduction] = useState("");
  const [mPowerActual, setMPowerActual] = useState("");
  const [dayHourActual, setDayHourActual] = useState("");
  const [dayOverTimeActual, setDayOverTimeActual] = useState("0");
  const [totalHour, setTotalHour] = useState("");
  const [totalOverTime, setTotalOverTime] = useState("");
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
        linesRes, workOrdersRes, unitsRes, floorsRes, assignmentsRes
      ] = await Promise.all([
        supabase.from("lines").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("work_orders").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("units").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("floors").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
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
    } catch (error) {
      console.error("Error fetching form data:", error);
      toast.error(t("common.submissionFailed"));
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedLineId) newErrors.line = "Line is required";
    if (!selectedWorkOrderId) newErrors.workOrder = "PO is required";
    if (!dayQcPass || parseInt(dayQcPass) < 0) newErrors.dayQcPass = "Day QC Pass is required";
    if (!totalQcPass || parseInt(totalQcPass) < 0) newErrors.totalQcPass = "Total QC Pass is required";
    if (!dayPoly || parseInt(dayPoly) < 0) newErrors.dayPoly = "Day Poly is required";
    if (!totalPoly || parseInt(totalPoly) < 0) newErrors.totalPoly = "Total Poly is required";
    if (!dayCarton || parseInt(dayCarton) < 0) newErrors.dayCarton = "Day Carton is required";
    if (!totalCarton || parseInt(totalCarton) < 0) newErrors.totalCarton = "Total Carton is required";
    if (!mPowerActual || parseInt(mPowerActual) <= 0) newErrors.mPowerActual = "M Power is required";
    if (!dayHourActual || parseFloat(dayHourActual) < 0) newErrors.dayHourActual = "Day hours is required";
    if (dayOverTimeActual === "" || parseFloat(dayOverTimeActual) < 0) newErrors.dayOverTimeActual = "OT hours must be 0 or more";

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
        style_no: selectedWorkOrder?.style || "",
        item_name: selectedWorkOrder?.item || "",
        order_qty: selectedWorkOrder?.order_qty || 0,
        day_qc_pass: parseInt(dayQcPass),
        total_qc_pass: parseInt(totalQcPass),
        day_poly: parseInt(dayPoly),
        total_poly: parseInt(totalPoly),
        day_carton: parseInt(dayCarton),
        total_carton: parseInt(totalCarton),
        average_production: averageProduction ? parseInt(averageProduction) : 0,
        m_power_actual: parseInt(mPowerActual),
        day_hour_actual: parseFloat(dayHourActual),
        day_over_time_actual: parseFloat(dayOverTimeActual),
        total_hour: totalHour ? parseFloat(totalHour) : 0,
        total_over_time: totalOverTime ? parseFloat(totalOverTime) : 0,
        remarks: remarks || null,
      };

      const { error } = await supabase.from("finishing_actuals").insert(insertData as any);

      if (error) {
        if (error.code === "23505") {
          toast.error("Output already submitted for this line and PO today");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Finishing output submitted successfully!");
      
      if (isAdminOrHigher()) {
        navigate("/dashboard");
      } else {
        navigate("/finishing/my-submissions");
      }
    } catch (error: any) {
      console.error("Error submitting output:", error);
      toast.error(error.message || "Failed to submit output");
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
    <div className="container max-w-2xl py-4 px-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t("nav.finishingDailyOutput")}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
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

        {/* QC & Production Output */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">QC & Production Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day QC Pass *</Label>
                <Input
                  type="number"
                  value={dayQcPass}
                  onChange={(e) => setDayQcPass(e.target.value)}
                  placeholder="0"
                  className={errors.dayQcPass ? "border-destructive" : ""}
                />
                {errors.dayQcPass && <p className="text-sm text-destructive">{errors.dayQcPass}</p>}
              </div>

              <div className="space-y-2">
                <Label>Total QC Pass *</Label>
                <Input
                  type="number"
                  value={totalQcPass}
                  onChange={(e) => setTotalQcPass(e.target.value)}
                  placeholder="0"
                  className={errors.totalQcPass ? "border-destructive" : ""}
                />
                {errors.totalQcPass && <p className="text-sm text-destructive">{errors.totalQcPass}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day Poly *</Label>
                <Input
                  type="number"
                  value={dayPoly}
                  onChange={(e) => setDayPoly(e.target.value)}
                  placeholder="0"
                  className={errors.dayPoly ? "border-destructive" : ""}
                />
                {errors.dayPoly && <p className="text-sm text-destructive">{errors.dayPoly}</p>}
              </div>

              <div className="space-y-2">
                <Label>Total Poly *</Label>
                <Input
                  type="number"
                  value={totalPoly}
                  onChange={(e) => setTotalPoly(e.target.value)}
                  placeholder="0"
                  className={errors.totalPoly ? "border-destructive" : ""}
                />
                {errors.totalPoly && <p className="text-sm text-destructive">{errors.totalPoly}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day Carton *</Label>
                <Input
                  type="number"
                  value={dayCarton}
                  onChange={(e) => setDayCarton(e.target.value)}
                  placeholder="0"
                  className={errors.dayCarton ? "border-destructive" : ""}
                />
                {errors.dayCarton && <p className="text-sm text-destructive">{errors.dayCarton}</p>}
              </div>

              <div className="space-y-2">
                <Label>Total Carton *</Label>
                <Input
                  type="number"
                  value={totalCarton}
                  onChange={(e) => setTotalCarton(e.target.value)}
                  placeholder="0"
                  className={errors.totalCarton ? "border-destructive" : ""}
                />
                {errors.totalCarton && <p className="text-sm text-destructive">{errors.totalCarton}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Average Production</Label>
              <Input
                type="number"
                value={averageProduction}
                onChange={(e) => setAverageProduction(e.target.value)}
                placeholder="0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Manpower & Hours */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Manpower & Hours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>M Power Actual *</Label>
                <Input
                  type="number"
                  value={mPowerActual}
                  onChange={(e) => setMPowerActual(e.target.value)}
                  placeholder="0"
                  className={errors.mPowerActual ? "border-destructive" : ""}
                />
                {errors.mPowerActual && <p className="text-sm text-destructive">{errors.mPowerActual}</p>}
              </div>

              <div className="space-y-2">
                <Label>Day Hours Actual *</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={dayHourActual}
                  onChange={(e) => setDayHourActual(e.target.value)}
                  placeholder="0"
                  className={errors.dayHourActual ? "border-destructive" : ""}
                />
                {errors.dayHourActual && <p className="text-sm text-destructive">{errors.dayHourActual}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>OT Hours Actual *</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={dayOverTimeActual}
                  onChange={(e) => setDayOverTimeActual(e.target.value)}
                  placeholder="0"
                  className={errors.dayOverTimeActual ? "border-destructive" : ""}
                />
                {errors.dayOverTimeActual && <p className="text-sm text-destructive">{errors.dayOverTimeActual}</p>}
              </div>

              <div className="space-y-2">
                <Label>Total Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={totalHour}
                  onChange={(e) => setTotalHour(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Total OT Hours</Label>
              <Input
                type="number"
                step="0.5"
                value={totalOverTime}
                onChange={(e) => setTotalOverTime(e.target.value)}
                placeholder="0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Optional Fields */}
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
        <div className="mt-6 pb-2">
          <Button type="submit" className="w-full h-12 text-base font-medium" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Finishing Output"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
