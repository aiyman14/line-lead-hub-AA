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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, ArrowLeft, AlertTriangle, CheckCircle } from "lucide-react";
import { SHIFTS, BLOCKER_IMPACTS } from "@/lib/constants";

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
}

interface Stage {
  id: string;
  name: string;
  code: string;
}

interface BlockerType {
  id: string;
  name: string;
  code: string;
  default_owner: string | null;
  default_impact: string | null;
}

export default function FinishingUpdate() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form data
  const [lines, setLines] = useState<Line[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [blockerTypes, setBlockerTypes] = useState<BlockerType[]>([]);

  // Form state
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState("");
  const [shift, setShift] = useState("day");
  
  // QC & Finishing metrics
  const [qcPassQty, setQcPassQty] = useState("");
  const [qcFailQty, setQcFailQty] = useState("");
  const [packedQty, setPackedQty] = useState("");
  const [shippedQty, setShippedQty] = useState("");
  
  // Manpower
  const [manpower, setManpower] = useState("");
  const [otHours, setOtHours] = useState("");
  const [otManpower, setOtManpower] = useState("");
  
  // Stage
  const [selectedStage, setSelectedStage] = useState("");
  const [stageProgress, setStageProgress] = useState("");
  
  // Blocker
  const [hasBlocker, setHasBlocker] = useState(false);
  const [selectedBlockerType, setSelectedBlockerType] = useState("");
  const [blockerDescription, setBlockerDescription] = useState("");
  const [blockerOwner, setBlockerOwner] = useState("");
  const [blockerImpact, setBlockerImpact] = useState("medium");
  
  // Notes
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (profile?.factory_id) {
      fetchFormData();
    } else if (profile !== undefined) {
      // User profile loaded but no factory assigned
      setLoading(false);
    }
  }, [profile?.factory_id, profile]);

  // Auto-fill blocker owner when blocker type is selected
  useEffect(() => {
    if (selectedBlockerType) {
      const bt = blockerTypes.find(b => b.id === selectedBlockerType);
      if (bt) {
        setBlockerOwner(bt.default_owner || '');
        setBlockerImpact(bt.default_impact || 'medium');
      }
    }
  }, [selectedBlockerType, blockerTypes]);

  async function fetchFormData() {
    if (!profile?.factory_id) return;

    try {
      const [linesRes, workOrdersRes, stagesRes, blockerTypesRes] = await Promise.all([
        supabase
          .from('lines')
          .select('id, line_id, name')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true)
          .order('line_id'),
        supabase
          .from('work_orders')
          .select('id, po_number, buyer, style, item, order_qty')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true)
          .order('po_number'),
        supabase
          .from('stages')
          .select('id, name, code')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true)
          .order('sequence'),
        supabase
          .from('blocker_types')
          .select('id, name, code, default_owner, default_impact')
          .eq('factory_id', profile.factory_id)
          .eq('is_active', true)
          .order('name'),
      ]);

      setLines(linesRes.data || []);
      setWorkOrders(workOrdersRes.data || []);
      setStages(stagesRes.data || []);
      setBlockerTypes(blockerTypesRes.data || []);
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedLine) {
      toast({ variant: "destructive", title: "Please select a line" });
      return;
    }
    if (!qcPassQty || parseInt(qcPassQty) < 0) {
      toast({ variant: "destructive", title: "Please enter a valid QC pass quantity" });
      return;
    }

    setIsSubmitting(true);

    try {
      const insertData: any = {
        factory_id: profile?.factory_id,
        line_id: selectedLine,
        work_order_id: selectedWorkOrder || null,
        production_date: new Date().toISOString().split('T')[0],
        shift,
        qc_pass_qty: parseInt(qcPassQty) || 0,
        qc_fail_qty: parseInt(qcFailQty) || 0,
        packed_qty: parseInt(packedQty) || 0,
        shipped_qty: parseInt(shippedQty) || 0,
        manpower: parseInt(manpower) || 0,
        ot_hours: parseFloat(otHours) || 0,
        ot_manpower: parseInt(otManpower) || 0,
        stage_id: selectedStage || null,
        stage_progress: parseInt(stageProgress) || 0,
        has_blocker: hasBlocker,
        blocker_type_id: hasBlocker && selectedBlockerType ? selectedBlockerType : null,
        blocker_description: hasBlocker ? blockerDescription : null,
        blocker_owner: hasBlocker ? blockerOwner : null,
        blocker_impact: hasBlocker ? blockerImpact as any : null,
        notes: notes || null,
        submitted_by: user?.id,
      };

      const { error } = await supabase.from('production_updates_finishing').insert(insertData);

      if (error) throw error;

      toast({
        title: "Update submitted!",
        description: "Your finishing/QC update has been recorded.",
      });

      navigate('/dashboard');
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

  const selectedWorkOrderData = workOrders.find(w => w.id === selectedWorkOrder);

  // Calculate QC pass rate
  const qcPassRate = () => {
    const pass = parseInt(qcPassQty) || 0;
    const fail = parseInt(qcFailQty) || 0;
    const total = pass + fail;
    if (total === 0) return null;
    return ((pass / total) * 100).toFixed(1);
  };

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
    <div className="p-4 lg:p-6 max-w-2xl mx-auto">
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
            <h1 className="text-xl font-bold">Finishing / QC Update</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line & Work Order Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Production Line</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mobile-form-field">
              <Label>Line *</Label>
              <Select value={selectedLine} onValueChange={setSelectedLine}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select line" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.line_id} {line.name ? `- ${line.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mobile-form-field">
              <Label>Work Order / PO</Label>
              <Select value={selectedWorkOrder} onValueChange={setSelectedWorkOrder}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select work order" />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.po_number} - {wo.buyer} / {wo.style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedWorkOrderData && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Buyer:</span>
                  <span className="font-medium">{selectedWorkOrderData.buyer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Style:</span>
                  <span className="font-medium">{selectedWorkOrderData.style}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Qty:</span>
                  <span className="font-medium">{selectedWorkOrderData.order_qty.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="mobile-form-field">
              <Label>Shift</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* QC Metrics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quality Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="mobile-form-field">
                <Label className="flex items-center gap-2">
                  QC Pass *
                  <span className="text-success text-xs">✓</span>
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={qcPassQty}
                  onChange={(e) => setQcPassQty(e.target.value)}
                  className="h-12 text-lg font-mono"
                />
              </div>
              <div className="mobile-form-field">
                <Label className="flex items-center gap-2">
                  QC Fail
                  <span className="text-destructive text-xs">✗</span>
                </Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={qcFailQty}
                  onChange={(e) => setQcFailQty(e.target.value)}
                  className="h-12 text-lg font-mono"
                />
              </div>
            </div>

            {qcPassRate() !== null && (
              <div className={`p-3 rounded-lg text-center ${
                parseFloat(qcPassRate()!) >= 95 
                  ? 'bg-success/10 text-success' 
                  : parseFloat(qcPassRate()!) >= 90 
                  ? 'bg-warning/10 text-warning'
                  : 'bg-destructive/10 text-destructive'
              }`}>
                <span className="text-sm font-medium">QC Pass Rate: </span>
                <span className="text-lg font-bold font-mono">{qcPassRate()}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Packing & Shipping */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Packing & Shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="mobile-form-field">
                <Label>Packed Qty</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={packedQty}
                  onChange={(e) => setPackedQty(e.target.value)}
                  className="h-12 text-lg font-mono"
                />
              </div>
              <div className="mobile-form-field">
                <Label>Shipped Qty</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={shippedQty}
                  onChange={(e) => setShippedQty(e.target.value)}
                  className="h-12 text-lg font-mono"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manpower */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Manpower</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="mobile-form-field">
                <Label>Staff</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={manpower}
                  onChange={(e) => setManpower(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="mobile-form-field">
                <Label>OT Hours</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  placeholder="0"
                  value={otHours}
                  onChange={(e) => setOtHours(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="mobile-form-field">
                <Label>OT Staff</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={otManpower}
                  onChange={(e) => setOtManpower(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Stage Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="mobile-form-field">
                <Label>Current Stage</Label>
                <Select value={selectedStage} onValueChange={setSelectedStage}>
                  <SelectTrigger className="h-12">
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
              </div>
              <div className="mobile-form-field">
                <Label>Progress %</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={stageProgress}
                  onChange={(e) => setStageProgress(e.target.value)}
                  className="h-12"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blocker Section */}
        <Card className={hasBlocker ? 'border-warning' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${hasBlocker ? 'text-warning' : 'text-muted-foreground'}`} />
                Blocker Today?
              </CardTitle>
              <Switch checked={hasBlocker} onCheckedChange={setHasBlocker} />
            </div>
          </CardHeader>
          {hasBlocker && (
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="mobile-form-field">
                  <Label>Blocker Type</Label>
                  <Select value={selectedBlockerType} onValueChange={setSelectedBlockerType}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {blockerTypes.map((bt) => (
                        <SelectItem key={bt.id} value={bt.id}>
                          {bt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mobile-form-field">
                  <Label>Impact</Label>
                  <Select value={blockerImpact} onValueChange={setBlockerImpact}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BLOCKER_IMPACTS).map(([key, value]) => (
                        <SelectItem key={value} value={value}>
                          {key.charAt(0) + key.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mobile-form-field">
                <Label>Owner / Responsible</Label>
                <Input
                  placeholder="e.g., QC Team, Packing Lead"
                  value={blockerOwner}
                  onChange={(e) => setBlockerOwner(e.target.value)}
                  className="h-12"
                />
              </div>

              <div className="mobile-form-field">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe the blocker..."
                  value={blockerDescription}
                  onChange={(e) => setBlockerDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any other comments..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          className="w-full h-14 text-lg bg-info hover:bg-info/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <CheckCircle className="h-5 w-5 mr-2" />
              Submit Finishing Update
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
