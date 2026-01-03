import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Clock, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

interface SubscriptionStatus {
  subscribed: boolean;
  hasAccess: boolean;
  isTrial?: boolean;
  trialEndDate?: string;
  daysRemaining?: number;
  subscriptionEnd?: string;
  needsPayment?: boolean;
  needsFactory?: boolean;
}

export default function Subscription() {
  const { user, profile, isAdminOrHigher } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    // Handle payment result from URL
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast({
        title: "Payment successful!",
        description: "Your subscription is now active.",
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
        body: { startTrial: true }
      });
      
      if (error) throw error;
      
      if (data.success && data.trial) {
        toast({
          title: "Trial started!",
          description: "You have 14 days to explore all features.",
        });
        navigate('/setup/factory');
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

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data.url) {
        window.open(data.url, '_blank');
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

  // Only owners/admins can manage subscription
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

  return (
    <div className="container max-w-4xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Subscription</h1>
        <p className="text-muted-foreground mt-1">
          Manage your Production Portal subscription
        </p>
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
                {status?.subscribed && "You have an active subscription."}
                {status?.isTrial && status.daysRemaining && `Trial ends in ${status.daysRemaining} days.`}
                {status?.needsPayment && "Subscribe to access all features."}
                {status?.needsFactory && "Create your factory to get started."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {status?.isTrial && status.trialEndDate && (
            <div className="bg-muted rounded-lg p-4 mb-4">
              <p className="text-sm">
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
          
          {status?.subscriptionEnd && (
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

      {/* Pricing Card - Only show if no active subscription */}
      {!status?.hasAccess && (
        <Card className="border-2 border-primary">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Production Portal</CardTitle>
            <CardDescription>
              Complete factory management solution
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="mb-6">
              <span className="text-4xl font-bold">$350</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            
            <ul className="text-left space-y-3 mb-8">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Unlimited production tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Real-time insights & analytics</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Unlimited users</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Work order management</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Blocker tracking & alerts</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Email reports & notifications</span>
              </li>
            </ul>

            <div className="space-y-3">
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
              
              <Button 
                onClick={handleSubscribe} 
                disabled={checkoutLoading}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {checkoutLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Subscribe Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
