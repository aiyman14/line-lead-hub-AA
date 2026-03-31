import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";
import { getCorsHeaders } from "../_shared/security.ts";

interface LineData {
  id: string;
  line_id: string;
  name: string | null;
}

interface DailyStats {
  date: string;
  sewingOutput: number;
  sewingTarget: number;
  finishingPoly: number;
  cuttingOutput: number;
  efficiency: number;
}

interface LinePerformance {
  lineName: string;
  totalOutput: number;
  totalTarget: number;
  efficiency: number;
  submissions: number;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-insights-report function called");

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, factoryId, scheduleType, userId } = await req.json();

    console.log(`Sending ${scheduleType} report to ${email} for factory ${factoryId}`);

    // Get factory info
    const { data: factory } = await supabase
      .from("factory_accounts")
      .select("name")
      .eq("id", factoryId)
      .single();

    const factoryName = factory?.name || "Your Factory";

    // Get all active lines for the factory
    const { data: allLines } = await supabase
      .from("lines")
      .select("id, line_id, name")
      .eq("factory_id", factoryId)
      .eq("is_active", true)
      .order("line_id");

    const lines: LineData[] = allLines || [];

    // Calculate date range based on schedule type
    const now = new Date();
    const days = scheduleType === "monthly" ? 30 : scheduleType === "weekly" ? 7 : 1;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    // Fetch all submission data
    const [
      { data: sewingTargets },
      { data: sewingActuals },
      { data: finishingTargets },
      { data: finishingDailySheets },
      { data: cuttingTargets },
      { data: cuttingActuals },
    ] = await Promise.all([
      supabase
        .from("sewing_targets")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr)
        .order("production_date"),
      supabase
        .from("sewing_actuals")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr)
        .order("production_date"),
      supabase
        .from("finishing_targets")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr)
        .order("production_date"),
      supabase
        .from("finishing_daily_sheets")
        .select("*, lines(name, line_id), finishing_hourly_logs(*)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr)
        .order("production_date"),
      supabase
        .from("cutting_targets")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr)
        .order("production_date"),
      supabase
        .from("cutting_actuals")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr)
        .order("production_date"),
    ]);

    // Helper to find missing submissions
    const findMissingLines = (submissions: any[], dateStr: string, lineKey = "line_id"): string[] => {
      const submittedLineIds = new Set(submissions
        .filter(s => s.production_date === dateStr)
        .map(s => s[lineKey]));
      return lines.filter(l => !submittedLineIds.has(l.id)).map(l => l.name || l.line_id);
    };

    // Generate CSV data (used for both daily and weekly)
    const generateCSV = () => {
      const csvRows: string[] = [];
      csvRows.push("Department,Type,Date,Line,PO Number,Buyer,Style,Status,Key Metrics");
      
      // Sewing Targets
      (sewingTargets || []).forEach(t => {
        const lineName = t.lines?.name || t.lines?.line_id || "Unknown";
        csvRows.push(`Sewing,Morning Target,${t.production_date},${lineName},${t.work_order_id || ""},${t.buyer_name || ""},${t.style_code || ""},Submitted,"Target: ${t.per_hour_target}/hr, MP: ${t.manpower_planned}"`);
      });
      
      // Sewing Actuals
      (sewingActuals || []).forEach(a => {
        const lineName = a.lines?.name || a.lines?.line_id || "Unknown";
        csvRows.push(`Sewing,End of Day,${a.production_date},${lineName},${a.work_order_id || ""},${a.buyer_name || ""},${a.style_code || ""},Submitted,"Output: ${a.good_today}, Reject: ${a.reject_today}, Rework: ${a.rework_today}"`);
      });

      // Finishing Targets  
      (finishingTargets || []).forEach(t => {
        const lineName = t.lines?.name || t.lines?.line_id || "Unknown";
        csvRows.push(`Finishing,Morning Target,${t.production_date},${lineName},${t.work_order_id || ""},${t.buyer_name || ""},${t.style_no || ""},Submitted,"Target: ${t.per_hour_target}/hr, M-Power: ${t.m_power_planned}"`);
      });
      
      // Finishing Daily Sheets
      (finishingDailySheets || []).forEach(s => {
        const lineName = s.lines?.name || s.lines?.line_id || "Unknown";
        const logs = s.finishing_hourly_logs || [];
        const totalPoly = logs.reduce((sum: number, l: any) => sum + (l.poly_actual || 0), 0);
        const totalCarton = logs.reduce((sum: number, l: any) => sum + (l.carton_actual || 0), 0);
        csvRows.push(`Finishing,Daily Sheet,${s.production_date},${lineName},${s.po_no || ""},${s.buyer || ""},${s.style || ""},Submitted,"Hours: ${logs.length}, Poly: ${totalPoly}, Carton: ${totalCarton}"`);
      });
      
      // Cutting Targets
      (cuttingTargets || []).forEach(t => {
        const lineName = t.lines?.name || t.lines?.line_id || "Unknown";
        csvRows.push(`Cutting,Morning Target,${t.production_date},${lineName},${t.work_order_id || ""},${t.buyer || ""},${t.style || ""},Submitted,"MP: ${t.man_power}, Cut Cap: ${t.cutting_capacity}"`);
      });
      
      // Cutting Actuals
      (cuttingActuals || []).forEach(a => {
        const lineName = a.lines?.name || a.lines?.line_id || "Unknown";
        csvRows.push(`Cutting,End of Day,${a.production_date},${lineName},${a.work_order_id || ""},${a.buyer || ""},${a.style || ""},Submitted,"Day Cut: ${a.day_cutting}, Day Input: ${a.day_input}, Balance: ${a.balance || 0}"`);
      });

      // Add missing entries for today (daily) or all dates (weekly)
      if (scheduleType === "daily") {
        const missingSewingTargets = findMissingLines(sewingTargets || [], todayStr);
        missingSewingTargets.forEach(lineName => {
          csvRows.push(`Sewing,Morning Target,${todayStr},${lineName},,,,Missing,`);
        });
        const missingSewingActuals = findMissingLines(sewingActuals || [], todayStr);
        missingSewingActuals.forEach(lineName => {
          csvRows.push(`Sewing,End of Day,${todayStr},${lineName},,,,Missing,`);
        });
        const missingFinishingTargets = findMissingLines(finishingTargets || [], todayStr);
        missingFinishingTargets.forEach(lineName => {
          csvRows.push(`Finishing,Morning Target,${todayStr},${lineName},,,,Missing,`);
        });
      }

      return csvRows.join("\n");
    };

    if (scheduleType === "daily") {
      // Daily report - CSV only
      const csvContent = generateCSV();
      const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));

      const missingSewingTargets = findMissingLines(sewingTargets || [], todayStr);
      const missingSewingActuals = findMissingLines(sewingActuals || [], todayStr);
      const missingFinishingTargets = findMissingLines(finishingTargets || [], todayStr);

      const emailResponse = await resend.emails.send({
        from: "Production Reports <onboarding@resend.dev>",
        to: [email],
        subject: `Daily Production Report - ${factoryName} - ${todayStr}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Daily Production Report</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${factoryName}</p>
              <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0; font-size: 14px;">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            
            <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
              <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 16px 0;">📊 Quick Summary</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Sewing Targets</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${(sewingTargets || []).length}</strong> submitted, <span style="color: ${missingSewingTargets.length > 0 ? '#ef4444' : '#22c55e'};">${missingSewingTargets.length} missing</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Sewing Actuals</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${(sewingActuals || []).length}</strong> submitted, <span style="color: ${missingSewingActuals.length > 0 ? '#ef4444' : '#22c55e'};">${missingSewingActuals.length} missing</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Finishing Targets</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${(finishingTargets || []).length}</strong> submitted, <span style="color: ${missingFinishingTargets.length > 0 ? '#ef4444' : '#22c55e'};">${missingFinishingTargets.length} missing</span></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Finishing Daily Sheets</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${(finishingDailySheets || []).length}</strong> submitted</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Cutting Targets</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${(cuttingTargets || []).length}</strong> submitted</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Cutting Actuals</td>
                  <td style="padding: 8px 0; text-align: right;"><strong>${(cuttingActuals || []).length}</strong> submitted</td>
                </tr>
              </table>
              
              <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">📎 The attached CSV contains all submitted and missing entries for today.</p>
              </div>
            </div>
            
            <div style="background: #1e293b; padding: 16px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">This report was automatically generated by your production tracking system.</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `daily-report-${todayStr}.csv`,
            content: csvBase64,
          },
        ],
      });

      console.log("Daily email sent successfully:", emailResponse);

      if (userId) {
        await supabase
          .from("email_schedules")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("schedule_type", scheduleType);
      }

      return new Response(
        JSON.stringify({ success: true, emailResponse }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ============ WEEKLY REPORT ============
    // Calculate insights
    const totalSewingOutput = (sewingActuals || []).reduce((sum, a) => sum + (a.good_today || 0), 0);
    const totalSewingTarget = (sewingTargets || []).reduce((sum, t) => sum + ((t.per_hour_target || 0) * 8), 0);
    const avgEfficiency = totalSewingTarget > 0 ? Math.round((totalSewingOutput / totalSewingTarget) * 100) : 0;
    
    const totalFinishingPoly = (finishingDailySheets || []).reduce((sum, s) => {
      const logs = s.finishing_hourly_logs || [];
      return sum + logs.reduce((lSum: number, l: any) => lSum + (l.poly_actual || 0), 0);
    }, 0);
    
    const totalCuttingOutput = (cuttingActuals || []).reduce((sum, a) => sum + (a.day_cutting || 0), 0);
    const totalRejects = (sewingActuals || []).reduce((sum, a) => sum + (a.reject_today || 0), 0);
    const totalRework = (sewingActuals || []).reduce((sum, a) => sum + (a.rework_today || 0), 0);

    // Process daily stats for charts
    const dailyMap = new Map<string, DailyStats>();
    (sewingActuals || []).forEach(a => {
      const existing = dailyMap.get(a.production_date) || {
        date: a.production_date,
        sewingOutput: 0,
        sewingTarget: 0,
        finishingPoly: 0,
        cuttingOutput: 0,
        efficiency: 0,
      };
      existing.sewingOutput += a.good_today || 0;
      dailyMap.set(a.production_date, existing);
    });

    (sewingTargets || []).forEach(t => {
      const existing = dailyMap.get(t.production_date);
      if (existing) {
        existing.sewingTarget += (t.per_hour_target || 0) * 8;
      }
    });

    (finishingDailySheets || []).forEach(s => {
      const logs = s.finishing_hourly_logs || [];
      const poly = logs.reduce((sum: number, l: any) => sum + (l.poly_actual || 0), 0);
      const existing = dailyMap.get(s.production_date);
      if (existing) {
        existing.finishingPoly += poly;
      }
    });

    (cuttingActuals || []).forEach(a => {
      const existing = dailyMap.get(a.production_date);
      if (existing) {
        existing.cuttingOutput += a.day_cutting || 0;
      }
    });

    const dailyStats = Array.from(dailyMap.values())
      .map(d => ({
        ...d,
        efficiency: d.sewingTarget > 0 ? Math.round((d.sewingOutput / d.sewingTarget) * 100) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Process line performance
    const lineMap = new Map<string, LinePerformance>();
    (sewingActuals || []).forEach(a => {
      const lineName = a.lines?.name || a.lines?.line_id || "Unknown";
      const existing = lineMap.get(lineName) || {
        lineName,
        totalOutput: 0,
        totalTarget: 0,
        efficiency: 0,
        submissions: 0,
      };
      existing.totalOutput += a.good_today || 0;
      existing.submissions += 1;
      lineMap.set(lineName, existing);
    });

    (sewingTargets || []).forEach(t => {
      const lineName = t.lines?.name || t.lines?.line_id || "Unknown";
      const existing = lineMap.get(lineName);
      if (existing) {
        existing.totalTarget += (t.per_hour_target || 0) * 8;
      }
    });

    const linePerformance = Array.from(lineMap.values())
      .map(l => ({
        ...l,
        efficiency: l.totalTarget > 0 ? Math.round((l.totalOutput / l.totalTarget) * 100) : 0,
      }))
      .sort((a, b) => b.efficiency - a.efficiency);

    // Generate professional PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);

    // Colors
    const primaryColor = [59, 130, 246]; // Blue
    const darkColor = [30, 41, 59]; // Slate 800
    const grayColor = [100, 116, 139]; // Slate 500
    const successColor = [34, 197, 94]; // Green
    const warningColor = [245, 158, 11]; // Amber

    // Helper functions
    const drawHeader = (title: string, yPos: number) => {
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin, 23);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(factoryName, pageWidth - margin, 23, { align: "right" });
      return 50;
    };

    const drawSectionTitle = (title: string, yPos: number) => {
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, margin + 40, yPos);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin, yPos + 12);
      return yPos + 20;
    };

    const drawKpiBox = (x: number, y: number, width: number, label: string, value: string, subtext?: string) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, width, 35, 3, 3, 'F');
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(label, x + 8, y + 12);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(value, x + 8, y + 26);
      if (subtext) {
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(subtext, x + 8, y + 32);
      }
    };

    // ========== PAGE 1: COVER PAGE ==========
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.text("Weekly", pageWidth / 2, 80, { align: "center" });
    doc.text("Production Report", pageWidth / 2, 100, { align: "center" });

    doc.setFontSize(20);
    doc.setFont("helvetica", "normal");
    doc.text(factoryName, pageWidth / 2, 130, { align: "center" });

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin + 20, 150, contentWidth - 40, 40, 5, 5, 'F');
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(14);
    doc.text(`${startDateStr} to ${todayStr}`, pageWidth / 2, 170, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 182, { align: "center" });

    // Quick stats on cover
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    const coverY = 220;
    doc.text(`Total Sewing Output: ${totalSewingOutput.toLocaleString()} pcs`, pageWidth / 2, coverY, { align: "center" });
    doc.text(`Average Efficiency: ${avgEfficiency}%`, pageWidth / 2, coverY + 15, { align: "center" });
    doc.text(`Total Finishing (Poly): ${totalFinishingPoly.toLocaleString()} pcs`, pageWidth / 2, coverY + 30, { align: "center" });

    // ========== PAGE 2: EXECUTIVE SUMMARY ==========
    doc.addPage();
    let yPos = drawHeader("Executive Summary", 0);

    // KPI Grid
    const kpiWidth = (contentWidth - 10) / 2;
    drawKpiBox(margin, yPos, kpiWidth, "TOTAL SEWING OUTPUT", totalSewingOutput.toLocaleString() + " pcs", `${Math.round(totalSewingOutput / 7).toLocaleString()} avg/day`);
    drawKpiBox(margin + kpiWidth + 10, yPos, kpiWidth, "AVERAGE EFFICIENCY", avgEfficiency + "%", avgEfficiency >= 90 ? "On Target" : avgEfficiency >= 70 ? "Needs Attention" : "Below Target");
    
    yPos += 42;
    drawKpiBox(margin, yPos, kpiWidth, "FINISHING (POLY)", totalFinishingPoly.toLocaleString() + " pcs", `${(finishingDailySheets || []).length} sheets submitted`);
    drawKpiBox(margin + kpiWidth + 10, yPos, kpiWidth, "CUTTING OUTPUT", totalCuttingOutput.toLocaleString() + " pcs", `${(cuttingActuals || []).length} actuals submitted`);

    yPos += 42;
    drawKpiBox(margin, yPos, kpiWidth, "TOTAL REJECTS", totalRejects.toLocaleString() + " pcs", `${totalSewingOutput > 0 ? ((totalRejects / totalSewingOutput) * 100).toFixed(1) : 0}% rejection rate`);
    drawKpiBox(margin + kpiWidth + 10, yPos, kpiWidth, "TOTAL REWORK", totalRework.toLocaleString() + " pcs", `${totalSewingOutput > 0 ? ((totalRework / totalSewingOutput) * 100).toFixed(1) : 0}% rework rate`);

    // Submission counts
    yPos += 55;
    yPos = drawSectionTitle("Submission Summary", yPos);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const submissionData = [
      ["Sewing Targets", (sewingTargets || []).length],
      ["Sewing Actuals", (sewingActuals || []).length],
      ["Finishing Targets", (finishingTargets || []).length],
      ["Finishing Daily Sheets", (finishingDailySheets || []).length],
      ["Cutting Targets", (cuttingTargets || []).length],
      ["Cutting Actuals", (cuttingActuals || []).length],
    ];

    submissionData.forEach(([label, count], idx) => {
      const rowY = yPos + (idx * 12);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text(label as string, margin, rowY);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.setFont("helvetica", "bold");
      doc.text(String(count), margin + 80, rowY);
      doc.setFont("helvetica", "normal");
    });

    // ========== PAGE 3: PRODUCTION TRENDS ==========
    doc.addPage();
    yPos = drawHeader("Production Trends", 0);
    yPos = drawSectionTitle("Daily Output Performance", yPos);

    if (dailyStats.length > 0) {
      // Draw bar chart
      const chartHeight = 80;
      const chartWidth = contentWidth;
      const barWidth = Math.min(20, (chartWidth - 20) / dailyStats.length - 5);
      const maxOutput = Math.max(...dailyStats.map(d => d.sewingOutput), 1);

      // Y-axis
      doc.setDrawColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, margin, yPos + chartHeight);
      doc.line(margin, yPos + chartHeight, margin + chartWidth, yPos + chartHeight);

      // Y-axis labels
      doc.setFontSize(7);
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text(maxOutput.toLocaleString(), margin - 2, yPos + 3, { align: "right" });
      doc.text("0", margin - 2, yPos + chartHeight, { align: "right" });

      // Bars
      dailyStats.forEach((d, idx) => {
        const barHeight = (d.sewingOutput / maxOutput) * chartHeight;
        const x = margin + 10 + (idx * (barWidth + 8));
        const barY = yPos + chartHeight - barHeight;
        
        // Draw bar
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.roundedRect(x, barY, barWidth, barHeight, 2, 2, 'F');
        
        // Date label
        doc.setFontSize(7);
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        const dateLabel = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        doc.text(dateLabel, x + barWidth/2, yPos + chartHeight + 8, { align: "center" });
        
        // Value on top
        if (d.sewingOutput > 0) {
          doc.setFontSize(6);
          doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
          doc.text(d.sewingOutput.toLocaleString(), x + barWidth/2, barY - 2, { align: "center" });
        }
      });

      yPos += chartHeight + 25;
    }

    // Efficiency trend
    yPos = drawSectionTitle("Daily Efficiency (%)", yPos);

    if (dailyStats.length > 0) {
      const chartHeight = 60;
      const barWidth = Math.min(20, (contentWidth - 20) / dailyStats.length - 5);

      dailyStats.forEach((d, idx) => {
        const x = margin + 10 + (idx * (barWidth + 8));
        const barHeight = Math.min((d.efficiency / 150) * chartHeight, chartHeight);
        const barY = yPos + chartHeight - barHeight;
        
        // Color based on efficiency
        if (d.efficiency >= 90) {
          doc.setFillColor(successColor[0], successColor[1], successColor[2]);
        } else if (d.efficiency >= 70) {
          doc.setFillColor(warningColor[0], warningColor[1], warningColor[2]);
        } else {
          doc.setFillColor(239, 68, 68); // Red
        }
        
        doc.roundedRect(x, barY, barWidth, barHeight, 2, 2, 'F');
        
        // Efficiency value
        doc.setFontSize(7);
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text(d.efficiency + "%", x + barWidth/2, barY - 2, { align: "center" });
        
        // Date
        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        const dateLabel = new Date(d.date).toLocaleDateString('en-US', { day: 'numeric' });
        doc.text(dateLabel, x + barWidth/2, yPos + chartHeight + 6, { align: "center" });
      });

      yPos += chartHeight + 20;
    }

    // ========== PAGE 4: LINE PERFORMANCE ==========
    doc.addPage();
    yPos = drawHeader("Line Performance Ranking", 0);
    yPos = drawSectionTitle("Efficiency Ranking by Production Line", yPos);

    if (linePerformance.length > 0) {
      // Table header
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos, contentWidth, 10, 'F');
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
      doc.text("RANK", margin + 5, yPos + 7);
      doc.text("LINE", margin + 25, yPos + 7);
      doc.text("OUTPUT", margin + 70, yPos + 7);
      doc.text("TARGET", margin + 100, yPos + 7);
      doc.text("EFFICIENCY", margin + 130, yPos + 7);

      yPos += 14;
      doc.setFont("helvetica", "normal");

      linePerformance.slice(0, 15).forEach((line, idx) => {
        if (yPos > 270) return;
        
        // Alternate row background
        if (idx % 2 === 0) {
          doc.setFillColor(252, 252, 253);
          doc.rect(margin, yPos - 5, contentWidth, 10, 'F');
        }

        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.setFontSize(9);
        
        // Medal for top 3
        const rank = idx + 1;
        if (rank <= 3) {
          doc.setFont("helvetica", "bold");
          doc.text(rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉", margin + 5, yPos);
        } else {
          doc.text(String(rank), margin + 8, yPos);
        }
        doc.setFont("helvetica", "normal");
        
        doc.text(line.lineName, margin + 25, yPos);
        doc.text(line.totalOutput.toLocaleString(), margin + 70, yPos);
        doc.text(line.totalTarget.toLocaleString(), margin + 100, yPos);
        
        // Efficiency with color
        const effColor = line.efficiency >= 90 ? successColor : line.efficiency >= 70 ? warningColor : [239, 68, 68];
        doc.setTextColor(effColor[0], effColor[1], effColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text(line.efficiency + "%", margin + 130, yPos);
        doc.setFont("helvetica", "normal");
        
        yPos += 10;
      });
    }

    // ========== PAGE 5+: DEPARTMENT SUBMISSIONS ==========
    // Sewing submissions table
    doc.addPage();
    yPos = drawHeader("Sewing Department", 0);
    yPos = drawSectionTitle("End of Day Actuals", yPos);

    // Table
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, yPos, contentWidth, 10, 'F');
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text("DATE", margin + 5, yPos + 7);
    doc.text("LINE", margin + 30, yPos + 7);
    doc.text("BUYER", margin + 60, yPos + 7);
    doc.text("STYLE", margin + 95, yPos + 7);
    doc.text("OUTPUT", margin + 125, yPos + 7);
    doc.text("REJECT", margin + 155, yPos + 7);

    yPos += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    (sewingActuals || []).slice(0, 25).forEach((a, idx) => {
      if (yPos > 270) return;
      
      if (idx % 2 === 0) {
        doc.setFillColor(252, 252, 253);
        doc.rect(margin, yPos - 5, contentWidth, 8, 'F');
      }

      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      const lineName = a.lines?.name || a.lines?.line_id || "-";
      doc.text(a.production_date, margin + 5, yPos);
      doc.text(String(lineName).substring(0, 12), margin + 30, yPos);
      doc.text(String(a.buyer_name || "-").substring(0, 15), margin + 60, yPos);
      doc.text(String(a.style_code || "-").substring(0, 12), margin + 95, yPos);
      doc.text(String(a.good_today || 0), margin + 125, yPos);
      doc.text(String(a.reject_today || 0), margin + 155, yPos);
      
      yPos += 8;
    });

    // Footer on last page
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(8);
    doc.text("This report was automatically generated by your production tracking system.", pageWidth / 2, pageHeight - 15, { align: "center" });

    // Generate PDF
    const pdfOutput = doc.output("datauristring");
    const pdfBase64 = pdfOutput.split(",")[1];

    // Generate CSV
    const csvContent = generateCSV();
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));

    // Send email with both attachments
    const reportTitle = scheduleType === "monthly" ? "Monthly Production Report" : "Weekly Production Report";
    const reportPeriod = scheduleType === "monthly" ? "30 Days" : "Week";
    const emailResponse = await resend.emails.send({
      from: "Production Reports <onboarding@resend.dev>",
      to: [email],
      subject: `${reportTitle} - ${factoryName} - ${reportPeriod} of ${startDateStr}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${reportTitle}</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${factoryName}</p>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0 0; font-size: 14px;">${startDateStr} to ${todayStr}</p>
          </div>
          
          <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
            <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 20px 0;">📊 ${scheduleType === "monthly" ? "Monthly" : "Weekly"} Highlights</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
              <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 12px; margin: 0 0 4px 0;">Total Sewing Output</p>
                <p style="color: #1e293b; font-size: 24px; font-weight: bold; margin: 0;">${totalSewingOutput.toLocaleString()}</p>
                <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">pieces</p>
              </div>
              <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
                <p style="color: #64748b; font-size: 12px; margin: 0 0 4px 0;">Average Efficiency</p>
                <p style="color: ${avgEfficiency >= 90 ? '#22c55e' : avgEfficiency >= 70 ? '#f59e0b' : '#ef4444'}; font-size: 24px; font-weight: bold; margin: 0;">${avgEfficiency}%</p>
                <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">${avgEfficiency >= 90 ? 'On Target' : avgEfficiency >= 70 ? 'Needs Attention' : 'Below Target'}</p>
              </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
              <tr style="background: #f1f5f9;">
                <td style="padding: 10px 12px; font-weight: 600; color: #475569; font-size: 12px;">Metric</td>
                <td style="padding: 10px 12px; font-weight: 600; color: #475569; font-size: 12px; text-align: right;">Value</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; color: #64748b; border-top: 1px solid #e2e8f0;">Finishing (Poly)</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 600; border-top: 1px solid #e2e8f0;">${totalFinishingPoly.toLocaleString()} pcs</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; color: #64748b; border-top: 1px solid #e2e8f0;">Cutting Output</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 600; border-top: 1px solid #e2e8f0;">${totalCuttingOutput.toLocaleString()} pcs</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; color: #64748b; border-top: 1px solid #e2e8f0;">Total Rejects</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: #ef4444; border-top: 1px solid #e2e8f0;">${totalRejects.toLocaleString()} pcs</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; color: #64748b; border-top: 1px solid #e2e8f0;">Sewing Submissions</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 600; border-top: 1px solid #e2e8f0;">${(sewingTargets || []).length} targets, ${(sewingActuals || []).length} actuals</td>
              </tr>
              <tr>
                <td style="padding: 10px 12px; color: #64748b; border-top: 1px solid #e2e8f0;">Finishing Submissions</td>
                <td style="padding: 10px 12px; text-align: right; font-weight: 600; border-top: 1px solid #e2e8f0;">${(finishingTargets || []).length} targets, ${(finishingDailySheets || []).length} sheets</td>
              </tr>
            </table>
            
            <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e293b;">📎 Attachments</p>
              <p style="margin: 0; color: #64748b; font-size: 14px;">• <strong>PDF Report</strong> - Detailed insights with charts and analysis</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">• <strong>CSV Data</strong> - All submissions for the ${scheduleType === "monthly" ? "last 30 days" : "week"}</p>
            </div>
          </div>
          
          <div style="background: #1e293b; padding: 16px; border-radius: 0 0 12px 12px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">This report was automatically generated by your production tracking system.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${scheduleType}-insights-${startDateStr}-to-${todayStr}.pdf`,
          content: pdfBase64,
        },
        {
          filename: `${scheduleType}-submissions-${startDateStr}-to-${todayStr}.csv`,
          content: csvBase64,
        },
      ],
    });

    console.log(`${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)} email sent successfully:`, emailResponse);

    if (userId) {
      await supabase
        .from("email_schedules")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("schedule_type", scheduleType);
    }

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-insights-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
