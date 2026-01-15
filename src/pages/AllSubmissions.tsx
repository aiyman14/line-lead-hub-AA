import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Factory, Package, Search, Download, RefreshCw, FileText, Calendar, Target, ClipboardCheck, Scissors } from "lucide-react";
import { SubmissionDetailModal } from "@/components/SubmissionDetailModal";
import { TargetDetailModal } from "@/components/TargetDetailModal";
import { ExportSubmissionsDialog } from "@/components/ExportSubmissionsDialog";
import { FinishingDailySheetsTable } from "@/components/submissions/FinishingDailySheetsTable";
import { CuttingSubmissionsTable } from "@/components/submissions/CuttingSubmissionsTable";
import { StorageSubmissionsTable } from "@/components/submissions/StorageSubmissionsTable";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { toast } from "sonner";

// Types for targets
interface SewingTarget {
  id: string;
  line_id: string;
  per_hour_target: number;
  manpower_planned: number;
  ot_hours_planned: number;
  planned_stage_progress: number;
  next_milestone: string | null;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  is_late: boolean | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

interface FinishingTarget {
  id: string;
  line_id: string;
  per_hour_target: number;
  m_power_planned: number;
  day_hour_planned: number;
  day_over_time_planned: number;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  is_late: boolean | null;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

// Types for actuals/end of day
interface SewingActual {
  id: string;
  line_id: string;
  good_today: number;
  reject_today: number;
  rework_today: number;
  cumulative_good_total: number;
  manpower_actual: number;
  ot_hours_actual: number;
  actual_stage_progress: number;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

interface FinishingActual {
  id: string;
  line_id: string;
  day_qc_pass: number;
  total_qc_pass: number;
  day_poly: number;
  total_poly: number;
  day_carton: number;
  total_carton: number;
  m_power_actual: number;
  day_hour_actual: number;
  day_over_time_actual: number;
  average_production: number | null;
  has_blocker: boolean;
  blocker_description: string | null;
  blocker_impact: string | null;
  blocker_owner: string | null;
  remarks: string | null;
  submitted_at: string;
  production_date: string;
  lines: { line_id: string; name: string | null } | null;
  work_orders: { po_number: string; buyer: string; style: string; order_qty: number } | null;
}

type CategoryType = 'targets' | 'actuals';
type DepartmentType = 'sewing' | 'finishing' | 'cutting' | 'storage';

export default function AllSubmissions() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  
  // Initialize state from URL params or defaults
  const initialDepartment = (searchParams.get('department') as DepartmentType) || 'sewing';
  const initialCategory = (searchParams.get('category') as CategoryType) || 'targets';
  
  const [category, setCategory] = useState<CategoryType>(initialCategory);
  const [department, setDepartment] = useState<DepartmentType>(initialDepartment);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState("7");

  // Target data
  const [sewingTargets, setSewingTargets] = useState<SewingTarget[]>([]);
  const [finishingTargets, setFinishingTargets] = useState<FinishingTarget[]>([]);

  // Actual data
  const [sewingActuals, setSewingActuals] = useState<SewingActual[]>([]);
  const [finishingActuals, setFinishingActuals] = useState<FinishingActual[]>([]);

  // Cutting and Storage data for export
  const [cuttingTargets, setCuttingTargets] = useState<any[]>([]);
  const [cuttingActuals, setCuttingActuals] = useState<any[]>([]);
  const [storageBinCards, setStorageBinCards] = useState<any[]>([]);

  // Modal state
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  const [selectedActual, setSelectedActual] = useState<any>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [actualModalOpen, setActualModalOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => {
    if (profile?.factory_id) {
      fetchSubmissions();
    }
  }, [profile?.factory_id, dateRange]);

  async function fetchSubmissions() {
    if (!profile?.factory_id) return;
    setLoading(true);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(dateRange));

