import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";

// Product ID to tier mapping - must match other functions
const PRODUCT_TO_TIER: Record<string, string> = {
  'prod_Tkl8Q1w6HfSqER': 'starter',
  'prod_Tkl8hBoNi8dZZL': 'growth',
  'prod_Tkl8LGqEjZVnRG': 'scale',
};

const TIER_MAX_LINES: Record<string, number> = {
  'starter': 30,
  'growth': 60,
  'scale': 100,
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LINK-FACTORY-SUB] ${step}${detailsStr}`);
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

    // Get auth token and validate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get factory_id from request body
    const body = await req.json();
    const { factory_id } = body;

    if (!factory_id) {
      throw new Error("factory_id is required");
    }
    logStep("Factory ID received", { factory_id });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      logStep("No Stripe key, skipping subscription link");
      return new Response(JSON.stringify({ linked: false, reason: "No Stripe configuration" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Look up Stripe customer by user email
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ linked: false, reason: "No Stripe customer" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found Stripe customers", { count: customers.data.length });

    // Find active subscription across all customers
    let activeSubscription: Stripe.Subscription | null = null;
    let customerId: string | null = null;

    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 10
      });

      const activeSub = subs.data.find((s: Stripe.Subscription) =>
        s.status === 'active' || s.status === 'trialing'
      );

      if (activeSub) {
        activeSubscription = activeSub;
        customerId = customer.id;
        break;
      }
    }

    if (!activeSubscription || !customerId) {
      logStep("No active subscription found");
      return new Response(JSON.stringify({ linked: false, reason: "No active subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found active subscription", {
      subscriptionId: activeSubscription.id,
      status: activeSubscription.status,
      customerId
    });

    // Derive tier and max lines from subscription
    let tier = 'starter';
    let maxLines = 30;

    if (activeSubscription.items.data.length > 0) {
      const item = activeSubscription.items.data[0];
      const productId = typeof item.price.product === 'string'
        ? item.price.product
        : item.price.product?.id;

      if (productId && PRODUCT_TO_TIER[productId]) {
        tier = PRODUCT_TO_TIER[productId];
        maxLines = TIER_MAX_LINES[tier] || 30;
      }
    }

    // Check for tier in metadata
    if (activeSubscription.metadata?.tier && TIER_MAX_LINES[activeSubscription.metadata.tier]) {
      tier = activeSubscription.metadata.tier;
      maxLines = TIER_MAX_LINES[tier] || 30;
    }

    // Determine subscription status
    const subscriptionStatus = activeSubscription.status === 'trialing' ? 'trialing' : 'active';
    const isTrial = activeSubscription.status === 'trialing';

    // Calculate trial end if applicable
    let trialEndDate: string | null = null;
    if (isTrial && activeSubscription.trial_end) {
      trialEndDate = new Date(activeSubscription.trial_end * 1000).toISOString();
    }

    // Update the factory with Stripe details
    const updateData: Record<string, unknown> = {
      stripe_customer_id: customerId,
      stripe_subscription_id: activeSubscription.id,
      subscription_status: subscriptionStatus,
      subscription_tier: tier,
      max_lines: maxLines,
    };

    // If it's a Stripe trial, clear the local trial dates (use Stripe's instead)
    if (isTrial) {
      updateData.trial_start_date = null;
      updateData.trial_end_date = trialEndDate;
    }

    const { error: updateError } = await supabaseAdmin
      .from('factory_accounts')
      .update(updateData)
      .eq('id', factory_id);

    if (updateError) {
      logStep("Failed to update factory", { error: updateError.message });
      throw new Error(`Failed to update factory: ${updateError.message}`);
    }

    // Also update the subscription metadata to include the factory_id for future webhook calls
    try {
      await stripe.subscriptions.update(activeSubscription.id, {
        metadata: {
          ...activeSubscription.metadata,
          factory_id: factory_id,
        },
      });
      logStep("Updated subscription metadata with factory_id");
    } catch (metaError) {
      logStep("Failed to update subscription metadata (non-fatal)", { error: String(metaError) });
    }

    logStep("Factory linked to subscription", {
      factory_id,
      customerId,
      subscriptionId: activeSubscription.id,
      tier,
      status: subscriptionStatus
    });

    return new Response(JSON.stringify({
      linked: true,
      tier,
      status: subscriptionStatus,
      isTrial,
      maxLines,
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
