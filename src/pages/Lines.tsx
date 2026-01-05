import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Rows3, Search, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Line {
  id: string;
  line_id: string;
  name: string | null;
  unit_name: string | null;
  floor_name: string | null;
  is_active: boolean;
  targetSubmitted: boolean;
  eodSubmitted: boolean;
  todayOutput: number;
  currentPO: string | null;
}

// Extract number from line_id for proper numerical sorting
function extractLineNumber(lineId: string): number {
  const match = lineId.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export default function Lines() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (profile?.factory_id) {
      fetchLines();
    }
  }, [profile?.factory_id]);

  async function fetchLines() {
    if (!profile?.factory_id) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Fetch lines with unit and floor info
      const { data: linesData } = await supabase
        .from('lines')
        .select('*, units(name), floors(name)')
        .eq('factory_id', profile.factory_id)
        .order('line_id');

      // Fetch today's targets (sewing + finishing)
      const { data: sewingTargets } = await supabase
        .from('sewing_targets')
        .select('line_id')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today);

      const { data: finishingTargets } = await supabase
        .from('finishing_targets')
        .select('line_id')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today);

      // Fetch today's EOD actuals (sewing + finishing)
      const { data: sewingActuals } = await supabase
        .from('sewing_actuals')
        .select('line_id, good_today, work_orders(po_number)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today);

      const { data: finishingActuals } = await supabase
        .from('finishing_actuals')
        .select('line_id, day_qc_pass, work_orders(po_number)')
        .eq('factory_id', profile.factory_id)
        .eq('production_date', today);

      // Fetch current work orders assigned to lines
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select('id, line_id, po_number')
        .eq('factory_id', profile.factory_id)
        .eq('is_active', true);

      // Build sets for target submissions
      const targetSubmittedSet = new Set<string>();
      sewingTargets?.forEach(t => targetSubmittedSet.add(t.line_id));
      finishingTargets?.forEach(t => targetSubmittedSet.add(t.line_id));

      // Build map for EOD submissions with output
      const eodMap = new Map<string, { submitted: boolean; output: number; po: string | null }>();
      
      sewingActuals?.forEach(u => {
        const existing = eodMap.get(u.line_id) || { submitted: false, output: 0, po: null };
        eodMap.set(u.line_id, {
          submitted: true,
          output: existing.output + (u.good_today || 0),
          po: u.work_orders?.po_number || existing.po,
        });
      });

      finishingActuals?.forEach(u => {
        const existing = eodMap.get(u.line_id) || { submitted: false, output: 0, po: null };
        eodMap.set(u.line_id, {
          submitted: true,
          output: existing.output + (u.day_qc_pass || 0),
          po: u.work_orders?.po_number || existing.po,
        });
      });

      // Map work orders to lines
      const workOrderMap = new Map<string, string>();
      workOrders?.forEach(wo => {
        if (wo.line_id) {
          workOrderMap.set(wo.line_id, wo.po_number);
        }
      });

      const formattedLines: Line[] = (linesData || []).map(line => {
        const eodData = eodMap.get(line.id);
        return {
          id: line.id,
          line_id: line.line_id,
          name: line.name,
          unit_name: line.units?.name || null,
          floor_name: line.floors?.name || null,
          is_active: line.is_active,
          targetSubmitted: targetSubmittedSet.has(line.id),
          eodSubmitted: eodData?.submitted || false,
          todayOutput: eodData?.output || 0,
          currentPO: workOrderMap.get(line.id) || eodData?.po || null,
        };
      });

      // Sort lines numerically by line number
      formattedLines.sort((a, b) => extractLineNumber(a.line_id) - extractLineNumber(b.line_id));

      setLines(formattedLines);
    } catch (error) {
      console.error('Error fetching lines:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredLines = lines.filter(line =>
    (line.name || line.line_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (line.unit_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (line.floor_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeLines = lines.filter(l => l.is_active);
  const targetsSubmitted = activeLines.filter(l => l.targetSubmitted).length;
  const eodSubmitted = activeLines.filter(l => l.eodSubmitted).length;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rows3 className="h-6 w-6" />
          Production Lines
        </h1>
        <p className="text-muted-foreground">View line status and today's submissions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{activeLines.length}</p>
            <p className="text-sm text-muted-foreground">Active Lines</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{targetsSubmitted}</p>
            <p className="text-sm text-muted-foreground">Targets Submitted</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-success">{eodSubmitted}</p>
            <p className="text-sm text-muted-foreground">EOD Submitted</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search lines..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lines Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Current PO</TableHead>
                  <TableHead className="text-center">Target Status</TableHead>
                  <TableHead className="text-center">EOD Status</TableHead>
                  <TableHead className="text-right">Today's Output</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLines.map((line) => (
                  <TableRow key={line.id} className={!line.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{line.name || line.line_id}</p>
                        {line.name && <p className="text-xs text-muted-foreground">{line.line_id}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{line.unit_name || '-'}</TableCell>
                    <TableCell>{line.floor_name || '-'}</TableCell>
                    <TableCell>
                      {line.currentPO ? (
                        <span className="font-mono text-sm">{line.currentPO}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {line.is_active ? (
                        line.targetSubmitted ? (
                          <StatusBadge variant="success" size="sm">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Submitted
                          </StatusBadge>
                        ) : (
                          <StatusBadge variant="warning" size="sm">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </StatusBadge>
                        )
                      ) : (
                        <StatusBadge variant="default" size="sm">-</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {line.is_active ? (
                        line.eodSubmitted ? (
                          <StatusBadge variant="success" size="sm">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Submitted
                          </StatusBadge>
                        ) : (
                          <StatusBadge variant="warning" size="sm">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </StatusBadge>
                        )
                      ) : (
                        <StatusBadge variant="default" size="sm">-</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {line.todayOutput > 0 ? line.todayOutput.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {line.is_active ? (
                        <CheckCircle2 className="h-4 w-4 text-success mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredLines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No lines found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
