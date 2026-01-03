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
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke('check-subscription');
      
      if (fnError) {
        throw fnError;
      }
      
      setStatus(data);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError('Failed to check subscription status');
      // Default to no access on error
      setStatus({
        subscribed: false,
        hasAccess: false,
        needsPayment: true
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

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
