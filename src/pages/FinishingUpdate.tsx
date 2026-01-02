import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, ArrowLeft, CheckCircle2 } from "lucide-react";

interface Line {
  id: string;
  line_id: string;
  name: string | null;
  unit_id: string | null;
  floor_id: string | null;
}

interface Unit {
  id: string;
  name: string;
  code: string;
}

interface Floor {
  id: string;
  name: string;
  code: string;
}

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  order_qty: number;
  color: string | null;
  line_id: string | null;
}

interface Factory {
  id: string;
  name: string;
}

export default function FinishingUpdate() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Master data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [factory, setFactory] = useState<Factory | null>(null);

  // SECTION A - Selection fields
  const [selectedPO, setSelectedPO] = useState("");
  const [selectedLine, setSelectedLine] = useState("");

  // SECTION B - Auto-filled from PO/Line (read-only display)
  const [styleNo, setStyleNo] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [itemName, setItemName] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [unitName, setUnitName] = useState("");
  const [floorName, setFloorName] = useState("");

  // SECTION C - Worker-entered finishing metrics
  const [mPower, setMPower] = useState("");
  const [perHourTarget, setPerHourTarget] = useState("");
  const [dayQcPass, setDayQcPass] = useState("");
  const [totalQcPass, setTotalQcPass] = useState("");
  const [dayPoly, setDayPoly] = useState("");
  const [totalPoly, setTotalPoly] = useState("");
  const [averageProduction, setAverageProduction] = useState("");
  const [dayOverTime, setDayOverTime] = useState("");
  const [totalOverTime, setTotalOverTime] = useState("");
  const [dayHour, setDayHour] = useState("");
  const [totalHour, setTotalHour] = useState("");
  const [dayCarton, setDayCarton] = useState("");
  const [totalCarton, setTotalCarton] = useState("");
  const [remarks, setRemarks] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.factory_id, profile]);

  // Auto-fill PO details when PO is selected
  useEffect(() => {
    if (selectedPO) {
      const po = workOrders.find(w => w.id === selectedPO);
      if (po) {
        setStyleNo(po.style || "");
        setBuyerName(po.buyer || "");
        setItemName(po.item || "");
        setOrderQuantity(po.order_qty || 0);
      }
    } else {
      setStyleNo("");
      setBuyerName("");
      setItemName("");
      setOrderQuantity(0);
    }
  }, [selectedPO, workOrders]);

  // Auto-fill Unit/Floor when Line is selected
  useEffect(() => {
    if (selectedLine) {
      const line = lines.find(l => l.id === selectedLine);
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
  }, [selectedLine, lines, units, floors]);

  // Filter work orders by selected line
  const filteredWorkOrders = selectedLine 
    ? workOrders.filter(wo => wo.line_id === selectedLine)
    : [];

  // Auto-select PO when line is selected and only one PO exists
  useEffect(() => {
    if (selectedLine) {
      const lineWorkOrders = workOrders.filter(wo => wo.line_id === selectedLine);
      if (lineWorkOrders.length === 1) {
        setSelectedPO(lineWorkOrders[0].id);
      } else if (!lineWorkOrders.find(wo => wo.id === selectedPO)) {
        setSelectedPO("");
      }
    } else {
      setSelectedPO("");
    }
  }, [selectedLine, workOrders]);

  async function fetchFormData() {
    if (!profile?.factory_id) return;

    try {
      const [linesRes, workOrdersRes, unitsRes, floorsRes, factoryRes] = await Promise.all([
        supabase
          .from('lines')
          .select('id, line_id, name, unit_id, floor_id')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true)
          .order('line_id'),
        supabase
          .from('work_orders')
          .select('id, po_number, buyer, style, item, order_qty, color, line_id')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true)
          .order('po_number'),
        supabase
          .from('units')
          .select('id, name, code')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true),
        supabase
          .from('floors')
          .select('id, name, code')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true),
        supabase
          .from('factory_accounts')
          .select('id, name')
          .eq('id', profile.factory_id)
          .maybeSingle(),
      ]);

      setLines(linesRes.data || []);
      setWorkOrders(workOrdersRes.data || []);
      setUnits(unitsRes.data || []);
      setFloors(floorsRes.data || []);
      setFactory(factoryRes.data);
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    // Required selections
    if (!selectedPO) newErrors.po = "PO ID is required";
    if (!selectedLine) newErrors.line = "Line No. is required";

    // Required metrics - must be non-negative numbers
    const numericFields = [
      { key: "mPower", value: mPower, label: "M Power" },
      { key: "perHourTarget", value: perHourTarget, label: "Per Hour Target" },
      { key: "dayQcPass", value: dayQcPass, label: "Day QC Pass" },
      { key: "totalQcPass", value: totalQcPass, label: "Total QC Pass" },
      { key: "dayPoly", value: dayPoly, label: "Day Poly" },
      { key: "totalPoly", value: totalPoly, label: "Total Poly" },
      { key: "averageProduction", value: averageProduction, label: "Average Production" },
      { key: "dayOverTime", value: dayOverTime, label: "Day Over Time" },
      { key: "totalOverTime", value: totalOverTime, label: "Total Over Time" },
      { key: "dayHour", value: dayHour, label: "Day Hour" },
      { key: "totalHour", value: totalHour, label: "Total Hour" },
      { key: "dayCarton", value: dayCarton, label: "Day Carton" },
      { key: "totalCarton", value: totalCarton, label: "Total Carton" },
    ];

    numericFields.forEach(({ key, value, label }) => {
      if (value === "" || value === null || value === undefined) {
        newErrors[key] = `${label} is required`;
      } else {
        const num = parseFloat(value);
        if (isNaN(num)) {
          newErrors[key] = `${label} must be a valid number`;
        } else if (num < 0) {
          newErrors[key] = `${label} cannot be negative`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast({ variant: "destructive", title: "Please fix the errors below" });
      return;
    }

    setIsSubmitting(true);

    try {
      const insertData = {
        factory_id: profile?.factory_id,
        line_id: selectedLine,
        work_order_id: selectedPO,
        production_date: new Date().toISOString().split('T')[0],
        submitted_by: user?.id,
        
        // Stored snapshots from PO/Line
        style_no: styleNo,
        buyer_name: buyerName,
        item_name: itemName,
        order_quantity: orderQuantity,
        unit_name: unitName,
        floor_name: floorName,
        factory_name: factory?.name || "",
        
        // Worker-entered finishing metrics
        m_power: parseInt(mPower) || 0,
        per_hour_target: parseInt(perHourTarget) || 0,
        day_qc_pass: parseInt(dayQcPass) || 0,
        total_qc_pass: parseInt(totalQcPass) || 0,
        day_poly: parseInt(dayPoly) || 0,
        total_poly: parseInt(totalPoly) || 0,
        average_production: parseInt(averageProduction) || 0,
        day_over_time: parseFloat(dayOverTime) || 0,
        total_over_time: parseFloat(totalOverTime) || 0,
        day_hour: parseFloat(dayHour) || 0,
        total_hour: parseFloat(totalHour) || 0,
        day_carton: parseInt(dayCarton) || 0,
        total_carton: parseInt(totalCarton) || 0,
        remarks: remarks || null,
        
        // Legacy fields (set defaults)
        qc_pass_qty: parseInt(dayQcPass) || 0,
        manpower: parseInt(mPower) || 0,
      };

      const { error } = await supabase.from('production_updates_finishing').insert(insertData);

      if (error) throw error;

      toast({
        title: "Update submitted!",
        description: "Your finishing daily update has been recorded.",
      });

      // Reset form for next entry
      resetForm();
    } catch (error: any) {
      console.error('Error submitting update:', error);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error.message || "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedPO("");
    setSelectedLine("");
    setMPower("");
    setPerHourTarget("");
    setDayQcPass("");
    setTotalQcPass("");
    setDayPoly("");
    setTotalPoly("");
    setAverageProduction("");
    setDayOverTime("");
    setTotalOverTime("");
    setDayHour("");
    setTotalHour("");
    setDayCarton("");
    setTotalCarton("");
    setRemarks("");
    setErrors({});
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.factory_id) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Factory Assigned</h2>
            <p className="text-muted-foreground text-sm">
              You need to be assigned to a factory before you can submit production updates.
              Please contact your administrator.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-info" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Finishing Daily Update</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION A - Select References */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Line No. - First so PO can filter by it */}
            <div className="space-y-2">
              <Label htmlFor="line">Line No. *</Label>
              <Select value={selectedLine} onValueChange={setSelectedLine}>
                <SelectTrigger className={`h-12 ${errors.line ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Select Line" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.name || line.line_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.line && <p className="text-xs text-destructive">{errors.line}</p>}
            </div>

            {/* PO ID */}
            <div className="space-y-2">
              <Label htmlFor="po">PO ID *</Label>
              <Select 
                value={selectedPO} 
                onValueChange={setSelectedPO}
                disabled={!selectedLine || filteredWorkOrders.length === 0}
              >
                <SelectTrigger className={`h-12 ${errors.po ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder={!selectedLine ? "Select a line first" : filteredWorkOrders.length === 0 ? "No POs for this line" : "Select PO"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredWorkOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.po_number} - {wo.style} ({wo.buyer})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.po && <p className="text-xs text-destructive">{errors.po}</p>}
            </div>
          </CardContent>
        </Card>

        {/* SECTION B - Auto-filled Details (Read-Only) */}
        {(selectedPO || selectedLine) && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Auto-filled Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Style No</Label>
                  <div className="p-2 bg-background rounded border text-sm font-medium">
                    {styleNo || "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Buyer</Label>
                  <div className="p-2 bg-background rounded border text-sm font-medium">
                    {buyerName || "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Item</Label>
                  <div className="p-2 bg-background rounded border text-sm font-medium">
                    {itemName || "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Order Quantity</Label>
                  <div className="p-2 bg-background rounded border text-sm font-medium font-mono">
                    {orderQuantity > 0 ? orderQuantity.toLocaleString() : "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Unit</Label>
                  <div className="p-2 bg-background rounded border text-sm font-medium">
                    {unitName || "-"}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Floor</Label>
                  <div className="p-2 bg-background rounded border text-sm font-medium">
                    {floorName || "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION C - Finishing Metrics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Finishing Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: M Power & Per Hour Target */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>M Power *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={mPower}
                  onChange={(e) => setMPower(e.target.value)}
                  className={`h-12 ${errors.mPower ? 'border-destructive' : ''}`}
                />
                {errors.mPower && <p className="text-xs text-destructive">{errors.mPower}</p>}
              </div>
              <div className="space-y-2">
                <Label>Per Hour Target *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={perHourTarget}
                  onChange={(e) => setPerHourTarget(e.target.value)}
                  className={`h-12 ${errors.perHourTarget ? 'border-destructive' : ''}`}
                />
                {errors.perHourTarget && <p className="text-xs text-destructive">{errors.perHourTarget}</p>}
              </div>
            </div>

            {/* Row 2: Day QC Pass & Total QC Pass */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day QC Pass *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={dayQcPass}
                  onChange={(e) => setDayQcPass(e.target.value)}
                  className={`h-12 ${errors.dayQcPass ? 'border-destructive' : ''}`}
                />
                {errors.dayQcPass && <p className="text-xs text-destructive">{errors.dayQcPass}</p>}
              </div>
              <div className="space-y-2">
                <Label>Total QC Pass *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={totalQcPass}
                  onChange={(e) => setTotalQcPass(e.target.value)}
                  className={`h-12 ${errors.totalQcPass ? 'border-destructive' : ''}`}
                />
                {errors.totalQcPass && <p className="text-xs text-destructive">{errors.totalQcPass}</p>}
              </div>
            </div>

            {/* Row 3: Day Poly & Total Poly */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day Poly *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={dayPoly}
                  onChange={(e) => setDayPoly(e.target.value)}
                  className={`h-12 ${errors.dayPoly ? 'border-destructive' : ''}`}
                />
                {errors.dayPoly && <p className="text-xs text-destructive">{errors.dayPoly}</p>}
              </div>
              <div className="space-y-2">
                <Label>Total Poly *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={totalPoly}
                  onChange={(e) => setTotalPoly(e.target.value)}
                  className={`h-12 ${errors.totalPoly ? 'border-destructive' : ''}`}
                />
                {errors.totalPoly && <p className="text-xs text-destructive">{errors.totalPoly}</p>}
              </div>
            </div>

            {/* Row 4: Average Production */}
            <div className="space-y-2">
              <Label>Average Production *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={averageProduction}
                onChange={(e) => setAverageProduction(e.target.value)}
                className={`h-12 ${errors.averageProduction ? 'border-destructive' : ''}`}
              />
              {errors.averageProduction && <p className="text-xs text-destructive">{errors.averageProduction}</p>}
            </div>

            {/* Row 5: Day Over Time & Total Over Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day Over Time *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={dayOverTime}
                  onChange={(e) => setDayOverTime(e.target.value)}
                  className={`h-12 ${errors.dayOverTime ? 'border-destructive' : ''}`}
                />
                {errors.dayOverTime && <p className="text-xs text-destructive">{errors.dayOverTime}</p>}
              </div>
              <div className="space-y-2">
                <Label>Total Over Time *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={totalOverTime}
                  onChange={(e) => setTotalOverTime(e.target.value)}
                  className={`h-12 ${errors.totalOverTime ? 'border-destructive' : ''}`}
                />
                {errors.totalOverTime && <p className="text-xs text-destructive">{errors.totalOverTime}</p>}
              </div>
            </div>

            {/* Row 6: Day Hour & Total Hour */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day Hour *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={dayHour}
                  onChange={(e) => setDayHour(e.target.value)}
                  className={`h-12 ${errors.dayHour ? 'border-destructive' : ''}`}
                />
                {errors.dayHour && <p className="text-xs text-destructive">{errors.dayHour}</p>}
              </div>
              <div className="space-y-2">
                <Label>Total Hour *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={totalHour}
                  onChange={(e) => setTotalHour(e.target.value)}
                  className={`h-12 ${errors.totalHour ? 'border-destructive' : ''}`}
                />
                {errors.totalHour && <p className="text-xs text-destructive">{errors.totalHour}</p>}
              </div>
            </div>

            {/* Row 7: Day Carton & Total Carton */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Day Carton *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={dayCarton}
                  onChange={(e) => setDayCarton(e.target.value)}
                  className={`h-12 ${errors.dayCarton ? 'border-destructive' : ''}`}
                />
                {errors.dayCarton && <p className="text-xs text-destructive">{errors.dayCarton}</p>}
              </div>
              <div className="space-y-2">
                <Label>Total Carton *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={totalCarton}
                  onChange={(e) => setTotalCarton(e.target.value)}
                  className={`h-12 ${errors.totalCarton ? 'border-destructive' : ''}`}
                />
                {errors.totalCarton && <p className="text-xs text-destructive">{errors.totalCarton}</p>}
              </div>
            </div>

            {/* Remarks (Optional) */}
            <div className="space-y-2">
              <Label>Remarks (Optional)</Label>
              <Textarea
                placeholder="Add any additional notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <div className="max-w-2xl mx-auto">
            <Button 
              type="submit" 
              className="w-full h-14 text-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Update"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
