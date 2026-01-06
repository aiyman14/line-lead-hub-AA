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
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");
    
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get the user's factory_id from profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('factory_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logStep("Profile query error", { error: profileError.message });
    }

    const factoryId = profile?.factory_id;
    logStep("Profile checked", { factoryId: factoryId || 'none' });

    const body = await req.json().catch(() => ({}));
    const { tier = 'starter', startTrial = false } = body;
    logStep("Request body", { tier, startTrial });

    // Validate tier
    const tierConfig = PLAN_TIERS[tier as keyof typeof PLAN_TIERS];
    if (!tierConfig && tier !== 'enterprise') {
      throw new Error(`Invalid tier: ${tier}`);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });
    
    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "https://production-portal.lovable.app";
    
    // If starting trial, require factory
    if (startTrial) {
      if (!factoryId) {
        throw new Error("Factory required to start trial");
      }
      
      logStep("Starting 14-day trial", { tier });
      
      // Create or get customer
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            factory_id: factoryId,
            user_id: user.id,
          },
        });
        customerId = customer.id;
        logStep("Created new customer", { customerId });
      }

      // Calculate trial end (14 days from now)
      const trialEnd = Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60);
      
      // Create subscription with trial using the selected tier
      const priceId = tierConfig?.priceId || PLAN_TIERS.starter.priceId;
      
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_end: trialEnd,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          factory_id: factoryId,
          tier: tier,
        },
      });
      
      logStep("Trial subscription created", { subscriptionId: subscription.id, trialEnd, tier });

      // Update factory with subscription info
      await supabaseAdmin
        .from('factory_accounts')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_status: 'trialing',
          subscription_tier: tier,
          max_lines: tierConfig?.maxLines || 30,
          trial_start_date: new Date().toISOString(),
          trial_end_date: new Date(trialEnd * 1000).toISOString(),
        })
        .eq('id', factoryId);

      logStep("Factory updated with trial info");

      return new Response(JSON.stringify({ 
        success: true, 
        trial: true,
        tier,
        trialEndDate: new Date(trialEnd * 1000).toISOString(),
        redirectUrl: `${origin}/billing-plan`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create checkout session for the selected tier
    if (tier === 'enterprise') {
      // Enterprise requires contact sales
      return new Response(JSON.stringify({ 
        error: "Enterprise plan requires contacting sales",
        contactSales: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: tierConfig.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/billing-plan?payment=success&tier=${tier}`,
      cancel_url: `${origin}/billing-plan?payment=cancelled`,
      metadata: {
        factory_id: factoryId || '',
        user_id: user.id,
        tier: tier,
      },
      subscription_data: {
        metadata: {
          factory_id: factoryId || '',
          tier: tier,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, tier, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
