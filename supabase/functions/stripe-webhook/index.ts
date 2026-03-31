import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Plan tier configuration - must match frontend plan-tiers.ts
const PLAN_TIERS: Record<string, { maxLines: number }> = {
  starter: { maxLines: 30 },
  growth: { maxLines: 60 },
  scale: { maxLines: 100 },
};

// Product ID to tier mapping
const PRODUCT_TO_TIER: Record<string, string> = {
  'prod_Tkl8Q1w6HfSqER': 'starter',
  'prod_Tkl8hBoNi8dZZL': 'growth',
  'prod_Tkl8LGqEjZVnRG': 'scale',
};

// Price ID to tier mapping
const PRICE_TO_TIER: Record<string, string> = {
  'price_1SnFcPHWgEvVObNzV8DUHzpe': 'starter',
  'price_1SnFcNHWgEvVObNzag27TfQY': 'growth',
  'price_1SnFcIHWgEvVObNz2u1IfoEw': 'scale',
  'price_1SnGNvHWgEvVObNzzSlIyDmj': 'starter',
  'price_1SnGPGHWgEvVObNz1cEK82X6': 'growth',
  'price_1SnGQQHWgEvVObNz6Gf4ff6Y': 'scale',
};

/**
 * Derives the plan tier and max lines from a Stripe subscription.
 * Checks product ID, price ID, and metadata in order of priority.
 */
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

  // Metadata can override if explicitly set
  if (subscription.metadata?.tier && PLAN_TIERS[subscription.metadata.tier]) {
    tier = subscription.metadata.tier;
    maxLines = PLAN_TIERS[tier]?.maxLines || 30;
  }

  return { tier, maxLines };
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

