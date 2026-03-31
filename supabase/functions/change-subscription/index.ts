import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";

// Plan tier configuration - must match frontend plan-tiers.ts
const PLAN_TIERS = {
  starter: {
    priceIdMonthly: "price_1SnFcPHWgEvVObNzV8DUHzpe",
    priceIdYearly: "price_1SnGNvHWgEvVObNzzSlIyDmj",
    productId: "prod_Tkl8Q1w6HfSqER",
    maxLines: 30,
    order: 1,
  },
  growth: {
    priceIdMonthly: "price_1SnFcNHWgEvVObNzag27TfQY",
    priceIdYearly: "price_1SnGPGHWgEvVObNz1cEK82X6",
    productId: "prod_Tkl8hBoNi8dZZL",
    maxLines: 60,
    order: 2,
  },
  scale: {
    priceIdMonthly: "price_1SnFcIHWgEvVObNz2u1IfoEw",
    priceIdYearly: "price_1SnGQQHWgEvVObNz6Gf4ff6Y",
    productId: "prod_Tkl8LGqEjZVnRG",
    maxLines: 100,
    order: 3,
  },
};

// Maps Stripe price IDs to tier names for detecting current plan
const PRICE_TO_TIER: Record<string, { tier: string; interval: "month" | "year" }> = {
  price_1SnFcPHWgEvVObNzV8DUHzpe: { tier: "starter", interval: "month" },
  price_1SnFcNHWgEvVObNzag27TfQY: { tier: "growth", interval: "month" },
  price_1SnFcIHWgEvVObNz2u1IfoEw: { tier: "scale", interval: "month" },
  price_1SnGNvHWgEvVObNzzSlIyDmj: { tier: "starter", interval: "year" },
  price_1SnGPGHWgEvVObNz1cEK82X6: { tier: "growth", interval: "year" },
  price_1SnGQQHWgEvVObNz6Gf4ff6Y: { tier: "scale", interval: "year" },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHANGE-SUBSCRIPTION] ${step}${detailsStr}`);
};

/**
 * Finds the best subscription from a list, prioritizing active/trialing statuses.
 */
function pickBestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  const priority: Stripe.Subscription.Status[] = ["active", "trialing", "past_due", "unpaid", "incomplete"];
  for (const status of priority) {
    const found = subs.find((s) => s.status === status);
    if (found) return found;
  }
  return subs[0] ?? null;
}

/**
 * Resolves the user's active Stripe subscription, attempting recovery if stored IDs are stale.
 * Updates the database with corrected IDs if recovery is needed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveSubscription(args: {
  stripe: Stripe;
  supabaseAdmin: any;
  factoryId: string;
  userEmail: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}): Promise<{ subscription: Stripe.Subscription; customerId: string | null }> {
  const { stripe, supabaseAdmin, factoryId, userEmail } = args;

  // Try stored subscription ID first (fast path)
  if (args.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(args.stripeSubscriptionId);
      const customerId = typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
      return { subscription, customerId };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("No such subscription")) throw e;
      logStep("Stored subscription ID invalid, attempting recovery");
    }
  }

  // Recover by customer ID or email lookup
  let customerId = args.stripeCustomerId || null;

  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("No such customer")) {
        customerId = null;
      } else {
        throw e;
      }
    }
  }

  // Look up customer by email if no valid customer ID
  if (!customerId) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No billing customer found. Please subscribe first.");
    }
    customerId = customers.data[0].id;
  }

  // Find active subscriptions for this customer
  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const candidates = subs.data.filter(
    (s: Stripe.Subscription) => s.status !== "canceled" && (s.items?.data?.length ?? 0) > 0
  );

  const subscription = pickBestSubscription(candidates);
  if (!subscription) {
    throw new Error("No active subscription found. Please subscribe first.");
  }

  // Update database with recovered IDs for future requests
  await supabaseAdmin
    .from("factory_accounts")
    .update({ stripe_customer_id: customerId, stripe_subscription_id: subscription.id })
    .eq("id", factoryId);

  logStep("Recovered Stripe IDs", { factoryId, customerId, subscriptionId: subscription.id });
  return { subscription, customerId };
}

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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAdmin.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    // Parse and validate request body
    const { newTier, billingInterval = "month" } = await req.json();
    if (!newTier) throw new Error("New tier is required");
    if (!["month", "year"].includes(billingInterval)) {
      throw new Error("Invalid billing interval");
    }

    const tierConfig = PLAN_TIERS[newTier as keyof typeof PLAN_TIERS];
    if (!tierConfig) throw new Error(`Invalid tier: ${newTier}`);

    const targetPriceId = billingInterval === "year" ? tierConfig.priceIdYearly : tierConfig.priceIdMonthly;
    logStep("Processing plan change request", { newTier, billingInterval });

    // Get user's factory
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("factory_id")
      .eq("id", user.id)
      .single();

    if (!profile?.factory_id) throw new Error("No factory associated with user");

    // Get factory's current subscription info
    const { data: factory } = await supabaseAdmin
      .from("factory_accounts")
      .select("stripe_subscription_id, stripe_customer_id, subscription_tier")
      .eq("id", profile.factory_id)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Resolve active subscription (handles stale IDs automatically)
    const { subscription, customerId } = await resolveSubscription({
      stripe,
      supabaseAdmin,
      factoryId: profile.factory_id,
      userEmail: user.email,
      stripeSubscriptionId: factory?.stripe_subscription_id ?? null,
      stripeCustomerId: factory?.stripe_customer_id ?? null,
    });

    // Determine current plan from subscription
    const currentPriceId = subscription.items.data[0]?.price?.id;
    if (!currentPriceId) throw new Error("Could not determine current plan");

    const currentPriceMapping = PRICE_TO_TIER[currentPriceId];
    const currentTierName = currentPriceMapping?.tier || factory?.subscription_tier || "starter";
    const currentInterval = currentPriceMapping?.interval || "month";
    const currentTierConfig = PLAN_TIERS[currentTierName as keyof typeof PLAN_TIERS];

    if (!currentTierConfig) throw new Error("Could not determine current plan tier");

    // Determine if this is an upgrade or downgrade based on tier order
    // For same-tier billing interval changes: yearly commitment = upgrade, monthly switch = downgrade
    let isUpgrade: boolean;
    let isDowngrade: boolean;

    if (tierConfig.order !== currentTierConfig.order) {
      isUpgrade = tierConfig.order > currentTierConfig.order;
      isDowngrade = tierConfig.order < currentTierConfig.order;
    } else {
      // Same tier, different billing interval
      if (currentInterval === "month" && billingInterval === "year") {
        isUpgrade = true;
        isDowngrade = false;
      } else if (currentInterval === "year" && billingInterval === "month") {
        isUpgrade = false;
        isDowngrade = true;
      } else {
        throw new Error("You are already on this plan");
      }
    }

    if (!isUpgrade && !isDowngrade) throw new Error("You are already on this plan");

    logStep("Plan change type determined", {
      currentTier: currentTierName,
      newTier,
      isUpgrade,
      isDowngrade
    });

    const requestOrigin = req.headers.get("origin") || "https://productionportal.cloud";

    // ============================================================
    // UPGRADE FLOW: Redirect to Stripe Checkout for user confirmation
    // User must explicitly confirm the upgrade and payment before any charge occurs.
    // The webhook handles the actual plan update after successful payment.
    // ============================================================
    if (isUpgrade) {
      logStep("Creating checkout session for upgrade");

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: targetPriceId, quantity: 1 }],
        success_url: `${requestOrigin}/billing-plan?payment=success&tier=${newTier}&interval=${billingInterval}&change=upgrade`,
        cancel_url: `${requestOrigin}/billing-plan?payment=cancelled`,
        subscription_data: {
          metadata: {
            factory_id: profile.factory_id,
            tier: newTier,
            interval: billingInterval,
            previous_tier: currentTierName,
            change_type: "upgrade",
          },
        },
        metadata: {
          factory_id: profile.factory_id,
          tier: newTier,
          interval: billingInterval,
          change_type: "upgrade",
        },
      });

      logStep("Checkout session created for upgrade", { sessionId: checkoutSession.id });

      return new Response(
        JSON.stringify({
          success: true,
          requiresCheckout: true,
          checkoutUrl: checkoutSession.url,
          changeType: "upgrade",
          message: "Redirecting to checkout to confirm your upgrade...",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ============================================================
    // DOWNGRADE FLOW: Schedule change for end of billing period
    // No charge occurs. User keeps current plan until period ends.
    // Uses cancel_at_period_end + metadata to track pending downgrade.
    // ============================================================
    logStep("Processing downgrade - scheduling for period end");

    // Get period end timestamp and convert to Date
    const periodEnd = subscription.current_period_end;
    if (!periodEnd || typeof periodEnd !== "number") {
      throw new Error("Could not determine subscription billing period");
    }
    const periodEndDate = new Date(periodEnd * 1000);
    if (isNaN(periodEndDate.getTime())) {
      throw new Error("Invalid subscription period end date");
    }

    // Update subscription to cancel at period end and store downgrade info in metadata
    // The webhook will handle creating the new subscription when this one ends
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
      metadata: {
        ...subscription.metadata,
        pending_downgrade_tier: newTier,
        pending_downgrade_interval: billingInterval,
        pending_downgrade_price_id: targetPriceId,
      },
    });

    // Store pending downgrade in database for reference
    await supabaseAdmin
      .from("factory_accounts")
      .update({
        pending_plan_change: {
          type: "downgrade",
          newTier,
          newInterval: billingInterval,
          effectiveDate: periodEndDate.toISOString(),
          newPriceId: targetPriceId,
        },
      })
      .eq("id", profile.factory_id);

    logStep("Downgrade scheduled", { effectiveDate: periodEndDate.toISOString() });

    // Format date as readable string (e.g., "Jan 15, 2026")
    const formattedDate = periodEndDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return new Response(
      JSON.stringify({
        success: true,
        changeType: "downgrade",
        newTier,
        newInterval: billingInterval,
        maxLines: tierConfig.maxLines,
        effectiveDate: periodEndDate.toISOString(),
        message: `Your plan will change to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} on ${formattedDate}. You'll keep your current features until then.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
