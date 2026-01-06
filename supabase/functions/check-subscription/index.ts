import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product ID to tier mapping - must match frontend plan-tiers.ts
const PRODUCT_TO_TIER: Record<string, string> = {
  'prod_Tk0Z6QU3HYNqmx': 'starter',
  'prod_Tk0Zyl3J739mGp': 'growth',
  'prod_Tk0ZNeXFFFP9jz': 'scale',
};

// Price amount to tier mapping (fallback)
const PRICE_TO_TIER: Record<number, string> = {
  39999: 'starter',
  54999: 'growth',
  62999: 'scale',
};

const TIER_MAX_LINES: Record<string, number> = {
  'starter': 30,
  'growth': 60,
  'scale': 100,
  'enterprise': 999999, // Unlimited
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
      logStep("No factory assigned");
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
      .select('subscription_status, trial_end_date, stripe_customer_id, stripe_subscription_id, subscription_tier, max_lines, name')
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
      tier: factory.subscription_tier,
      trialEnd: factory.trial_end_date 
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for active Stripe subscription
    if (factory.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(factory.stripe_subscription_id);
        logStep("Stripe subscription retrieved", { 
          id: subscription.id, 
          status: subscription.status 
        });

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          // Determine tier from subscription
          let tier = factory.subscription_tier || 'starter';
          let maxLines = factory.max_lines || 30;

          if (subscription.items.data.length > 0) {
            const item = subscription.items.data[0];
            const productId = typeof item.price.product === 'string' 
              ? item.price.product 
              : item.price.product.id;
            
            // Map product to tier
            if (PRODUCT_TO_TIER[productId]) {
              tier = PRODUCT_TO_TIER[productId];
              maxLines = TIER_MAX_LINES[tier] || 30;
            } else if (item.price.unit_amount && PRICE_TO_TIER[item.price.unit_amount]) {
              tier = PRICE_TO_TIER[item.price.unit_amount];
              maxLines = TIER_MAX_LINES[tier] || 30;
            }
          }

          // Update factory if tier changed
          if (tier !== factory.subscription_tier || maxLines !== factory.max_lines) {
            await supabaseClient
              .from('factory_accounts')
              .update({ 
                subscription_tier: tier,
                max_lines: maxLines,
                subscription_status: subscription.status
              })
              .eq('id', profile.factory_id);
            logStep("Factory tier updated", { tier, maxLines });
          }

          const isTrial = subscription.status === 'trialing';
          const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();

          return new Response(JSON.stringify({
            subscribed: !isTrial,
            hasAccess: true,
            isTrial,
            subscriptionEnd,
            currentTier: tier,
            maxLines,
            factoryName: factory.name,
            daysRemaining: isTrial ? Math.ceil((subscription.trial_end! * 1000 - Date.now()) / (1000 * 60 * 60 * 24)) : null,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        } else {
          // Subscription not active - update status
          await supabaseClient
            .from('factory_accounts')
            .update({ subscription_status: subscription.status })
            .eq('id', profile.factory_id);
          logStep("Subscription not active", { status: subscription.status });
        }
      } catch (err) {
        logStep("Error checking Stripe subscription", { error: String(err) });
      }
    }

    // Check for trial status in database (fallback)
    if (factory.subscription_status === 'trialing' && factory.trial_end_date) {
      const trialEnd = new Date(factory.trial_end_date);
      const now = new Date();
      
      if (trialEnd > now) {
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        logStep("Active trial (from DB)", { trialEndDate: factory.trial_end_date, daysRemaining });
        return new Response(JSON.stringify({
          subscribed: false,
          hasAccess: true,
          isTrial: true,
          trialEndDate: factory.trial_end_date,
          daysRemaining,
          currentTier: factory.subscription_tier || 'starter',
          maxLines: factory.max_lines || 30,
          factoryName: factory.name,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // Trial expired
        await supabaseClient
          .from('factory_accounts')
          .update({ subscription_status: 'expired' })
          .eq('id', profile.factory_id);
        logStep("Trial expired");
      }
    }

    // No active subscription or trial
    logStep("No active subscription or trial");
    return new Response(JSON.stringify({
      subscribed: false,
      hasAccess: false,
      needsPayment: true,
      currentTier: factory.subscription_tier || 'starter',
      maxLines: factory.max_lines || 30,
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
