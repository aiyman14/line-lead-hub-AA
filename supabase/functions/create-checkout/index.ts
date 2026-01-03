import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role for database operations
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Use anon client for auth verification
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

    // Get the user's factory_id from profile using service role (bypasses RLS)
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

    const { startTrial } = await req.json().catch(() => ({ startTrial: false }));
    logStep("Request body", { startTrial });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    
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
      
      logStep("Starting 2-week trial");
      
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
      
      // Create subscription with trial
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: "price_1SlX0pHuCf2bKZx0PL2u7wGh" }],
        trial_end: trialEnd,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          factory_id: factoryId,
        },
      });
      
      logStep("Trial subscription created", { subscriptionId: subscription.id, trialEnd });

      await supabaseAdmin
        .from('factory_accounts')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          subscription_status: 'trial',
          trial_start_date: new Date().toISOString(),
          trial_end_date: new Date(trialEnd * 1000).toISOString(),
        })
        .eq('id', factoryId);

      logStep("Factory updated with trial info");

      return new Response(JSON.stringify({ 
        success: true, 
        trial: true,
        trialEndDate: new Date(trialEnd * 1000).toISOString(),
        redirectUrl: `${origin}/setup/factory`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create checkout session for payment (works with or without factory)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: "price_1SlX0pHuCf2bKZx0PL2u7wGh",
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/subscription?payment=success`,
      cancel_url: `${origin}/subscription?payment=cancelled`,
      metadata: {
        factory_id: factoryId || '',
        user_id: user.id,
      },
      subscription_data: {
        metadata: {
          factory_id: factoryId || '',
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

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
