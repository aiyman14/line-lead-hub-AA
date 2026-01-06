import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { Loader2, Search, Scissors } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CuttingSubmission {
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
  day_cutting: number;
  total_cutting: number | null;
  day_input: number;
  total_input: number | null;
  balance: number | null;
  lines?: { line_id: string; name: string | null };
  work_orders?: { po_number: string; buyer: string; style: string };
}

interface CuttingSubmissionsTableProps {
  factoryId: string;
  dateRange: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function CuttingSubmissionsTable({
  factoryId,
  dateRange,
  searchTerm,
  onSearchChange,
}: CuttingSubmissionsTableProps) {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<CuttingSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<CuttingSubmission | null>(null);

  useEffect(() => {
    fetchData();
  }, [factoryId, dateRange]);

  async function fetchData() {
    setLoading(true);
    const endDate = new Date();
    const startDate = subDays(endDate, parseInt(dateRange));

    try {
      const [actualsRes, targetsRes] = await Promise.all([
        supabase
          .from("cutting_actuals")
          .select("*, lines!cutting_actuals_line_id_fkey(line_id, name), work_orders(po_number, buyer, style)")
          .eq("factory_id", factoryId)
          .gte("production_date", format(startDate, "yyyy-MM-dd"))
          .lte("production_date", format(endDate, "yyyy-MM-dd"))
          .order("production_date", { ascending: false }),
        supabase
          .from("cutting_targets")
          .select("*, lines(line_id, name), work_orders(po_number, buyer, style)")
          .eq("factory_id", factoryId)
          .gte("production_date", format(startDate, "yyyy-MM-dd"))
          .lte("production_date", format(endDate, "yyyy-MM-dd")),
      ]);

      const targetsMap = new Map<string, any>();
      (targetsRes.data || []).forEach(t => {
        const key = `${t.production_date}-${t.line_id}-${t.work_order_id}`;
        targetsMap.set(key, t);
      });

      const mergedSubmissions: CuttingSubmission[] = (actualsRes.data || []).map(actual => {
        const key = `${actual.production_date}-${actual.line_id}-${actual.work_order_id}`;
        const target = targetsMap.get(key);
        return {
          id: actual.id,
          production_date: actual.production_date,
          submitted_at: actual.submitted_at,
          line_id: actual.line_id,
          work_order_id: actual.work_order_id,
          buyer: actual.buyer,
          style: actual.style,
          po_no: actual.po_no,
          colour: actual.colour,
          order_qty: actual.order_qty,
          man_power: target?.man_power || 0,
          marker_capacity: target?.marker_capacity || 0,
          lay_capacity: target?.lay_capacity || 0,
          cutting_capacity: target?.cutting_capacity || 0,
          under_qty: target?.under_qty || null,
          day_cutting: actual.day_cutting,
          total_cutting: actual.total_cutting,
          day_input: actual.day_input,
          total_input: actual.total_input,
          balance: actual.balance,
          lines: actual.lines,
          work_orders: actual.work_orders,
        };
      });

      setSubmissions(mergedSubmissions);
    } catch (error) {
      console.error("Error fetching cutting data:", error);
      toast.error("Failed to load cutting submissions");
    } finally {
      setLoading(false);
    }
  }

  const filteredSubmissions = useMemo(() => {
    if (!searchTerm) return submissions;
    const term = searchTerm.toLowerCase();
    return submissions.filter(s =>
      (s.lines?.name || s.lines?.line_id || "").toLowerCase().includes(term) ||
      (s.work_orders?.po_number || s.po_no || "").toLowerCase().includes(term) ||
      (s.work_orders?.buyer || s.buyer || "").toLowerCase().includes(term)
    );
  }, [submissions, searchTerm]);

  const stats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todaySubmissions = submissions.filter(s => s.production_date === today);
    return {
      total: submissions.length,
      todayCount: todaySubmissions.length,
      totalCutting: submissions.reduce((sum, s) => sum + (s.day_cutting || 0), 0),
      totalInput: submissions.reduce((sum, s) => sum + (s.day_input || 0), 0),
    };
  }, [submissions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total Submissions</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Today</p>
            <p className="text-xl font-bold">{stats.todayCount}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total Cutting</p>
            <p className="text-xl font-bold">{stats.totalCutting.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total Input</p>
            <p className="text-xl font-bold">{stats.totalInput.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by line, PO, or buyer..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary" />
            Cutting Submissions
            <Badge variant="secondary" className="ml-2">{filteredSubmissions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead className="text-right">Order Qty</TableHead>
                  <TableHead className="text-right">Day Cutting</TableHead>
                  <TableHead className="text-right">Total Cutting</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No cutting submissions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubmissions.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedSubmission(s)}
                    >
                      <TableCell className="font-mono text-sm">
                        {format(new Date(s.production_date), "MMM d")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.lines?.name || s.lines?.line_id || "—"}</Badge>
                      </TableCell>
                      <TableCell>{s.work_orders?.po_number || s.po_no || "—"}</TableCell>
                      <TableCell className="text-right">{s.order_qty?.toLocaleString() || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{s.day_cutting}</TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {s.total_cutting?.toLocaleString() || "—"}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${s.balance && s.balance < 0 ? "text-destructive" : ""}`}>
                        {s.balance?.toLocaleString() || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Cutting Details
            </DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Date</p>
                  <p className="font-medium">{format(new Date(selectedSubmission.production_date), "MMM d, yyyy")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Line</p>
                  <p className="font-medium">{selectedSubmission.lines?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">PO Number</p>
                  <p className="font-medium">{selectedSubmission.work_orders?.po_number || selectedSubmission.po_no || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Buyer</p>
                  <p className="font-medium">{selectedSubmission.work_orders?.buyer || selectedSubmission.buyer || "—"}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Production Data</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Day Cutting</p>
                    <p className="font-medium text-lg">{selectedSubmission.day_cutting}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Total Cutting</p>
                    <p className="font-medium text-lg text-primary">{selectedSubmission.total_cutting?.toLocaleString() || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Day Input</p>
                    <p className="font-medium text-lg">{selectedSubmission.day_input}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Total Input</p>
                    <p className="font-medium text-lg">{selectedSubmission.total_input?.toLocaleString() || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Balance</p>
                    <p className={`font-medium text-lg ${selectedSubmission.balance && selectedSubmission.balance < 0 ? "text-destructive" : ""}`}>
                      {selectedSubmission.balance?.toLocaleString() || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
