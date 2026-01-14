import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, isToday, parseISO } from "date-fns";
import { toast } from "sonner";
import { Loader2, Download, RefreshCw, Scissors, Target, ClipboardCheck, Pencil, Package, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EditCuttingActualModal } from "@/components/EditCuttingActualModal";
import { CuttingDetailModal } from "@/components/CuttingDetailModal";
import { useEditPermission } from "@/hooks/useEditPermission";

interface CuttingTarget {
  id: string;
  production_date: string;
  submitted_at: string | null;
  line_id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  colour: string | null;
  order_qty: number | null;
  man_power: number;
  marker_capacity: number;
  lay_capacity: number;
  cutting_capacity: number;
  under_qty: number | null;
  day_cutting: number;
  day_input: number;
  lines?: { line_id: string; name: string | null };
  work_orders?: { po_number: string; buyer: string; style: string };
}

interface CuttingActual {
  id: string;
  production_date: string;
  submitted_at: string | null;
  line_id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  colour: string | null;
  order_qty: number | null;
  day_cutting: number;
  day_input: number;
  total_cutting: number | null;
  total_input: number | null;
  balance: number | null;
  man_power: number;
  marker_capacity: number;
  lay_capacity: number;
  cutting_capacity: number;
  under_qty: number | null;
  leftover_recorded: boolean | null;
  leftover_type: string | null;
  leftover_unit: string | null;
  leftover_quantity: number | null;
  leftover_notes: string | null;
  leftover_location: string | null;
  leftover_photo_urls: string[] | null;
  lines?: { line_id: string; name: string | null };
  work_orders?: { po_number: string; buyer: string; style: string };
}

interface Line {
  id: string;
  line_id: string;
  name: string | null;
}

