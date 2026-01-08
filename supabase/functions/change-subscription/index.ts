import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan tier configuration - matches frontend plan-tiers.ts (LIVE)
// Tiers are ordered from lowest to highest
const PLAN_TIERS = {
  starter: {
    priceId: 'price_1SnFcPHWgEvVObNzV8DUHzpe',
    productId: 'prod_Tkl8Q1w6HfSqER',
    maxLines: 30,
    order: 1,
  },
  growth: {
    priceId: 'price_1SnFcNHWgEvVObNzag27TfQY',
    productId: 'prod_Tkl8hBoNi8dZZL',
    maxLines: 60,
    order: 2,
  },
  scale: {
    priceId: 'price_1SnFcIHWgEvVObNz2u1IfoEw',
    productId: 'prod_Tkl8LGqEjZVnRG',
    maxLines: 100,
    order: 3,
  },
};

// Map price IDs to tier names for current plan detection
const PRICE_TO_TIER: Record<string, string> = {
  'price_1SnFcPHWgEvVObNzV8DUHzpe': 'starter',
  'price_1SnFcNHWgEvVObNzag27TfQY': 'growth',
  'price_1SnFcIHWgEvVObNz2u1IfoEw': 'scale',
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
    if (!tierConfig) throw new Error(`Invalid tier: ${newTier}. Enterprise requires contacting sales.`);
    
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
      .select('stripe_subscription_id, stripe_customer_id, subscription_tier')
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
      itemId: subscription.items.data[0]?.id,
      currentPriceId: subscription.items.data[0]?.price?.id
    });

    // Determine current tier from Stripe subscription
    const currentPriceId = subscription.items.data[0]?.price?.id;
    const currentTierName = PRICE_TO_TIER[currentPriceId] || factory.subscription_tier || 'starter';
    const currentTierConfig = PLAN_TIERS[currentTierName as keyof typeof PLAN_TIERS];
    
    if (!currentTierConfig) {
      throw new Error("Could not determine current plan tier");
    }

    const isUpgrade = tierConfig.order > currentTierConfig.order;
    const isDowngrade = tierConfig.order < currentTierConfig.order;

    logStep("Plan change type", { 
      currentTier: currentTierName,
      newTier,
      isUpgrade,
      isDowngrade,
      currentOrder: currentTierConfig.order,
      newOrder: tierConfig.order
    });

    if (!isUpgrade && !isDowngrade) {
      throw new Error("You are already on this plan");
    }

    let result: any;

    if (isUpgrade) {
      // UPGRADE LOGIC: Immediate change with proration
      // User pays the prorated difference immediately
      // The subscription is updated right away
      logStep("Processing UPGRADE - immediate with proration");

      const updatedSubscription = await stripe.subscriptions.update(factory.stripe_subscription_id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: tierConfig.priceId,
          },
        ],
        // create_prorations: Creates proration invoice items that will be invoiced
        // at the next billing cycle. For immediate payment, we use always_invoice.
        proration_behavior: 'always_invoice',
        metadata: {
          ...subscription.metadata,
          tier: newTier,
        },
      });

      logStep("Upgrade completed", { 
        id: updatedSubscription.id, 
        newTier,
        status: updatedSubscription.status 
      });

      // Update factory record immediately for upgrades
      await supabaseClient
        .from('factory_accounts')
        .update({ 
          subscription_tier: newTier,
          max_lines: tierConfig.maxLines,
        })
        .eq('id', profile.factory_id);

      logStep("Factory updated for upgrade", { tier: newTier, maxLines: tierConfig.maxLines });

      result = {
        success: true,
        changeType: 'upgrade',
        newTier,
        maxLines: tierConfig.maxLines,
        effectiveImmediately: true,
        message: `Upgraded to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} plan. Your new limits are active now.`,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        }
      };

    } else {
      // DOWNGRADE LOGIC: Schedule change for next billing cycle
      // User stays on current plan until renewal, then moves to lower plan
      // We need to ensure they have a valid payment method for the next charge
      logStep("Processing DOWNGRADE - scheduled for next billing cycle");

      // Check if customer has a default payment method
      const customer = await stripe.customers.retrieve(factory.stripe_customer_id!) as Stripe.Customer;
      const hasPaymentMethod = !!customer.invoice_settings?.default_payment_method || 
                               (customer.default_source !== null);

      logStep("Payment method check", { 
        hasPaymentMethod,
        defaultPaymentMethod: customer.invoice_settings?.default_payment_method,
        defaultSource: customer.default_source
      });

      // If no payment method, we could return a SetupIntent for the frontend
      // But for simplicity, we'll proceed with scheduling (Stripe will handle it at renewal)
      
      // Use subscription schedule to change at period end
      // First check if there's an existing schedule
      let schedule = subscription.schedule 
        ? await stripe.subscriptionSchedules.retrieve(subscription.schedule as string)
        : null;

      const periodEnd = subscription.current_period_end;
      const nextBillingDate = new Date(periodEnd * 1000);

      if (schedule && schedule.status === 'active') {
        // Update existing schedule
        logStep("Updating existing subscription schedule");
        
        schedule = await stripe.subscriptionSchedules.update(schedule.id, {
          phases: [
            {
              items: [{ price: currentPriceId, quantity: 1 }],
              start_date: subscription.current_period_start,
              end_date: periodEnd,
            },
            {
              items: [{ price: tierConfig.priceId, quantity: 1 }],
              start_date: periodEnd,
              metadata: { tier: newTier },
            },
          ],
        });
      } else {
        // Create a new schedule from the subscription
        logStep("Creating new subscription schedule for downgrade");
        
        schedule = await stripe.subscriptionSchedules.create({
          from_subscription: subscription.id,
        });

        // Now update it with our phases
        schedule = await stripe.subscriptionSchedules.update(schedule.id, {
          phases: [
            {
              items: [{ price: currentPriceId, quantity: 1 }],
              start_date: subscription.current_period_start,
              end_date: periodEnd,
            },
            {
              items: [{ price: tierConfig.priceId, quantity: 1 }],
              start_date: periodEnd,
              metadata: { tier: newTier },
            },
          ],
        });
      }

      logStep("Downgrade scheduled", { 
        scheduleId: schedule.id,
        effectiveDate: nextBillingDate.toISOString()
      });

      // Note: We don't update factory_accounts yet - that happens at renewal via webhook
      // But we can store pending_tier if needed

      result = {
        success: true,
        changeType: 'downgrade',
        newTier,
        maxLines: tierConfig.maxLines,
        effectiveImmediately: false,
        scheduledDate: nextBillingDate.toISOString(),
        message: `Downgrade to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} plan scheduled. You'll continue on your current plan until ${nextBillingDate.toLocaleDateString()}.`,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: nextBillingDate.toISOString(),
        },
        schedule: {
          id: schedule.id,
          status: schedule.status,
        },
        needsPaymentMethod: !hasPaymentMethod,
      };
    }

    return new Response(JSON.stringify(result), {
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
