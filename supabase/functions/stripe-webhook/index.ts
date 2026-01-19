import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Plan tier configuration - matches frontend plan-tiers.ts
const PLAN_TIERS: Record<string, { maxLines: number }> = {
  starter: { maxLines: 30 },
  growth: { maxLines: 60 },
  scale: { maxLines: 100 },
};

// Product ID to tier mapping - must match frontend plan-tiers.ts (LIVE)
const PRODUCT_TO_TIER: Record<string, string> = {
  'prod_Tkl8Q1w6HfSqER': 'starter',
  'prod_Tkl8hBoNi8dZZL': 'growth',
  'prod_Tkl8LGqEjZVnRG': 'scale',
};

// Price ID to tier mapping (fallback) - LIVE
const PRICE_TO_TIER: Record<string, string> = {
  'price_1SnFcPHWgEvVObNzV8DUHzpe': 'starter',
  'price_1SnFcNHWgEvVObNzag27TfQY': 'growth',
  'price_1SnFcIHWgEvVObNz2u1IfoEw': 'scale',
};

// Helper to derive tier from subscription
function deriveTierFromSubscription(subscription: Stripe.Subscription): { tier: string; maxLines: number } {
  let tier = 'starter';
  let maxLines = 30;

  if (subscription.items.data.length > 0) {
    const item = subscription.items.data[0];
    const productId = typeof item.price.product === 'string'
      ? item.price.product
      : item.price.product?.id;

    if (productId && PRODUCT_TO_TIER[productId]) {
      tier = PRODUCT_TO_TIER[productId];
      maxLines = PLAN_TIERS[tier]?.maxLines || 30;
    } else if (item.price.id && PRICE_TO_TIER[item.price.id]) {
      tier = PRICE_TO_TIER[item.price.id];
      maxLines = PLAN_TIERS[tier]?.maxLines || 30;
    }
  }

  // Allow metadata to override if explicitly set
  if (subscription.metadata?.tier && PLAN_TIERS[subscription.metadata.tier]) {
    tier = subscription.metadata.tier;
    maxLines = PLAN_TIERS[tier]?.maxLines || 30;
  }

  return { tier, maxLines };
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
  
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    // SECURITY: Always require webhook signature verification
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }
    
    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    let event: Stripe.Event;
    
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Webhook signature verified");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    logStep("Webhook received", { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { 
          sessionId: session.id, 
          customerId: session.customer,
          factoryId: session.metadata?.factory_id,
          tier: session.metadata?.tier,
          subscriptionId: session.subscription
        });
        
        if (session.metadata?.factory_id && session.subscription) {
          // Fetch the subscription to get the actual product/price for tier detection
          let tier = session.metadata?.tier || 'starter';
          let maxLines = PLAN_TIERS[tier]?.maxLines || 30;
          
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            const derived = deriveTierFromSubscription(subscription);
            tier = derived.tier;
            maxLines = derived.maxLines;
            logStep("Derived tier from subscription", { tier, maxLines });
          } catch (err) {
            logStep("Could not fetch subscription for tier derivation, using metadata", { tier });
          }
          
          await supabaseAdmin
            .from('factory_accounts')
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_status: 'active',
              subscription_tier: tier,
              max_lines: maxLines,
              payment_failed_at: null,
            })
            .eq('id', session.metadata.factory_id);
          
          logStep("Factory updated to active", { tier, maxLines });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { 
          subscriptionId: subscription.id, 
          status: subscription.status,
          factoryId: subscription.metadata?.factory_id,
          tier: subscription.metadata?.tier
        });
        
        // Get factory by subscription ID or metadata
        let factoryId = subscription.metadata?.factory_id;
        
        if (!factoryId) {
          // Try to find factory by subscription ID
          const { data: factory } = await supabaseAdmin
            .from('factory_accounts')
            .select('id')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          
          factoryId = factory?.id;
        }
        
        if (factoryId) {
          const status = subscription.status === 'active' ? 'active' : 
                        subscription.status === 'trialing' ? 'trialing' :
                        subscription.status === 'past_due' ? 'past_due' :
                        subscription.status === 'canceled' ? 'canceled' : 
                        subscription.status === 'unpaid' ? 'expired' : 'inactive';
          
          // Get tier from subscription items (not just metadata)
          const { tier, maxLines } = deriveTierFromSubscription(subscription);
          
          await supabaseAdmin
            .from('factory_accounts')
            .update({ 
              subscription_status: status,
              subscription_tier: tier,
              max_lines: maxLines,
            })
            .eq('id', factoryId);
          
          logStep("Factory status and tier updated", { status, tier, maxLines });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { 
          subscriptionId: subscription.id,
          factoryId: subscription.metadata?.factory_id 
        });
        
        // Get factory by subscription ID or metadata
        let factoryId = subscription.metadata?.factory_id;
        
        if (!factoryId) {
          const { data: factory } = await supabaseAdmin
            .from('factory_accounts')
            .select('id, name')
            .eq('stripe_subscription_id', subscription.id)
            .single();
          
          factoryId = factory?.id;
        }
        
        if (factoryId) {
          // Get factory info for notification
          const { data: factory } = await supabaseAdmin
            .from('factory_accounts')
            .select('name')
            .eq('id', factoryId)
            .single();
          
          await supabaseAdmin
            .from('factory_accounts')
            .update({ 
              subscription_status: 'canceled',
              stripe_subscription_id: null 
            })
            .eq('id', factoryId);
          
          logStep("Factory subscription canceled");
          
          // Send cancellation notification
          try {
            const { data: admins } = await supabaseAdmin
              .from('profiles')
              .select('email')
              .eq('factory_id', factoryId);
            
            if (admins && admins.length > 0) {
              const notificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-billing-notification`;
              await fetch(notificationUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  type: 'subscription_canceled',
                  factoryId: factoryId,
                  email: admins[0].email,
                  factoryName: factory?.name,
                }),
              });
              logStep("Cancellation notification sent");
            }
          } catch (notifError) {
            logStep("Failed to send notification", { error: String(notifError) });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { 
          invoiceId: invoice.id,
          customerId: invoice.customer 
        });
        
        // Find factory by customer ID first
        let factory = null;
        const { data: factoryByCustomer } = await supabaseAdmin
          .from('factory_accounts')
          .select('id, name')
          .eq('stripe_customer_id', invoice.customer as string)
          .single();
        
        factory = factoryByCustomer;
        
        // If not found by customer ID, try to find by subscription ID from the invoice
        if (!factory && invoice.subscription) {
          const { data: factoryBySub } = await supabaseAdmin
            .from('factory_accounts')
            .select('id, name')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .single();
          factory = factoryBySub;
          
          if (factory) {
            logStep("Factory found by subscription ID instead of customer ID", { factoryId: factory.id });
          }
        }
        
        // Last resort: find by customer email via Stripe
        if (!factory) {
          try {
            const customer = await stripe.customers.retrieve(invoice.customer as string);
            if (customer && !customer.deleted && 'email' in customer && customer.email) {
              const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('factory_id')
                .eq('email', customer.email)
                .limit(1)
                .single();
              
              if (profile?.factory_id) {
                const { data: factoryByEmail } = await supabaseAdmin
                  .from('factory_accounts')
                  .select('id, name')
                  .eq('id', profile.factory_id)
                  .single();
                factory = factoryByEmail;
                
                if (factory) {
                  logStep("Factory found by customer email", { factoryId: factory.id, email: customer.email });
                  // Update the factory with the correct customer ID
                  await supabaseAdmin
                    .from('factory_accounts')
                    .update({ stripe_customer_id: invoice.customer as string })
                    .eq('id', factory.id);
                }
              }
            }
          } catch (err) {
            logStep("Error looking up customer for factory match", { error: String(err) });
          }
        }
        
        if (factory) {
          await supabaseAdmin
            .from('factory_accounts')
            .update({ 
              subscription_status: 'past_due',
              payment_failed_at: new Date().toISOString()
            })
            .eq('id', factory.id);
          
          logStep("Factory marked as past due");
          
          // Send payment failed notification
          try {
            const { data: admins } = await supabaseAdmin
              .from('profiles')
              .select('email')
              .eq('factory_id', factory.id);
            
            if (admins && admins.length > 0) {
              const notificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-billing-notification`;
              await fetch(notificationUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  type: 'payment_failed',
                  factoryId: factory.id,
                  email: admins[0].email,
                  factoryName: factory.name,
                }),
              });
              logStep("Payment failed notification sent");
            }
          } catch (notifError) {
            logStep("Failed to send notification", { error: String(notifError) });
          }
        } else {
          logStep("Could not find factory for failed payment", { customerId: invoice.customer });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment succeeded", { 
          invoiceId: invoice.id,
          customerId: invoice.customer,
          subscriptionId: invoice.subscription
        });
        
        // Find factory by customer ID first
        let factory = null;
        const { data: factoryByCustomer } = await supabaseAdmin
          .from('factory_accounts')
          .select('id, stripe_customer_id')
          .eq('stripe_customer_id', invoice.customer as string)
          .single();
        
        factory = factoryByCustomer;
        
        // If not found by customer ID, try subscription ID
        if (!factory && invoice.subscription) {
          const { data: factoryBySub } = await supabaseAdmin
            .from('factory_accounts')
            .select('id, stripe_customer_id')
            .eq('stripe_subscription_id', invoice.subscription as string)
            .single();
          factory = factoryBySub;
          
          if (factory) {
            logStep("Factory found by subscription ID", { factoryId: factory.id });
          }
        }
        
        // Last resort: find by customer email via Stripe
        if (!factory) {
          try {
            const customer = await stripe.customers.retrieve(invoice.customer as string);
            if (customer && !customer.deleted && 'email' in customer && customer.email) {
              const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('factory_id')
                .eq('email', customer.email)
                .limit(1)
                .single();
              
              if (profile?.factory_id) {
                const { data: factoryByEmail } = await supabaseAdmin
                  .from('factory_accounts')
                  .select('id, stripe_customer_id')
                  .eq('id', profile.factory_id)
                  .single();
                factory = factoryByEmail;
                
                if (factory) {
                  logStep("Factory found by customer email", { factoryId: factory.id, email: customer.email });
                }
              }
            }
          } catch (err) {
            logStep("Error looking up customer for factory match", { error: String(err) });
          }
        }
        
        if (factory) {
          // Sync the Stripe IDs if they've changed
          const updates: Record<string, unknown> = { 
            subscription_status: 'active',
            payment_failed_at: null
          };
          
          if (factory.stripe_customer_id !== invoice.customer) {
            updates.stripe_customer_id = invoice.customer as string;
            logStep("Updating mismatched customer ID", { 
              old: factory.stripe_customer_id, 
              new: invoice.customer 
            });
          }
          
          if (invoice.subscription) {
            updates.stripe_subscription_id = invoice.subscription as string;
          }
          
          await supabaseAdmin
            .from('factory_accounts')
            .update(updates)
            .eq('id', factory.id);
          
          logStep("Factory subscription reactivated and synced", updates);
        } else {
          logStep("Could not find factory for successful payment", { customerId: invoice.customer });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
