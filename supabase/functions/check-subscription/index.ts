import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
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
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get user's factory
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('factory_id')
      .eq('id', user.id)
      .single();

    if (!profile?.factory_id) {
      logStep("No factory assigned, user needs to create one");
      return new Response(JSON.stringify({ 
        subscribed: false, 
        needsFactory: true,
        hasAccess: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get factory subscription status
    const { data: factory } = await supabaseClient
      .from('factory_accounts')
      .select('subscription_status, trial_end_date, stripe_customer_id, stripe_subscription_id')
      .eq('id', profile.factory_id)
      .single();

    if (!factory) {
      logStep("Factory not found");
      return new Response(JSON.stringify({ 
        subscribed: false, 
        needsFactory: true,
        hasAccess: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Factory found", { 
      factoryId: profile.factory_id, 
      status: factory.subscription_status,
      trialEnd: factory.trial_end_date 
    });

    // Check trial status
    if (factory.subscription_status === 'trial' && factory.trial_end_date) {
      const trialEnd = new Date(factory.trial_end_date);
      const now = new Date();
      
      if (trialEnd > now) {
        logStep("Active trial", { trialEndDate: factory.trial_end_date });
        return new Response(JSON.stringify({
          subscribed: false,
          hasAccess: true,
          isTrial: true,
          trialEndDate: factory.trial_end_date,
          daysRemaining: Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        logStep("Trial expired");
        // Update status to expired
        await supabaseClient
          .from('factory_accounts')
          .update({ subscription_status: 'expired' })
          .eq('id', profile.factory_id);
      }
    }

    // Check active subscription status
    if (factory.subscription_status === 'active') {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      
      // Verify with Stripe
      if (factory.stripe_subscription_id) {
        try {
          const subscription = await stripe.subscriptions.retrieve(factory.stripe_subscription_id);
          
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            logStep("Active subscription verified", { 
              status: subscription.status,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
            });
            
            return new Response(JSON.stringify({
              subscribed: true,
              hasAccess: true,
              isTrial: subscription.status === 'trialing',
              subscriptionEnd: new Date(subscription.current_period_end * 1000).toISOString()
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          } else {
            logStep("Subscription not active", { status: subscription.status });
            // Update local status
            await supabaseClient
              .from('factory_accounts')
              .update({ subscription_status: subscription.status })
              .eq('id', profile.factory_id);
          }
        } catch (err) {
          logStep("Error checking Stripe subscription", { error: String(err) });
        }
      }
    }

    // No active subscription or trial
    logStep("No active subscription or trial");
    return new Response(JSON.stringify({
      subscribed: false,
      hasAccess: false,
      needsPayment: true
    }), {
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
