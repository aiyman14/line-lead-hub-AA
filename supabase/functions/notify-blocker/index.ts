import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resendClient = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const blockerNotificationSchema = z.object({
  factoryId: z.string().uuid("Invalid factory ID"),
  lineName: z.string().min(1, "Line name is required"),
  poNumber: z.string().optional(),
  blockerType: z.string().min(1, "Blocker type is required"),
  blockerImpact: z.enum(["low", "medium", "high", "critical"]),
  blockerDescription: z.string().min(1, "Description is required"),
  submittedBy: z.string().min(1, "Submitter name is required"),
  department: z.enum(["sewing", "finishing"]),
});

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validate input
    const validation = blockerNotificationSchema.safeParse(rawBody);
    
    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message).join(", ");
      console.error("Validation failed:", errors);
      return new Response(
        JSON.stringify({ success: false, error: `Invalid input: ${errors}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { 
      factoryId, 
      lineName, 
      poNumber, 
      blockerType, 
      blockerImpact, 
      blockerDescription, 
      submittedBy,
      department 
    } = validation.data;

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get factory name
    const { data: factory } = await supabase
      .from("factory_accounts")
      .select("name")
      .eq("id", factoryId)
      .single();

    const factoryName = factory?.name || "Factory";

    // Find all admin and owner users for this factory
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("factory_id", factoryId)
      .in("role", ["admin", "owner", "supervisor"]);

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw rolesError;
    }

    const adminUserIds = [...new Set(adminRoles?.map(r => r.user_id) || [])];

    if (adminUserIds.length === 0) {
      console.log("No admins found for factory:", factoryId);
      return new Response(
        JSON.stringify({ success: true, message: "No admins to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get admin emails from profiles
    const { data: adminProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", adminUserIds);

    if (profilesError) {
      console.error("Error fetching admin profiles:", profilesError);
      throw profilesError;
    }

    // Format impact for display
    const impactColors: Record<string, string> = {
      low: "#22c55e",
      medium: "#eab308",
      high: "#f97316",
      critical: "#ef4444",
    };
    const impactColor = impactColors[blockerImpact] || "#6b7280";

    // Create in-app notifications for all admins
    const notificationTitle = `🚨 ${blockerImpact.toUpperCase()} Blocker: ${lineName}`;
    const notificationMessage = `${blockerType} reported by ${submittedBy}${poNumber ? ` on ${poNumber}` : ""}. ${blockerDescription.slice(0, 100)}${blockerDescription.length > 100 ? "..." : ""}`;

    const notificationsToInsert = adminUserIds.map(userId => ({
      factory_id: factoryId,
      user_id: userId,
      type: "blocker_reported",
      title: notificationTitle,
      message: notificationMessage,
      data: {
        lineName,
        poNumber,
        blockerType,
        blockerImpact,
        department,
      },
      is_read: false,
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notificationsToInsert);

    if (insertError) {
      console.error("Error inserting notifications:", insertError);
      // Continue to send emails even if in-app notifications fail
    } else {
      console.log(`Created ${notificationsToInsert.length} in-app notifications`);
    }

    // Send email notifications to admins
    const emailPromises = (adminProfiles || []).map(async (admin) => {
      if (!admin.email) return null;

      try {
        const emailResponse = await resendClient.emails.send({
          from: "Woventex Alerts <noreply@woventex.co>",
          to: [admin.email],
          subject: `🚨 ${blockerImpact.toUpperCase()} Blocker Reported - ${lineName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
              <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ Production Blocker Alert</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${factoryName} - ${department.charAt(0).toUpperCase() + department.slice(1)}</p>
              </div>
              
              <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                  <span style="background: ${impactColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                    ${blockerImpact} impact
                  </span>
                </div>

                <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #111827;">
                  ${blockerType} on ${lineName}
                </h2>
                
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #991b1b; font-size: 14px;">
                    ${blockerDescription}
                  </p>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Line</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right;">${lineName}</td>
                  </tr>
                  ${poNumber ? `
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">PO Number</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right;">${poNumber}</td>
                  </tr>
                  ` : ""}
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Reported By</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; text-align: right;">${submittedBy}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Time</td>
                    <td style="padding: 8px 0; font-weight: 600; text-align: right;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
                
                <p style="font-size: 13px; color: #6b7280; margin: 0; text-align: center;">
                  Log in to Production Portal to view details and take action.
                </p>
              </div>
            </body>
            </html>
          `,
        });

        console.log(`Email sent to ${admin.email}:`, emailResponse);
        return { email: admin.email, success: true };
      } catch (emailError) {
        console.error(`Failed to send email to ${admin.email}:`, emailError);
        return { email: admin.email, success: false, error: emailError };
      }
    });

    const emailResults = await Promise.all(emailPromises);
    const successfulEmails = emailResults.filter(r => r?.success).length;

    console.log(`Sent ${successfulEmails} of ${adminProfiles?.length || 0} emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsCreated: notificationsToInsert.length,
        emailsSent: successfulEmails,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("Error in notify-blocker function:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to send notifications" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