    try {
      const [
        sewingTargetsRes,
        finishingTargetsRes,
        sewingActualsRes,
        finishingActualsRes,
        cuttingTargetsRes,
        cuttingActualsRes,
        storageBinCardsRes,
      ] = await Promise.all([
        supabase
          .from('sewing_targets')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('finishing_targets')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('sewing_actuals')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('finishing_actuals')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('cutting_targets')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('cutting_actuals')
          .select('*, lines(line_id, name), work_orders(po_number, buyer, style, order_qty)')
          .eq('factory_id', profile.factory_id)
          .gte('production_date', startDate.toISOString().split('T')[0])
          .lte('production_date', endDate.toISOString().split('T')[0])
          .order('production_date', { ascending: false })
          .order('submitted_at', { ascending: false }),
        supabase
          .from('storage_bin_cards')
          .select('*, work_orders(po_number, buyer, style)')
          .eq('factory_id', profile.factory_id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false }),
      ]);

      setSewingTargets(sewingTargetsRes.data || []);
      setFinishingTargets(finishingTargetsRes.data || []);
      setSewingActuals(sewingActualsRes.data || []);
      setFinishingActuals(finishingActualsRes.data || []);
      setCuttingTargets(cuttingTargetsRes.data || []);
      setCuttingActuals(cuttingActualsRes.data || []);
      setStorageBinCards(storageBinCardsRes.data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter functions
  const filterBySearch = <T extends { lines?: { line_id: string; name: string | null } | null; work_orders?: { po_number: string } | null }>(items: T[]) => {
    if (!searchTerm) return items;
    return items.filter(item =>
      (item.lines?.name || item.lines?.line_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.work_orders?.po_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get current sewing data based on category
  const sewingData = useMemo(() => {
    if (category === 'targets') {
      return filterBySearch(sewingTargets);
    } else {
      return filterBySearch(sewingActuals);
    }
  }, [category, sewingTargets, sewingActuals, searchTerm]);

  // Separate pagination for targets and actuals to maintain type safety
  const sewingTargetsPagination = usePagination(filterBySearch(sewingTargets), { pageSize });
  const sewingActualsPagination = usePagination(filterBySearch(sewingActuals), { pageSize });

  // Use the appropriate pagination based on category
  const pagination = category === 'targets' ? sewingTargetsPagination : sewingActualsPagination;
  const { currentPage, totalPages, setCurrentPage, goToFirstPage, goToLastPage, goToNextPage, goToPreviousPage, canGoNext, canGoPrevious, startIndex, endIndex } = pagination;

  // Summary stats
  const getCounts = () => ({
    sewingTargets: sewingTargets.length,
    finishingTargets: finishingTargets.length,
    sewingActuals: sewingActuals.length,
    finishingActuals: finishingActuals.length,
  });

  const counts = getCounts();

  const handleTargetClick = (target: SewingTarget | FinishingTarget) => {
    setSelectedTarget({
      ...target,
      type: department,
    });
    setTargetModalOpen(true);
  };

  const handleActualClick = (actual: SewingActual | FinishingActual) => {
    setSelectedActual({
      id: actual.id,
      type: department,
      line_name: actual.lines?.name || actual.lines?.line_id || 'Unknown',
      po_number: actual.work_orders?.po_number || null,
      buyer: actual.work_orders?.buyer,
      style: actual.work_orders?.style,
      has_blocker: actual.has_blocker,
      blocker_description: actual.blocker_description,
      blocker_impact: actual.blocker_impact,
      blocker_owner: actual.blocker_owner,
      blocker_status: null,
      submitted_at: actual.submitted_at,
      production_date: actual.production_date,
      remarks: actual.remarks,
      ...(department === 'sewing' && {
        output_qty: (actual as SewingActual).good_today,
        reject_qty: (actual as SewingActual).reject_today,
        rework_qty: (actual as SewingActual).rework_today,
        manpower: (actual as SewingActual).manpower_actual,
        stage_progress: (actual as SewingActual).actual_stage_progress,
        ot_hours: (actual as SewingActual).ot_hours_actual,
      }),
      ...(department === 'finishing' && {
        day_qc_pass: (actual as FinishingActual).day_qc_pass,
        total_qc_pass: (actual as FinishingActual).total_qc_pass,
        day_poly: (actual as FinishingActual).day_poly,
        total_poly: (actual as FinishingActual).total_poly,
        day_carton: (actual as FinishingActual).day_carton,
        total_carton: (actual as FinishingActual).total_carton,
        m_power: (actual as FinishingActual).m_power_actual,
        average_production: (actual as FinishingActual).average_production,
      }),
    });
    setActualModalOpen(true);
  };

  const getExportData = () => ({
    sewingTargets: filterBySearch(sewingTargets),
    finishingTargets: filterBySearch(finishingTargets),
    sewingActuals: filterBySearch(sewingActuals),
    finishingActuals: filterBySearch(finishingActuals),
    cuttingTargets,
    cuttingActuals,
    storageBinCards,
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            All Submissions
          </h1>
          <p className="text-muted-foreground">
            View and export historical targets and end of day data
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="21">Last 21 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchSubmissions}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Department Selection - Primary Tabs */}
      <div className="grid grid-cols-4 gap-3">
        <Button
          variant={department === 'storage' ? 'default' : 'outline'}
          className="h-14 flex flex-col gap-0.5"
          onClick={() => setDepartment('storage')}
        >
          <Package className="h-4 w-4" />
          <span className="font-semibold text-sm">Storage</span>
        </Button>
        <Button
          variant={department === 'cutting' ? 'default' : 'outline'}
          className="h-14 flex flex-col gap-0.5"
          onClick={() => setDepartment('cutting')}
        >
          <Scissors className="h-4 w-4" />
          <span className="font-semibold text-sm">Cutting</span>
        </Button>
        <Button
          variant={department === 'sewing' ? 'default' : 'outline'}
          className="h-14 flex flex-col gap-0.5"
          onClick={() => setDepartment('sewing')}
        >
          <Factory className="h-4 w-4" />
          <span className="font-semibold text-sm">Sewing</span>
        </Button>
        <Button
          variant={department === 'finishing' ? 'default' : 'outline'}
          className="h-14 flex flex-col gap-0.5"
          onClick={() => setDepartment('finishing')}
        >
          <Package className="h-4 w-4" />
          <span className="font-semibold text-sm">Finishing</span>
        </Button>
      </div>

      {/* Category Selection - Only for Sewing */}
      {department === 'sewing' && (
        <div className="flex justify-center gap-2">
          <Button
            variant={category === 'targets' ? 'default' : 'outline'}
            onClick={() => setCategory('targets')}
            size="sm"
            className={`gap-1.5 ${
              category === 'targets' 
                ? 'shadow-md' 
                : 'hover:bg-primary/10 hover:border-primary/50'
            }`}
          >
            <Target className="h-4 w-4" />
            <span className="font-medium">Morning Targets</span>
            <Badge 
              variant={category === 'targets' ? 'secondary' : 'outline'} 
              className={`ml-0.5 text-xs ${category === 'targets' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
            >
              {counts.sewingTargets}
            </Badge>
          </Button>
          <Button
            variant={category === 'actuals' ? 'default' : 'outline'}
            onClick={() => setCategory('actuals')}
            size="sm"
            className={`gap-1.5 ${
              category === 'actuals' 
                ? 'shadow-md' 
                : 'hover:bg-primary/10 hover:border-primary/50'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span className="font-medium">End of Day</span>
            <Badge 
              variant={category === 'actuals' ? 'secondary' : 'outline'} 
              className={`ml-0.5 text-xs ${category === 'actuals' ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
            >
              {counts.sewingActuals}
            </Badge>
          </Button>
        </div>
      )}

      {/* Finishing uses new Daily Sheets view */}
      {department === 'finishing' && profile?.factory_id && (
        <FinishingDailySheetsTable
          factoryId={profile.factory_id}
          dateRange={dateRange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}

      {/* Cutting submissions */}
      {department === 'cutting' && profile?.factory_id && (
        <CuttingSubmissionsTable
          factoryId={profile.factory_id}
          dateRange={dateRange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}

      {/* Storage bin cards */}
      {department === 'storage' && profile?.factory_id && (
        <StorageSubmissionsTable
          factoryId={profile.factory_id}
          dateRange={dateRange}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}

      {/* Sewing uses existing view */}
      {department === 'sewing' && (
        <>
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by line or PO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Data Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {category === 'targets' ? (
                  <Target className="h-4 w-4 text-primary" />
                ) : (
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                )}
                Sewing {category === 'targets' ? 'Targets' : 'End of Day'}
                <Badge variant="secondary" className="ml-2">{sewingData.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {category === 'targets' && (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Target/hr</TableHead>
                        <TableHead className="text-right">Manpower</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewingTargetsPagination.paginatedData.map((target) => (
                        <TableRow
                          key={target.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleTargetClick(target)}
                        >
                          <TableCell className="font-mono text-sm">{formatDate(target.production_date)}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{formatTime(target.submitted_at)}</TableCell>
                          <TableCell className="font-medium">{target.lines?.name || target.lines?.line_id}</TableCell>
                          <TableCell>{target.work_orders?.po_number || '-'}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{target.per_hour_target}</TableCell>
                          <TableCell className="text-right">{target.manpower_planned}</TableCell>
                          <TableCell className="text-right">{target.planned_stage_progress}%</TableCell>
                          <TableCell>
                            {target.is_late ? (
                              <StatusBadge variant="warning" size="sm">Late</StatusBadge>
                            ) : (
                              <StatusBadge variant="success" size="sm">On Time</StatusBadge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {sewingTargetsPagination.paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No sewing targets found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {category === 'actuals' && (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Line</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Good Today</TableHead>
                        <TableHead className="text-right">Cumulative</TableHead>
                        <TableHead className="text-right">Manpower</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sewingActualsPagination.paginatedData.map((actual) => (
                        <TableRow
                          key={actual.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleActualClick(actual)}
                        >
                          <TableCell className="font-mono text-sm">{formatDate(actual.production_date)}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{formatTime(actual.submitted_at)}</TableCell>
                          <TableCell className="font-medium">{actual.lines?.name || actual.lines?.line_id}</TableCell>
                          <TableCell>{actual.work_orders?.po_number || '-'}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{actual.good_today.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{actual.cumulative_good_total.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{actual.manpower_actual}</TableCell>
                          <TableCell>
                            {actual.has_blocker ? (
                              <StatusBadge variant="danger" size="sm">Blocker</StatusBadge>
                            ) : (
                              <StatusBadge variant="success" size="sm">OK</StatusBadge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {sewingActualsPagination.paginatedData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No sewing end of day data found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={sewingData.length}
                onPageChange={setCurrentPage}
                onFirstPage={goToFirstPage}
                onLastPage={goToLastPage}
                onNextPage={goToNextPage}
                onPreviousPage={goToPreviousPage}
                canGoNext={canGoNext}
                canGoPrevious={canGoPrevious}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Target Detail Modal */}
      <TargetDetailModal
        target={selectedTarget}
        open={targetModalOpen}
        onOpenChange={setTargetModalOpen}
      />

      {/* Actual Detail Modal */}
      <SubmissionDetailModal
        submission={selectedActual}
        open={actualModalOpen}
        onOpenChange={setActualModalOpen}
        onDeleted={fetchSubmissions}
        onUpdated={fetchSubmissions}
      />

      {/* Export Dialog */}
      <ExportSubmissionsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={getExportData()}
        dateRange={dateRange}
      />
    </div>
  );
}
