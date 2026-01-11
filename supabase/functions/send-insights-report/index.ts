import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LineData {
  id: string;
  line_id: string;
  name: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-insights-report function called");

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
    const days = scheduleType === "weekly" ? 7 : 1;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    // Fetch all submission data
    const [
      { data: sewingTargets },
      { data: sewingActuals },
      { data: finishingTargets },
      { data: finishingActuals },
      { data: cuttingTargets },
      { data: cuttingActuals },
      { data: finishingDailySheets },
    ] = await Promise.all([
      supabase
        .from("sewing_targets")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr),
      supabase
        .from("sewing_actuals")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr),
      supabase
        .from("finishing_targets")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr),
      supabase
        .from("finishing_actuals")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr),
      supabase
        .from("cutting_targets")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr),
      supabase
        .from("cutting_actuals")
        .select("*, lines(name, line_id)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr),
      supabase
        .from("finishing_daily_sheets")
        .select("*, lines(name, line_id), finishing_hourly_logs(*)")
        .eq("factory_id", factoryId)
        .gte("production_date", startDateStr)
        .lte("production_date", todayStr),
    ]);

    // Helper to get line name
    const getLineName = (lineId: string): string => {
      const line = lines.find(l => l.id === lineId);
      return line?.name || line?.line_id || "Unknown";
    };

    // Helper to find missing submissions
    const findMissingLines = (submissions: any[], dateStr: string, lineKey = "line_id"): string[] => {
      const submittedLineIds = new Set(submissions
        .filter(s => s.production_date === dateStr)
        .map(s => s[lineKey]));
      return lines.filter(l => !submittedLineIds.has(l.id)).map(l => l.name || l.line_id);
    };

    if (scheduleType === "daily") {
      // Generate CSV for daily report
      const csvRows: string[] = [];
      
      // Header
      csvRows.push("Department,Type,Date,Line,PO Number,Buyer,Style,Status,Key Metrics");
      
      // Sewing Targets
      (sewingTargets || []).forEach(t => {
        const lineName = t.lines?.name || t.lines?.line_id || "Unknown";
        csvRows.push(`Sewing,Morning Target,${t.production_date},${lineName},${t.work_order_id || ""},${t.buyer_name || ""},${t.style_code || ""},Submitted,"Target: ${t.per_hour_target}/hr, Manpower: ${t.manpower_planned}"`);
      });
      
      // Missing Sewing Targets
      const missingSewingTargets = findMissingLines(sewingTargets || [], todayStr);
      missingSewingTargets.forEach(lineName => {
        csvRows.push(`Sewing,Morning Target,${todayStr},${lineName},,,,Missing,`);
      });
      
      // Sewing Actuals
      (sewingActuals || []).forEach(a => {
        const lineName = a.lines?.name || a.lines?.line_id || "Unknown";
        csvRows.push(`Sewing,End of Day,${a.production_date},${lineName},${a.work_order_id || ""},${a.buyer_name || ""},${a.style_code || ""},Submitted,"Output: ${a.good_today}, Reject: ${a.reject_today}, Rework: ${a.rework_today}"`);
      });
      
      // Missing Sewing Actuals
      const missingSewingActuals = findMissingLines(sewingActuals || [], todayStr);
      missingSewingActuals.forEach(lineName => {
        csvRows.push(`Sewing,End of Day,${todayStr},${lineName},,,,Missing,`);
      });
      
      // Finishing Targets
      (finishingTargets || []).forEach(t => {
        const lineName = t.lines?.name || t.lines?.line_id || "Unknown";
        csvRows.push(`Finishing,Morning Target,${t.production_date},${lineName},${t.work_order_id || ""},${t.buyer_name || ""},${t.style_no || ""},Submitted,"Target: ${t.per_hour_target}/hr, M-Power: ${t.m_power_planned}"`);
      });
      
      // Missing Finishing Targets
      const missingFinishingTargets = findMissingLines(finishingTargets || [], todayStr);
      missingFinishingTargets.forEach(lineName => {
        csvRows.push(`Finishing,Morning Target,${todayStr},${lineName},,,,Missing,`);
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
        csvRows.push(`Cutting,Morning Target,${t.production_date},${lineName},${t.work_order_id || ""},${t.buyer || ""},${t.style || ""},Submitted,"Manpower: ${t.man_power}, Cutting Cap: ${t.cutting_capacity}"`);
      });
      
      // Cutting Actuals
      (cuttingActuals || []).forEach(a => {
        const lineName = a.lines?.name || a.lines?.line_id || "Unknown";
        csvRows.push(`Cutting,End of Day,${a.production_date},${lineName},${a.work_order_id || ""},${a.buyer || ""},${a.style || ""},Submitted,"Day Cut: ${a.day_cutting}, Day Input: ${a.day_input}, Balance: ${a.balance || 0}"`);
      });
      
      const csvContent = csvRows.join("\n");
      const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));

      // Send email with CSV attachment
      const emailResponse = await resend.emails.send({
        from: "Production Reports <onboarding@resend.dev>",
        to: [email],
        subject: `Daily Production Report - ${factoryName} - ${todayStr}`,
        html: `
          <h2>Daily Production Report</h2>
          <p><strong>${factoryName}</strong> - ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <p>Please find attached the daily submissions report including all completed and missing submissions.</p>
          <h3>Summary</h3>
          <ul>
            <li>Sewing Targets: ${(sewingTargets || []).length} submitted, ${missingSewingTargets.length} missing</li>
            <li>Sewing Actuals: ${(sewingActuals || []).length} submitted, ${missingSewingActuals.length} missing</li>
            <li>Finishing Targets: ${(finishingTargets || []).length} submitted, ${missingFinishingTargets.length} missing</li>
            <li>Finishing Daily Sheets: ${(finishingDailySheets || []).length} submitted</li>
            <li>Cutting Targets: ${(cuttingTargets || []).length} submitted</li>
            <li>Cutting Actuals: ${(cuttingActuals || []).length} submitted</li>
          </ul>
          <p style="color: #666; font-size: 12px;">This report was automatically generated by your production tracking system.</p>
        `,
        attachments: [
          {
            filename: `daily-report-${todayStr}.csv`,
            content: csvBase64,
          },
        ],
      });

      console.log("Daily email with CSV sent successfully:", emailResponse);

      // Update last_sent_at
      if (userId) {
        await supabase
          .from("email_schedules")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("schedule_type", scheduleType);
      }

      return new Response(
        JSON.stringify({ success: true, emailResponse }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    } else {
      // Generate PDF for weekly report
      const doc = new jsPDF();
      let yPos = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);

      // Helper to add new page if needed
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > 270) {
          doc.addPage();
          yPos = 20;
        }
      };

      // Title Page
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Weekly Production Report", pageWidth / 2, 60, { align: "center" });
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "normal");
      doc.text(factoryName, pageWidth / 2, 75, { align: "center" });
      
      doc.setFontSize(12);
      doc.text(`${startDateStr} to ${todayStr}`, pageWidth / 2, 90, { align: "center" });
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 100, { align: "center" });

      // Calculate insights
      const totalSewingOutput = (sewingActuals || []).reduce((sum, a) => sum + (a.good_today || 0), 0);
      const totalSewingTarget = (sewingTargets || []).reduce((sum, t) => sum + ((t.per_hour_target || 0) * 8), 0);
      const avgEfficiency = totalSewingTarget > 0 ? Math.round((totalSewingOutput / totalSewingTarget) * 100) : 0;
      
      const totalFinishingPoly = (finishingDailySheets || []).reduce((sum, s) => {
        const logs = s.finishing_hourly_logs || [];
        return sum + logs.reduce((lSum: number, l: any) => lSum + (l.poly_actual || 0), 0);
      }, 0);
      
      const totalCuttingOutput = (cuttingActuals || []).reduce((sum, a) => sum + (a.day_cutting || 0), 0);

      // Page 2: Executive Summary
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Executive Summary", margin, yPos);
      yPos += 15;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      
      const summaryData = [
        ["Total Sewing Output", `${totalSewingOutput.toLocaleString()} pcs`],
        ["Average Efficiency", `${avgEfficiency}%`],
        ["Total Finishing (Poly)", `${totalFinishingPoly.toLocaleString()} pcs`],
        ["Total Cutting Output", `${totalCuttingOutput.toLocaleString()} pcs`],
        ["Sewing Submissions", `${(sewingTargets || []).length} targets, ${(sewingActuals || []).length} actuals`],
        ["Finishing Submissions", `${(finishingTargets || []).length} targets, ${(finishingDailySheets || []).length} sheets`],
        ["Cutting Submissions", `${(cuttingTargets || []).length} targets, ${(cuttingActuals || []).length} actuals`],
      ];

      summaryData.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label + ":", margin, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(value, margin + 80, yPos);
        yPos += 8;
      });

      // Page 3: Sewing Department
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Sewing Department", margin, yPos);
      yPos += 15;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Morning Targets", margin, yPos);
      yPos += 8;
      
      doc.setFont("helvetica", "normal");
      (sewingTargets || []).slice(0, 20).forEach(t => {
        checkPageBreak(8);
        const lineName = t.lines?.name || t.lines?.line_id || "Unknown";
        doc.text(`${t.production_date} | ${lineName} | Target: ${t.per_hour_target}/hr | MP: ${t.manpower_planned}`, margin, yPos);
        yPos += 6;
      });

      yPos += 10;
      checkPageBreak(20);
      doc.setFont("helvetica", "bold");
      doc.text("End of Day Actuals", margin, yPos);
      yPos += 8;
      
      doc.setFont("helvetica", "normal");
      (sewingActuals || []).slice(0, 20).forEach(a => {
        checkPageBreak(8);
        const lineName = a.lines?.name || a.lines?.line_id || "Unknown";
        doc.text(`${a.production_date} | ${lineName} | Output: ${a.good_today} | Reject: ${a.reject_today}`, margin, yPos);
        yPos += 6;
      });

      // Page 4: Finishing Department
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Finishing Department", margin, yPos);
      yPos += 15;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Daily Sheets", margin, yPos);
      yPos += 8;
      
      doc.setFont("helvetica", "normal");
      (finishingDailySheets || []).slice(0, 20).forEach(s => {
        checkPageBreak(8);
        const lineName = s.lines?.name || s.lines?.line_id || "Unknown";
        const logs = s.finishing_hourly_logs || [];
        const totalPoly = logs.reduce((sum: number, l: any) => sum + (l.poly_actual || 0), 0);
        doc.text(`${s.production_date} | ${lineName} | Hours: ${logs.length} | Poly: ${totalPoly}`, margin, yPos);
        yPos += 6;
      });

      // Page 5: Cutting Department
      doc.addPage();
      yPos = 20;
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Cutting Department", margin, yPos);
      yPos += 15;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Cutting Actuals", margin, yPos);
      yPos += 8;
      
      doc.setFont("helvetica", "normal");
      (cuttingActuals || []).slice(0, 20).forEach(a => {
        checkPageBreak(8);
        const lineName = a.lines?.name || a.lines?.line_id || "Unknown";
        doc.text(`${a.production_date} | ${lineName} | Cut: ${a.day_cutting} | Input: ${a.day_input} | Bal: ${a.balance || 0}`, margin, yPos);
        yPos += 6;
      });

      // Generate PDF as base64
      const pdfOutput = doc.output("datauristring");
      const pdfBase64 = pdfOutput.split(",")[1];

      // Send email with PDF attachment
      const emailResponse = await resend.emails.send({
        from: "Production Reports <onboarding@resend.dev>",
        to: [email],
        subject: `Weekly Production Report - ${factoryName} - Week of ${startDateStr}`,
        html: `
          <h2>Weekly Production Report</h2>
          <p><strong>${factoryName}</strong></p>
          <p>Period: ${startDateStr} to ${todayStr}</p>
          <p>Please find attached the comprehensive weekly production report with detailed insights.</p>
          <h3>Quick Summary</h3>
          <ul>
            <li><strong>Total Sewing Output:</strong> ${totalSewingOutput.toLocaleString()} pcs</li>
            <li><strong>Average Efficiency:</strong> ${avgEfficiency}%</li>
            <li><strong>Total Finishing (Poly):</strong> ${totalFinishingPoly.toLocaleString()} pcs</li>
            <li><strong>Total Cutting Output:</strong> ${totalCuttingOutput.toLocaleString()} pcs</li>
          </ul>
          <p>The attached PDF contains detailed breakdowns by department including all submissions from the week.</p>
          <p style="color: #666; font-size: 12px;">This report was automatically generated by your production tracking system.</p>
        `,
        attachments: [
          {
            filename: `weekly-report-${startDateStr}-to-${todayStr}.pdf`,
            content: pdfBase64,
          },
        ],
      });

      console.log("Weekly email with PDF sent successfully:", emailResponse);

      // Update last_sent_at
      if (userId) {
        await supabase
          .from("email_schedules")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("schedule_type", scheduleType);
      }

      return new Response(
        JSON.stringify({ success: true, emailResponse }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in send-insights-report function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
