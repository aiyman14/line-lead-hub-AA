import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Table } from "lucide-react";
import { toast } from "sonner";

interface ExportData {
  summary: {
    totalSewingOutput: number;
    totalFinishingQcPass: number;
    avgEfficiency: number;
    totalBlockers: number;
    openBlockers: number;
    resolvedBlockers: number;
    avgManpower: number;
    daysWithData: number;
    topPerformingLine: string | null;
    worstPerformingLine: string | null;
  };
  linePerformance: Array<{
    lineName: string;
    totalOutput: number;
    totalTarget: number;
    efficiency: number;
    avgManpower: number;
    blockers: number;
  }>;
  dailyData: Array<{
    date: string;
    sewingOutput: number;
    sewingTarget: number;
    finishingQcPass: number;
    efficiency: number;
    blockers: number;
  }>;
  blockerBreakdown: Array<{
    type: string;
    count: number;
  }>;
  workOrderProgress: Array<{
    poNumber: string;
    buyer: string;
    style: string;
    orderQty: number;
    totalOutput: number;
    progress: number;
  }>;
  periodDays: number;
  exportDate: string;
  factoryName: string;
}

interface ExportInsightsProps {
  data: ExportData;
}

export function ExportInsights({ data }: ExportInsightsProps) {
  const [exporting, setExporting] = useState(false);

  const exportToCSV = () => {
    setExporting(true);
    try {
      // Create CSV content
      let csv = '';
      
      // Header
      csv += `Production Insights Report\n`;
      csv += `Factory: ${data.factoryName}\n`;
      csv += `Period: Last ${data.periodDays} days\n`;
      csv += `Generated: ${data.exportDate}\n\n`;

      // Summary
      csv += `SUMMARY\n`;
      csv += `Total Sewing Output,${data.summary.totalSewingOutput}\n`;
      csv += `Total QC Pass,${data.summary.totalFinishingQcPass}\n`;
      csv += `Average Efficiency,${data.summary.avgEfficiency}%\n`;
      csv += `Total Blockers,${data.summary.totalBlockers}\n`;
      csv += `Open Blockers,${data.summary.openBlockers}\n`;
      csv += `Resolved Blockers,${data.summary.resolvedBlockers}\n`;
      csv += `Average Manpower,${data.summary.avgManpower}\n`;
      csv += `Days with Data,${data.summary.daysWithData}\n`;
      csv += `Top Performing Line,${data.summary.topPerformingLine || 'N/A'}\n`;
      csv += `Lowest Performing Line,${data.summary.worstPerformingLine || 'N/A'}\n\n`;

      // Daily Data
      csv += `DAILY DATA\n`;
      csv += `Date,Sewing Output,Sewing Target,QC Pass,Efficiency,Blockers\n`;
      data.dailyData.forEach(d => {
        csv += `${d.date},${d.sewingOutput},${d.sewingTarget},${d.finishingQcPass},${d.efficiency}%,${d.blockers}\n`;
      });
      csv += `\n`;

      // Line Performance
      csv += `LINE PERFORMANCE\n`;
      csv += `Line,Output,Target,Efficiency,Avg Manpower,Blockers\n`;
      data.linePerformance.forEach(l => {
        csv += `${l.lineName},${l.totalOutput},${l.totalTarget},${l.efficiency}%,${l.avgManpower},${l.blockers}\n`;
      });
      csv += `\n`;

      // Blocker Breakdown
      csv += `BLOCKER BREAKDOWN\n`;
      csv += `Type,Count\n`;
      data.blockerBreakdown.forEach(b => {
        csv += `${b.type},${b.count}\n`;
      });
      csv += `\n`;

      // Work Order Progress
      csv += `WORK ORDER PROGRESS\n`;
      csv += `PO Number,Buyer,Style,Order Qty,Output,Progress\n`;
      data.workOrderProgress.forEach(wo => {
        csv += `${wo.poNumber},${wo.buyer},${wo.style},${wo.orderQty},${wo.totalOutput},${wo.progress}%\n`;
      });

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `insights-report-${data.exportDate}.csv`;
      link.click();

      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const exportToText = () => {
    setExporting(true);
    try {
      let text = '';
      const separator = '═'.repeat(60);
      const thinSeparator = '─'.repeat(60);

      text += `${separator}\n`;
      text += `           PRODUCTION INSIGHTS REPORT\n`;
      text += `${separator}\n\n`;
      text += `Factory: ${data.factoryName}\n`;
      text += `Period: Last ${data.periodDays} days\n`;
      text += `Generated: ${data.exportDate}\n\n`;

      // Summary
      text += `${thinSeparator}\n`;
      text += `  EXECUTIVE SUMMARY\n`;
      text += `${thinSeparator}\n\n`;
      text += `  • Total Sewing Output:    ${data.summary.totalSewingOutput.toLocaleString()} pcs\n`;
      text += `  • Total QC Pass:          ${data.summary.totalFinishingQcPass.toLocaleString()} pcs\n`;
      text += `  • Average Efficiency:     ${data.summary.avgEfficiency}%\n`;
      text += `  • Total Blockers:         ${data.summary.totalBlockers} (${data.summary.openBlockers} open, ${data.summary.resolvedBlockers} resolved)\n`;
      text += `  • Average Manpower:       ${data.summary.avgManpower}\n`;
      text += `  • Days with Data:         ${data.summary.daysWithData}\n\n`;

      if (data.summary.topPerformingLine) {
        text += `  ✓ Top Performer: ${data.summary.topPerformingLine}\n`;
      }
      if (data.summary.worstPerformingLine && data.summary.worstPerformingLine !== data.summary.topPerformingLine) {
        text += `  ⚠ Needs Attention: ${data.summary.worstPerformingLine}\n`;
      }
      text += `\n`;

      // Line Performance
      text += `${thinSeparator}\n`;
      text += `  LINE PERFORMANCE RANKING\n`;
      text += `${thinSeparator}\n\n`;
      data.linePerformance.forEach((l, idx) => {
        const rank = idx + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        text += `  ${medal} ${l.lineName.padEnd(15)} ${l.efficiency}% efficiency | ${l.totalOutput.toLocaleString()} pcs\n`;
      });
      text += `\n`;

      // Blockers
      if (data.blockerBreakdown.length > 0) {
        text += `${thinSeparator}\n`;
        text += `  BLOCKER ANALYSIS\n`;
        text += `${thinSeparator}\n\n`;
        data.blockerBreakdown.forEach(b => {
          text += `  • ${b.type}: ${b.count} occurrence(s)\n`;
        });
        text += `\n`;
      }

      // Work Orders
      if (data.workOrderProgress.length > 0) {
        text += `${thinSeparator}\n`;
        text += `  WORK ORDER PROGRESS\n`;
        text += `${thinSeparator}\n\n`;
        data.workOrderProgress.forEach(wo => {
          const progressBar = '█'.repeat(Math.floor(wo.progress / 10)) + '░'.repeat(10 - Math.floor(wo.progress / 10));
          text += `  ${wo.poNumber} (${wo.buyer})\n`;
          text += `    ${progressBar} ${wo.progress}% | ${wo.totalOutput.toLocaleString()}/${wo.orderQty.toLocaleString()}\n\n`;
        });
      }

      text += `${separator}\n`;
      text += `                    END OF REPORT\n`;
      text += `${separator}\n`;

      // Download
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `insights-report-${data.exportDate}.txt`;
      link.click();

      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          <Table className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToText}>
          <FileText className="h-4 w-4 mr-2" />
          Export as Text Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
