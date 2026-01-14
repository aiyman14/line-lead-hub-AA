import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Scissors, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  order_qty: number;
  color: string | null;
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

interface ExistingActual {
  id: string;
  day_cutting: number;
  day_input: number;
  total_cutting: number | null;
  total_input: number | null;
  balance: number | null;
}

export default function CuttingEndOfDay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { i18n } = useTranslation();
  const { user, profile, factory, isAdminOrHigher } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const dateLocale = i18n.language === 'bn' ? 'bn-BD' : 'en-US';

  // Master data
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lineSearchOpen, setLineSearchOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [selectedLine, setSelectedLine] = useState<Line | null>(null);

  // Actual fields (same as targets form)
  const [dayCutting, setDayCutting] = useState("");
  const [dayInput, setDayInput] = useState("");

  // Computed totals (only for actuals)
  const [totalCutting, setTotalCutting] = useState(0);
  const [totalInput, setTotalInput] = useState(0);
  const [balance, setBalance] = useState(0);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [existingActual, setExistingActual] = useState<ExistingActual | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    }
  }, [profile?.factory_id]);

  // Check for existing data when line + work order are selected
  useEffect(() => {
    if (selectedLine && selectedWorkOrder && profile?.factory_id) {
      checkExistingData();
      calculateTotals();
    }
  }, [selectedLine?.id, selectedWorkOrder?.id, profile?.factory_id]);

  // Recalculate totals when day values change
  useEffect(() => {
    if (selectedWorkOrder && profile?.factory_id) {
      calculateTotals();
    }
  }, [dayCutting, dayInput]);

  async function fetchFormData() {
    if (!profile?.factory_id) return;

    try {
      const [workOrdersRes, linesRes] = await Promise.all([
        supabase
          .from("work_orders")
          .select("id, po_number, buyer, style, item, order_qty, color")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true)
          .order("po_number", { ascending: true }),
        supabase
          .from("lines")
          .select("id, line_id, name")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true)
          .order("line_id", { ascending: true }),
      ]);

      setWorkOrders(workOrdersRes.data || []);
      
      // Sort lines numerically
      const sortedLines = (linesRes.data || []).sort((a, b) => {
        const numA = parseInt(a.line_id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.line_id.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setLines(sortedLines);

      // Pre-select from URL params if editing
      const lineParam = searchParams.get('line');
      const woParam = searchParams.get('wo');
      if (lineParam) {
        const line = sortedLines.find(l => l.id === lineParam);
        if (line) setSelectedLine(line);
      }
      if (woParam && workOrdersRes.data) {
        const wo = workOrdersRes.data.find(w => w.id === woParam);
        if (wo) setSelectedWorkOrder(wo);
      }
    } catch (error) {
      console.error("Error fetching form data:", error);
      toast.error("Failed to load form data");
    } finally {
      setLoading(false);
    }
  }

  async function checkExistingData() {
    if (!profile?.factory_id || !selectedLine || !selectedWorkOrder) return;

    const today = format(new Date(), "yyyy-MM-dd");

    try {
      // Check for today's actual
      const { data: actualData, error } = await supabase
        .from("cutting_actuals")
        .select("id, day_cutting, day_input, total_cutting, total_input, balance")
        .eq("factory_id", profile.factory_id)
        .eq("line_id", selectedLine.id)
        .eq("work_order_id", selectedWorkOrder.id)
        .eq("production_date", today)
        .maybeSingle();

      if (error) throw error;

      if (actualData) {
        setIsEditing(true);
        setExistingActual(actualData);
        setDayCutting(String(actualData.day_cutting));
        setDayInput(String(actualData.day_input));
      } else {
        setIsEditing(false);
        setExistingActual(null);
        if (!dayCutting && !dayInput) {
          setDayCutting("");
          setDayInput("");
        }
      }
    } catch (error) {
      console.error("Error checking existing data:", error);
    }
  }

  async function calculateTotals() {
    if (!profile?.factory_id || !selectedWorkOrder) return;

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Get all previous actuals for this work order (excluding today if editing)
      const { data: previousActuals } = await supabase
        .from("cutting_actuals")
        .select("day_cutting, day_input")
        .eq("factory_id", profile.factory_id)
        .eq("work_order_id", selectedWorkOrder.id)
        .lt("production_date", today);

      const prevTotalCutting = previousActuals?.reduce((sum, a) => sum + (a.day_cutting || 0), 0) || 0;
      const prevTotalInput = previousActuals?.reduce((sum, a) => sum + (a.day_input || 0), 0) || 0;

      const todayCutting = parseInt(dayCutting) || 0;
      const todayInput = parseInt(dayInput) || 0;

      const newTotalCutting = prevTotalCutting + todayCutting;
      const newTotalInput = prevTotalInput + todayInput;
      const orderQty = selectedWorkOrder?.order_qty || 0;
      const newBalance = orderQty - newTotalInput;

      setTotalCutting(newTotalCutting);
      setTotalInput(newTotalInput);
      setBalance(newBalance);
    } catch (error) {
      console.error("Error calculating totals:", error);
    }
  }

  const getSearchableValue = (wo: WorkOrder) => {
    return [wo.po_number, wo.buyer, wo.style, wo.item].filter(Boolean).join(" ").toLowerCase();
  };

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedLine) newErrors.line = "Line is required";
    if (!selectedWorkOrder) newErrors.workOrder = "PO is required";
    if (!dayCutting || parseInt(dayCutting) < 0) newErrors.dayCutting = "Day Cutting is required";
    if (!dayInput || parseInt(dayInput) < 0) newErrors.dayInput = "Day Input is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!profile?.factory_id || !user?.id || !selectedWorkOrder || !selectedLine) {
      toast.error("Submission failed");
      return;
    }

    setSubmitting(true);

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Check if submission is late
      let isLate = false;
      if (factory?.evening_actual_cutoff) {
        const now = new Date();
        const [cutoffHour, cutoffMinute] = factory.evening_actual_cutoff.split(':').map(Number);
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffHour, cutoffMinute, 0, 0);
        isLate = now > cutoffTime;
      }

      const actualData = {
        factory_id: profile.factory_id,
        production_date: today,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        line_id: selectedLine.id,
        work_order_id: selectedWorkOrder.id,
        buyer: selectedWorkOrder.buyer,
        style: selectedWorkOrder.style,
        po_no: selectedWorkOrder.po_number,
        colour: selectedWorkOrder.color || "",
        order_qty: selectedWorkOrder.order_qty,
        day_cutting: parseInt(dayCutting),
        day_input: parseInt(dayInput),
        total_cutting: totalCutting,
        total_input: totalInput,
        balance: balance,
        is_late: isLate,
        transfer_to_line_id: selectedLine.id,
      };

      if (isEditing && existingActual) {
        const { error } = await supabase
          .from("cutting_actuals")
          .update(actualData)
          .eq("id", existingActual.id);

        if (error) throw error;
        toast.success("Cutting actuals updated successfully!");
      } else {
        const { error } = await supabase
          .from("cutting_actuals")
          .insert(actualData as any);

        if (error) {
          if (error.code === "23505") {
            toast.error("Actuals already submitted for this line/PO today");
            return;
          }
          throw error;
        }
        toast.success("Cutting end-of-day actuals submitted successfully!");
      }
      
      if (isAdminOrHigher()) {
        navigate("/dashboard");
      } else {
        navigate("/cutting/submissions");
      }
    } catch (error: any) {
      console.error("Error submitting:", error);
      toast.error(error.message || "Submission failed");
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
        <p className="text-muted-foreground">No factory assigned</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-4 px-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Cutting End of Day</h1>
            {isEditing && (
              <Badge variant="secondary">Editing</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Line No.</CardTitle>
          </CardHeader>
          <CardContent>
            <Popover open={lineSearchOpen} onOpenChange={setLineSearchOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`w-full justify-start ${errors.line ? 'border-destructive' : ''}`}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {selectedLine 
                    ? (selectedLine.name || selectedLine.line_id)
                    : "Select a line..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={true}>
                  <CommandInput placeholder="Search lines..." />
                  <CommandList>
                    <CommandEmpty>No lines found.</CommandEmpty>
                    <CommandGroup>
                      {lines.map(line => (
                        <CommandItem 
                          key={line.id} 
                          value={line.name || line.line_id}
                          onSelect={() => {
                            setSelectedLine(line);
                            setLineSearchOpen(false);
                            setErrors(prev => ({ ...prev, line: "" }));
                          }}
                        >
                          <span className="font-medium">{line.name || line.line_id}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.line && <p className="text-sm text-destructive mt-1">{errors.line}</p>}
          </CardContent>
        </Card>

        {/* PO Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select PO / Work Order</CardTitle>
          </CardHeader>
          <CardContent>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className={`w-full justify-start min-w-0 ${errors.workOrder ? 'border-destructive' : ''}`}
                >
                  <Search className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {selectedWorkOrder 
                      ? `${selectedWorkOrder.po_number} - ${selectedWorkOrder.buyer} / ${selectedWorkOrder.style}`
                      : "Search by PO, Buyer, Style..."}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={true}>
                  <CommandInput placeholder="Search PO, buyer, style, item..." />
                  <CommandList>
                    <CommandEmpty>No work orders found.</CommandEmpty>
                    <CommandGroup>
                      {workOrders.map(wo => (
                        <CommandItem 
                          key={wo.id} 
                          value={getSearchableValue(wo)}
                          onSelect={() => {
                            setSelectedWorkOrder(wo);
                            setSearchOpen(false);
                            setErrors(prev => ({ ...prev, workOrder: "" }));
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{wo.po_number}</span>
                            <span className="text-xs text-muted-foreground">
                              {wo.buyer} / {wo.style} {wo.item ? `/ ${wo.item}` : ""}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.workOrder && <p className="text-sm text-destructive mt-1">{errors.workOrder}</p>}
          </CardContent>
        </Card>

        {/* Auto-filled Details */}
        {selectedWorkOrder && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">BUYER:</span>
                  <p className="font-medium">{selectedWorkOrder.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">STYLE:</span>
                  <p className="font-medium">{selectedWorkOrder.style}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">PO - NO:</span>
                  <p className="font-medium">{selectedWorkOrder.po_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">COLOUR:</span>
                  <p className="font-medium">{selectedWorkOrder.color || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ORDER QTY:</span>
                  <p className="font-medium">{selectedWorkOrder.order_qty.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Actuals (same fields as targets) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Daily Actuals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>DAY CUTTING *</Label>
              <Input
                type="number"
                value={dayCutting}
                onChange={(e) => setDayCutting(e.target.value)}
                placeholder="0"
                className={errors.dayCutting ? "border-destructive" : ""}
              />
              {errors.dayCutting && <p className="text-sm text-destructive">{errors.dayCutting}</p>}
            </div>

            <div className="space-y-2">
              <Label>DAY INPUT * (to Sewing)</Label>
              <Input
                type="number"
                value={dayInput}
                onChange={(e) => setDayInput(e.target.value)}
                placeholder="0"
                className={errors.dayInput ? "border-destructive" : ""}
              />
              {errors.dayInput && <p className="text-sm text-destructive">{errors.dayInput}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Cumulative Totals - Only for Actuals form */}
        {selectedWorkOrder && (dayCutting || dayInput) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cumulative Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">TOTAL CUTTING</p>
                  <p className="text-2xl font-bold">{totalCutting.toLocaleString()}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">TOTAL INPUT</p>
                  <p className="text-2xl font-bold text-success">{totalInput.toLocaleString()}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">BALANCE</p>
                  <p className={`text-2xl font-bold ${balance < 0 ? 'text-destructive' : ''}`}>
                    {balance.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <Button 
          type="submit" 
          className="w-full" 
          size="lg"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : isEditing ? (
            "Update End-of-Day Actuals"
          ) : (
            "Submit End-of-Day Actuals"
          )}
        </Button>
      </form>
    </div>
  );
}
