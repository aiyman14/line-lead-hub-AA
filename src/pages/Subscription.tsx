import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { openExternalUrl } from "@/lib/capacitor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  Crown, 
  LogOut, 
  Mail,
  Percent
} from "lucide-react";
import { 
  PLAN_TIERS, 
  formatPlanPrice, 
  type PlanTierConfig, 
  type PlanTier,
  type BillingInterval,
  getDisplayPrice,
  getMonthlyEquivalent
} from "@/lib/plan-tiers";

interface SubscriptionStatus {
  subscribed: boolean;
  hasAccess: boolean;
  isTrial?: boolean;
  trialEndDate?: string;
  daysRemaining?: number;
  subscriptionEnd?: string;
  needsPayment?: boolean;
  needsFactory?: boolean;
  currentTier?: string;
}

export default function Subscription() {
  const { user, profile, isAdminOrHigher, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');

  useEffect(() => {
    const payment = searchParams.get('payment');
    const interval = searchParams.get('interval');
    if (payment === 'success') {
      toast({
        title: "Payment successful!",
        description: `Your subscription is now active${interval === 'year' ? ' (Yearly)' : ''}.`,
      });
    } else if (payment === 'cancelled') {
      toast({
        variant: "destructive",
        title: "Payment cancelled",
        description: "You can try again when you're ready.",
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    checkSubscription();
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) throw error;
      setStatus(data);
    } catch (err) {
      console.error('Error checking subscription:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to check subscription status.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    setTrialLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier: 'starter', startTrial: true, interval: billingInterval }
      });
      
      if (error) throw error;
      
      if (data.url) {
        await openExternalUrl(data.url);
      }
    } catch (err) {
      console.error('Error starting trial:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start trial. Please try again.",
      });
    } finally {
      setTrialLoading(false);
    }
  };

  const handleSubscribe = async (tier: PlanTierConfig) => {
    if (tier.id === 'enterprise') {
      await openExternalUrl('https://www.woventex.co');
      return;
    }
    
    setCheckoutLoading(tier.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier: tier.id, interval: billingInterval }
      });
      
      if (error) throw error;
      
      if (data.url) {
        await openExternalUrl(data.url);
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data.url) {
        await openExternalUrl(data.url);
      }
    } catch (err) {
      console.error('Error opening portal:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminOrHigher()) {
    return (
      <div className="container max-w-2xl py-8 px-4">
        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              Only factory owners and admins can manage subscriptions.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentTier = (status?.currentTier || 'starter') as PlanTier;
  const tiers = Object.values(PLAN_TIERS);
  const tierOrder: PlanTier[] = ['starter', 'growth', 'scale', 'enterprise'];
  const isYearly = billingInterval === 'year';

  return (
    <div className="container max-w-6xl py-8 px-4">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription</h1>
          <p className="text-muted-foreground mt-1">
            Choose the plan that fits your factory's needs
          </p>
        </div>
        <Button variant="outline" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Current Status Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Subscription Status
                {status?.hasAccess && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                )}
                {status?.isTrial && (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Trial
                  </Badge>
                )}
                {!status?.hasAccess && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Inactive
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-2">
                {status?.subscribed && `You're on the ${PLAN_TIERS[currentTier]?.name || 'Starter'} plan.`}
                {status?.isTrial && status.daysRemaining && `Trial ends in ${status.daysRemaining} days.`}
                {status?.needsPayment && "Subscribe to access all features."}
                {status?.needsFactory && "Create your factory to get started."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {status?.isTrial && status.trialEndDate && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4 inline mr-2" />
                <span className="font-medium">Trial expires:</span>{" "}
                {new Date(status.trialEndDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}
          
          {status?.subscriptionEnd && !status?.isTrial && (
            <div className="bg-muted rounded-lg p-4 mb-4">
              <p className="text-sm">
                <span className="font-medium">Next billing date:</span>{" "}
                {new Date(status.subscriptionEnd).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {status?.hasAccess && (
              <Button 
                onClick={() => navigate('/dashboard')} 
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            )}
            
            {status?.subscribed && (
              <Button 
                onClick={handleManageSubscription} 
                disabled={portalLoading}
                variant="outline"
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Manage Billing
              </Button>
            )}
            
            {(status?.subscribed || status?.isTrial) && (
              <Button 
                onClick={() => navigate('/billing')} 
                variant="outline"
              >
                View Billing History
              </Button>
            )}
            
            <Button onClick={checkSubscription} variant="ghost">
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Tiers */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
            <p className="text-muted-foreground">
              All plans include a 14-day free trial. Pricing based on active production lines.
            </p>
          </div>
          
          {/* Billing Interval Toggle */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Label 
              htmlFor="billing-toggle-sub" 
              className={`text-sm font-medium cursor-pointer ${billingInterval === 'month' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              Monthly
            </Label>
            <Switch
              id="billing-toggle-sub"
              checked={billingInterval === 'year'}
              onCheckedChange={(checked) => setBillingInterval(checked ? 'year' : 'month')}
            />
            <div className="flex items-center gap-1.5">
              <Label 
                htmlFor="billing-toggle-sub" 
                className={`text-sm font-medium cursor-pointer ${billingInterval === 'year' ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                Yearly
              </Label>
              {isYearly && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  <Percent className="h-3 w-3 mr-1" />
                  Save 15%
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {tiers.map((tier) => {
          const isCurrentPlan = status?.subscribed && currentTier === tier.id;
          const currentTierIndex = tierOrder.indexOf(currentTier);
          const thisTierIndex = tierOrder.indexOf(tier.id);
          const isUpgrade = status?.subscribed && thisTierIndex > currentTierIndex;
          const isDowngrade = status?.subscribed && thisTierIndex < currentTierIndex;
          
          const displayPrice = getDisplayPrice(tier, billingInterval);
          const monthlyEquivalent = isYearly ? getMonthlyEquivalent(tier.priceYearly) : null;
          
          return (
            <Card 
              key={tier.id} 
              className={`relative flex flex-col ${
                tier.popular ? 'border-2 border-primary shadow-lg' : ''
              } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
            >
              {/* Badges container */}
              <div className="absolute -top-3 left-0 right-0 flex justify-between px-4">
                {tier.popular && (
                  <Badge className="bg-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                )}
                {!tier.popular && <span />}
                
                {isCurrentPlan ? (
                  <Badge className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Current Plan
                  </Badge>
                ) : isYearly && tier.priceMonthly > 0 ? (
                  <Badge className="bg-green-600 text-white">
                    15% off
                  </Badge>
                ) : null}
              </div>

              <CardHeader className="text-center pb-4 pt-8">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  {tier.id === 'enterprise' ? (
                    <Crown className="h-6 w-6 text-primary" />
                  ) : (
                    <Sparkles className="h-6 w-6 text-primary" />
                  )}
                </div>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  {displayPrice === 0 ? (
                    <span className="text-3xl font-bold">Custom</span>
                  ) : isYearly ? (
                    <div>
                      <span className="text-3xl font-bold">{formatPlanPrice(displayPrice)}</span>
                      <span className="text-muted-foreground">/year</span>
                      {monthlyEquivalent && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ({formatPlanPrice(monthlyEquivalent)}/mo equivalent)
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">{formatPlanPrice(displayPrice)}</span>
                      <span className="text-muted-foreground">/month</span>
                    </>
                  )}
                </div>
                
                <ul className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                {!status?.hasAccess ? (
                  <div className="w-full space-y-2">
                    {tier.id === 'starter' && (
                      <Button 
                        onClick={handleStartTrial} 
                        disabled={trialLoading}
                        className="w-full"
                        size="lg"
                      >
                        {trialLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Clock className="h-4 w-4 mr-2" />
                        )}
                        Start 14-Day Free Trial
                      </Button>
                    )}
                    {tier.id === 'enterprise' ? (
                      <Button 
                        onClick={() => handleSubscribe(tier)} 
                        variant="outline"
                        className="w-full"
                        size="lg"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Contact Sales
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => handleSubscribe(tier)} 
                        disabled={checkoutLoading === tier.id}
                        variant={tier.id === 'starter' ? 'outline' : 'default'}
                        className="w-full"
                        size="lg"
                      >
                        {checkoutLoading === tier.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <CreditCard className="h-4 w-4 mr-2" />
                        )}
                        Subscribe Now
                      </Button>
                    )}
                  </div>
                ) : isCurrentPlan ? (
                  <Button disabled variant="outline" className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Current Plan
                  </Button>
                ) : tier.id === 'enterprise' ? (
                  <Button 
                    onClick={() => handleSubscribe(tier)}
                    variant="outline"
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Contact Sales
                  </Button>
                ) : (
                  <Button 
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    variant={isUpgrade ? 'default' : 'outline'}
                    className="w-full"
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    {isUpgrade ? 'Upgrade' : 'Downgrade'}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* FAQ / Info */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">How does the free trial work?</h4>
            <p className="text-sm text-muted-foreground">
              Start with a 14-day free trial of the Starter plan. No credit card required. 
              You'll have full access to all features during the trial (up to 30 active lines).
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Can I upgrade or downgrade my plan?</h4>
            <p className="text-sm text-muted-foreground">
              Yes! You can change your plan anytime. Upgrades take effect immediately with prorated billing. 
              Downgrades take effect at the end of your current billing period.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">How does yearly billing work?</h4>
            <p className="text-sm text-muted-foreground">
              Choose yearly billing to save 15% compared to monthly payments. 
              You'll be billed once per year at the discounted rate.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">What happens if I cancel?</h4>
            <p className="text-sm text-muted-foreground">
              You'll continue to have access until the end of your billing period. 
              Your data is retained for 30 days after cancellation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}