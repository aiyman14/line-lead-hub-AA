import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, ArrowLeft, CalendarIcon, Factory } from "lucide-react";
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
}

interface Floor {
  id: string;
  name: string;
}

interface WorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  line_id: string | null;
}

interface BlockerType {
  id: string;
  name: string;
  code: string;
  default_owner: string | null;
  default_impact: string | null;
}

interface DropdownOption {
  id: string;
  label: string;
  is_active: boolean;
}

export default function ReportBlocker() {
  const { t, i18n } = useTranslation();
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
  const [blockerTypes, setBlockerTypes] = useState<BlockerType[]>([]);
  const [blockerOwnerOptions, setBlockerOwnerOptions] = useState<DropdownOption[]>([]);
  const [blockerImpactOptions, setBlockerImpactOptions] = useState<DropdownOption[]>([]);

  // Form fields
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedPO, setSelectedPO] = useState("");
  const [blockerType, setBlockerType] = useState("");
  const [blockerOwner, setBlockerOwner] = useState("");
  const [blockerImpact, setBlockerImpact] = useState("");
  const [blockerResolution, setBlockerResolution] = useState<Date | undefined>(new Date());
  const [blockerDescription, setBlockerDescription] = useState("");

  // Check if user is Cutting or Storage role (no line selection needed)
  const isCuttingOrStorage = hasRole("cutting") || hasRole("storage");
  const showLineSelection = !isCuttingOrStorage;
  
  // Determine update type based on user's department
  const userDepartment = profile?.department || "sewing";
  const canAccessBoth = userDepartment === "both" || isAdminOrHigher();
  const defaultUpdateType = userDepartment === "finishing" ? "finishing" : "sewing";
  const [updateType, setUpdateType] = useState<"sewing" | "finishing">(defaultUpdateType);

  // Auto-filled
  const [unitName, setUnitName] = useState("");
  const [floorName, setFloorName] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Set update type based on department when profile loads
  useEffect(() => {
    if (profile?.department) {
      if (profile.department === "finishing") {
        setUpdateType("finishing");
      } else if (profile.department === "sewing") {
        setUpdateType("sewing");
      }
      // If "both", keep whatever is currently selected (defaults to sewing)
    }
  }, [profile?.department]);

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    } else if (profile !== undefined) {
      setLoading(false);
    }
  }, [profile?.factory_id, profile]);

  // Auto-fill Unit/Floor when Line or PO is selected
  useEffect(() => {
    // For cutting/storage: use PO's line_id
    // For workers: use selectedLine
    const lineId = isCuttingOrStorage
      ? workOrders.find((w) => w.id === selectedPO)?.line_id
      : selectedLine;

    if (lineId) {
      const line = lines.find((l) => l.id === lineId);
      if (line) {
        const unit = units.find((u) => u.id === line.unit_id);
        const floor = floors.find((f) => f.id === line.floor_id);
        setUnitName(unit?.name || "");
        setFloorName(floor?.name || "");
      } else {
        setUnitName("");
        setFloorName("");
      }
    } else {
      setUnitName("");
      setFloorName("");
    }
  }, [selectedLine, selectedPO, workOrders, lines, units, floors, isCuttingOrStorage]);

  // Auto-fill blocker owner/impact when blocker type is selected
  useEffect(() => {
    if (blockerType) {
      const bt = blockerTypes.find((b) => b.id === blockerType);
      if (bt) {
        if (bt.default_owner) {
          const ownerOption = blockerOwnerOptions.find(
            (o) => o.label.toLowerCase() === bt.default_owner?.toLowerCase()
          );
          if (ownerOption) setBlockerOwner(ownerOption.id);
        }
        if (bt.default_impact) {
          const impactOption = blockerImpactOptions.find((o) =>
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
        blockerTypesRes,
        blockerOwnerRes,
        blockerImpactRes,
      ] = await Promise.all([
        supabase
          .from("lines")
          .select("id, line_id, name, unit_id, floor_id")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true)
          .order("line_id"),
        supabase
          .from("user_line_assignments")
          .select("line_id")
          .eq("user_id", user.id)
          .eq("factory_id", profile.factory_id),
        supabase
          .from("work_orders")
          .select("id, po_number, buyer, style, line_id")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true)
          .order("po_number"),
        supabase
          .from("units")
          .select("id, name")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true),
        supabase
          .from("floors")
          .select("id, name")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true),
        supabase
          .from("blocker_types")
          .select("id, name, code, default_owner, default_impact")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("blocker_owner_options")
          .select("id, label, is_active")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("blocker_impact_options")
          .select("id, label, is_active")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true)
          .order("sort_order"),
      ]);

      const allLines = linesRes.data || [];
      const assignedLineIds = (lineAssignmentsRes.data || []).map((a) => a.line_id);

      // If user has line assignments, filter to only those lines. Otherwise show all (for admins).
      const filteredLines =
        assignedLineIds.length > 0
          ? allLines.filter((line) => assignedLineIds.includes(line.id))
          : allLines;

      // Sort lines numerically
      const sortedLines = [...filteredLines].sort((a, b) => {
        const numA = parseInt(a.line_id.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.line_id.replace(/\D/g, "")) || 0;
        return numA - numB;
      });

      setLines(sortedLines);
      setWorkOrders(workOrdersRes.data || []);
      setUnits(unitsRes.data || []);
      setFloors(floorsRes.data || []);
      setBlockerTypes(blockerTypesRes.data || []);
      setBlockerOwnerOptions(blockerOwnerRes.data || []);
      setBlockerImpactOptions(blockerImpactRes.data || []);
    } catch (error) {
      console.error("Error fetching form data:", error);
    } finally {
      setLoading(false);
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    // Line is required for workers (non-cutting/storage)
    if (showLineSelection && !selectedLine) newErrors.line = "Line is required";
    if (!selectedPO) newErrors.po = "PO is required";
    if (!blockerType) newErrors.blockerType = "Blocker Type is required";
    if (!blockerOwner) newErrors.blockerOwner = "Blocker Owner is required";
    if (!blockerImpact) newErrors.blockerImpact = "Blocker Impact is required";
    if (!blockerResolution) newErrors.blockerResolution = "Expected Resolution date is required";
    if (!blockerDescription.trim()) newErrors.blockerDescription = "Description is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast({ variant: "destructive", title: t('common.fillRequiredFields') });
      return;
    }

    setIsSubmitting(true);

    try {
      const blockerOwnerLabel = blockerOwnerOptions.find((o) => o.id === blockerOwner)?.label || "";
      const blockerImpactLabel = blockerImpactOptions.find((i) => i.id === blockerImpact)?.label || "";

      const impactValue = blockerImpactLabel.toLowerCase().includes("critical")
        ? "critical"
        : blockerImpactLabel.toLowerCase().includes("high")
        ? "high"
        : blockerImpactLabel.toLowerCase().includes("medium")
        ? "medium"
        : "low";

      const workOrder = workOrders.find((w) => w.id === selectedPO);
      // For cutting/storage use PO's line_id, for workers use selectedLine
      const lineId = isCuttingOrStorage 
        ? (workOrder?.line_id || lines[0]?.id)
        : selectedLine;

      const insertData: Record<string, unknown> = {
        factory_id: profile?.factory_id,
        line_id: lineId,
        work_order_id: selectedPO,
        production_date: new Date().toISOString().split("T")[0],
        submitted_by: user?.id,
        submitted_at: new Date().toISOString(),

        // Blocker fields
        has_blocker: true,
        blocker_type_id: blockerType,
        blocker_owner: blockerOwnerLabel,
        blocker_impact: impactValue as "low" | "medium" | "high" | "critical",
        blocker_resolution_date: blockerResolution ? format(blockerResolution, "yyyy-MM-dd") : null,
        blocker_description: blockerDescription,
        blocker_status: "open",

        // Auto-filled context
        unit_name: unitName,
        floor_name: floorName,
        factory_name: factory?.name || "",
      };

      // Add table-specific required fields
      if (updateType === "sewing") {
        Object.assign(insertData, {
          buyer_name: workOrder?.buyer || "",
          po_number: workOrder?.po_number || "",
          style_code: workOrder?.style || "",
          output_qty: 0,
          action_taken_today: blockerDescription,
        });
      } else {
        Object.assign(insertData, {
          buyer_name: workOrder?.buyer || "",
          style_no: workOrder?.style || "",
          qc_pass_qty: 0,
        });
      }

      const table = updateType === "sewing" ? "production_updates_sewing" : "production_updates_finishing";
      const { error } = await supabase.from(table).insert(insertData as never);

      if (error) throw error;

      // Get the blocker type name for notification
      const blockerTypeName = blockerTypes.find(bt => bt.id === blockerType)?.name || "Unknown";
      
      // Get the line name for notification
      const lineName = isCuttingOrStorage
        ? (lines.find(l => l.id === workOrder?.line_id)?.name || lines.find(l => l.id === workOrder?.line_id)?.line_id || "Unknown")
        : (lines.find(l => l.id === selectedLine)?.name || lines.find(l => l.id === selectedLine)?.line_id || "Unknown");

      // Send notification to admins (fire and forget - don't block the user)
      supabase.functions.invoke("notify-blocker", {
        body: {
          factoryId: profile?.factory_id,
          lineName,
          poNumber: workOrder?.po_number || undefined,
          blockerType: blockerTypeName,
          blockerImpact: impactValue,
          blockerDescription,
          submittedBy: profile?.full_name || "Unknown",
          department: updateType,
        },
      }).then((res) => {
        if (res.error) {
          console.error("Failed to send blocker notifications:", res.error);
        } else {
          console.log("Blocker notifications sent:", res.data);
        }
      }).catch((err) => {
        console.error("Error calling notify-blocker function:", err);
      });

      toast({
        title: t('reportBlocker.blockerReported'),
        description: t('reportBlocker.blockerReportedDesc'),
      });

      // Navigate workers to my-submissions, others to blockers view
      const isWorker = hasRole("worker") && !isAdminOrHigher();
      navigate(isWorker ? "/my-submissions" : "/blockers");
    } catch (error: unknown) {
      console.error("Error submitting blocker:", error);
      toast({
        variant: "destructive",
        title: t('common.submissionFailed'),
        description: error instanceof Error ? error.message : t('common.pleaseTryAgain'),
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
            <h2 className="text-lg font-semibold mb-2">{t('common.noFactoryAssigned')}</h2>
            <p className="text-muted-foreground text-sm">
              {t('common.needFactoryAssigned')}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
              {t('reportBlocker.goBack')}
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
          <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('reportBlocker.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString(i18n.language === 'bn' ? 'bn-BD' : 'en-US', { dateStyle: "full" })}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Update Type - Only show if user has access to both */}
        {canAccessBoth ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('reportBlocker.updateType')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={updateType} onValueChange={(v) => setUpdateType(v as "sewing" | "finishing")}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sewing">{t('dashboard.sewing')}</SelectItem>
                  <SelectItem value="finishing">{t('dashboard.finishing')}</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ) : null}

        {/* Location Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('reportBlocker.location')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Line Selection - Only for Worker roles (not Cutting/Storage) */}
            {showLineSelection && (
              <div className="space-y-2">
                <Label>{t('sewing.lineNo')} *</Label>
                <Select value={selectedLine} onValueChange={setSelectedLine}>
                  <SelectTrigger className={`h-12 ${errors.line ? "border-destructive" : ""}`}>
                    <SelectValue
                      placeholder={
                        lines.length === 0
                          ? t('common.noLinesAvailable')
                          : t('common.selectLine')
                      }
                    />
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
            )}

            <div className="space-y-2">
              <Label>PO *</Label>
              <Select value={selectedPO} onValueChange={setSelectedPO}>
                <SelectTrigger className={`h-12 ${errors.po ? "border-destructive" : ""}`}>
                  <SelectValue
                    placeholder={
                      workOrders.length === 0
                        ? t('common.noPOsAvailable')
                        : t('common.selectPO')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.po_number} - {wo.style} ({wo.buyer})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.po && <p className="text-xs text-destructive">{errors.po}</p>}
            </div>

            {/* Auto-filled context */}
            {(showLineSelection ? selectedLine : selectedPO) && (unitName || floorName) && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                {unitName && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('sewing.unit')}</Label>
                    <div className="p-2 bg-muted rounded border text-sm font-medium">{unitName}</div>
                  </div>
                )}
                {floorName && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t('sewing.floor')}</Label>
                    <div className="p-2 bg-muted rounded border text-sm font-medium">{floorName}</div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Blocker Details */}
        <Card className="border-warning">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {t('reportBlocker.blockerDetails')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Blocker Type */}
            <div className="space-y-2">
              <Label>{t('sewing.blockerType')} *</Label>
              <Select value={blockerType} onValueChange={setBlockerType}>
                <SelectTrigger className={`h-12 ${errors.blockerType ? "border-destructive" : ""}`}>
                  <SelectValue placeholder={t('reportBlocker.selectBlockerType')} />
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
              <Label>{t('sewing.blockerOwner')} *</Label>
              <Select value={blockerOwner} onValueChange={setBlockerOwner}>
                <SelectTrigger className={`h-12 ${errors.blockerOwner ? "border-destructive" : ""}`}>
                  <SelectValue placeholder={t('reportBlocker.selectBlockerOwner')} />
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
              <Label>{t('sewing.blockerImpact')} *</Label>
              <Select value={blockerImpact} onValueChange={setBlockerImpact}>
                <SelectTrigger className={`h-12 ${errors.blockerImpact ? "border-destructive" : ""}`}>
                  <SelectValue placeholder={t('reportBlocker.selectBlockerImpact')} />
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

            {/* Expected Resolution Date */}
            <div className="space-y-2">
              <Label>{t('reportBlocker.expectedResolution')} *</Label>
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
                    {blockerResolution ? format(blockerResolution, "PPP") : t('common.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={blockerResolution} onSelect={setBlockerResolution} initialFocus />
                </PopoverContent>
              </Popover>
              {errors.blockerResolution && <p className="text-xs text-destructive">{errors.blockerResolution}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>{t('blockers.description_label')} *</Label>
              <Textarea
                placeholder={t('sewing.actionTakenToday')}
                value={blockerDescription}
                onChange={(e) => setBlockerDescription(e.target.value)}
                className={`min-h-[100px] ${errors.blockerDescription ? "border-destructive" : ""}`}
              />
              {errors.blockerDescription && (
                <p className="text-xs text-destructive">{errors.blockerDescription}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button type="submit" className="w-full h-12" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.loading')}
            </>
          ) : (
            <>
              <AlertTriangle className="mr-2 h-4 w-4" />
              {t('reportBlocker.title')}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
