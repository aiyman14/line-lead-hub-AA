import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export function useSubscription() {
  const { user, profile, factory } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback: check subscription status directly from factory data
  const checkFromFactory = useCallback(() => {
    if (!profile?.factory_id || !factory) {
      return {
        subscribed: false,
        hasAccess: false,
        needsFactory: !profile?.factory_id,
        needsPayment: false
      };
    }

    const now = new Date();
    
    // Check trial status
    if (factory.subscription_status === 'trial' && factory.trial_end_date) {
      const trialEnd = new Date(factory.trial_end_date);
      if (trialEnd > now) {
        const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          subscribed: false,
          hasAccess: true,
          isTrial: true,
          trialEndDate: factory.trial_end_date,
          daysRemaining,
        };
      }
    }

    // Check active subscription
    if (factory.subscription_status === 'active') {
      return {
        subscribed: true,
        hasAccess: true,
        isTrial: false,
      };
    }

    // Check trialing status (Stripe trial)
    if (factory.subscription_status === 'trialing') {
      return {
        subscribed: true,
        hasAccess: true,
        isTrial: true,
      };
    }

    // No valid subscription
    return {
      subscribed: false,
      hasAccess: false,
      needsPayment: true
    };
  }, [profile?.factory_id, factory]);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Verify we have a valid session before calling the edge function
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        // No valid session yet, use fallback
        const fallbackStatus = checkFromFactory();
        setStatus(fallbackStatus);
        setLoading(false);
        return;
      }
      
      const { data, error: fnError } = await supabase.functions.invoke('check-subscription');
      
      if (fnError) {
        throw fnError;
      }
      
      setStatus(data);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError('Failed to check subscription status');
      // Fallback to checking factory data directly
      const fallbackStatus = checkFromFactory();
      setStatus(fallbackStatus);
    } finally {
      setLoading(false);
    }
  }, [user, checkFromFactory]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Refresh every minute
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  return {
    status,
    loading,
    error,
    refresh: checkSubscription,
    hasAccess: status?.hasAccess ?? false,
    isTrial: status?.isTrial ?? false,
    needsPayment: status?.needsPayment ?? false,
    needsFactory: status?.needsFactory ?? false,
  };
}
