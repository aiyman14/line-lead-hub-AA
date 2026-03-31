import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOfflineSubmission } from "@/hooks/useOfflineSubmission";
import { toast } from "sonner";
import { Loader2, Search, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { isLateForCutoff, getTodayInTimezone } from "@/lib/date-utils";

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  order_qty: number;
  color: string | null;
}

export default function CuttingForm() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, profile, factory, isAdminOrHigher } = useAuth();
  const { submit: offlineSubmit } = useOfflineSubmission();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const dateLocale = i18n.language === 'bn' ? 'bn-BD' : i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  // Master data
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [lines, setLines] = useState<{ id: string; line_id: string; name: string | null }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lineSearchOpen, setLineSearchOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [selectedLine, setSelectedLine] = useState<{ id: string; line_id: string; name: string | null } | null>(null);

  // Morning Target fields
  const [manPower, setManPower] = useState("");
  const [markerCapacity, setMarkerCapacity] = useState("");
  const [layCapacity, setLayCapacity] = useState("");
  const [cuttingCapacity, setCuttingCapacity] = useState("");
  const [underQty, setUnderQty] = useState("0");

  // End of Day fields
  const [dayCutting, setDayCutting] = useState("");
  const [dayInput, setDayInput] = useState("");

  // Computed/calculated
  const [totalCutting, setTotalCutting] = useState(0);
  const [totalInput, setTotalInput] = useState(0);
  const [balance, setBalance] = useState(0);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile?.factory_id) {
      fetchWorkOrders();
      fetchLines();
    }
  }, [profile?.factory_id]);

  async function fetchLines() {
    if (!profile?.factory_id) return;

    try {
      const { data, error } = await supabase
        .from("lines")
        .select("id, line_id, name")
        .eq("factory_id", profile.factory_id)
        .eq("is_active", true)
        .order("line_id", { ascending: true });

      if (error) throw error;
      
      // Sort numerically by extracting numbers from line_id
      const sortedLines = (data || []).sort((a, b) => {
        const numA = parseInt(a.line_id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.line_id.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      
      setLines(sortedLines);
    } catch (error) {
      console.error("Error fetching lines:", error);
    }
  }

  // Calculate totals when work order or day values change
  useEffect(() => {
    if (selectedWorkOrder && profile?.factory_id) {
      calculateTotals();
    }
  }, [selectedWorkOrder, dayCutting, dayInput, profile?.factory_id]);

  async function fetchWorkOrders() {
    if (!profile?.factory_id) return;

    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, po_number, buyer, style, item, order_qty, color")
        .eq("factory_id", profile.factory_id)
        .eq("is_active", true)
        .order("po_number", { ascending: true });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      toast.error(t('cutting.failedToLoadWorkOrders'));
    } finally {
      setLoading(false);
    }
  }

  const getSearchableValue = (wo: WorkOrder) => {
    return [wo.po_number, wo.buyer, wo.style, wo.item].filter(Boolean).join(" ").toLowerCase();
  };

  async function calculateTotals() {
    if (!profile?.factory_id || !selectedWorkOrder) return;

    try {
      // Get all previous actuals for this work order
      const { data: previousActuals } = await supabase
        .from("cutting_actuals")
        .select("day_cutting, day_input")
        .eq("factory_id", profile.factory_id)
        .eq("work_order_id", selectedWorkOrder.id)
        .lt("production_date", getTodayInTimezone(factory?.timezone || "Asia/Dhaka"));

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

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!selectedLine) newErrors.line = t('cutting.lineRequired');
    if (!selectedWorkOrder) newErrors.workOrder = t('cutting.poRequired');
    if (!manPower || parseInt(manPower) < 0) newErrors.manPower = t('cutting.manPowerRequired');
    if (!markerCapacity || parseInt(markerCapacity) < 0) newErrors.markerCapacity = t('cutting.markerCapacityRequired');
    if (!layCapacity || parseInt(layCapacity) < 0) newErrors.layCapacity = t('cutting.layCapacityRequired');
    if (!cuttingCapacity || parseInt(cuttingCapacity) < 0) newErrors.cuttingCapacity = t('cutting.cuttingCapacityRequired');
    if (!dayCutting || parseInt(dayCutting) < 0) newErrors.dayCutting = t('cutting.dayCuttingRequired');
    if (!dayInput || parseInt(dayInput) < 0) newErrors.dayInput = t('cutting.dayInputRequired');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(t('cutting.fillAllRequired'));
      return;
    }

    if (!profile?.factory_id || !user?.id || !selectedWorkOrder || !selectedLine) {
      toast.error(t('cutting.submissionFailed'));
      return;
    }

    setSubmitting(true);

    try {
      // Check if submission is late (using factory timezone)
      const timezone = factory?.timezone || "Asia/Dhaka";
      const today = getTodayInTimezone(timezone);

      const isLateMorning = factory?.morning_target_cutoff
        ? isLateForCutoff(factory.morning_target_cutoff, timezone)
        : false;

      const isLateEvening = factory?.evening_actual_cutoff
        ? isLateForCutoff(factory.evening_actual_cutoff, timezone)
        : false;

      const lineId = selectedLine.id;

      // Insert targets
      const targetData = {
        factory_id: profile.factory_id,
        production_date: today,
        submitted_by: user.id,
        line_id: lineId,
        work_order_id: selectedWorkOrder.id,
        buyer: selectedWorkOrder.buyer,
        style: selectedWorkOrder.style,
        po_no: selectedWorkOrder.po_number,
        colour: selectedWorkOrder.color || "",
        order_qty: selectedWorkOrder.order_qty,
        man_power: parseInt(manPower),
        marker_capacity: parseInt(markerCapacity),
        lay_capacity: parseInt(layCapacity),
        cutting_capacity: parseInt(cuttingCapacity),
        under_qty: parseInt(underQty) || 0,
        is_late: isLateMorning,
      };

      // Insert targets via offline-capable hook
      const targetResult = await offlineSubmit("cutting_targets", "cutting_targets", targetData as Record<string, unknown>, {
        showSuccessToast: false,
        showQueuedToast: false,
      });

      if (targetResult.queued) {
        // Queued offline — queue actuals too and navigate away
        const actualData = {
          factory_id: profile.factory_id,
          production_date: today,
          submitted_by: user.id,
          line_id: lineId,
          work_order_id: selectedWorkOrder.id,
          buyer: selectedWorkOrder.buyer,
          style: selectedWorkOrder.style,
          po_no: selectedWorkOrder.po_number,
          colour: selectedWorkOrder.color || "",
          order_qty: selectedWorkOrder.order_qty,
          day_cutting: parseInt(dayCutting),
          total_cutting: totalCutting,
          day_input: parseInt(dayInput),
          total_input: totalInput,
          balance: balance,
          is_late: isLateEvening,
          transfer_to_line_id: selectedLine.id,
        };
        await offlineSubmit("cutting_actuals", "cutting_actuals", actualData as Record<string, unknown>, {
          showSuccessToast: false,
          showQueuedToast: true,
          queuedMessage: "Cutting report saved offline. Will sync when online.",
        });
        if (isAdminOrHigher()) {
          navigate("/dashboard");
        } else {
          navigate("/cutting/submissions");
        }
        return;
      }

      if (!targetResult.success) {
        if (targetResult.error?.includes("duplicate")) {
          // Already submitted targets, continue with actuals only
          console.log("Targets already submitted for today, updating actuals only");
        } else {
          throw new Error(targetResult.error);
        }
      }

      // Insert actuals via offline-capable hook
      const actualData = {
        factory_id: profile.factory_id,
        production_date: today,
        submitted_by: user.id,
        line_id: lineId,
        work_order_id: selectedWorkOrder.id,
        buyer: selectedWorkOrder.buyer,
        style: selectedWorkOrder.style,
        po_no: selectedWorkOrder.po_number,
        colour: selectedWorkOrder.color || "",
        order_qty: selectedWorkOrder.order_qty,
        day_cutting: parseInt(dayCutting),
        total_cutting: totalCutting,
        day_input: parseInt(dayInput),
        total_input: totalInput,
        balance: balance,
        is_late: isLateEvening,
        transfer_to_line_id: selectedLine.id,
      };

      const actualResult = await offlineSubmit("cutting_actuals", "cutting_actuals", actualData as Record<string, unknown>, {
        showSuccessToast: false,
        showQueuedToast: true,
      });

      if (actualResult.queued) {
        if (isAdminOrHigher()) {
          navigate("/dashboard");
        } else {
          navigate("/cutting/submissions");
        }
        return;
      }

      if (!actualResult.success) {
        if (actualResult.error?.includes("duplicate")) {
          toast.error(t('cutting.alreadySubmittedToday'));
        } else {
          throw new Error(actualResult.error);
        }
        return;
      }

      toast.success(t('cutting.cuttingReportSubmitted'));
      
      if (isAdminOrHigher()) {
        navigate("/dashboard");
      } else {
        navigate("/cutting/submissions");
      }
    } catch (error: any) {
      console.error("Error submitting:", error);
      toast.error(t('cutting.submissionFailed'));
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
        <p className="text-muted-foreground">{t('cutting.noFactoryAssigned')}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-4 px-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Scissors className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-xl font-bold">{t('cutting.dailyCuttingReport')}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(getTodayInTimezone(factory?.timezone || "Asia/Dhaka") + "T00:00:00").toLocaleDateString(dateLocale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Transfer To Line Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('cutting.lineNo')}</CardTitle>
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
                    : t('cutting.selectALine')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={true}>
                  <CommandInput placeholder={t('cutting.searchLines')} />
                  <CommandList>
                    <CommandEmpty>{t('cutting.noLinesFound')}</CommandEmpty>
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

        {/* Step 2: PO Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('cutting.selectPO')}</CardTitle>
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
                      : t('cutting.searchPO')}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command shouldFilter={true}>
                  <CommandInput placeholder={t('cutting.searchPOLong')} />
                  <CommandList>
                    <CommandEmpty>{t('cutting.noWorkOrdersFound')}</CommandEmpty>
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
              <CardTitle className="text-base">{t('cutting.orderDetails')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('cutting.buyerLabel')}</span>
                  <p className="font-medium">{selectedWorkOrder.buyer}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('cutting.styleLabel')}</span>
                  <p className="font-medium">{selectedWorkOrder.style}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('cutting.poNoLabel')}</span>
                  <p className="font-medium">{selectedWorkOrder.po_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('cutting.colourLabel')}</span>
                  <p className="font-medium">{selectedWorkOrder.color || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('cutting.orderQtyLabel')}</span>
                  <p className="font-medium">{selectedWorkOrder.order_qty.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Target Capacities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('cutting.targetCapacities')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('cutting.manPower')} *</Label>
              <Input
                type="number"
                value={manPower}
                onChange={(e) => setManPower(e.target.value)}
                placeholder="0"
                className={errors.manPower ? "border-destructive" : ""}
              />
              {errors.manPower && <p className="text-sm text-destructive">{errors.manPower}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="block h-10 leading-5">{t('cutting.markerCapacity')} *</Label>
                <Input
                  type="number"
                  value={markerCapacity}
                  onChange={(e) => setMarkerCapacity(e.target.value)}
                  placeholder="0"
                  className={errors.markerCapacity ? "border-destructive" : ""}
                />
                {errors.markerCapacity && <p className="text-sm text-destructive">{errors.markerCapacity}</p>}
              </div>

              <div className="space-y-2">
                <Label className="block h-10 leading-5">{t('cutting.layCapacity')} *</Label>
                <Input
                  type="number"
                  value={layCapacity}
                  onChange={(e) => setLayCapacity(e.target.value)}
                  placeholder="0"
                  className={errors.layCapacity ? "border-destructive" : ""}
                />
                {errors.layCapacity && <p className="text-sm text-destructive">{errors.layCapacity}</p>}
              </div>

              <div className="space-y-2">
                <Label className="block h-10 leading-5">{t('cutting.cuttingCapacity')} *</Label>
                <Input
                  type="number"
                  value={cuttingCapacity}
                  onChange={(e) => setCuttingCapacity(e.target.value)}
                  placeholder="0"
                  className={errors.cuttingCapacity ? "border-destructive" : ""}
                />
                {errors.cuttingCapacity && <p className="text-sm text-destructive">{errors.cuttingCapacity}</p>}
              </div>

              <div className="space-y-2">
                <Label className="block h-10 leading-5">{t('cutting.underQty')}</Label>
                <Input
                  type="number"
                  value={underQty}
                  onChange={(e) => setUnderQty(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* End of Day Actuals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('cutting.dailyActuals')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('cutting.dayCutting')} *</Label>
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
                <Label>{t('cutting.dayInput')} *</Label>
                <Input
                  type="number"
                  value={dayInput}
                  onChange={(e) => setDayInput(e.target.value)}
                  placeholder="0"
                  className={errors.dayInput ? "border-destructive" : ""}
                />
                {errors.dayInput && <p className="text-sm text-destructive">{errors.dayInput}</p>}
              </div>
            </div>

            {/* Computed Fields */}
            {selectedWorkOrder && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">{t('cutting.totalCutting')}</p>
                  <p className="text-lg font-bold">{totalCutting.toLocaleString()}</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">{t('cutting.totalInput')}</p>
                  <p className="text-lg font-bold">{totalInput.toLocaleString()}</p>
                </div>
                <div className={`text-center p-3 rounded-lg ${balance < 0 ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                  <p className="text-xs text-muted-foreground">{t('cutting.balance')}</p>
                  <p className={`text-lg font-bold ${balance < 0 ? 'text-destructive' : ''}`}>
                    {balance.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Submit Button */}
        <div className="sticky bottom-4 pt-4">
          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {t('cutting.submitting')}
              </>
            ) : (
              t('cutting.submitDailyCuttingReport')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
