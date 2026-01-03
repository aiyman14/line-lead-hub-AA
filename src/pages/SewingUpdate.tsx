import { useState, useEffect, useRef } from "react";
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
import { Loader2, Factory, ArrowLeft, AlertTriangle, CheckCircle, Upload, X, Image as ImageIcon, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  smv: number | null;
  target_per_hour: number | null;
  target_per_day: number | null;
  line_id: string | null;
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

interface DropdownOption {
  id: string;
  label: string;
  is_active: boolean;
}

interface BlockerType {
  id: string;
  name: string;
  code: string;
  default_owner: string | null;
  default_impact: string | null;
}

interface Factory {
  id: string;
  name: string;
}

export default function SewingUpdate() {
  const { profile, user, factory, hasRole, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Master data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageProgressOptions, setStageProgressOptions] = useState<DropdownOption[]>([]);
  const [nextMilestoneOptions, setNextMilestoneOptions] = useState<DropdownOption[]>([]);
  const [blockerTypes, setBlockerTypes] = useState<BlockerType[]>([]);
  const [blockerOwnerOptions, setBlockerOwnerOptions] = useState<DropdownOption[]>([]);
  const [blockerImpactOptions, setBlockerImpactOptions] = useState<DropdownOption[]>([]);

  // SECTION A - Selection fields
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedPO, setSelectedPO] = useState("");

  // SECTION B - Auto-filled from PO/Line (read-only display)
  const [buyerName, setBuyerName] = useState("");
  const [styleCode, setStyleCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [orderQty, setOrderQty] = useState(0);
  const [color, setColor] = useState("");
  const [smv, setSmv] = useState("");
  const [unitName, setUnitName] = useState("");
  const [floorName, setFloorName] = useState("");

  // SECTION C - Worker-entered production numbers
  const [perHourTarget, setPerHourTarget] = useState("");
  const [dayProduction, setDayProduction] = useState("");
  const [rejectToday, setRejectToday] = useState("");
  const [reworkToday, setReworkToday] = useState("");
  const [totalProduction, setTotalProduction] = useState("");
  const [overTime, setOverTime] = useState("");
  const [mPower, setMPower] = useState("");

  // SECTION D - Tracking fields
  const [currentStage, setCurrentStage] = useState("");
  const [stageProgress, setStageProgress] = useState("");
  const [estimatedExFactory, setEstimatedExFactory] = useState<Date | undefined>();
  const [nextMilestone, setNextMilestone] = useState("");

  // SECTION E - Blockers (conditional)
  const [blockerToday, setBlockerToday] = useState("No");
  const [blockerType, setBlockerType] = useState("");
  const [blockerOwner, setBlockerOwner] = useState("");
  const [blockerImpact, setBlockerImpact] = useState("");
  const [blockerResolution, setBlockerResolution] = useState<Date | undefined>(new Date());
  const [actionTakenToday, setActionTakenToday] = useState("");

  // SECTION F - Photos and Notes
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [remarks, setRemarks] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.factory_id, profile]);

  // Filter work orders by selected line
  const filteredWorkOrders = selectedLine 
    ? workOrders.filter(wo => wo.line_id === selectedLine)
    : [];

  // Auto-fill PO details when PO is selected
  useEffect(() => {
    if (selectedPO) {
      const po = workOrders.find(w => w.id === selectedPO);
      if (po) {
        setBuyerName(po.buyer || "");
        setStyleCode(po.style || "");
        setItemName(po.item || "");
        setOrderQty(po.order_qty || 0);
        setColor(po.color || "");
        setSmv(po.smv?.toString() || "");
        // Auto-fill per hour target from work order if available
        if (po.target_per_hour) {
          setPerHourTarget(po.target_per_hour.toString());
        }
      }
    } else {
      setBuyerName("");
      setStyleCode("");
      setItemName("");
      setOrderQty(0);
      setColor("");
      setSmv("");
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
      // Reset PO when line changes
      if (!filteredWorkOrders.find(wo => wo.id === selectedPO)) {
        setSelectedPO("");
      }
    } else {
      setUnitName("");
      setFloorName("");
      setSelectedPO("");
    }
  }, [selectedLine, lines, units, floors]);

  // Auto-fill blocker owner/impact when blocker type is selected
  useEffect(() => {
    if (blockerType) {
      const bt = blockerTypes.find(b => b.id === blockerType);
      if (bt) {
        if (bt.default_owner) {
          // Find matching owner option
          const ownerOption = blockerOwnerOptions.find(o => 
            o.label.toLowerCase() === bt.default_owner?.toLowerCase()
          );
          if (ownerOption) setBlockerOwner(ownerOption.id);
        }
        if (bt.default_impact) {
          // Find matching impact option
          const impactOption = blockerImpactOptions.find(o => 
            o.label.toLowerCase().includes(bt.default_impact?.toLowerCase() || "")
          );
          if (impactOption) setBlockerImpact(impactOption.id);
        }
      }
    }
  }, [blockerType, blockerTypes, blockerOwnerOptions, blockerImpactOptions]);

  async function fetchFormData() {
    if (!profile?.factory_id || !user?.id) return;

    try {
      const [
        linesRes, 
        lineAssignmentsRes,
        workOrdersRes, 
        unitsRes, 
        floorsRes, 
        stagesRes, 
        stageProgressRes,
        nextMilestoneRes,
        blockerTypesRes,
        blockerOwnerRes,
        blockerImpactRes
      ] = await Promise.all([
        supabase.from('lines').select('id, line_id, name, unit_id, floor_id').eq('factory_id', profile.factory_id).eq('is_active', true).order('line_id'),
        supabase.from('user_line_assignments').select('line_id').eq('user_id', user.id).eq('factory_id', profile.factory_id),
        supabase.from('work_orders').select('id, po_number, buyer, style, item, order_qty, color, smv, target_per_hour, target_per_day, line_id').eq('factory_id', profile.factory_id).eq('is_active', true).order('po_number'),
        supabase.from('units').select('id, name, code').eq('factory_id', profile.factory_id).eq('is_active', true),
        supabase.from('floors').select('id, name, code').eq('factory_id', profile.factory_id).eq('is_active', true),
        supabase.from('stages').select('id, name, code').eq('factory_id', profile.factory_id).eq('is_active', true).order('sequence'),
        supabase.from('stage_progress_options').select('id, label, is_active').eq('factory_id', profile.factory_id).eq('is_active', true).order('sort_order'),
        supabase.from('next_milestone_options').select('id, label, is_active').eq('factory_id', profile.factory_id).eq('is_active', true).order('sort_order'),
        supabase.from('blocker_types').select('id, name, code, default_owner, default_impact').eq('factory_id', profile.factory_id).eq('is_active', true).order('name'),
        supabase.from('blocker_owner_options').select('id, label, is_active').eq('factory_id', profile.factory_id).eq('is_active', true).order('sort_order'),
        supabase.from('blocker_impact_options').select('id, label, is_active').eq('factory_id', profile.factory_id).eq('is_active', true).order('sort_order'),
      ]);

      const allLines = linesRes.data || [];
      const assignedLineIds = (lineAssignmentsRes.data || []).map(a => a.line_id);
      
      // If user has line assignments, filter to only those lines. Otherwise show all (for admins).
      const filteredLines = assignedLineIds.length > 0 
        ? allLines.filter(line => assignedLineIds.includes(line.id))
        : allLines;

      // Sort lines numerically by extracting number from line_id
      const sortedLines = [...filteredLines].sort((a, b) => {
        const numA = parseInt(a.line_id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.line_id.replace(/\D/g, '')) || 0;
        return numA - numB;
      });

      setLines(sortedLines);
      setWorkOrders(workOrdersRes.data || []);
      setUnits(unitsRes.data || []);
      setFloors(floorsRes.data || []);
      setStages(stagesRes.data || []);
      setStageProgressOptions(stageProgressRes.data || []);
      setNextMilestoneOptions(nextMilestoneRes.data || []);
      setBlockerTypes(blockerTypesRes.data || []);
      setBlockerOwnerOptions(blockerOwnerRes.data || []);
      setBlockerImpactOptions(blockerImpactRes.data || []);
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    // Section A validations
    if (!selectedLine) newErrors.line = "Line No is required";
    if (!selectedPO) newErrors.po = "PO ID is required";

    // Section C validations
    if (!perHourTarget) newErrors.perHourTarget = "Per Hour Target is required";
    if (!dayProduction) newErrors.dayProduction = "Day Production is required";
    if (!rejectToday) newErrors.rejectToday = "Reject Today is required";
    if (!reworkToday) newErrors.reworkToday = "Rework Today is required";
    if (!totalProduction) newErrors.totalProduction = "Total Production is required";
    if (!overTime && overTime !== "0") newErrors.overTime = "Over Time is required";
    if (!mPower) newErrors.mPower = "M Power is required";

    // Section D validations
    if (!currentStage) newErrors.currentStage = "Current Stage is required";
    if (!stageProgress) newErrors.stageProgress = "Stage Progress is required";
    if (!nextMilestone) newErrors.nextMilestone = "Next Milestone is required";

    // Section E validations (conditional)
    if (blockerToday === "Yes") {
      if (!blockerType) newErrors.blockerType = "Blocker Type is required";
      if (!blockerOwner) newErrors.blockerOwner = "Blocker Owner is required";
      if (!blockerImpact) newErrors.blockerImpact = "Blocker Impact is required";
      if (!blockerResolution) newErrors.blockerResolution = "Blocker Resolution date is required";
      if (!actionTakenToday) newErrors.actionTakenToday = "Action Taken Today is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast({ variant: "destructive", title: "Please fill all required fields" });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get stage progress label for storage
      const stageProgressLabel = stageProgressOptions.find(s => s.id === stageProgress)?.label || "";
      const stageProgressValue = parseInt(stageProgressLabel.replace('%', '')) || 0;

      // Get next milestone label
      const nextMilestoneLabel = nextMilestoneOptions.find(n => n.id === nextMilestone)?.label || "";

      // Get blocker details if applicable
      const blockerTypeData = blockerTypes.find(b => b.id === blockerType);
      const blockerOwnerLabel = blockerOwnerOptions.find(o => o.id === blockerOwner)?.label || "";
      const blockerImpactLabel = blockerImpactOptions.find(i => i.id === blockerImpact)?.label || "";

      const insertData: any = {
        factory_id: profile?.factory_id,
        line_id: selectedLine,
        work_order_id: selectedPO || null,
        production_date: new Date().toISOString().split('T')[0],
        
        // Auto-filled from PO (stored for historical record)
        buyer_name: buyerName,
        po_number: workOrders.find(w => w.id === selectedPO)?.po_number || "",
        style_code: styleCode,
        item_name: itemName,
        color: color,
        order_qty: orderQty,
        smv: parseFloat(smv) || null,
        
        // Auto-filled from Line
        unit_name: unitName,
        floor_name: floorName,
        factory_name: factory?.name || "",
        
        // Worker-entered production numbers
        per_hour_target: parseInt(perHourTarget) || 0,
        output_qty: parseInt(dayProduction) || 0, // Day Production maps to output_qty
        reject_qty: parseInt(rejectToday) || 0,
        rework_qty: parseInt(reworkToday) || 0,
        cumulative_good_total: parseInt(totalProduction) || 0,
        ot_hours: parseFloat(overTime) || 0,
        manpower: parseInt(mPower) || 0,
        
        // Tracking fields
        stage_id: currentStage || null,
        stage_progress: stageProgressValue,
        estimated_ex_factory: estimatedExFactory ? format(estimatedExFactory, 'yyyy-MM-dd') : null,
        next_milestone: nextMilestoneLabel,
        
        // Blocker fields
        has_blocker: blockerToday === "Yes",
        blocker_type_id: blockerToday === "Yes" && blockerType ? blockerType : null,
        blocker_owner: blockerToday === "Yes" ? blockerOwnerLabel : null,
        blocker_impact: blockerToday === "Yes" && blockerImpactLabel ? 
          (blockerImpactLabel.toLowerCase().includes('critical') ? 'critical' :
           blockerImpactLabel.toLowerCase().includes('high') ? 'high' :
           blockerImpactLabel.toLowerCase().includes('medium') ? 'medium' : 'low') as any : null,
        blocker_resolution_date: blockerToday === "Yes" && blockerResolution ? format(blockerResolution, 'yyyy-MM-dd') : null,
        action_taken_today: blockerToday === "Yes" ? actionTakenToday : null,
        blocker_description: blockerToday === "Yes" ? actionTakenToday : null, // Use action taken as description
        
        // Notes
        notes: remarks || null,
        submitted_by: user?.id,
      };

      const { error } = await supabase.from('production_updates_sewing').insert(insertData);

      if (error) throw error;

      toast({
        title: "Update submitted!",
        description: "Your daily production update has been recorded.",
      });

      // Clear form and navigate - workers go to my-submissions, others to dashboard
      const isWorker = hasRole('worker') && !isAdminOrHigher();
      navigate(isWorker ? '/my-submissions' : '/dashboard');
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
            <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
    <div className="p-4 lg:p-6 max-w-2xl mx-auto pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Factory className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Daily Production Update</h1>
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
            {/* Line No */}
            <div className="space-y-2">
              <Label htmlFor="line">Line No *</Label>
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

        {/* SECTION B - Auto-filled Details (Read-only) */}
        {selectedPO && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Buyer</Label>
                  <p className="font-medium text-sm">{buyerName || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Style No</Label>
                  <p className="font-medium text-sm">{styleCode || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Item</Label>
                  <p className="font-medium text-sm">{itemName || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Order Quantity</Label>
                  <p className="font-medium text-sm">{orderQty.toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <p className="font-medium text-sm">{color || "-"}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">SMV</Label>
                  <p className="font-medium text-sm">{smv || "-"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION C - Production Numbers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Production Numbers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Per Hour Target & Day Production */}
            <div className="grid grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label>Day Production *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={dayProduction}
                  onChange={(e) => setDayProduction(e.target.value)}
                  className={`h-12 ${errors.dayProduction ? 'border-destructive' : ''}`}
                />
                {errors.dayProduction && <p className="text-xs text-destructive">{errors.dayProduction}</p>}
              </div>
            </div>

            {/* Row 2: Reject Today & Rework Today */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reject Today *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={rejectToday}
                  onChange={(e) => setRejectToday(e.target.value)}
                  className={`h-12 ${errors.rejectToday ? 'border-destructive' : ''}`}
                />
                {errors.rejectToday && <p className="text-xs text-destructive">{errors.rejectToday}</p>}
              </div>
              <div className="space-y-2">
                <Label>Rework Today *</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="0"
                  value={reworkToday}
                  onChange={(e) => setReworkToday(e.target.value)}
                  className={`h-12 ${errors.reworkToday ? 'border-destructive' : ''}`}
                />
                {errors.reworkToday && <p className="text-xs text-destructive">{errors.reworkToday}</p>}
              </div>
            </div>

            {/* Row 3: Total Production */}
            <div className="space-y-2">
              <Label>Total Production *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={totalProduction}
                onChange={(e) => setTotalProduction(e.target.value)}
                className={`h-12 ${errors.totalProduction ? 'border-destructive' : ''}`}
              />
              {errors.totalProduction && <p className="text-xs text-destructive">{errors.totalProduction}</p>}
            </div>

            {/* Row 4: Over Time & M Power */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Over Time *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={overTime}
                  onChange={(e) => setOverTime(e.target.value)}
                  className={`h-12 ${errors.overTime ? 'border-destructive' : ''}`}
                />
                {errors.overTime && <p className="text-xs text-destructive">{errors.overTime}</p>}
              </div>
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
            </div>
          </CardContent>
        </Card>

        {/* SECTION D - Tracking */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Stage */}
            <div className="space-y-2">
              <Label>Current Stage *</Label>
              <Select value={currentStage} onValueChange={setCurrentStage}>
                <SelectTrigger className={`h-12 ${errors.currentStage ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currentStage && <p className="text-xs text-destructive">{errors.currentStage}</p>}
            </div>

            {/* Stage Progress */}
            <div className="space-y-2">
              <Label>Stage Progress *</Label>
              <Select value={stageProgress} onValueChange={setStageProgress}>
                <SelectTrigger className={`h-12 ${errors.stageProgress ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Select Progress" />
                </SelectTrigger>
                <SelectContent>
                  {stageProgressOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.stageProgress && <p className="text-xs text-destructive">{errors.stageProgress}</p>}
            </div>

            {/* Estimated ExFactory */}
            <div className="space-y-2">
              <Label>Estimated ExFactory</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-12 justify-start text-left font-normal",
                      !estimatedExFactory && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {estimatedExFactory ? format(estimatedExFactory, "PPP") : "Select date (optional)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={estimatedExFactory}
                    onSelect={setEstimatedExFactory}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Next Milestone */}
            <div className="space-y-2">
              <Label>Next Milestone Tomc *</Label>
              <Select value={nextMilestone} onValueChange={setNextMilestone}>
                <SelectTrigger className={`h-12 ${errors.nextMilestone ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Select Milestone" />
                </SelectTrigger>
                <SelectContent>
                  {nextMilestoneOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.nextMilestone && <p className="text-xs text-destructive">{errors.nextMilestone}</p>}
            </div>
          </CardContent>
        </Card>

        {/* SECTION E - Blockers (Conditional) */}
        <Card className={blockerToday === "Yes" ? 'border-warning' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${blockerToday === "Yes" ? 'text-warning' : 'text-muted-foreground'}`} />
              Blocker Today
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Blocker Today Yes/No */}
            <div className="space-y-2">
              <Label>Blocker Today *</Label>
              <Select value={blockerToday} onValueChange={setBlockerToday}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conditional blocker fields */}
            {blockerToday === "Yes" && (
              <>
                {/* Blocker Type */}
                <div className="space-y-2">
                  <Label>Blocker Type *</Label>
                  <Select value={blockerType} onValueChange={setBlockerType}>
                    <SelectTrigger className={`h-12 ${errors.blockerType ? 'border-destructive' : ''}`}>
                      <SelectValue placeholder="Select Blocker Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {blockerTypes.map((bt) => (
                        <SelectItem key={bt.id} value={bt.id}>
                          {bt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.blockerType && <p className="text-xs text-destructive">{errors.blockerType}</p>}
                </div>

                {/* Blocker Owner */}
                <div className="space-y-2">
                  <Label>Blocker Owner *</Label>
                  <Select value={blockerOwner} onValueChange={setBlockerOwner}>
                    <SelectTrigger className={`h-12 ${errors.blockerOwner ? 'border-destructive' : ''}`}>
                      <SelectValue placeholder="Select Owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {blockerOwnerOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.blockerOwner && <p className="text-xs text-destructive">{errors.blockerOwner}</p>}
                </div>

                {/* Blocker Impact */}
                <div className="space-y-2">
                  <Label>Blocker Impact *</Label>
                  <Select value={blockerImpact} onValueChange={setBlockerImpact}>
                    <SelectTrigger className={`h-12 ${errors.blockerImpact ? 'border-destructive' : ''}`}>
                      <SelectValue placeholder="Select Impact" />
                    </SelectTrigger>
                    <SelectContent>
                      {blockerImpactOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.blockerImpact && <p className="text-xs text-destructive">{errors.blockerImpact}</p>}
                </div>

                {/* Blocker Resolution Date */}
                <div className="space-y-2">
                  <Label>Blocker Resolution *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 justify-start text-left font-normal",
                          !blockerResolution && "text-muted-foreground",
                          errors.blockerResolution && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {blockerResolution ? format(blockerResolution, "PPP") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={blockerResolution}
                        onSelect={setBlockerResolution}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.blockerResolution && <p className="text-xs text-destructive">{errors.blockerResolution}</p>}
                </div>

                {/* Action Taken Today */}
                <div className="space-y-2">
                  <Label>Action Taken Today *</Label>
                  <Textarea
                    placeholder="Describe action taken..."
                    value={actionTakenToday}
                    onChange={(e) => setActionTakenToday(e.target.value)}
                    className={`min-h-[80px] ${errors.actionTakenToday ? 'border-destructive' : ''}`}
                  />
                  {errors.actionTakenToday && <p className="text-xs text-destructive">{errors.actionTakenToday}</p>}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* SECTION F - Photos & Remarks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Attachments & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Photos */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Photos (Optional)
              </Label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (photos.length + files.length > 2) {
                    toast({
                      variant: "destructive",
                      title: "Maximum 2 photos allowed",
                    });
                    return;
                  }
                  const newPhotos = [...photos, ...files].slice(0, 2);
                  setPhotos(newPhotos);
                  setPhotoPreviewUrls(newPhotos.map(file => URL.createObjectURL(file)));
                }}
              />
              
              {photoPreviewUrls.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                  {photoPreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="h-24 w-24 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newPhotos = photos.filter((_, i) => i !== index);
                          const newUrls = photoPreviewUrls.filter((_, i) => i !== index);
                          setPhotos(newPhotos);
                          setPhotoPreviewUrls(newUrls);
                        }}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {photos.length < 2 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {photos.length === 0 ? 'Add Photos' : 'Add Another Photo'}
                </Button>
              )}
              
              <p className="text-xs text-muted-foreground">
                You can upload up to 2 photos (optional)
              </p>
            </div>

            {/* Remarks */}
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
        <div className="sticky bottom-0 bg-background border-t py-4">
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
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Submit Update
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
