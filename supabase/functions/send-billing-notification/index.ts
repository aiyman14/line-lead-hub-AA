import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-BILLING-NOTIFICATION] ${step}${detailsStr}`);
};

interface NotificationRequest {
  type: 'trial_expiring' | 'trial_expired' | 'payment_failed' | 'subscription_canceled';
  factoryId?: string;
  email?: string;
  factoryName?: string;
  daysRemaining?: number;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      logStep("RESEND_API_KEY not set, skipping email");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const resend = new Resend(resendKey);
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { type, factoryId, email, factoryName, daysRemaining }: NotificationRequest = await req.json();
    logStep("Request body", { type, factoryId, email, factoryName, daysRemaining });

    if (!email) {
      throw new Error("Email is required");
    }

    let subject = '';
    let htmlContent = '';
    const portalUrl = 'https://productionportal.cloud';

    switch (type) {
      case 'trial_expiring':
        subject = `Your ProductionPortal trial expires ${daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`}`;
        htmlContent = `
          <h1>Your trial is ending soon</h1>
          <p>Hi there,</p>
          <p>Your ProductionPortal trial for <strong>${factoryName || 'your factory'}</strong> will expire ${daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`}.</p>
          <p>To continue using all features without interruption, please subscribe to one of our plans.</p>
          <p style="margin: 24px 0;">
            <a href="${portalUrl}/subscription" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Subscribe Now
            </a>
          </p>
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>Best regards,<br>The ProductionPortal Team</p>
        `;
        break;

      case 'trial_expired':
        subject = 'Your ProductionPortal trial has expired';
        htmlContent = `
          <h1>Your trial has ended</h1>
          <p>Hi there,</p>
          <p>Your ProductionPortal trial for <strong>${factoryName || 'your factory'}</strong> has expired.</p>
          <p>Subscribe now to regain access to all features and your data.</p>
          <p style="margin: 24px 0;">
            <a href="${portalUrl}/subscription" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Subscribe Now
            </a>
          </p>
          <p>Your data is safe and will be available once you subscribe.</p>
          <p>Best regards,<br>The ProductionPortal Team</p>
        `;
        break;

      case 'payment_failed':
        subject = 'Action required: Payment failed for ProductionPortal';
        htmlContent = `
          <h1>Payment Failed</h1>
          <p>Hi there,</p>
          <p>We were unable to process your payment for <strong>${factoryName || 'your factory'}</strong>.</p>
          <p>Please update your payment method to avoid service interruption.</p>
          <p style="margin: 24px 0;">
            <a href="${portalUrl}/billing" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Update Payment Method
            </a>
          </p>
          <p>If you believe this is an error, please contact our support team.</p>
          <p>Best regards,<br>The ProductionPortal Team</p>
        `;
        break;

      case 'subscription_canceled':
        subject = 'Your ProductionPortal subscription has been canceled';
        htmlContent = `
          <h1>Subscription Canceled</h1>
          <p>Hi there,</p>
          <p>Your ProductionPortal subscription for <strong>${factoryName || 'your factory'}</strong> has been canceled.</p>
          <p>We're sorry to see you go! If you change your mind, you can resubscribe at any time.</p>
          <p style="margin: 24px 0;">
            <a href="${portalUrl}/subscription" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Resubscribe
            </a>
          </p>
          <p>Thank you for using ProductionPortal.</p>
          <p>Best regards,<br>The ProductionPortal Team</p>
        `;
        break;

      default:
        throw new Error(`Unknown notification type: ${type}`);
    }

    const emailResponse = await resend.emails.send({
      from: "ProductionPortal <notifications@resend.dev>",
      to: [email],
      subject,
      html: htmlContent,
    });

    logStep("Email sent", { emailResponse });

    // Create in-app notification
    if (factoryId) {
      // Get admin users for this factory
      const { data: adminRoles } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('factory_id', factoryId)
        .in('role', ['admin', 'owner']);

      if (adminRoles && adminRoles.length > 0) {
        const notifications = adminRoles.map(role => ({
          factory_id: factoryId,
          user_id: role.user_id,
          type: 'billing',
          title: subject,
          message: type === 'payment_failed' 
            ? 'Please update your payment method to avoid service interruption.'
            : type === 'trial_expiring'
            ? `Your trial expires ${daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`}. Subscribe to continue.`
            : 'Check your billing settings for more details.',
          data: { notificationType: type, factoryId },
        }));

        await supabaseClient.from('notifications').insert(notifications);
        logStep("In-app notifications created", { count: notifications.length });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