/**
 * Logs a webhook processing error to app_error_logs and creates
 * in-app notifications for factory admin/owner users.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logWebhookError(
  supabaseAdmin: any,
  params: {
    message: string;
    eventType: string;
    eventId: string;
    factoryId?: string;
    stack?: string;
    metadata?: Record<string, unknown>;
  }
) {
  // Log to app_error_logs
  try {
    await supabaseAdmin.from('app_error_logs').insert({
      message: params.message,
      stack: params.stack || null,
      source: 'stripe-webhook',
      severity: 'error',
      factory_id: params.factoryId || null,
      metadata: {
        event_type: params.eventType,
        event_id: params.eventId,
        ...params.metadata,
      },
    });
  } catch (e) {
    console.error('[STRIPE-WEBHOOK] Failed to log error to database:', e);
  }

  // Create in-app notifications for factory admins/owners
  if (params.factoryId) {
    try {
      const { data: admins } = await supabaseAdmin
        .from('user_roles')
        .select('user_id')
        .eq('factory_id', params.factoryId)
        .in('role', ['owner', 'admin']);

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: { user_id: string }) => ({
          factory_id: params.factoryId,
          user_id: admin.user_id,
          type: 'webhook_error',
          title: 'Billing Processing Error',
          message: params.message,
          data: { event_type: params.eventType, event_id: params.eventId },
        }));

        await supabaseAdmin.from('notifications').insert(notifications);
      }
    } catch (e) {
      console.error('[STRIPE-WEBHOOK] Failed to create admin notifications:', e);
    }
  }
}

/**
 * Finds factory by various methods: subscription ID, customer ID, or metadata
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findFactory(
  supabaseAdmin: any,
  stripe: Stripe,
  options: {
    subscriptionId?: string;
    customerId?: string;
    factoryIdFromMetadata?: string;
  }
): Promise<{ id: string; name?: string; stripe_customer_id?: string; pending_plan_change?: Record<string, unknown> } | null> {
  // Try metadata first
  if (options.factoryIdFromMetadata) {
    const { data } = await supabaseAdmin
      .from('factory_accounts')
      .select('id, name, stripe_customer_id, pending_plan_change')
      .eq('id', options.factoryIdFromMetadata)
      .single();
    if (data) return data;
  }

  // Try subscription ID
  if (options.subscriptionId) {
    const { data } = await supabaseAdmin
      .from('factory_accounts')
      .select('id, name, stripe_customer_id, pending_plan_change')
      .eq('stripe_subscription_id', options.subscriptionId)
      .single();
    if (data) return data;
  }

  // Try customer ID
  if (options.customerId) {
    const { data } = await supabaseAdmin
      .from('factory_accounts')
      .select('id, name, stripe_customer_id, pending_plan_change')
      .eq('stripe_customer_id', options.customerId)
      .single();
    if (data) return data;

    // Last resort: look up customer email in Stripe, then find profile
    try {
      const customer = await stripe.customers.retrieve(options.customerId);
      if (customer && !customer.deleted && 'email' in customer && customer.email) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('factory_id')
          .eq('email', customer.email)
          .limit(1)
          .single();

        if (profile?.factory_id) {
          const { data: factory } = await supabaseAdmin
            .from('factory_accounts')
            .select('id, name, stripe_customer_id, pending_plan_change')
            .eq('id', profile.factory_id as string)
            .single();
          return factory;
        }
      }
    } catch {
      // Ignore lookup errors
    }
  }

  return null;
}

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

    // Verify webhook signature for security
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
      // ============================================================
      // CHECKOUT COMPLETED: New subscription or upgrade via checkout
      // Updates factory with new subscription details and tier
      // ============================================================
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", {
          sessionId: session.id,
          customerId: session.customer,
          factoryId: session.metadata?.factory_id,
          tier: session.metadata?.tier,
        });

        let factoryId = session.metadata?.factory_id;

        // Fallback: find factory via user_id in metadata
        if (!factoryId && session.metadata?.user_id) {
          const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('factory_id')
            .eq('id', session.metadata.user_id)
            .single();
          factoryId = userProfile?.factory_id;
        }

        if (!factoryId) {
          logStep("Factory not found for checkout session", { sessionId: session.id });
          await logWebhookError(supabaseAdmin, {
            message: `Checkout completed but no factory found. Customer: ${session.customer}, Session: ${session.id}`,
            eventType: event.type,
            eventId: event.id,
            metadata: { sessionId: session.id, customerId: session.customer },
          });
          break;
        }

        if (factoryId && session.subscription) {
          // Derive tier from the actual subscription
          let tier = session.metadata?.tier || 'starter';
          let maxLines = PLAN_TIERS[tier]?.maxLines || 30;

          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            const derived = deriveTierFromSubscription(subscription);
            tier = derived.tier;
            maxLines = derived.maxLines;
          } catch {
            logStep("Could not fetch subscription, using metadata tier");
          }

          // Clear any pending plan change since checkout completed successfully
          await supabaseAdmin
            .from('factory_accounts')
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_status: 'active',
              subscription_tier: tier,
              max_lines: maxLines,
              payment_failed_at: null,
              pending_plan_change: null,
            })
            .eq('id', factoryId);

          logStep("Factory updated", { factoryId, tier, maxLines });
        }
        break;
      }

      // ============================================================
      // SUBSCRIPTION UPDATED: Plan changes, status changes, etc.
      // Syncs subscription status and tier to database
      // ============================================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", {
          subscriptionId: subscription.id,
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        const factory = await findFactory(supabaseAdmin, stripe, {
          subscriptionId: subscription.id,
          factoryIdFromMetadata: subscription.metadata?.factory_id,
        });

        if (!factory) {
          logStep("Factory not found for subscription update");
          await logWebhookError(supabaseAdmin, {
            message: `Subscription updated but no factory found. Subscription: ${subscription.id}, Status: ${subscription.status}`,
            eventType: event.type,
            eventId: event.id,
            metadata: { subscriptionId: subscription.id, status: subscription.status },
          });
          break;
        }

        {
          const status = subscription.status === 'active' ? 'active' :
                        subscription.status === 'trialing' ? 'trialing' :
                        subscription.status === 'past_due' ? 'past_due' :
                        subscription.status === 'canceled' ? 'canceled' :
                        subscription.status === 'unpaid' ? 'expired' : 'inactive';

          const { tier, maxLines } = deriveTierFromSubscription(subscription);

          await supabaseAdmin
            .from('factory_accounts')
            .update({
              subscription_status: status,
              subscription_tier: tier,
              max_lines: maxLines,
            })
            .eq('id', factory.id);

          logStep("Factory status updated", { factoryId: factory.id, status, tier });
        }
        break;
      }

      // ============================================================
      // SUBSCRIPTION DELETED: Subscription ended or cancelled
      // Handles pending downgrades by creating new subscription at lower tier
      // ============================================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", {
          subscriptionId: subscription.id,
          hasPendingDowngrade: !!subscription.metadata?.pending_downgrade_tier,
        });

        const factory = await findFactory(supabaseAdmin, stripe, {
          subscriptionId: subscription.id,
          factoryIdFromMetadata: subscription.metadata?.factory_id,
        });

        if (!factory) {
          logStep("Factory not found for deleted subscription");
          await logWebhookError(supabaseAdmin, {
            message: `Subscription deleted but no factory found. Subscription: ${subscription.id}`,
            eventType: event.type,
            eventId: event.id,
            metadata: { subscriptionId: subscription.id },
          });
          break;
        }

        // Check if this was a scheduled downgrade
        const pendingDowngradeTier = subscription.metadata?.pending_downgrade_tier;
        const pendingDowngradePriceId = subscription.metadata?.pending_downgrade_price_id;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

        if (pendingDowngradeTier && pendingDowngradePriceId) {
          // Create new subscription at the downgraded tier
          logStep("Processing pending downgrade", { newTier: pendingDowngradeTier });

          try {
            const newSubscription = await stripe.subscriptions.create({
              customer: customerId,
              items: [{ price: pendingDowngradePriceId }],
              metadata: {
                factory_id: factory.id,
                tier: pendingDowngradeTier,
                interval: subscription.metadata?.pending_downgrade_interval || 'month',
              },
            });

            const maxLines = PLAN_TIERS[pendingDowngradeTier]?.maxLines || 30;

            await supabaseAdmin
              .from('factory_accounts')
              .update({
                stripe_subscription_id: newSubscription.id,
                subscription_status: 'active',
                subscription_tier: pendingDowngradeTier,
                max_lines: maxLines,
                pending_plan_change: null,
              })
              .eq('id', factory.id);

            logStep("Downgrade completed", {
              factoryId: factory.id,
              newTier: pendingDowngradeTier,
              newSubscriptionId: newSubscription.id,
            });
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logStep("Failed to create downgrade subscription", { error: errorMessage });

            // Mark as canceled since we couldn't create the new subscription
            await supabaseAdmin
              .from('factory_accounts')
              .update({
                subscription_status: 'canceled',
                stripe_subscription_id: null,
                pending_plan_change: null,
              })
              .eq('id', factory.id);

            // Alert admins: downgrade failed, subscription canceled
            await logWebhookError(supabaseAdmin, {
              message: `Plan downgrade failed — subscription has been canceled. Intended tier: ${pendingDowngradeTier}. Error: ${errorMessage}`,
              eventType: event.type,
              eventId: event.id,
              factoryId: factory.id,
              stack: err instanceof Error ? err.stack : undefined,
              metadata: { subscriptionId: subscription.id, intendedTier: pendingDowngradeTier },
            });
          }
        } else {
          // Regular cancellation (not a downgrade)
          await supabaseAdmin
            .from('factory_accounts')
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              pending_plan_change: null,
            })
            .eq('id', factory.id);

          logStep("Subscription canceled", { factoryId: factory.id });

          // Send cancellation notification
          try {
            const { data: admins } = await supabaseAdmin
              .from('profiles')
              .select('email')
              .eq('factory_id', factory.id);

            if (admins && admins.length > 0) {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-billing-notification`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  type: 'subscription_canceled',
                  factoryId: factory.id,
                  email: admins[0].email,
                  factoryName: factory.name,
                }),
              });
            }
          } catch (notifErr) {
            logStep("Failed to send cancellation notification");
            await logWebhookError(supabaseAdmin, {
              message: `Failed to send subscription cancellation notification for factory ${factory.name || factory.id}`,
              eventType: event.type,
              eventId: event.id,
              factoryId: factory.id,
              metadata: { error: notifErr instanceof Error ? notifErr.message : String(notifErr) },
            });
          }
        }
        break;
      }

      // ============================================================
      // PAYMENT FAILED: Mark subscription as past due
      // ============================================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { invoiceId: invoice.id });

        const factory = await findFactory(supabaseAdmin, stripe, {
          subscriptionId: invoice.subscription as string,
          customerId: invoice.customer as string,
        });

        if (!factory) {
          logStep("Factory not found for failed payment");
          await logWebhookError(supabaseAdmin, {
            message: `Payment failed but no factory found. Invoice: ${invoice.id}, Customer: ${invoice.customer}`,
            eventType: event.type,
            eventId: event.id,
            metadata: { invoiceId: invoice.id, customerId: invoice.customer },
          });
          break;
        }

        if (factory) {
          await supabaseAdmin
            .from('factory_accounts')
            .update({
              subscription_status: 'past_due',
              payment_failed_at: new Date().toISOString(),
            })
            .eq('id', factory.id);

          logStep("Factory marked as past due", { factoryId: factory.id });

          // Send payment failed notification
          try {
            const { data: admins } = await supabaseAdmin
              .from('profiles')
              .select('email')
              .eq('factory_id', factory.id);

            if (admins && admins.length > 0) {
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-billing-notification`, {
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
            }
          } catch (notifErr) {
            logStep("Failed to send payment failed notification");
            await logWebhookError(supabaseAdmin, {
              message: `Failed to send payment failure notification for factory ${factory.name || factory.id}`,
              eventType: event.type,
              eventId: event.id,
              factoryId: factory.id,
              metadata: { error: notifErr instanceof Error ? notifErr.message : String(notifErr) },
            });
          }
        }
        break;
      }

      // ============================================================
      // PAYMENT SUCCEEDED: Reactivate subscription if it was past due
      // ============================================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment succeeded", { invoiceId: invoice.id });

        const factory = await findFactory(supabaseAdmin, stripe, {
          subscriptionId: invoice.subscription as string,
          customerId: invoice.customer as string,
        });

        if (!factory) {
          logStep("Factory not found for successful payment");
          await logWebhookError(supabaseAdmin, {
            message: `Payment succeeded but no factory found. Invoice: ${invoice.id}, Customer: ${invoice.customer}`,
            eventType: event.type,
            eventId: event.id,
            metadata: { invoiceId: invoice.id, customerId: invoice.customer },
          });
          break;
        }

        if (factory) {
          const updates: Record<string, unknown> = {
            subscription_status: 'active',
            payment_failed_at: null,
          };

          // Sync Stripe IDs if they've changed
          if (factory.stripe_customer_id !== invoice.customer) {
            updates.stripe_customer_id = invoice.customer as string;
          }
          if (invoice.subscription) {
            updates.stripe_subscription_id = invoice.subscription as string;
          }

          await supabaseAdmin
            .from('factory_accounts')
            .update(updates)
            .eq('id', factory.id);

          logStep("Factory reactivated", { factoryId: factory.id });
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
    const errorStack = error instanceof Error ? error.stack : undefined;
    logStep("ERROR", { message: errorMessage });

    // Log unhandled webhook errors to database for admin visibility
    await logWebhookError(supabaseAdmin, {
      message: `Webhook processing failed: ${errorMessage}`,
      eventType: 'unknown',
      eventId: 'unknown',
      stack: errorStack,
    });

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
