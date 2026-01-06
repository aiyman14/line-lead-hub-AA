import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Download, FileSpreadsheet, Factory, Package, Scissors } from "lucide-react";
import { toast } from "sonner";

interface ExportData {
  sewingTargets: any[];
  finishingTargets: any[];
  sewingActuals: any[];
  finishingActuals: any[];
  cuttingTargets: any[];
  cuttingActuals: any[];
  storageBinCards: any[];
}

interface ExportSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ExportData;
  dateRange: string;
}

export function ExportSubmissionsDialog({
  open,
  onOpenChange,
  data,
  dateRange,
}: ExportSubmissionsDialogProps) {
  const [exporting, setExporting] = useState(false);
  
  // Department selection
  const [includeSewing, setIncludeSewing] = useState(true);
  const [includeFinishing, setIncludeFinishing] = useState(true);
  const [includeCutting, setIncludeCutting] = useState(true);
  const [includeStorage, setIncludeStorage] = useState(true);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getExportCounts = () => {
    let total = 0;
    if (includeSewing) {
      total += data.sewingTargets.length + data.sewingActuals.length;
    }
    if (includeFinishing) {
      total += data.finishingTargets.length + data.finishingActuals.length;
    }
    if (includeCutting) {
      total += data.cuttingTargets.length + data.cuttingActuals.length;
    }
    if (includeStorage) {
      total += data.storageBinCards.length;
    }
    return total;
  };

  const canExport = (includeSewing || includeFinishing || includeCutting || includeStorage) && getExportCounts() > 0;

  const handleExport = () => {
    setExporting(true);
    try {
      const rows: string[][] = [];
      const exportDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      // Build title based on selections
      const deptParts: string[] = [];
      if (includeSewing) deptParts.push('Sewing');
      if (includeFinishing) deptParts.push('Finishing');
      if (includeCutting) deptParts.push('Cutting');
      if (includeStorage) deptParts.push('Storage');

      rows.push([`Submissions Report - ${deptParts.join(', ')}`]);
      rows.push([`Generated: ${exportDate}`]);
      rows.push([`Date Range: Last ${dateRange} days`]);
      rows.push(['']);

      // Export Sewing Targets
      if (includeSewing && data.sewingTargets.length > 0) {
        rows.push(['=== SEWING TARGETS ===']);
        rows.push(['Date', 'Time', 'Line', 'PO Number', 'Buyer', 'Style', 'Target/hr', 'Manpower', 'OT Hours', 'Progress %', 'Next Milestone', 'Late', 'Remarks']);
        data.sewingTargets.forEach(t => {
          rows.push([
            formatDate(t.production_date),
            formatTime(t.submitted_at),
            t.lines?.name || t.lines?.line_id || '-',
            t.work_orders?.po_number || '-',
            t.work_orders?.buyer || '-',
            t.work_orders?.style || '-',
            t.per_hour_target?.toString() || '0',
            t.manpower_planned?.toString() || '0',
            t.ot_hours_planned?.toString() || '0',
            `${t.planned_stage_progress || 0}%`,
            t.next_milestone || '-',
            t.is_late ? 'Yes' : 'No',
            t.remarks || '-',
          ]);
        });
        rows.push(['']);
      }

      // Export Sewing Actuals
      if (includeSewing && data.sewingActuals.length > 0) {
        rows.push(['=== SEWING END OF DAY ===']);
        rows.push(['Date', 'Time', 'Line', 'PO Number', 'Buyer', 'Style', 'Good Today', 'Reject', 'Rework', 'Cumulative Total', 'Manpower', 'OT Hours', 'Progress %', 'Has Blocker', 'Blocker Type', 'Blocker Impact', 'Remarks']);
        data.sewingActuals.forEach(a => {
          rows.push([
            formatDate(a.production_date),
            formatTime(a.submitted_at),
            a.lines?.name || a.lines?.line_id || '-',
            a.work_orders?.po_number || '-',
            a.work_orders?.buyer || '-',
            a.work_orders?.style || '-',
            a.good_today?.toString() || '0',
            a.reject_today?.toString() || '0',
            a.rework_today?.toString() || '0',
            a.cumulative_good_total?.toString() || '0',
            a.manpower_actual?.toString() || '0',
            a.ot_hours_actual?.toString() || '0',
            `${a.actual_stage_progress || 0}%`,
            a.has_blocker ? 'Yes' : 'No',
            a.blocker_description || '-',
            a.blocker_impact || '-',
            a.remarks || '-',
          ]);
        });
        rows.push(['']);
      }

      // Export Finishing Targets
      if (includeFinishing && data.finishingTargets.length > 0) {
        rows.push(['=== FINISHING TARGETS ===']);
        rows.push(['Date', 'Time', 'Line', 'PO Number', 'Buyer', 'Style', 'Target/hr', 'Manpower', 'Day Hours', 'OT Hours', 'Late', 'Remarks']);
        data.finishingTargets.forEach(t => {
          rows.push([
            formatDate(t.production_date),
            formatTime(t.submitted_at),
            t.lines?.name || t.lines?.line_id || '-',
            t.work_orders?.po_number || '-',
            t.work_orders?.buyer || '-',
            t.work_orders?.style || '-',
            t.per_hour_target?.toString() || '0',
            t.m_power_planned?.toString() || '0',
            t.day_hour_planned?.toString() || '0',
            t.day_over_time_planned?.toString() || '0',
            t.is_late ? 'Yes' : 'No',
            t.remarks || '-',
          ]);
        });
        rows.push(['']);
      }

      // Export Finishing Actuals
      if (includeFinishing && data.finishingActuals.length > 0) {
        rows.push(['=== FINISHING END OF DAY ===']);
        rows.push(['Date', 'Time', 'Line', 'PO Number', 'Buyer', 'Style', 'Day QC Pass', 'Total QC Pass', 'Day Poly', 'Total Poly', 'Day Carton', 'Total Carton', 'Manpower', 'Day Hours', 'OT Hours', 'Avg Production', 'Has Blocker', 'Remarks']);
        data.finishingActuals.forEach(a => {
          rows.push([
            formatDate(a.production_date),
            formatTime(a.submitted_at),
            a.lines?.name || a.lines?.line_id || '-',
            a.work_orders?.po_number || '-',
            a.work_orders?.buyer || '-',
            a.work_orders?.style || '-',
            a.day_qc_pass?.toString() || '0',
            a.total_qc_pass?.toString() || '0',
            a.day_poly?.toString() || '0',
            a.total_poly?.toString() || '0',
            a.day_carton?.toString() || '0',
            a.total_carton?.toString() || '0',
            a.m_power_actual?.toString() || '0',
            a.day_hour_actual?.toString() || '0',
            a.day_over_time_actual?.toString() || '0',
            a.average_production?.toString() || '-',
            a.has_blocker ? 'Yes' : 'No',
            a.remarks || '-',
          ]);
        });
        rows.push(['']);
      }

      // Export Cutting Targets
      if (includeCutting && data.cuttingTargets.length > 0) {
        rows.push(['=== CUTTING TARGETS ===']);
        rows.push(['Date', 'Time', 'Line', 'PO Number', 'Buyer', 'Style', 'Colour', 'Order Qty', 'Marker Capacity', 'Lay Capacity', 'Cutting Capacity', 'Manpower', 'Under Qty', 'Late']);
        data.cuttingTargets.forEach(t => {
          rows.push([
            formatDate(t.production_date),
            formatTime(t.submitted_at),
            t.lines?.name || t.lines?.line_id || '-',
            t.work_orders?.po_number || t.po_no || '-',
            t.work_orders?.buyer || t.buyer || '-',
            t.work_orders?.style || t.style || '-',
            t.colour || '-',
            t.order_qty?.toString() || '0',
            t.marker_capacity?.toString() || '0',
            t.lay_capacity?.toString() || '0',
            t.cutting_capacity?.toString() || '0',
            t.man_power?.toString() || '0',
            t.under_qty?.toString() || '0',
            t.is_late ? 'Yes' : 'No',
          ]);
        });
        rows.push(['']);
      }

      // Export Cutting Actuals
      if (includeCutting && data.cuttingActuals.length > 0) {
        rows.push(['=== CUTTING ACTUALS ===']);
        rows.push(['Date', 'Time', 'Line', 'PO Number', 'Buyer', 'Style', 'Colour', 'Order Qty', 'Day Cutting', 'Total Cutting', 'Day Input', 'Total Input', 'Balance', 'Late', 'Acknowledged']);
        data.cuttingActuals.forEach(a => {
          rows.push([
            formatDate(a.production_date),
            formatTime(a.submitted_at),
            a.lines?.name || a.lines?.line_id || '-',
            a.work_orders?.po_number || a.po_no || '-',
            a.work_orders?.buyer || a.buyer || '-',
            a.work_orders?.style || a.style || '-',
            a.colour || '-',
            a.order_qty?.toString() || '0',
            a.day_cutting?.toString() || '0',
            a.total_cutting?.toString() || '0',
            a.day_input?.toString() || '0',
            a.total_input?.toString() || '0',
            a.balance?.toString() || '0',
            a.is_late ? 'Yes' : 'No',
            a.acknowledged ? 'Yes' : 'No',
          ]);
        });
        rows.push(['']);
      }

      // Export Storage Bin Cards
      if (includeStorage && data.storageBinCards.length > 0) {
        rows.push(['=== STORAGE BIN CARDS ===']);
        rows.push(['Date', 'PO Number', 'Buyer', 'Style', 'Color', 'Supplier', 'Description', 'Total Received', 'Total Issued', 'Balance']);
        data.storageBinCards.forEach(bc => {
          rows.push([
            formatDate(bc.created_at),
            bc.work_orders?.po_number || '-',
            bc.buyer || '-',
            bc.style || '-',
            bc.color || '-',
            bc.supplier_name || '-',
            bc.description || '-',
            bc.totalReceived?.toString() || '0',
            bc.totalIssued?.toString() || '0',
            bc.balance?.toString() || '0',
          ]);
        });
        rows.push(['']);
      }

      // Convert to CSV
      const csvContent = rows.map(row =>
        row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      // Generate filename
      const fileDate = new Date().toISOString().split('T')[0];
      const deptSuffix = deptParts.join('_').toLowerCase();
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `submissions_${deptSuffix}_${dateRange}days_${fileDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Exported ${getExportCounts()} records`);
      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  const selectAll = () => {
    setIncludeSewing(true);
    setIncludeFinishing(true);
    setIncludeCutting(true);
    setIncludeStorage(true);
  };

  const clearAll = () => {
    setIncludeSewing(false);
    setIncludeFinishing(false);
    setIncludeCutting(false);
    setIncludeStorage(false);
  };

  const getSewingCount = () => data.sewingTargets.length + data.sewingActuals.length;
  const getFinishingCount = () => data.finishingTargets.length + data.finishingActuals.length;
  const getCuttingCount = () => data.cuttingTargets.length + data.cuttingActuals.length;
  const getStorageCount = () => data.storageBinCards.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Export Submissions
          </DialogTitle>
          <DialogDescription>
            Select which departments to include in your export
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear All
            </Button>
          </div>

          {/* Department Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Departments</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="sewing"
                  checked={includeSewing}
                  onCheckedChange={(checked) => setIncludeSewing(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="sewing" className="cursor-pointer font-medium flex items-center gap-2">
                    <Factory className="h-4 w-4" />
                    Sewing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {getSewingCount()} records
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="finishing"
                  checked={includeFinishing}
                  onCheckedChange={(checked) => setIncludeFinishing(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="finishing" className="cursor-pointer font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Finishing
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {getFinishingCount()} records
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="cutting"
                  checked={includeCutting}
                  onCheckedChange={(checked) => setIncludeCutting(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="cutting" className="cursor-pointer font-medium flex items-center gap-2">
                    <Scissors className="h-4 w-4" />
                    Cutting
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {getCuttingCount()} records
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="storage"
                  checked={includeStorage}
                  onCheckedChange={(checked) => setIncludeStorage(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="storage" className="cursor-pointer font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Storage
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {getStorageCount()} records
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Export Summary */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm">
              <span className="font-medium">{getExportCounts()}</span> records will be exported
            </p>
            <p className="text-xs text-muted-foreground">
              Date range: Last {dateRange} days
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!canExport || exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
