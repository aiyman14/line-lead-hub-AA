import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  CreditCard, 
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Rows3,
  Mail,
  Star,
  ExternalLink
} from "lucide-react";
import { ActiveLinesMeter } from "@/components/ActiveLinesMeter";
import { useActiveLines } from "@/hooks/useActiveLines";
import { PLAN_TIERS, formatPlanPrice, getNextTier, PlanTier, mapLegacyTier } from "@/lib/plan-tiers";

export default function BillingPlan() {
  const { user, factory, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { status: lineStatus, loading: linesLoading, refresh: refetchLines } = useActiveLines();
  
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const currentTier = mapLegacyTier(factory?.subscription_tier || 'starter');
  const currentPlan = PLAN_TIERS[currentTier];
  const subscriptionStatus = factory?.subscription_status || 'inactive';

  // Handle payment success/cancel from URL params
  useEffect(() => {
    const payment = searchParams.get('payment');
    const tier = searchParams.get('tier');
    
    if (payment === 'success') {
      toast({
        title: "Payment Successful!",
        description: tier 
          ? `You've been upgraded to the ${PLAN_TIERS[tier as PlanTier]?.name || tier} plan.`
          : "Your subscription is now active.",
      });
      // Clear the params
      navigate('/billing-plan', { replace: true });
      // Refetch subscription status
      refetchLines();
    } else if (payment === 'cancelled') {
      toast({
        variant: "destructive",
        title: "Payment Cancelled",
        description: "You can try again whenever you're ready.",
      });
      navigate('/billing-plan', { replace: true });
    }
  }, [searchParams, toast, navigate, refetchLines]);

  const handleSubscribe = async (tier: PlanTier) => {
    if (tier === 'enterprise') {
      handleContactSales();
      return;
    }

    setCheckoutLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier }
      });
      
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, '_blank');
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error('Error creating checkout:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to start checkout. Please try again.",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleStartTrial = async (tier: PlanTier = 'starter') => {
    setCheckoutLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier, startTrial: true }
      });
      
      if (error) throw error;
      
      if (data.success && data.trial) {
        toast({
          title: "Trial Started!",
          description: `Your 14-day trial of the ${PLAN_TIERS[tier].name} plan has begun.`,
        });
        refetchLines();
        if (data.redirectUrl) {
          navigate(data.redirectUrl);
        }
      } else if (data.url) {
        window.open(data.url, '_blank');
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error('Error starting trial:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to start trial. Please try again.",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, '_blank');
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error('Error opening portal:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to open billing portal. Please try again.",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:sales@productionportal.app?subject=Enterprise%20Plan%20Inquiry';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge variant="secondary">Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge variant="outline">Canceled</Badge>;
      case 'trial':
        return <Badge variant="secondary">Trial</Badge>;
      default:
        return <Badge variant="outline">{status || 'Inactive'}</Badge>;
    }
  };

  const hasActiveSubscription = ['active', 'trialing', 'trial'].includes(subscriptionStatus);

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!isAdminOrHigher()) {
    return (
      <div className="container max-w-2xl py-8 px-4">
        <Card>
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>Access Restricted</CardTitle>
            <CardDescription>
              Only factory owners and admins can view billing and plan information.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Billing & Plan</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and active line usage
        </p>
      </div>

      {/* Current Status Overview */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Active Lines Meter */}
        <ActiveLinesMeter showUpgrade={false} />

        {/* Current Plan Card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Current Plan</p>
                  <p className="text-xs text-muted-foreground">Subscription status</p>
                </div>
              </div>
              {getStatusBadge(subscriptionStatus)}
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{currentPlan.name}</p>
              <p className="text-sm text-muted-foreground">
                {currentPlan.priceMonthly > 0 
                  ? `${formatPlanPrice(currentPlan.priceMonthly)} / month`
                  : 'Custom pricing'}
              </p>
            </div>
            {hasActiveSubscription && (
              <Button 
                onClick={handleManageBilling} 
                disabled={portalLoading}
                variant="outline"
                className="w-full mt-4"
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Billing
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* Plan Tiers */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Available Plans</h2>
        <p className="text-muted-foreground text-sm">
          All plans include full access to all production modules. Plans are based on active production lines.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.values(PLAN_TIERS).map((plan) => {
          const isCurrent = plan.id === currentTier;
          const isUpgrade = !isCurrent && (
            (currentTier === 'starter' && ['growth', 'scale', 'enterprise'].includes(plan.id)) ||
            (currentTier === 'growth' && ['scale', 'enterprise'].includes(plan.id)) ||
            (currentTier === 'scale' && plan.id === 'enterprise')
          );
          const isDowngrade = !isCurrent && !isUpgrade && plan.id !== 'enterprise';
          const isLoading = checkoutLoading === plan.id;

          return (
            <Card 
              key={plan.id} 
              className={`relative ${isCurrent ? 'border-primary ring-2 ring-primary/20' : ''} ${plan.popular ? 'border-primary/50' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">
                    <Star className="h-3 w-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <Badge variant="secondary">Current</Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="mb-4">
                  {plan.priceMonthly > 0 ? (
                    <>
                      <span className="text-3xl font-bold">
                        {formatPlanPrice(plan.priceMonthly)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold">Custom</span>
                  )}
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded mb-4">
                  <Rows3 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {plan.maxActiveLines ? `Up to ${plan.maxActiveLines} lines` : 'Unlimited lines'}
                  </span>
                </div>
                <ul className="space-y-2">
                  {plan.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.id === 'enterprise' ? (
                  <Button 
                    onClick={handleContactSales}
                    variant={isCurrent ? "outline" : "default"}
                    className="w-full"
                    disabled={isCurrent}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isCurrent ? 'Current Plan' : 'Contact Sales'}
                  </Button>
                ) : isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : !hasActiveSubscription ? (
                  <Button 
                    onClick={() => handleSubscribe(plan.id)}
                    variant="default"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Subscribe
                  </Button>
                ) : (
                  <Button 
                    onClick={handleManageBilling}
                    variant={isUpgrade ? "default" : "outline"}
                    className="w-full"
                    disabled={portalLoading}
                  >
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : isUpgrade ? (
                      <>
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Upgrade
                      </>
                    ) : (
                      'Switch Plan'
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Need More Lines Banner */}
      {lineStatus && lineStatus.isAtLimit && currentTier !== 'enterprise' && (
        <Card className="mt-8 border-warning bg-warning/5">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-warning/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="font-semibold">Need more production lines?</p>
                <p className="text-sm text-muted-foreground">
                  You've reached your plan's active line limit. Upgrade to add more lines.
                </p>
              </div>
            </div>
            {getNextTier(currentTier) === 'enterprise' ? (
              <Button onClick={handleContactSales}>
                <Mail className="h-4 w-4 mr-2" />
                Contact Sales
              </Button>
            ) : hasActiveSubscription ? (
              <Button onClick={handleManageBilling} disabled={portalLoading}>
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Upgrade Plan
              </Button>
            ) : (
              <Button onClick={() => handleSubscribe(getNextTier(currentTier) || 'growth')}>
                <TrendingUp className="h-4 w-4 mr-2" />
                Subscribe Now
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Subscription CTA */}
      {!hasActiveSubscription && (
        <Card className="mt-8 border-primary bg-primary/5">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Get Started Today</p>
                <p className="text-sm text-muted-foreground">
                  Start your 14-day free trial or subscribe to a plan.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleStartTrial('starter')}
                disabled={checkoutLoading === 'starter'}
              >
                {checkoutLoading === 'starter' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Start Free Trial
              </Button>
              <Button 
                onClick={() => handleSubscribe('growth')}
                disabled={checkoutLoading === 'growth'}
              >
                {checkoutLoading === 'growth' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Subscribe
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ Section */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What counts as an active line?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                An active line is any production line with status set to "Active" in your Factory Setup. 
                Archived/inactive lines don't count toward your limit and can be reactivated anytime.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Can I archive lines to stay under my limit?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Yes! You can archive any line to free up a slot. Archived lines keep their historical data 
                but won't appear in dropdowns or require submissions.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What happens if I need more than 100 lines?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                For factories with more than 100 active lines, we offer custom Enterprise plans. 
                Contact our sales team for personalized pricing and support.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Are all modules included in every plan?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Yes! All plans include full access to Sewing, Cutting, Finishing, and Storing modules. 
                Plans differ only by the number of active production lines allowed.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
