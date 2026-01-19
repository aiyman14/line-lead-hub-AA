import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product ID to tier mapping - must match frontend plan-tiers.ts (LIVE)
const PRODUCT_TO_TIER: Record<string, string> = {
  'prod_Tkl8Q1w6HfSqER': 'starter',
  'prod_Tkl8hBoNi8dZZL': 'growth',
  'prod_Tkl8LGqEjZVnRG': 'scale',
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // If user has no factory, check if they have an active Stripe subscription
    // This allows users who subscribed but haven't created a factory yet to proceed
    if (!profile?.factory_id) {
      logStep("No factory assigned, checking Stripe directly");
      
      // Look for Stripe customer by email
      const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
      
      if (customers.data.length > 0) {
        const customerId = customers.data[0].id;
        logStep("Found Stripe customer", { customerId });
        
        // Check for active subscriptions
        const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
        const activeSub = subs.data.find((s: Stripe.Subscription) => s.status === 'active' || s.status === 'trialing');
        
        if (activeSub) {
          const isTrial = activeSub.status === 'trialing';
          const daysRemaining = isTrial && activeSub.trial_end
            ? Math.ceil((activeSub.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
          
          // Get tier from subscription
          let tier = 'starter';
          if (activeSub.items.data.length > 0) {
            const item = activeSub.items.data[0];
            const productId = typeof item.price.product === 'string'
              ? item.price.product
              : item.price.product.id;
            tier = PRODUCT_TO_TIER[productId] || 'starter';
          }
          
          logStep("User has active subscription but no factory", { 
            subscriptionId: activeSub.id, 
            status: activeSub.status,
            tier 
          });
          
          return new Response(JSON.stringify({ 
            subscribed: !isTrial,
            hasAccess: true,
            isTrial,
            needsFactory: true,
            currentTier: tier,
            maxLines: TIER_MAX_LINES[tier] || 30,
            daysRemaining,
            stripeCustomerId: customerId,
            stripeSubscriptionId: activeSub.id,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      
      logStep("No factory and no active subscription");
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

    const deriveTierAndMaxLines = (subscription: Stripe.Subscription) => {
      let tier = factory.subscription_tier || 'starter';
      let maxLines = factory.max_lines || 30;

      if (subscription.items.data.length > 0) {
        const item = subscription.items.data[0];
        const productId = typeof item.price.product === 'string'
          ? item.price.product
          : item.price.product.id;

        if (PRODUCT_TO_TIER[productId]) {
          tier = PRODUCT_TO_TIER[productId];
          maxLines = TIER_MAX_LINES[tier] || 30;
        } else if (item.price.unit_amount && PRICE_TO_TIER[item.price.unit_amount]) {
          tier = PRICE_TO_TIER[item.price.unit_amount];
          maxLines = TIER_MAX_LINES[tier] || 30;
        }
      }

      return { tier, maxLines };
    };

    const respondWithActiveSubscription = async (subscription: Stripe.Subscription) => {
      const { tier, maxLines } = deriveTierAndMaxLines(subscription);
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

      // Keep factory in sync even if webhooks are not configured.
      await supabaseClient
        .from('factory_accounts')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_tier: tier,
          max_lines: maxLines,
          subscription_status: subscription.status,
        })
        .eq('id', profile.factory_id);

      const isTrial = subscription.status === 'trialing';
      const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const daysRemaining = isTrial && subscription.trial_end
        ? Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

      return new Response(JSON.stringify({
        subscribed: !isTrial,
        hasAccess: true,
        isTrial,
        subscriptionEnd,
        currentTier: tier,
        maxLines,
        factoryName: factory.name,
        daysRemaining,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    };

    const tryFindSubscriptionByCustomerEmail = async () => {
      // Search all customers with this email (there may be multiple from different payment attempts)
      const customers = await stripe.customers.list({ email: user.email!, limit: 10 });
      
      if (customers.data.length === 0) {
        logStep("No Stripe customers found for email");
        return null;
      }
      
      logStep("Found Stripe customers by email", { count: customers.data.length, ids: customers.data.map((c: Stripe.Customer) => c.id) });
      
      // Check all customers for an active subscription
      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10 });
        const activeSub = subs.data.find((s: Stripe.Subscription) => s.status === 'active' || s.status === 'trialing');
        
        if (activeSub) {
          logStep("Active subscription found", { 
            customerId: customer.id, 
            subscriptionId: activeSub.id, 
            status: activeSub.status 
          });
          return activeSub;
        }
      }
      
      logStep("No active subscriptions found across all customers");
      return null;
    };

    // IMPORTANT: Always check for active subscription by email first
    // This catches cases where customer ID in DB doesn't match the one with active subscription
    try {
      const activeSubByEmail = await tryFindSubscriptionByCustomerEmail();
      if (activeSubByEmail) {
        const currentCustomerId = typeof activeSubByEmail.customer === 'string' 
          ? activeSubByEmail.customer 
          : activeSubByEmail.customer.id;
        
        // Check if we need to sync the Stripe IDs
        if (factory.stripe_customer_id !== currentCustomerId || 
            factory.stripe_subscription_id !== activeSubByEmail.id) {
          logStep("Syncing mismatched Stripe IDs", {
            oldCustomerId: factory.stripe_customer_id,
            newCustomerId: currentCustomerId,
            oldSubId: factory.stripe_subscription_id,
            newSubId: activeSubByEmail.id,
          });
        }
        
        return await respondWithActiveSubscription(activeSubByEmail);
      }
    } catch (err) {
      logStep("Error checking subscription by email", { error: String(err) });
    }

    // Fall back to checking stored subscription ID if email lookup failed
    if (factory.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(factory.stripe_subscription_id);
        logStep("Stripe subscription retrieved by stored ID", {
          id: subscription.id,
          status: subscription.status,
        });

        if (subscription.status === 'active' || subscription.status === 'trialing') {
          return await respondWithActiveSubscription(subscription);
        }

        // Subscription not active - update status
        await supabaseClient
          .from('factory_accounts')
          .update({ subscription_status: subscription.status })
          .eq('id', profile.factory_id);
        logStep("Stored subscription not active", { status: subscription.status });
      } catch (err) {
        logStep("Error checking stored Stripe subscription", { error: String(err) });
      }
    }

    const now = new Date();

    // Database-backed access (authoritative when webhook/checkout updates factory_accounts).
    // This also protects against missing Stripe permissions on restricted keys.
    if (factory.subscription_status === 'active') {
      logStep("Access granted from DB status", { status: factory.subscription_status });
      return new Response(JSON.stringify({
        subscribed: true,
        hasAccess: true,
        isTrial: false,
        currentTier: factory.subscription_tier || 'starter',
        maxLines: factory.max_lines || 30,
        factoryName: factory.name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (factory.subscription_status === 'trialing') {
      logStep("Access granted from DB status", { status: factory.subscription_status });
      return new Response(JSON.stringify({
        subscribed: true,
        hasAccess: true,
        isTrial: true,
        currentTier: factory.subscription_tier || 'starter',
        maxLines: factory.max_lines || 30,
        factoryName: factory.name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (factory.subscription_status === 'trial' && factory.trial_end_date) {
      const trialEnd = new Date(factory.trial_end_date);

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
      }

      // Trial expired
      await supabaseClient
        .from('factory_accounts')
        .update({ subscription_status: 'expired' })
        .eq('id', profile.factory_id);
      logStep("Trial expired");
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
