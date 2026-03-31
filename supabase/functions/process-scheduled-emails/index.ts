import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/security.ts";

// This function is designed to be called by an external cron service (e.g., cron-job.org)
// It checks which email schedules are due based on factory timezones and triggers them

const handler = async (req: Request): Promise<Response> => {
  console.log("process-scheduled-emails function called");

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current UTC time
    const nowUTC = new Date();
    console.log("Current UTC time:", nowUTC.toISOString());

    // Get all active email schedules with factory timezone info
    const { data: schedules, error: schedulesError } = await supabase
      .from("email_schedules")
      .select(`
        id,
        user_id,
        email,
        factory_id,
        schedule_type,
        send_time,
        day_of_week,
        day_of_month,
        is_active,
        last_sent_at,
        factory_accounts!inner(timezone, name)
      `)
      .eq("is_active", true);

    if (schedulesError) {
      console.error("Error fetching schedules:", schedulesError);
      throw schedulesError;
    }

    console.log(`Found ${schedules?.length || 0} active schedules`);

    const processedEmails: string[] = [];
    const errors: string[] = [];

    for (const schedule of schedules || []) {
      try {
        const factoryAccount = schedule.factory_accounts as unknown as { timezone: string; name: string } | null;
        const factoryTimezone = factoryAccount?.timezone || "UTC";
        const scheduledTime = schedule.send_time; // e.g., "18:00:00"
        const dayOfWeek = schedule.day_of_week; // 0 = Sunday, 6 = Saturday
        const dayOfMonth = schedule.day_of_month; // 1-28 for monthly
        const scheduleType = schedule.schedule_type;

        // Get current time in factory timezone
        const factoryNow = new Date(nowUTC.toLocaleString("en-US", { timeZone: factoryTimezone }));
        const factoryHour = factoryNow.getHours();
        const factoryMinute = factoryNow.getMinutes();
        const factoryDayOfWeek = factoryNow.getDay();
        const factoryDayOfMonth = factoryNow.getDate();
        const factoryDateStr = factoryNow.toISOString().split("T")[0];

        // Parse scheduled time
        const [scheduledHour, scheduledMinute] = scheduledTime.split(":").map(Number);

        console.log(`Schedule ${schedule.id}: Factory TZ=${factoryTimezone}, Current=${factoryHour}:${factoryMinute}, Scheduled=${scheduledHour}:${scheduledMinute}, Day=${factoryDayOfWeek}`);

        // Check if it's time to send
        let shouldSend = false;

        if (scheduleType === "daily") {
          // Daily: check if current hour:minute matches scheduled time (within 5 min window)
          if (factoryHour === scheduledHour && factoryMinute >= scheduledMinute && factoryMinute < scheduledMinute + 5) {
            shouldSend = true;
          }
        } else if (scheduleType === "weekly") {
          // Weekly: check if day of week and time match
          if (factoryDayOfWeek === dayOfWeek && factoryHour === scheduledHour && factoryMinute >= scheduledMinute && factoryMinute < scheduledMinute + 5) {
            shouldSend = true;
          }
        } else if (scheduleType === "monthly") {
          // Monthly: check if day of month and time match
          if (factoryDayOfMonth === dayOfMonth && factoryHour === scheduledHour && factoryMinute >= scheduledMinute && factoryMinute < scheduledMinute + 5) {
            shouldSend = true;
          }
        }

        // Check if already sent today/this period
        if (shouldSend && schedule.last_sent_at) {
          const lastSent = new Date(schedule.last_sent_at);
          const lastSentDateStr = lastSent.toISOString().split("T")[0];
          
          if (scheduleType === "daily") {
            // Don't send if already sent today
            if (lastSentDateStr === factoryDateStr) {
              console.log(`Schedule ${schedule.id}: Already sent today, skipping`);
              shouldSend = false;
            }
          } else if (scheduleType === "weekly") {
            // Don't send if sent within last 6 days
            const daysDiff = Math.floor((nowUTC.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff < 6) {
              console.log(`Schedule ${schedule.id}: Already sent ${daysDiff} days ago, skipping`);
              shouldSend = false;
            }
          } else if (scheduleType === "monthly") {
            // Don't send if sent within last 27 days
            const daysDiff = Math.floor((nowUTC.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff < 27) {
              console.log(`Schedule ${schedule.id}: Already sent ${daysDiff} days ago, skipping`);
              shouldSend = false;
            }
          }
        }

        if (shouldSend) {
          console.log(`Schedule ${schedule.id}: Triggering ${scheduleType} email to ${schedule.email}`);

          // Call the send-insights-report function
          const response = await fetch(`${supabaseUrl}/functions/v1/send-insights-report`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              email: schedule.email,
              factoryId: schedule.factory_id,
              scheduleType: schedule.schedule_type,
              userId: schedule.user_id,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send email for schedule ${schedule.id}:`, errorText);
            errors.push(`Schedule ${schedule.id}: ${errorText}`);
          } else {
            console.log(`Successfully triggered email for schedule ${schedule.id}`);
            processedEmails.push(`${schedule.email} (${scheduleType})`);

            // Update last_sent_at timestamp
            const { error: updateError } = await supabase
              .from("email_schedules")
              .update({ last_sent_at: nowUTC.toISOString() })
              .eq("id", schedule.id);

            if (updateError) {
              console.error(`Failed to update last_sent_at for schedule ${schedule.id}:`, updateError);
            }
          }
        }
      } catch (scheduleError: any) {
        console.error(`Error processing schedule ${schedule.id}:`, scheduleError);
        errors.push(`Schedule ${schedule.id}: ${scheduleError?.message || "Unknown error"}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedEmails.length,
        emails: processedEmails,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: nowUTC.toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in process-scheduled-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
