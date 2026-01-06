import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { Loader2, Download, RefreshCw, Scissors, Crosshair, ClipboardCheck } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CuttingTarget {
  id: string;
  production_date: string;
  submitted_at: string;
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
  lines?: { line_id: string; name: string | null };
  work_orders?: { po_number: string; buyer: string; style: string };
}

interface CuttingActual {
  id: string;
  production_date: string;
  submitted_at: string;
  line_id: string;
  work_order_id: string;
  buyer: string | null;
  style: string | null;
  po_no: string | null;
  colour: string | null;
  order_qty: number | null;
  day_cutting: number;
  total_cutting: number | null;
  day_input: number;
  total_input: number | null;
  balance: number | null;
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("targets");

  // Data
  const [targets, setTargets] = useState<CuttingTarget[]>([]);
  const [actuals, setActuals] = useState<CuttingActual[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedLine, setSelectedLine] = useState("all");

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
          .select("*, lines(line_id, name), work_orders(po_number, buyer, style)")
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

  // Filtered targets
  const filteredTargets = useMemo(() => {
    return targets.filter(t => {
      if (selectedLine !== "all" && t.line_id !== selectedLine) return false;
      return true;
    });
  }, [targets, selectedLine]);

  // Filtered actuals
  const filteredActuals = useMemo(() => {
    return actuals.filter(a => {
      if (selectedLine !== "all" && a.line_id !== selectedLine) return false;
      return true;
    });
  }, [actuals, selectedLine]);

  // Stats
  const stats = useMemo(() => ({
    totalTargets: filteredTargets.length,
    totalActuals: filteredActuals.length,
    totalDayCutting: filteredActuals.reduce((sum, a) => sum + (a.day_cutting || 0), 0),
    totalDayInput: filteredActuals.reduce((sum, a) => sum + (a.day_input || 0), 0),
  }), [filteredTargets, filteredActuals]);