export default function CuttingAllSubmissions() {
  const { profile } = useAuth();
  const { canEditSubmission } = useEditPermission();
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<CuttingTarget[]>([]);
  const [actuals, setActuals] = useState<CuttingActual[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [activeTab, setActiveTab] = useState("actuals");
  
  // Modals
  const [selectedTarget, setSelectedTarget] = useState<CuttingTarget | null>(null);
  const [selectedActual, setSelectedActual] = useState<CuttingActual | null>(null);
  const [editingActual, setEditingActual] = useState<any>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedLine, setSelectedLine] = useState("all");
  const [selectedPO, setSelectedPO] = useState("all");

  useEffect(() => {
    if (profile?.factory_id) {
      fetchData();
    }
  }, [profile?.factory_id, dateFrom, dateTo]);

  async function fetchData() {
    if (!profile?.factory_id) return;
    setLoading(true);

    try {
      const [targetsRes, actualsRes, linesRes] = await Promise.all([
        supabase
          .from("cutting_targets")
          .select("*, lines(line_id, name), work_orders(po_number, buyer, style)")
          .eq("factory_id", profile.factory_id)
          .gte("production_date", dateFrom)
          .lte("production_date", dateTo)
          .order("production_date", { ascending: false }),
        supabase
          .from("cutting_actuals")
          .select("*, lines!cutting_actuals_line_id_fkey(line_id, name), work_orders(po_number, buyer, style)")
          .eq("factory_id", profile.factory_id)
          .gte("production_date", dateFrom)
          .lte("production_date", dateTo)
          .order("production_date", { ascending: false }),
        supabase
          .from("lines")
          .select("id, line_id, name")
          .eq("factory_id", profile.factory_id)
          .eq("is_active", true),
      ]);

      setTargets(targetsRes.data || []);
      setActuals(actualsRes.data || []);
      setLines(linesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // Get unique PO numbers for filter
  const uniquePOs = useMemo(() => {
    const pos = new Set<string>();
    [...targets, ...actuals].forEach(s => {
      const po = s.work_orders?.po_number || s.po_no;
      if (po) pos.add(po);
    });
    return Array.from(pos).sort();
  }, [targets, actuals]);

  const filteredTargets = useMemo(() => {
    return targets.filter(s => {
      if (selectedLine !== "all" && s.line_id !== selectedLine) return false;
      if (selectedPO !== "all") {
        const po = s.work_orders?.po_number || s.po_no;
        if (po !== selectedPO) return false;
      }
      return true;
    });
  }, [targets, selectedLine, selectedPO]);

  const filteredActuals = useMemo(() => {
    return actuals.filter(s => {
      if (selectedLine !== "all" && s.line_id !== selectedLine) return false;
      if (selectedPO !== "all") {
        const po = s.work_orders?.po_number || s.po_no;
        if (po !== selectedPO) return false;
      }
      return true;
    });
  }, [actuals, selectedLine, selectedPO]);

  // Aggregate leftover data by PO
  const leftoverByPO = useMemo(() => {
    const map = new Map<string, {
      po_number: string;
      buyer: string;
      style: string;
      entries: CuttingActual[];
      totalQuantity: number;
      unit: string;
    }>();

    actuals
      .filter(a => a.leftover_recorded && a.leftover_quantity && a.leftover_quantity > 0)
      .forEach(actual => {
        const po = actual.work_orders?.po_number || actual.po_no || "Unknown PO";
        const existing = map.get(po);
        if (existing) {
          existing.entries.push(actual);
          existing.totalQuantity += actual.leftover_quantity || 0;
        } else {
          map.set(po, {
            po_number: po,
            buyer: actual.work_orders?.buyer || actual.buyer || "—",
            style: actual.work_orders?.style || actual.style || "—",
            entries: [actual],
            totalQuantity: actual.leftover_quantity || 0,
            unit: actual.leftover_unit || "pcs",
          });
        }
      });

    return Array.from(map.values()).sort((a, b) => a.po_number.localeCompare(b.po_number));
  }, [actuals]);

  async function markLeftoverAsUsed(actualId: string) {
    if (!profile?.factory_id) return;
    
    try {
      const { error } = await supabase
        .from("cutting_actuals")
        .update({
          leftover_recorded: false,
          leftover_type: null,
          leftover_unit: null,
          leftover_quantity: null,
          leftover_notes: null,
          leftover_location: null,
        })
        .eq("id", actualId)
        .eq("factory_id", profile.factory_id);

      if (error) throw error;
      toast.success("Left over marked as used");
      fetchData();
    } catch (error) {
      console.error("Error marking leftover as used:", error);
      toast.error("Failed to update leftover status");
    }
  }

  const stats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayTargets = targets.filter(s => s.production_date === today);
    const todayActuals = actuals.filter(s => s.production_date === today);
    return {
      targetsToday: todayTargets.length,
      actualsToday: todayActuals.length,
      targetCuttingToday: todayTargets.reduce((sum, s) => sum + (s.cutting_capacity || 0), 0),
      actualCuttingToday: todayActuals.reduce((sum, s) => sum + (s.day_cutting || 0), 0),
      actualInputToday: todayActuals.reduce((sum, s) => sum + (s.day_input || 0), 0),
    };
  }, [targets, actuals]);

  function exportToCSV() {
    const headers = activeTab === "targets" 
      ? ["DATE", "LINE", "BUYER", "STYLE", "PO-NO", "ORDER QTY", "DAY CUTTING TARGET", "DAY INPUT TARGET"]
      : ["DATE", "LINE", "BUYER", "STYLE", "PO-NO", "ORDER QTY", "DAY CUTTING", "DAY INPUT", "TOTAL CUTTING", "TOTAL INPUT", "BALANCE"];
    
    const data = activeTab === "targets" ? filteredTargets : filteredActuals;
    const rows = data.map(s => activeTab === "targets" 
      ? [
          s.production_date,
          (s as CuttingTarget).lines?.name || (s as CuttingTarget).lines?.line_id || "",
          s.work_orders?.buyer || s.buyer || "",
          s.work_orders?.style || s.style || "",
          s.work_orders?.po_number || s.po_no || "",
          s.order_qty || 0,
          (s as CuttingTarget).cutting_capacity || 0,
          (s as CuttingTarget).lay_capacity || 0,
        ]
      : [
          s.production_date,
          (s as CuttingActual).lines?.name || (s as CuttingActual).lines?.line_id || "",
          s.work_orders?.buyer || s.buyer || "",
          s.work_orders?.style || s.style || "",
          s.work_orders?.po_number || s.po_no || "",
          s.order_qty || 0,
          (s as CuttingActual).day_cutting || 0,
          (s as CuttingActual).day_input || 0,
          (s as CuttingActual).total_cutting || 0,
          (s as CuttingActual).total_input || 0,
          (s as CuttingActual).balance || 0,
        ]
    );
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadCSV(csv, `cutting-${activeTab}-${dateFrom}-to-${dateTo}.csv`);
  }

  function downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-4 px-4 pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Scissors className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">All Cutting Submissions</h1>
            <p className="text-sm text-muted-foreground">View targets and actuals</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Line</Label>
              <Select value={selectedLine} onValueChange={setSelectedLine}>
                <SelectTrigger>
                  <SelectValue placeholder="All Lines" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lines</SelectItem>
                  {lines.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name || l.line_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>PO Number</Label>
              <Select value={selectedPO} onValueChange={setSelectedPO}>
                <SelectTrigger>
                  <SelectValue placeholder="All POs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All POs</SelectItem>
                  {uniquePOs.map(po => (
                    <SelectItem key={po} value={po}>{po}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Targets Today</p>
            <p className="text-2xl font-bold">{stats.targetsToday}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Actuals Today</p>
            <p className="text-2xl font-bold">{stats.actualsToday}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Target Cutting</p>
            <p className="text-2xl font-bold">{stats.targetCuttingToday.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Actual Cutting</p>
            <p className="text-2xl font-bold">{stats.actualCuttingToday.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="targets" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Targets ({filteredTargets.length})
          </TabsTrigger>
          <TabsTrigger value="actuals" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Actuals ({filteredActuals.length})
          </TabsTrigger>
          <TabsTrigger value="leftover" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Left Over ({leftoverByPO.length})
          </TabsTrigger>
        </TabsList>

        {/* Targets Tab */}
        <TabsContent value="targets" className="mt-6">
          {filteredTargets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No target submissions found for selected filters
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTargets.map((target) => (
                <Card 
                  key={target.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedTarget(target)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-primary/10">
                        <Target className="h-3 w-3 mr-1" />
                        Target
                      </Badge>
                      {isToday(parseISO(target.production_date)) && (
                        <Badge variant="secondary" className="text-xs">Today</Badge>
                      )}
                    </div>
                    <CardTitle className="text-base mt-2">
                      {target.lines?.name || target.lines?.line_id || "—"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-medium">{format(parseISO(target.production_date), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PO:</span>
                        <span className="font-medium">{target.work_orders?.po_number || target.po_no || "—"}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="text-muted-foreground">Day Cutting:</span>
                        <span className="font-bold text-primary">{target.day_cutting?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Day Input:</span>
                        <span className="font-bold text-success">{target.day_input?.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Actuals Tab */}
        <TabsContent value="actuals" className="mt-6">
          {filteredActuals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No actual submissions found for selected filters
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredActuals.map((actual) => {
                const editCheck = canEditSubmission(actual.production_date);
                return (
                  <Card 
                    key={actual.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedActual(actual)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-success/10 text-success">
                          <ClipboardCheck className="h-3 w-3 mr-1" />
                          Actual
                        </Badge>
                        <div className="flex items-center gap-2">
                          {isToday(parseISO(actual.production_date)) && (
                            <Badge variant="secondary" className="text-xs">Today</Badge>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={!editCheck.canEdit}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingActual(actual);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {editCheck.canEdit ? "Edit submission" : editCheck.reason}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      <CardTitle className="text-base mt-2">
                        {actual.lines?.name || actual.lines?.line_id || "—"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date:</span>
                          <span className="font-medium">{format(parseISO(actual.production_date), "MMM d, yyyy")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">PO:</span>
                          <span className="font-medium">{actual.work_orders?.po_number || actual.po_no || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Day Cutting:</span>
                          <span className="font-bold">{actual.day_cutting?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Day Input:</span>
                          <span className="font-bold text-success">{actual.day_input?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2 mt-2">
                          <span className="text-muted-foreground">Balance:</span>
                          <span className={`font-bold ${actual.balance && actual.balance < 0 ? 'text-destructive' : ''}`}>
                            {actual.balance?.toLocaleString() || "—"}
                          </span>
                        </div>
                        {actual.leftover_recorded && (
                          <div className="flex items-center gap-2 pt-2 mt-2 border-t">
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                              <Package className="h-3 w-3 mr-1" />
                              Left Over: {actual.leftover_quantity} {actual.leftover_unit}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Left Over Tab */}
        <TabsContent value="leftover" className="mt-6">
          {leftoverByPO.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No leftover fabric records found
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {leftoverByPO.map((poData) => (
                <Card key={poData.po_number}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                          <Package className="h-3 w-3 mr-1" />
                          Left Over
                        </Badge>
                        <CardTitle className="text-base">{poData.po_number}</CardTitle>
                      </div>
                      <Badge className="bg-amber-500 text-white">
                        Total: {poData.totalQuantity} {poData.unit}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {poData.buyer} • {poData.style}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {poData.entries.map((entry) => (
                        <div 
                          key={entry.id} 
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">
                                {entry.lines?.name || entry.lines?.line_id || "—"}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">
                                {format(parseISO(entry.production_date), "MMM d, yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm">
                              <span className="text-amber-600 font-semibold">
                                {entry.leftover_quantity} {entry.leftover_unit}
                              </span>
                              {entry.leftover_type && (
                                <span className="text-muted-foreground">
                                  {entry.leftover_type}
                                </span>
                              )}
                              {entry.leftover_location && (
                                <span className="text-muted-foreground">
                                  📍 {entry.leftover_location}
                                </span>
                              )}
                            </div>
                            {entry.leftover_notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {entry.leftover_notes}
                              </p>
                            )}
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => markLeftoverAsUsed(entry.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Mark as used / Remove
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Target Detail Modal */}
      {selectedTarget && (
        <CuttingTargetDetailModal
          target={selectedTarget}
          open={!!selectedTarget}
          onOpenChange={(open) => !open && setSelectedTarget(null)}
        />
      )}

      {/* Actual Detail Modal */}
      {selectedActual && (
        <CuttingDetailModal
          cutting={{
            id: selectedActual.id,
            production_date: selectedActual.production_date,
            line_name: selectedActual.lines?.name || selectedActual.lines?.line_id || "—",
            buyer: selectedActual.work_orders?.buyer || selectedActual.buyer,
            style: selectedActual.work_orders?.style || selectedActual.style,
            po_number: selectedActual.work_orders?.po_number || selectedActual.po_no,
            colour: selectedActual.colour,
            order_qty: selectedActual.order_qty,
            man_power: selectedActual.man_power,
            marker_capacity: selectedActual.marker_capacity,
            lay_capacity: selectedActual.lay_capacity,
            cutting_capacity: selectedActual.cutting_capacity,
            under_qty: selectedActual.under_qty,
            day_cutting: selectedActual.day_cutting,
            total_cutting: selectedActual.total_cutting,
            day_input: selectedActual.day_input,
            total_input: selectedActual.total_input,
            balance: selectedActual.balance,
            submitted_at: selectedActual.submitted_at,
            leftover_recorded: selectedActual.leftover_recorded,
            leftover_type: selectedActual.leftover_type,
            leftover_unit: selectedActual.leftover_unit,
            leftover_quantity: selectedActual.leftover_quantity,
            leftover_notes: selectedActual.leftover_notes,
            leftover_location: selectedActual.leftover_location,
          }}
          open={!!selectedActual}
          onOpenChange={(open) => !open && setSelectedActual(null)}
        />
      )}

      {/* Edit Actual Modal */}
      <EditCuttingActualModal
        submission={editingActual}
        open={!!editingActual}
        onOpenChange={(open) => !open && setEditingActual(null)}
        onSaved={fetchData}
      />
    </div>
  );
}

// Target Detail Modal Component
function CuttingTargetDetailModal({ 
  target, 
  open, 
  onOpenChange 
}: { 
  target: CuttingTarget; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 ${open ? 'flex' : 'hidden'} items-center justify-center`}
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/50" />
      <div 
        className="relative bg-background rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Target Details</h2>
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
                <p className="font-semibold">{format(parseISO(target.production_date), "MMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Line</p>
                <p className="font-semibold">{target.lines?.name || target.lines?.line_id || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Buyer</p>
                <p className="font-semibold">{target.work_orders?.buyer || target.buyer || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Style</p>
                <p className="font-semibold">{target.work_orders?.style || target.style || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">PO Number</p>
                <p className="font-semibold">{target.work_orders?.po_number || target.po_no || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Order Qty</p>
                <p className="font-semibold">{target.order_qty?.toLocaleString() || "—"}</p>
              </div>
            </div>

            {/* Target Capacities */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Target Capacities</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Man Power:</span>
                  <span className="font-medium">{target.man_power?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marker Capacity:</span>
                  <span className="font-medium">{target.marker_capacity?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lay Capacity:</span>
                  <span className="font-medium">{target.lay_capacity?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cutting Capacity:</span>
                  <span className="font-medium">{target.cutting_capacity?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Under Qty:</span>
                  <span className="font-medium">{target.under_qty?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>

            {/* Target Daily Actuals */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Target Daily Actuals</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/10 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Day Cutting</p>
                  <p className="text-2xl font-bold text-primary">{target.day_cutting?.toLocaleString() || 0}</p>
                </div>
                <div className="bg-success/10 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Day Input</p>
                  <p className="text-2xl font-bold text-success">{target.day_input?.toLocaleString() || 0}</p>
                </div>
              </div>
            </div>

            {/* Submitted Info */}
            {target.submitted_at && (
              <p className="text-xs text-muted-foreground">
                Submitted: {format(new Date(target.submitted_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>

          <Button 
            className="w-full mt-6" 
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
