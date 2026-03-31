import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's profile and factory
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('factory_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.factory_id) {
      throw new Error("User has no associated factory");
    }

    const factoryId = profile.factory_id;
    logStep("Factory identified", { factoryId });

    // Check user's role - only admin/owner can cancel
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('factory_id', factoryId);

    const isAdminOrOwner = roles?.some(r => 
      ['admin', 'owner', 'superadmin', 'supervisor'].includes(r.role)
    );

    if (!isAdminOrOwner) {
      throw new Error("Only admins or owners can cancel subscriptions");
    }
    logStep("User authorized to cancel");

    // Get factory's Stripe subscription info
    const { data: factory, error: factoryError } = await supabaseAdmin
      .from('factory_accounts')
      .select('stripe_subscription_id, stripe_customer_id, subscription_status, name')
      .eq('id', factoryId)
      .single();

    if (factoryError || !factory) {
      throw new Error("Factory not found");
    }

    logStep("Factory data retrieved", { 
      subscriptionId: factory.stripe_subscription_id,
      customerId: factory.stripe_customer_id,
      status: factory.subscription_status 
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Cancel in Stripe if there's an active subscription
    if (factory.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(factory.stripe_subscription_id);
        
        if (subscription.status !== 'canceled') {
          // Cancel immediately (not at period end)
          await stripe.subscriptions.cancel(factory.stripe_subscription_id);
          logStep("Stripe subscription cancelled immediately");
        } else {
          logStep("Subscription already cancelled in Stripe");
        }
      } catch (stripeError: any) {
        // Handle cases where subscription doesn't exist in Stripe
        if (stripeError.code === 'resource_missing') {
          logStep("Subscription not found in Stripe, proceeding with database update");
        } else {
          throw stripeError;
        }
      }
    } else {
      logStep("No Stripe subscription ID found, updating database only");
    }

    // Update factory to mark subscription as canceled
    const { error: updateError } = await supabaseAdmin
      .from('factory_accounts')
      .update({
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        // Keep stripe_customer_id for potential resubscription
      })
      .eq('id', factoryId);

    if (updateError) {
      throw new Error(`Failed to update factory: ${updateError.message}`);
    }
    logStep("Factory subscription status updated to canceled");

    // Create a notification for all factory users
    try {
      const { data: factoryUsers } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('factory_id', factoryId);

      if (factoryUsers && factoryUsers.length > 0) {
        const notifications = factoryUsers.map(u => ({
          factory_id: factoryId,
          user_id: u.id,
          type: 'subscription_canceled',
          title: 'Subscription Cancelled',
          message: `The factory subscription has been cancelled. Please resubscribe to regain access.`,
        }));

        await supabaseAdmin
          .from('notifications')
          .insert(notifications);
        
        logStep("Notifications created for all factory users", { count: factoryUsers.length });
      }
    } catch (notifError) {
      logStep("Warning: Failed to create notifications", { error: String(notifError) });
      // Don't throw - notification failure shouldn't block cancellation
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Subscription cancelled. All factory users have lost access." 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

