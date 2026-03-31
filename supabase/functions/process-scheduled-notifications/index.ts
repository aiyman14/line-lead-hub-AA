import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/security.ts";

// This function is designed to be called by an external cron service (e.g., cron-job.org)
// every 5 minutes. It checks factory timezones and triggers:
// 1. late_submission notifications (cutoff + 30 min)
// 2. daily_summary notifications (cutoff + 60 min)

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SCHEDULED-NOTIFICATIONS] ${step}${detailsStr}`);
};

const handler = async (req: Request): Promise<Response> => {
  logStep("Function called");

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const nowUTC = new Date();
    logStep("Current UTC time", nowUTC.toISOString());

    // Get all factories with timezone and cutoff settings
    const { data: factories, error: factoriesError } = await supabase
      .from("factory_accounts")
      .select("id, name, timezone, evening_actual_cutoff")
      .in("subscription_status", ["active", "trialing", "trial"]);

    if (factoriesError) throw factoriesError;

    logStep("Factories found", { count: factories?.length || 0 });

    const results = { lateSubmissions: 0, dailySummaries: 0, errors: [] as string[] };

    for (const factory of factories || []) {
      try {
        const tz = factory.timezone || "Asia/Dhaka";
        const factoryNow = new Date(nowUTC.toLocaleString("en-US", { timeZone: tz }));
        const factoryHour = factoryNow.getHours();
        const factoryMinute = factoryNow.getMinutes();
        const todayStr = factoryNow.toISOString().split("T")[0];

        // Parse cutoff time (default 18:00)
        const [cutoffHour, cutoffMin] = (factory.evening_actual_cutoff || "18:00:00")
          .split(":")
          .map(Number);

        // --- LATE SUBMISSION CHECK (cutoff + 30 min, within 5-min window) ---
        const lateMinTotal = cutoffHour * 60 + cutoffMin + 30;
        const lateHour = Math.floor(lateMinTotal / 60) % 24;
        const lateMin = lateMinTotal % 60;

        if (factoryHour === lateHour && factoryMinute >= lateMin && factoryMinute < lateMin + 5) {
          await processLateSubmissions(supabase, factory.id, factory.name, todayStr, nowUTC, results);
        }

        // --- DAILY SUMMARY CHECK (cutoff + 60 min, within 5-min window) ---
        const summaryMinTotal = cutoffHour * 60 + cutoffMin + 60;
        const summaryHour = Math.floor(summaryMinTotal / 60) % 24;
        const summaryMin = summaryMinTotal % 60;

        if (factoryHour === summaryHour && factoryMinute >= summaryMin && factoryMinute < summaryMin + 5) {
          await processDailySummary(supabase, factory.id, factory.name, todayStr, nowUTC, results);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logStep(`Error processing factory ${factory.id}`, msg);
        results.errors.push(`Factory ${factory.name}: ${msg}`);
      }
    }

    logStep("Completed", results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        timestamp: nowUTC.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

// --- Late Submission Logic ---
async function processLateSubmissions(
  supabase: any,
  factoryId: string,
  factoryName: string,
  todayStr: string,
  nowUTC: Date,
  results: { lateSubmissions: number; errors: string[] }
) {
  logStep(`Checking late submissions for ${factoryName}`);

  // Check if we already sent late_submission notifications for today
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("factory_id", factoryId)
    .eq("type", "late_submission")
    .gte("created_at", `${todayStr}T00:00:00Z`)
    .limit(1);

  if (existing && existing.length > 0) {
    logStep(`Late submission notifications already sent today for ${factoryName}`);
    return;
  }

  // Get all active lines for this factory
  const { data: lines } = await supabase
    .from("lines")
    .select("id, name, line_id, department")
    .eq("factory_id", factoryId)
    .eq("is_active", true);

  if (!lines || lines.length === 0) return;

  // Check which lines have submitted today (sewing_actuals + finishing_actuals)
  const { data: sewingSubmissions } = await supabase
    .from("sewing_actuals")
    .select("line_id")
    .eq("factory_id", factoryId)
    .eq("production_date", todayStr);

  const { data: finishingSubmissions } = await supabase
    .from("finishing_actuals")
    .select("line_id")
    .eq("factory_id", factoryId)
    .eq("production_date", todayStr);

  const submittedLineIds = new Set([
    ...(sewingSubmissions || []).map((s: any) => s.line_id),
    ...(finishingSubmissions || []).map((s: any) => s.line_id),
  ]);

  const missingLines = (lines as any[]).filter((l) => !submittedLineIds.has(l.id));

  if (missingLines.length === 0) {
    logStep(`All lines submitted for ${factoryName}`);
    return;
  }

  logStep(`${missingLines.length} lines missing submissions in ${factoryName}`);

  // Find admin/owner users with late_submission preference enabled
  const { data: adminUsers } = await supabase
    .from("profiles")
    .select("id")
    .eq("factory_id", factoryId)
    .eq("is_active", true);

  if (!adminUsers) return;

  // Filter to admin/owner roles
  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "owner"])
    .in(
      "user_id",
      (adminUsers as any[]).map((u) => u.id)
    );

  if (!adminRoles || adminRoles.length === 0) return;

  const adminUserIds = (adminRoles as any[]).map((r) => r.user_id);

  // Check preferences for each admin
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, in_app_enabled")
    .eq("notification_type", "late_submission")
    .in("user_id", adminUserIds);

  const prefsMap = new Map(
    (prefs || []).map((p: any) => [
      p.user_id,
      p.in_app_enabled,
    ])
  );

  const missingLineNames = missingLines
    .map((l: any) => l.name || l.line_id)
    .slice(0, 5);
  const moreCount = missingLines.length > 5 ? missingLines.length - 5 : 0;
  const linesSummary = missingLineNames.join(", ") + (moreCount > 0 ? ` +${moreCount} more` : "");

  const notifications = [];
  for (const userId of adminUserIds) {
    // Default to true if no preference set
    const enabled = prefsMap.get(userId) ?? true;
    if (enabled === false) continue;

    notifications.push({
      factory_id: factoryId,
      user_id: userId,
      title: "Late Submission Alert",
      message: `${missingLines.length} line${missingLines.length === 1 ? "" : "s"} missing end-of-day submissions: ${linesSummary}`,
      type: "late_submission",
      data: {
        production_date: todayStr,
        missing_count: missingLines.length,
        missing_lines: missingLines.map((l: any) => ({
          id: l.id,
          name: l.name || l.line_id,
        })),
      },
    });
  }

  if (notifications.length > 0) {
    const { error } = await supabase.from("notifications").insert(notifications);
    if (error) {
      logStep("Error inserting late submission notifications", error.message);
      results.errors.push(`Late submissions for ${factoryName}: ${error.message}`);
    } else {
      results.lateSubmissions += notifications.length;
      logStep(`Sent ${notifications.length} late submission notifications for ${factoryName}`);
    }
  }
}

// --- Daily Summary Logic ---
async function processDailySummary(
  supabase: any,
  factoryId: string,
  factoryName: string,
  todayStr: string,
  nowUTC: Date,
  results: { dailySummaries: number; errors: string[] }
) {
  logStep(`Generating daily summary for ${factoryName}`);

  // Check if we already sent daily_summary notifications for today
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("factory_id", factoryId)
    .eq("type", "daily_summary")
    .gte("created_at", `${todayStr}T00:00:00Z`)
    .limit(1);

  if (existing && existing.length > 0) {
    logStep(`Daily summary already sent today for ${factoryName}`);
    return;
  }

  // Get active lines count
  const { count: totalLines } = await supabase
    .from("lines")
    .select("id", { count: "exact", head: true })
    .eq("factory_id", factoryId)
    .eq("is_active", true);

  // Get today's sewing actuals (correct column: good_today)
  const { data: sewingActuals } = await supabase
    .from("sewing_actuals")
    .select("line_id, good_today, has_blocker")
    .eq("factory_id", factoryId)
    .eq("production_date", todayStr);

  // Get today's sewing targets for efficiency calculation
  const { data: sewingTargetRows } = await supabase
    .from("sewing_targets")
    .select("line_id, per_hour_target, hours_planned, target_total_planned")
    .eq("factory_id", factoryId)
    .eq("production_date", todayStr);

  // Get today's finishing actuals (correct column: day_qc_pass)
  const { data: finishingActuals } = await supabase
    .from("finishing_actuals")
    .select("line_id, day_qc_pass, has_blocker")
    .eq("factory_id", factoryId)
    .eq("production_date", todayStr);

  // Count active blockers from both tables
  const activeBlockers =
    (sewingActuals || []).filter((r: any) => r.has_blocker).length +
    (finishingActuals || []).filter((r: any) => r.has_blocker).length;

  // Aggregate stats using correct column names
  const sewingOutput = (sewingActuals || []).reduce(
    (sum: number, r: { good_today: number | null }) => sum + (r.good_today || 0),
    0
  );
  const sewingTarget = (sewingTargetRows || []).reduce(
    (sum: number, r: { target_total_planned: number | null; per_hour_target: number | null; hours_planned: number | null }) =>
      sum + (r.target_total_planned ?? (r.per_hour_target || 0) * (r.hours_planned || 8)),
    0
  );
  const finishingOutput = (finishingActuals || []).reduce(
    (sum: number, r: { day_qc_pass: number | null }) => sum + (r.day_qc_pass || 0),
    0
  );

  const submittedLineIds = new Set([
    ...(sewingActuals || []).map((s: { line_id: string }) => s.line_id),
    ...(finishingActuals || []).map((s: { line_id: string }) => s.line_id),
  ]);
  const missingLines = (totalLines || 0) - submittedLineIds.size;
  const avgEfficiency = sewingTarget > 0 ? Math.round((sewingOutput / sewingTarget) * 100) : 0;

  // Build summary message
  const parts = [];
  if (sewingOutput > 0) parts.push(`Sewing: ${sewingOutput.toLocaleString()} pcs (${avgEfficiency}% eff)`);
  if (finishingOutput > 0) parts.push(`Finishing: ${finishingOutput.toLocaleString()} pcs`);
  if (activeBlockers && activeBlockers > 0) parts.push(`${activeBlockers} active blocker${activeBlockers === 1 ? "" : "s"}`);
  if (missingLines > 0) parts.push(`${missingLines} line${missingLines === 1 ? "" : "s"} missing`);
  const summaryMessage = parts.length > 0 ? parts.join(" | ") : "No production data submitted today";

  // Find users with daily_summary preference enabled
  const { data: adminUsers } = await supabase
    .from("profiles")
    .select("id")
    .eq("factory_id", factoryId)
    .eq("is_active", true);

  if (!adminUsers) return;

  const { data: adminRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "owner"])
    .in(
      "user_id",
      adminUsers.map((u: { id: string }) => u.id)
    );

  if (!adminRoles || adminRoles.length === 0) return;

  const adminUserIds = adminRoles.map((r: { user_id: string }) => r.user_id);

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, in_app_enabled")
    .eq("notification_type", "daily_summary")
    .in("user_id", adminUserIds);

  const prefsMap = new Map(
    (prefs || []).map((p: { user_id: string; in_app_enabled: boolean | null }) => [
      p.user_id,
      p.in_app_enabled,
    ])
  );

  const notifications = [];
  for (const userId of adminUserIds) {
    const enabled = prefsMap.get(userId) ?? true;
    if (enabled === false) continue;

    notifications.push({
      factory_id: factoryId,
      user_id: userId,
      title: "Daily Production Summary",
      message: summaryMessage,
      type: "daily_summary",
      data: {
        production_date: todayStr,
        sewing_output: sewingOutput,
        sewing_target: sewingTarget,
        finishing_output: finishingOutput,
        avg_efficiency: avgEfficiency,
        active_blockers: activeBlockers,
        missing_lines: missingLines,
        total_lines: totalLines || 0,
        lines_submitted: submittedLineIds.size,
      },
    });
  }

  if (notifications.length > 0) {
    const { error } = await supabase.from("notifications").insert(notifications);
    if (error) {
      logStep("Error inserting daily summary notifications", error.message);
      results.errors.push(`Daily summary for ${factoryName}: ${error.message}`);
    } else {
      results.dailySummaries += notifications.length;
      logStep(`Sent ${notifications.length} daily summary notifications for ${factoryName}`);
    }
  }
}

serve(handler);
