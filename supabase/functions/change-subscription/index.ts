import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan tier configuration - matches frontend plan-tiers.ts
const PLAN_TIERS = {
  starter: {
    priceId: 'price_starter_monthly', // TODO: Replace with actual Stripe price ID
    productId: 'prod_Tk0Z6QU3HYNqmx',
    maxLines: 30,
  },
  growth: {
    priceId: 'price_growth_monthly', // TODO: Replace with actual Stripe price ID
    productId: 'prod_Tk0Zyl3J739mGp',
    maxLines: 60,
  },
  scale: {
    priceId: 'price_scale_monthly', // TODO: Replace with actual Stripe price ID
    productId: 'prod_Tk0ZNeXFFFP9jz',
    maxLines: 100,
  },
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHANGE-SUBSCRIPTION] ${step}${detailsStr}`);
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
    
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { newTier } = await req.json();
    if (!newTier) throw new Error("New tier is required");
    
    const tierConfig = PLAN_TIERS[newTier as keyof typeof PLAN_TIERS];
    if (!tierConfig) throw new Error(`Invalid tier: ${newTier}`);
    
    logStep("Request body", { newTier, priceId: tierConfig.priceId });

    // Get user's factory
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('factory_id')
      .eq('id', user.id)
      .single();

    if (!profile?.factory_id) {
      throw new Error("No factory associated with user");
    }

    // Get factory subscription info
    const { data: factory } = await supabaseClient
      .from('factory_accounts')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', profile.factory_id)
      .single();

    if (!factory?.stripe_subscription_id) {
      throw new Error("No active subscription found. Please subscribe first.");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(factory.stripe_subscription_id);
    logStep("Current subscription", { 
      id: subscription.id, 
      status: subscription.status,
      itemId: subscription.items.data[0]?.id 
    });

    // Update subscription with prorated billing
    const updatedSubscription = await stripe.subscriptions.update(factory.stripe_subscription_id, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: tierConfig.priceId,
        },
      ],
      proration_behavior: 'create_prorations',
      metadata: {
        ...subscription.metadata,
        tier: newTier,
      },
    });

    logStep("Subscription updated", { 
      id: updatedSubscription.id, 
      newTier,
      status: updatedSubscription.status 
    });

    // Update factory record
    await supabaseClient
      .from('factory_accounts')
      .update({ 
        subscription_tier: newTier,
        max_lines: tierConfig.maxLines,
      })
      .eq('id', profile.factory_id);

    logStep("Factory updated", { tier: newTier, maxLines: tierConfig.maxLines });

    return new Response(JSON.stringify({ 
      success: true,
      newTier,
      maxLines: tierConfig.maxLines,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      }
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
