import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { Loader2, AlertCircle, Lock, LogOut, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

export function SubscriptionGate({ children }: SubscriptionGateProps) {
  const { user, profile, loading: authLoading, roles, hasRole, signOut } = useAuth();
  const { hasAccess, needsFactory, needsPayment, loading: subLoading, isTrial, status } = useSubscription();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // If user was invited to an existing factory (has factory_id but is not the owner), 
  // they don't need to pay - the factory owner pays
  // Supervisors and admins who are invited should also have access
  const isOwner = hasRole('owner');
  const isSuperAdmin = hasRole('superadmin');
  const isInvitedUser = profile?.factory_id && !isOwner && !isSuperAdmin;

  // Still loading
  if (authLoading || subLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return null;
  }

  // Invited users don't need their own subscription
  if (isInvitedUser) {
    // Check if the factory has access
    if (!hasAccess) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-4">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <CardTitle>Account Suspended</CardTitle>
              <CardDescription>
                Your factory's subscription has expired. Please contact your factory administrator 
                to reactivate the subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={() => navigate('/billing-plan')} className="w-full">
                <CreditCard className="h-4 w-4 mr-2" />
                Renew Subscription
              </Button>
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return <>{children}</>;
  }

  // User has subscription but needs to create a factory
  if (needsFactory && hasAccess) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-primary mb-4" />
            <CardTitle>Almost There!</CardTitle>
            <CardDescription>
              Your subscription is active{isTrial ? ' (trial)' : ''}. Now let's set up your factory to get started.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => navigate('/setup/factory')} className="w-full">
              Set Up Your Factory
            </Button>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin/Owner who needs to subscribe first (no active subscription and no factory)
  if (needsFactory && !hasAccess) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-primary mb-4" />
            <CardTitle>Welcome to Production Portal</CardTitle>
            <CardDescription>
              Start your 14-day free trial or subscribe to begin setting up your factory.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => navigate('/subscription')} className="w-full">
              Get Started
            </Button>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No access - needs payment
  if (!hasAccess && needsPayment) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Subscription Required</CardTitle>
            <CardDescription>
              Your subscription has expired or payment has failed. 
              Please update your billing to continue using Production Portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => navigate('/subscription')} className="w-full">
              Manage Subscription
            </Button>
            <Button onClick={handleSignOut} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Has access - render children
  return <>{children}</>;
}
