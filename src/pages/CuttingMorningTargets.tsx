import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Scissors, Target } from "lucide-react";
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

interface ExistingTarget {
  id: string;
  man_power: number;
  marker_capacity: number;
  lay_capacity: number;
  cutting_capacity: number;
  under_qty: number | null;
}

export default function CuttingMorningTargets() {
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

  // Target fields (same as actuals form)
  const [dayCutting, setDayCutting] = useState("");
  const [dayInput, setDayInput] = useState("");

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [existingTarget, setExistingTarget] = useState<ExistingTarget | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    }
  }, [profile?.factory_id]);

  // Check for existing target when line + work order are selected
  useEffect(() => {
    if (selectedLine && selectedWorkOrder && profile?.factory_id) {
      checkExistingTarget();
    }
  }, [selectedLine?.id, selectedWorkOrder?.id, profile?.factory_id]);

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

  async function checkExistingTarget() {
    if (!profile?.factory_id || !selectedLine || !selectedWorkOrder) return;

    const today = format(new Date(), "yyyy-MM-dd");

    try {
      const { data, error } = await supabase
        .from("cutting_targets")
        .select("id, man_power, marker_capacity, lay_capacity, cutting_capacity, under_qty")
        .eq("factory_id", profile.factory_id)
        .eq("line_id", selectedLine.id)
        .eq("work_order_id", selectedWorkOrder.id)
        .eq("production_date", today)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIsEditing(true);
        setExistingTarget(data);
        // Use marker_capacity and lay_capacity as our day_cutting and day_input targets
        setDayCutting(String(data.cutting_capacity || 0));
        setDayInput(String(data.lay_capacity || 0));
      } else {
        setIsEditing(false);
        setExistingTarget(null);
        if (!dayCutting && !dayInput) {
          setDayCutting("");
          setDayInput("");
        }
      }
    } catch (error) {
      console.error("Error checking existing target:", error);
    }
  }

  const getSearchableValue = (wo: WorkOrder) => {
    return [wo.po_number, wo.buyer, wo.style, wo.item].filter(Boolean).join(" ").toLowerCase();
  };

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedLine) newErrors.line = "Line is required";
    if (!selectedWorkOrder) newErrors.workOrder = "PO is required";
    if (!dayCutting || parseInt(dayCutting) < 0) newErrors.dayCutting = "Day Cutting Target is required";
    if (!dayInput || parseInt(dayInput) < 0) newErrors.dayInput = "Day Input Target is required";

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
      if (factory?.morning_target_cutoff) {
        const now = new Date();
        const [cutoffHour, cutoffMinute] = factory.morning_target_cutoff.split(':').map(Number);
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffHour, cutoffMinute, 0, 0);
        isLate = now > cutoffTime;
      }

      // Map day_cutting to cutting_capacity and day_input to lay_capacity for storage
      const targetData = {
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
        man_power: 0,
        marker_capacity: 0,
        lay_capacity: parseInt(dayInput) || 0, // Store day_input target here
        cutting_capacity: parseInt(dayCutting) || 0, // Store day_cutting target here
        under_qty: 0,
        is_late: isLate,
      };

      if (isEditing && existingTarget) {
        const { error } = await supabase
          .from("cutting_targets")
          .update(targetData)
          .eq("id", existingTarget.id);

        if (error) throw error;
        toast.success("Cutting targets updated successfully!");
      } else {
        const { error } = await supabase
          .from("cutting_targets")
          .insert(targetData as any);

        if (error) {
          if (error.code === "23505") {
            toast.error("Targets already submitted for this line/PO today");
            return;
          }
          throw error;
        }
        toast.success("Cutting targets submitted successfully!");
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
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Cutting Daily Targets</h1>
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

        {/* Daily Targets (same fields as actuals) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Daily Targets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>DAY CUTTING (Target) *</Label>
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
              <Label>DAY INPUT (Target) * (to Sewing)</Label>
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
            "Update Daily Cutting Targets"
          ) : (
            "Submit Daily Cutting Targets"
          )}
        </Button>
      </form>
    </div>
  );
}