  function exportToCSV() {
    if (activeTab === "targets") {
      const headers = ["DATE", "LINE", "BUYER", "STYLE", "PO-NO", "COLOUR", "ORDER QTY", "MAN POWER", "MARKER CAP", "LAY CAP", "CUTTING CAP", "UNDER QTY"];
      const rows = filteredTargets.map(t => [
        t.production_date,
        t.lines?.name || t.lines?.line_id || "",
        t.work_orders?.buyer || t.buyer || "",
        t.work_orders?.style || t.style || "",
        t.work_orders?.po_number || t.po_no || "",
        t.colour || "",
        t.order_qty || 0,
        t.man_power,
        t.marker_capacity,
        t.lay_capacity,
        t.cutting_capacity,
        t.under_qty || 0,
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      downloadCSV(csv, `cutting-targets-${dateFrom}-to-${dateTo}.csv`);
    } else {
      const headers = ["DATE", "LINE", "BUYER", "STYLE", "PO-NO", "COLOUR", "ORDER QTY", "DAY CUTTING", "TOTAL CUTTING", "DAY INPUT", "TOTAL INPUT", "BALANCE"];
      const rows = filteredActuals.map(a => [
        a.production_date,
        a.lines?.name || a.lines?.line_id || "",
        a.work_orders?.buyer || a.buyer || "",
        a.work_orders?.style || a.style || "",
        a.work_orders?.po_number || a.po_no || "",
        a.colour || "",
        a.order_qty || 0,
        a.day_cutting,
        a.total_cutting || 0,
        a.day_input,
        a.total_input || 0,
        a.balance || 0,
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      downloadCSV(csv, `cutting-actuals-${dateFrom}-to-${dateTo}.csv`);
    }
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
            <p className="text-sm text-muted-foreground">View all cutting targets and daily reports</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Targets</p>
            <p className="text-2xl font-bold">{stats.totalTargets}</p>
            <p className="text-xs text-muted-foreground">In date range</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Actuals</p>
            <p className="text-2xl font-bold">{stats.totalActuals}</p>
            <p className="text-xs text-muted-foreground">In date range</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Day Cutting</p>
            <p className="text-2xl font-bold">{stats.totalDayCutting.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total pieces</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Day Input</p>
            <p className="text-2xl font-bold">{stats.totalDayInput.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total pieces</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs with Tables */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="targets" className="gap-2">
            <Crosshair className="h-4 w-4" />
            Morning Targets ({filteredTargets.length})
          </TabsTrigger>
          <TabsTrigger value="actuals" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            End of Day ({filteredActuals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="targets">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Cutting Targets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DATE</TableHead>
                      <TableHead>LINE</TableHead>
                      <TableHead>BUYER</TableHead>
                      <TableHead>STYLE</TableHead>
                      <TableHead>PO-NO</TableHead>
                      <TableHead>COLOUR</TableHead>
                      <TableHead className="text-right">ORDER QTY</TableHead>
                      <TableHead className="text-right">MAN POWER</TableHead>
                      <TableHead className="text-right">MARKER CAP</TableHead>
                      <TableHead className="text-right">LAY CAP</TableHead>
                      <TableHead className="text-right">CUTTING CAP</TableHead>
                      <TableHead className="text-right">UNDER QTY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTargets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          No targets found for selected filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTargets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {format(new Date(t.production_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.lines?.name || t.lines?.line_id || "—"}</Badge>
                          </TableCell>
                          <TableCell>{t.work_orders?.buyer || t.buyer || "—"}</TableCell>
                          <TableCell>{t.work_orders?.style || t.style || "—"}</TableCell>
                          <TableCell>{t.work_orders?.po_number || t.po_no || "—"}</TableCell>
                          <TableCell>{t.colour || "—"}</TableCell>
                          <TableCell className="text-right">{t.order_qty?.toLocaleString() || "—"}</TableCell>
                          <TableCell className="text-right font-medium">{t.man_power}</TableCell>
                          <TableCell className="text-right">{t.marker_capacity}</TableCell>
                          <TableCell className="text-right">{t.lay_capacity}</TableCell>
                          <TableCell className="text-right font-medium text-primary">{t.cutting_capacity}</TableCell>
                          <TableCell className="text-right">{t.under_qty || "—"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actuals">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Cutting Actuals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DATE</TableHead>
                      <TableHead>LINE</TableHead>
                      <TableHead>BUYER</TableHead>
                      <TableHead>STYLE</TableHead>
                      <TableHead>PO-NO</TableHead>
                      <TableHead>COLOUR</TableHead>
                      <TableHead className="text-right">ORDER QTY</TableHead>
                      <TableHead className="text-right">DAY CUTTING</TableHead>
                      <TableHead className="text-right">TOTAL CUTTING</TableHead>
                      <TableHead className="text-right">DAY INPUT</TableHead>
                      <TableHead className="text-right">TOTAL INPUT</TableHead>
                      <TableHead className="text-right">BALANCE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActuals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          No actuals found for selected filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredActuals.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {format(new Date(a.production_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{a.lines?.name || a.lines?.line_id || "—"}</Badge>
                          </TableCell>
                          <TableCell>{a.work_orders?.buyer || a.buyer || "—"}</TableCell>
                          <TableCell>{a.work_orders?.style || a.style || "—"}</TableCell>
                          <TableCell>{a.work_orders?.po_number || a.po_no || "—"}</TableCell>
                          <TableCell>{a.colour || "—"}</TableCell>
                          <TableCell className="text-right">{a.order_qty?.toLocaleString() || "—"}</TableCell>
                          <TableCell className="text-right font-medium text-primary">{a.day_cutting.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{a.total_cutting?.toLocaleString() || "—"}</TableCell>
                          <TableCell className="text-right font-medium text-success">{a.day_input.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{a.total_input?.toLocaleString() || "—"}</TableCell>
                          <TableCell className={`text-right font-medium ${a.balance && a.balance < 0 ? "text-destructive" : ""}`}>
                            {a.balance?.toLocaleString() || "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
