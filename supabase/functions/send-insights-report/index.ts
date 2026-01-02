import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InsightsData {
  factoryName: string;
  periodDays: number;
  totalSewingOutput: number;
  totalQcPass: number;
  avgEfficiency: number;
  totalBlockers: number;
  openBlockers: number;
  resolvedBlockers: number;
  topPerformingLine: string | null;
  worstPerformingLine: string | null;
  linePerformance: Array<{
    lineName: string;
    efficiency: number;
    totalOutput: number;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-insights-report function called");

  // Handle CORS preflight requests
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

    // Calculate date range based on schedule type
    const now = new Date();
    const days = scheduleType === "weekly" ? 7 : 1;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    // Fetch sewing data
    const { data: sewingData } = await supabase
      .from("production_updates_sewing")
      .select("*, lines(name, line_id)")
      .eq("factory_id", factoryId)
      .gte("production_date", startDateStr)
      .lte("production_date", todayStr);

    // Fetch finishing data
    const { data: finishingData } = await supabase
      .from("production_updates_finishing")
      .select("*")
      .eq("factory_id", factoryId)
      .gte("production_date", startDateStr)
      .lte("production_date", todayStr);

    // Calculate insights
    const totalSewingOutput = sewingData?.reduce((sum, u) => sum + (u.output_qty || 0), 0) || 0;
    const totalSewingTarget = sewingData?.reduce((sum, u) => sum + (u.target_qty || 0), 0) || 0;
    const totalQcPass = finishingData?.reduce((sum, u) => sum + (u.day_qc_pass || 0), 0) || 0;
    const avgEfficiency = totalSewingTarget > 0 ? Math.round((totalSewingOutput / totalSewingTarget) * 100) : 0;

    const allBlockers = [
      ...(sewingData?.filter((u) => u.has_blocker) || []),
      ...(finishingData?.filter((u) => u.has_blocker) || []),
    ];
    const totalBlockers = allBlockers.length;
    const openBlockers = allBlockers.filter((b) => b.blocker_status !== "resolved").length;
    const resolvedBlockers = allBlockers.filter((b) => b.blocker_status === "resolved").length;

    // Calculate line performance
    const lineMap = new Map<string, { lineName: string; output: number; target: number }>();
    sewingData?.forEach((u) => {
      const lineId = u.line_id;
      const lineName = u.lines?.name || u.lines?.line_id || "Unknown";
      const existing = lineMap.get(lineId) || { lineName, output: 0, target: 0 };
      existing.output += u.output_qty || 0;
      existing.target += u.target_qty || 0;
      lineMap.set(lineId, existing);
    });

    const linePerformance = Array.from(lineMap.values())
      .map((l) => ({
        lineName: l.lineName,
        efficiency: l.target > 0 ? Math.round((l.output / l.target) * 100) : 0,
        totalOutput: l.output,
      }))
      .sort((a, b) => b.efficiency - a.efficiency);

    const topPerformingLine = linePerformance[0]?.lineName || null;
    const worstPerformingLine = linePerformance[linePerformance.length - 1]?.lineName || null;

    // Generate email HTML
    const periodLabel = scheduleType === "weekly" ? "Weekly" : "Daily";
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 8px 0 0; opacity: 0.9; }
    .content { padding: 32px; }
    .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .metric { background: #f8fafc; border-radius: 8px; padding: 16px; text-align: center; }
    .metric-value { font-size: 28px; font-weight: bold; color: #1e293b; }
    .metric-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 4px; }
    .efficiency-good { color: #22c55e; }
    .efficiency-warning { color: #f59e0b; }
    .efficiency-bad { color: #ef4444; }
    .section { margin-top: 24px; }
    .section h3 { font-size: 16px; color: #1e293b; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    .line-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .line-name { font-weight: 500; }
    .line-efficiency { font-weight: bold; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-warning { background: #fef3c7; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${periodLabel} Production Insights</h1>
      <p>${factoryName} • ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric">
          <div class="metric-value">${totalSewingOutput.toLocaleString()}</div>
          <div class="metric-label">Total Output</div>
        </div>
        <div class="metric">
          <div class="metric-value ${avgEfficiency >= 90 ? "efficiency-good" : avgEfficiency >= 70 ? "efficiency-warning" : "efficiency-bad"}">${avgEfficiency}%</div>
          <div class="metric-label">Avg Efficiency</div>
        </div>
        <div class="metric">
          <div class="metric-value">${totalQcPass.toLocaleString()}</div>
          <div class="metric-label">QC Pass</div>
        </div>
        <div class="metric">
          <div class="metric-value">${totalBlockers}</div>
          <div class="metric-label">Blockers (${openBlockers} open)</div>
        </div>
      </div>
      
      ${topPerformingLine ? `
      <div class="section">
        <h3>🏆 Performance Highlights</h3>
        <p>
          <strong>Top Performer:</strong> ${topPerformingLine} 
          <span class="badge badge-success">${linePerformance[0]?.efficiency}%</span>
        </p>
        ${worstPerformingLine && worstPerformingLine !== topPerformingLine ? `
        <p>
          <strong>Needs Attention:</strong> ${worstPerformingLine}
          <span class="badge badge-warning">${linePerformance[linePerformance.length - 1]?.efficiency}%</span>
        </p>
        ` : ""}
      </div>
      ` : ""}
      
      ${linePerformance.length > 0 ? `
      <div class="section">
        <h3>📈 Line Performance</h3>
        ${linePerformance.slice(0, 5).map((line) => `
          <div class="line-row">
            <span class="line-name">${line.lineName}</span>
            <span class="line-efficiency ${line.efficiency >= 90 ? "efficiency-good" : line.efficiency >= 70 ? "efficiency-warning" : "efficiency-bad"}">${line.efficiency}% • ${line.totalOutput.toLocaleString()} pcs</span>
          </div>
        `).join("")}
      </div>
      ` : ""}
    </div>
    <div class="footer">
      <p>This report was automatically generated by your production tracking system.</p>
      <p>View full insights in your dashboard.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Production Insights <onboarding@resend.dev>",
      to: [email],
      subject: `${periodLabel} Production Report - ${factoryName}`,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

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
