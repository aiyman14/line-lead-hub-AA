import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Scissors, CheckCircle, Shirt, CircleDot, Flame, Package, Box, Archive, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Line {
  id: string;
  line_id: string;
  name: string | null;
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

interface TargetLog {
  id: string;
  thread_cutting: number;
  inside_check: number;
  top_side_check: number;
  buttoning: number;
  iron: number;
  get_up: number;
  poly: number;
  carton: number;
}

// Process categories matching the hourly grid
const PROCESS_CATEGORIES = [
  { key: "thread_cutting", label: "Thread Cutting", icon: Scissors },
  { key: "inside_check", label: "Inside Check", icon: CheckCircle },
  { key: "top_side_check", label: "Top Side Check", icon: Shirt },
  { key: "buttoning", label: "Buttoning", icon: CircleDot },
  { key: "iron", label: "Iron", icon: Flame },
  { key: "get_up", label: "Get-up", icon: Package },
  { key: "poly", label: "Poly", icon: Box },
  { key: "carton", label: "Carton", icon: Archive },
] as const;

type ProcessKey = typeof PROCESS_CATEGORIES[number]["key"];

export default function FinishingDailyOutput() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user, profile, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingLog, setExistingLog] = useState<any>(null);
  const [targetLog, setTargetLog] = useState<TargetLog | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Master data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedLineId, setSelectedLineId] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [shift, setShift] = useState("");
  const [remarks, setRemarks] = useState("");

  // Process category values
  const [processValues, setProcessValues] = useState<Record<ProcessKey, string>>({
    thread_cutting: "",
    inside_check: "",
    top_side_check: "",
    buttoning: "",
    iron: "",
    get_up: "",
    poly: "",
    carton: "",
  });

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

  // Check for existing log and target when line/date/work order changes
  useEffect(() => {
    if (selectedLineId && selectedDate && profile?.factory_id) {
      checkExistingLogs();
    }
  }, [selectedLineId, selectedDate, selectedWorkOrderId, profile?.factory_id]);

  async function fetchFormData() {
    if (!profile?.factory_id) return;

    try {
      const [linesRes, workOrdersRes, assignmentsRes] = await Promise.all([
        supabase.from("lines").select("id, line_id, name").eq("factory_id", profile.factory_id).eq("is_active", true).order("line_id"),
        supabase.from("work_orders").select("id, po_number, buyer, style, item, order_qty, line_id").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("user_line_assignments").select("line_id").eq("user_id", user?.id || ""),
      ]);

      let availableLines = linesRes.data || [];
      
      if (!isAdminOrHigher() && assignmentsRes.data && assignmentsRes.data.length > 0) {
        const assignedLineIds = assignmentsRes.data.map(a => a.line_id);
        availableLines = availableLines.filter(l => assignedLineIds.includes(l.id));
      }

      setLines(availableLines);
      setWorkOrders(workOrdersRes.data || []);

      // Pre-select from URL params
      const lineParam = searchParams.get("line");
      const woParam = searchParams.get("wo");
      if (lineParam && availableLines.find(l => l.id === lineParam)) {
        setSelectedLineId(lineParam);
      }
      if (woParam && (workOrdersRes.data || []).find(w => w.id === woParam)) {
        setSelectedWorkOrderId(woParam);
      }
    } catch (error) {
      console.error("Error fetching form data:", error);
      toast.error("Failed to load form data");
    } finally {
      setLoading(false);
    }
  }

  async function checkExistingLogs() {
    if (!profile?.factory_id || !selectedLineId) return;

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      
      // Build query for existing output and target
      let outputQuery = supabase
        .from("finishing_daily_logs")
        .select("*")
        .eq("factory_id", profile.factory_id)
        .eq("production_date", dateStr)
        .eq("line_id", selectedLineId)
        .eq("log_type", "OUTPUT");

      let targetQuery = supabase
        .from("finishing_daily_logs")
        .select("*")
        .eq("factory_id", profile.factory_id)
        .eq("production_date", dateStr)
        .eq("line_id", selectedLineId)
        .eq("log_type", "TARGET");

      if (selectedWorkOrderId) {
        outputQuery = outputQuery.eq("work_order_id", selectedWorkOrderId);
        targetQuery = targetQuery.eq("work_order_id", selectedWorkOrderId);
      } else {
        outputQuery = outputQuery.is("work_order_id", null);
        targetQuery = targetQuery.is("work_order_id", null);
      }

      const [outputRes, targetRes] = await Promise.all([
        outputQuery.maybeSingle(),
        targetQuery.maybeSingle()
      ]);

      if (outputRes.error) throw outputRes.error;
      if (targetRes.error) throw targetRes.error;

      // Set target for comparison
      if (targetRes.data) {
        setTargetLog(targetRes.data);
      } else {
        setTargetLog(null);
      }

      if (outputRes.data) {
        setExistingLog(outputRes.data);
        // Pre-fill form with existing data
        setShift(outputRes.data.shift || "");
        setRemarks(outputRes.data.remarks || "");
        setProcessValues({
          thread_cutting: outputRes.data.thread_cutting?.toString() || "",
          inside_check: outputRes.data.inside_check?.toString() || "",
          top_side_check: outputRes.data.top_side_check?.toString() || "",
          buttoning: outputRes.data.buttoning?.toString() || "",
          iron: outputRes.data.iron?.toString() || "",
          get_up: outputRes.data.get_up?.toString() || "",
          poly: outputRes.data.poly?.toString() || "",
          carton: outputRes.data.carton?.toString() || "",
        });
        setIsEditing(true);
      } else {
        setExistingLog(null);
        setIsEditing(false);
        // Reset form
        setProcessValues({
          thread_cutting: "",
          inside_check: "",
          top_side_check: "",
          buttoning: "",
          iron: "",
          get_up: "",
          poly: "",
          carton: "",
        });
      }
    } catch (error) {
      console.error("Error checking existing logs:", error);
    }
  }

  function handleProcessValueChange(key: ProcessKey, value: string) {
    setProcessValues(prev => ({ ...prev, [key]: value }));
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedLineId) newErrors.line = "Line is required";
    
    // At least one process value should be entered
    const hasAnyValue = PROCESS_CATEGORIES.some(cat => {
      const val = processValues[cat.key];
      return val !== "" && parseInt(val) >= 0;
    });
    
    if (!hasAnyValue) {
      newErrors.processes = "Enter at least one output value";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in required fields");
      return;
    }

    if (!profile?.factory_id || !user?.id) {
      toast.error("Missing user or factory information");
      return;
    }

    setSubmitting(true);

    try {
      const logData = {
        factory_id: profile.factory_id,
        production_date: format(selectedDate, "yyyy-MM-dd"),
        line_id: selectedLineId,
        work_order_id: selectedWorkOrderId || null,
        log_type: "OUTPUT" as const,
        shift: shift || null,
        thread_cutting: processValues.thread_cutting ? parseInt(processValues.thread_cutting) : 0,
        inside_check: processValues.inside_check ? parseInt(processValues.inside_check) : 0,
        top_side_check: processValues.top_side_check ? parseInt(processValues.top_side_check) : 0,
        buttoning: processValues.buttoning ? parseInt(processValues.buttoning) : 0,
        iron: processValues.iron ? parseInt(processValues.iron) : 0,
        get_up: processValues.get_up ? parseInt(processValues.get_up) : 0,
        poly: processValues.poly ? parseInt(processValues.poly) : 0,
        carton: processValues.carton ? parseInt(processValues.carton) : 0,
        remarks: remarks || null,
        submitted_by: user.id,
      };

      if (isEditing && existingLog) {
        // Save old values to history
        const historyData = {
          log_id: existingLog.id,
          changed_by: user.id,
          old_values: existingLog,
          new_values: logData,
        };

        await supabase.from("finishing_daily_log_history").insert(historyData);

        // Update existing log
        const { error } = await supabase
          .from("finishing_daily_logs")
          .update({
            ...logData,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("id", existingLog.id);

        if (error) throw error;
        toast.success("End-of-day output updated successfully!");
      } else {
        // Insert new log
        const { error } = await supabase.from("finishing_daily_logs").insert(logData);

        if (error) {
          if (error.code === "23505") {
            toast.error("Output already submitted for this date and line. You can edit the existing entry.");
            checkExistingLogs();
            return;
          }
          throw error;
        }
        toast.success("End-of-day output submitted successfully!");
      }
      
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

  const calculateTotal = () => {
    return PROCESS_CATEGORIES.reduce((sum, cat) => {
      const val = parseInt(processValues[cat.key]) || 0;
      return sum + val;
    }, 0);
  };

  const calculateTargetTotal = () => {
    if (!targetLog) return 0;
    return PROCESS_CATEGORIES.reduce((sum, cat) => {
      const val = (targetLog as any)[cat.key] || 0;
      return sum + val;
    }, 0);
  };

  const getVariance = (key: ProcessKey): number => {
    if (!targetLog) return 0;
    const output = parseInt(processValues[key]) || 0;
    const target = (targetLog as any)[key] || 0;
    return output - target;
  };

  const VarianceIndicator = ({ variance }: { variance: number }) => {
    if (variance > 0) {
      return <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><TrendingUp className="h-3 w-3" />+{variance}</span>;
    } else if (variance < 0) {
      return <span className="text-destructive flex items-center gap-1"><TrendingDown className="h-3 w-3" />{variance}</span>;
    }
    return <span className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" />0</span>;
  };

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
            Record end-of-day production output
          </p>
        </div>
      </div>

      {isEditing && existingLog && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            ✏️ Editing existing output for {format(selectedDate, "MMM dd, yyyy")}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date & Line Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Date & Line</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "MMM dd, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Shift (Optional)</Label>
                <Select value={shift} onValueChange={setShift}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Shift A (Day)</SelectItem>
                    <SelectItem value="B">Shift B (Night)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
              <Label>PO Number (Optional)</Label>
              <Select value={selectedWorkOrderId || "none"} onValueChange={(val) => setSelectedWorkOrderId(val === "none" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PO (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific PO</SelectItem>
                  {filteredWorkOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.po_number} - {wo.style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Order Details (if PO selected) */}
        {selectedWorkOrder && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Details</CardTitle>
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Target vs Output Comparison (if target exists) */}
        {targetLog && selectedLineId && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Target vs Output Comparison</span>
                <Badge variant="outline">Target exists</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-xs mb-3 font-medium text-muted-foreground">
                <div>Process</div>
                <div className="text-right">Target</div>
                <div className="text-right">Output</div>
                <div className="text-right">Variance</div>
              </div>
              <div className="space-y-2">
                {PROCESS_CATEGORIES.map((cat) => {
                  const target = (targetLog as any)[cat.key] || 0;
                  const output = parseInt(processValues[cat.key]) || 0;
                  const variance = output - target;
                  
                  return (
                    <div key={cat.key} className="grid grid-cols-4 gap-2 text-sm">
                      <div className="truncate">{cat.label}</div>
                      <div className="text-right text-muted-foreground">{target}</div>
                      <div className="text-right font-medium">{output}</div>
                      <div className="text-right">
                        <VarianceIndicator variance={variance} />
                      </div>
                    </div>
                  );
                })}
                <div className="border-t pt-2 mt-2 grid grid-cols-4 gap-2 text-sm font-medium">
                  <div>Total</div>
                  <div className="text-right text-muted-foreground">{calculateTargetTotal()}</div>
                  <div className="text-right">{calculateTotal()}</div>
                  <div className="text-right">
                    <VarianceIndicator variance={calculateTotal() - calculateTargetTotal()} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Process Category Outputs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>End-of-Day Output by Process</span>
              <span className="text-sm font-normal text-muted-foreground">
                Total: {calculateTotal().toLocaleString()} pcs
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errors.processes && (
              <p className="text-sm text-destructive mb-4">{errors.processes}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              {PROCESS_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const variance = getVariance(cat.key);
                const hasTarget = targetLog !== null;
                
                return (
                  <div key={cat.key} className="space-y-2">
                    <Label className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {cat.label}
                      </span>
                      {hasTarget && processValues[cat.key] && (
                        <span className="text-xs">
                          <VarianceIndicator variance={variance} />
                        </span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={processValues[cat.key]}
                      onChange={(e) => handleProcessValueChange(cat.key, e.target.value)}
                      placeholder={targetLog ? `Target: ${(targetLog as any)[cat.key] || 0}` : "0"}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Remarks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any notes about today's production..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="mt-6 pb-2">
          <Button type="submit" className="w-full h-12 text-base font-medium" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {isEditing ? "Updating..." : "Submitting..."}
              </>
            ) : (
              isEditing ? "Update End-of-Day Output" : "Submit End-of-Day Output"
            )}
          </Button>
        </div>
      </form>

      {/* Link to hourly archive */}
      <div className="mt-6 text-center">
        <Button 
          variant="link" 
          className="text-muted-foreground"
          onClick={() => navigate("/finishing/hourly-archive")}
        >
          View Hourly Log (Archive)
        </Button>
      </div>
    </div>
  );
}
