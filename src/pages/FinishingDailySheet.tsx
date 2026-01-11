import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Lock, Unlock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { HourlyEntryDialog } from "@/components/finishing/HourlyEntryDialog";
import { HourlyLogGrid } from "@/components/finishing/HourlyLogGrid";

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
  color: string | null;
  order_qty: number;
  line_id: string | null;
}

interface DailySheet {
  id: string;
  production_date: string;
  line_id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  item: string | null;
  color: string | null;
  finishing_no: string | null;
}

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

const REGULAR_HOUR_SLOTS = [
  "08-09", "09-10", "10-11", "11-12", "12-01",
  "02-03", "03-04", "04-05", "05-06", "06-07"
];

const OT_SLOTS = ["OT-1", "OT-2", "OT-3", "OT-4", "OT-5"];

export default function FinishingDailySheet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { user, profile, isAdminOrHigher } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedLineId, setSelectedLineId] = useState(searchParams.get("line") || "");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(searchParams.get("po") || "");
  const sheetIdFromUrl = searchParams.get("sheet");
  
  const [currentSheet, setCurrentSheet] = useState<DailySheet | null>(null);
  const [hourlyLogs, setHourlyLogs] = useState<HourlyLog[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [loadingExistingSheet, setLoadingExistingSheet] = useState(!!sheetIdFromUrl);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editingLog, setEditingLog] = useState<HourlyLog | null>(null);

  const selectedWorkOrder = useMemo(() => {
    return workOrders.find(wo => wo.id === selectedWorkOrderId);
  }, [workOrders, selectedWorkOrderId]);

  const filteredWorkOrders = useMemo(() => {
    if (!selectedLineId) return workOrders;
    return workOrders.filter(wo => wo.line_id === selectedLineId || !wo.line_id);
  }, [workOrders, selectedLineId]);

  const submittedSlots = useMemo(() => {
    return hourlyLogs.map(log => log.hour_slot);
  }, [hourlyLogs]);

  // Calculate which OT slots should be visible (show next available OT slot)
  const visibleOTSlots = useMemo(() => {
    const submittedOTSlots = hourlyLogs
      .filter(log => log.hour_slot.startsWith("OT-"))
      .map(log => log.hour_slot);
    
    // Always show submitted OT slots + next available one
    const nextOTIndex = submittedOTSlots.length;
    if (nextOTIndex < OT_SLOTS.length) {
      return [...submittedOTSlots, OT_SLOTS[nextOTIndex]];
    }
    return submittedOTSlots;
  }, [hourlyLogs]);

  const allVisibleSlots = useMemo(() => {
    return [...REGULAR_HOUR_SLOTS, ...visibleOTSlots];
  }, [visibleOTSlots]);

  const currentHourSlot = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 8 && hour < 9) return "08-09";
    if (hour >= 9 && hour < 10) return "09-10";
    if (hour >= 10 && hour < 11) return "10-11";
    if (hour >= 11 && hour < 12) return "11-12";
    if (hour >= 12 && hour < 13) return "12-01";
    if (hour >= 14 && hour < 15) return "02-03";
    if (hour >= 15 && hour < 16) return "03-04";
    if (hour >= 16 && hour < 17) return "04-05";
    if (hour >= 17 && hour < 18) return "05-06";
    if (hour >= 18 && hour < 19) return "06-07";
    
    return null;
  }, []);

  // Load existing sheet if sheet ID is in URL
  useEffect(() => {
    if (sheetIdFromUrl && profile?.factory_id) {
      loadExistingSheet(sheetIdFromUrl);
    }
  }, [sheetIdFromUrl, profile?.factory_id]);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchInitialData();
    }
  }, [profile?.factory_id]);

  useEffect(() => {
    // Only auto-load/create sheet if we don't have a sheet from URL
    if (!sheetIdFromUrl && selectedLineId && selectedWorkOrderId && profile?.factory_id) {
      loadOrCreateSheet();
    } else if (!sheetIdFromUrl && (!selectedLineId || !selectedWorkOrderId)) {
      setCurrentSheet(null);
      setHourlyLogs([]);
    }
  }, [selectedLineId, selectedWorkOrderId, profile?.factory_id, sheetIdFromUrl]);

  async function loadExistingSheet(sheetId: string) {
    if (!profile?.factory_id) return;
    
    setLoadingExistingSheet(true);
    try {
      const { data: sheet, error } = await supabase
        .from("finishing_daily_sheets")
        .select("*")
        .eq("id", sheetId)
        .eq("factory_id", profile.factory_id)
        .single();

      if (error) throw error;
      
      if (sheet) {
        setCurrentSheet(sheet);
        setSelectedLineId(sheet.line_id);
        setSelectedWorkOrderId(sheet.work_order_id);
        await fetchHourlyLogs(sheet.id);
      }
    } catch (error) {
      console.error("Error loading sheet:", error);
      toast.error("Failed to load sheet");
    } finally {
      setLoadingExistingSheet(false);
    }
  }

  async function fetchInitialData() {
    if (!profile?.factory_id) return;

    try {
      const [linesRes, workOrdersRes, assignmentsRes] = await Promise.all([
        supabase.from("lines").select("id, line_id, name").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("work_orders").select("*").eq("factory_id", profile.factory_id).eq("is_active", true),
        supabase.from("user_line_assignments").select("line_id").eq("user_id", user?.id || ""),
      ]);

      let availableLines = linesRes.data || [];
      
      if (!isAdminOrHigher() && assignmentsRes.data && assignmentsRes.data.length > 0) {
        const assignedLineIds = assignmentsRes.data.map(a => a.line_id);
        availableLines = availableLines.filter(l => assignedLineIds.includes(l.id));
      }

      setLines(availableLines);
      setWorkOrders(workOrdersRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadOrCreateSheet() {
    if (!profile?.factory_id || !user?.id || !selectedLineId || !selectedWorkOrderId) return;
    
    setLoadingSheet(true);
    const today = format(new Date(), "yyyy-MM-dd");

    try {
      // Check if sheet exists
      const { data: existingSheet, error: fetchError } = await supabase
        .from("finishing_daily_sheets")
        .select("*")
        .eq("factory_id", profile.factory_id)
        .eq("production_date", today)
        .eq("line_id", selectedLineId)
        .eq("work_order_id", selectedWorkOrderId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingSheet) {
        setCurrentSheet(existingSheet);
        await fetchHourlyLogs(existingSheet.id);
      } else {
        // Create new sheet
        const wo = workOrders.find(w => w.id === selectedWorkOrderId);
        const { data: newSheet, error: insertError } = await supabase
          .from("finishing_daily_sheets")
          .insert({
            factory_id: profile.factory_id,
            production_date: today,
            line_id: selectedLineId,
            work_order_id: selectedWorkOrderId,
            buyer: wo?.buyer || null,
            style: wo?.style || null,
            po_no: wo?.po_number || null,
            item: wo?.item || null,
            color: wo?.color || null,
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setCurrentSheet(newSheet);
        setHourlyLogs([]);
      }
    } catch (error: any) {
      console.error("Error loading/creating sheet:", error);
      toast.error("Failed to load daily sheet");
    } finally {
      setLoadingSheet(false);
    }
  }

  async function fetchHourlyLogs(sheetId: string) {
    const { data, error } = await supabase
      .from("finishing_hourly_logs")
      .select("*")
      .eq("sheet_id", sheetId)
      .order("hour_slot");

    if (error) {
      console.error("Error fetching hourly logs:", error);
      return;
    }

    setHourlyLogs(data || []);
  }

  function handleAddHour(slot: string) {
    const existingLog = hourlyLogs.find(log => log.hour_slot === slot);
    setEditingSlot(slot);
    setEditingLog(existingLog || null);
    setDialogOpen(true);
  }

  async function handleSaveHourlyLog(data: Partial<HourlyLog>) {
    if (!currentSheet || !user?.id || !editingSlot) return;

    try {
      if (editingLog) {
        // Update existing
        const { error } = await supabase
          .from("finishing_hourly_logs")
          .update({
            thread_cutting_target: data.thread_cutting_target || 0,
            thread_cutting_actual: data.thread_cutting_actual || 0,
            inside_check_target: data.inside_check_target || 0,
            inside_check_actual: data.inside_check_actual || 0,
            top_side_check_target: data.top_side_check_target || 0,
            top_side_check_actual: data.top_side_check_actual || 0,
            buttoning_target: data.buttoning_target || 0,
            buttoning_actual: data.buttoning_actual || 0,
            iron_target: data.iron_target || 0,
            iron_actual: data.iron_actual || 0,
            get_up_target: data.get_up_target || 0,
            get_up_actual: data.get_up_actual || 0,
            poly_target: data.poly_target || 0,
            poly_actual: data.poly_actual || 0,
            carton_target: data.carton_target || 0,
            carton_actual: data.carton_actual || 0,
            remarks: data.remarks || null,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          })
          .eq("id", editingLog.id);

        if (error) throw error;
        toast.success("Hour updated successfully");
      } else {
        // Insert new
        const { error } = await supabase
          .from("finishing_hourly_logs")
          .insert({
            sheet_id: currentSheet.id,
            hour_slot: editingSlot as any,
            thread_cutting_target: data.thread_cutting_target || 0,
            thread_cutting_actual: data.thread_cutting_actual || 0,
            inside_check_target: data.inside_check_target || 0,
            inside_check_actual: data.inside_check_actual || 0,
            top_side_check_target: data.top_side_check_target || 0,
            top_side_check_actual: data.top_side_check_actual || 0,
            buttoning_target: data.buttoning_target || 0,
            buttoning_actual: data.buttoning_actual || 0,
            iron_target: data.iron_target || 0,
            iron_actual: data.iron_actual || 0,
            get_up_target: data.get_up_target || 0,
            get_up_actual: data.get_up_actual || 0,
            poly_target: data.poly_target || 0,
            poly_actual: data.poly_actual || 0,
            carton_target: data.carton_target || 0,
            carton_actual: data.carton_actual || 0,
            remarks: data.remarks || null,
            submitted_by: user.id,
          });

        if (error) throw error;
        toast.success("Hour logged successfully");
      }

      await fetchHourlyLogs(currentSheet.id);
      setDialogOpen(false);
      setEditingSlot(null);
      setEditingLog(null);
    } catch (error: any) {
      console.error("Error saving hourly log:", error);
      toast.error("Failed to save hourly log");
    }
  }

  async function handleToggleLock(log: HourlyLog) {
    if (!isAdminOrHigher()) {
      toast.error("Only admins can lock/unlock hours");
      return;
    }

    try {
      const { error } = await supabase
        .from("finishing_hourly_logs")
        .update({ is_locked: !log.is_locked })
        .eq("id", log.id);

      if (error) throw error;
      
      toast.success(log.is_locked ? "Hour unlocked" : "Hour locked");
      if (currentSheet) {
        await fetchHourlyLogs(currentSheet.id);
      }
    } catch (error) {
      console.error("Error toggling lock:", error);
      toast.error("Failed to update lock status");
    }
  }

  if (loading || loadingExistingSheet) {
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
    <div className="container max-w-6xl py-4 px-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Finishing Daily Sheet</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Line & PO Selection */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Line & PO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Line *</Label>
              <Select value={selectedLineId} onValueChange={setSelectedLineId}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>PO / Work Order *</Label>
              <Select value={selectedWorkOrderId} onValueChange={setSelectedWorkOrderId}>
                <SelectTrigger>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sheet Header Info */}
      {loadingSheet ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : currentSheet && selectedWorkOrder ? (
        <>
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Order Details</CardTitle>
                <Badge variant="outline">
                  {submittedSlots.length} Hours Logged
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">BUYER:</span>
                  <p className="font-medium">{currentSheet.buyer || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">STYLE:</span>
                  <p className="font-medium">{currentSheet.style || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">P/O:</span>
                  <p className="font-medium">{currentSheet.po_no || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ITEM:</span>
                  <p className="font-medium">{currentSheet.item || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">COLOR:</span>
                  <p className="font-medium">{currentSheet.color || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">ORDER QTY:</span>
                  <p className="font-medium">{selectedWorkOrder.order_qty?.toLocaleString() || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hourly Log Grid */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Hourly Production Log</CardTitle>
                {currentHourSlot && !submittedSlots.includes(currentHourSlot) && (
                  <Button size="sm" onClick={() => handleAddHour(currentHourSlot)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Log Current Hour ({currentHourSlot})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <HourlyLogGrid
                hourSlots={allVisibleSlots}
                hourlyLogs={hourlyLogs}
                currentHourSlot={currentHourSlot}
                isAdmin={isAdminOrHigher()}
                userId={user?.id || ""}
                onAddHour={handleAddHour}
                onToggleLock={handleToggleLock}
              />
            </CardContent>
          </Card>
        </>
      ) : selectedLineId && selectedWorkOrderId ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading sheet...</p>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Select a Line and PO to view or create today's finishing sheet
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hourly Entry Dialog */}
      <HourlyEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        hourSlot={editingSlot || ""}
        existingLog={editingLog}
        onSave={handleSaveHourlyLog}
        isAdmin={isAdminOrHigher()}
      />
    </div>
  );
}
