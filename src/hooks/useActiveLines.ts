import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { mapLegacyTier, PLAN_TIERS, PlanTier } from '@/lib/plan-tiers';

interface ActiveLinesStatus {
  activeCount: number;
  archivedCount: number;
  maxLines: number | null; // null = unlimited
  planTier: PlanTier;
  canActivateMore: boolean;
  isAtLimit: boolean;
  needsEnterprise: boolean;
}

export function useActiveLines() {
  const { profile, factory } = useAuth();
  const factoryId = profile?.factory_id;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['active-lines', factoryId],
    queryFn: async () => {
      if (!factoryId) throw new Error('No factory');

      // Single parallel fetch instead of 3 sequential calls
      const [activeRes, archivedRes, factoryRes] = await Promise.all([
        supabase.from('lines').select('id').eq('factory_id', factoryId).eq('is_active', true),
        supabase.from('lines').select('id').eq('factory_id', factoryId).eq('is_active', false),
        supabase.from('factory_accounts').select('max_lines, subscription_tier').eq('id', factoryId).single(),
      ]);

      if (activeRes.error) throw activeRes.error;
      if (archivedRes.error) throw archivedRes.error;
      if (factoryRes.error) throw factoryRes.error;

      return {
        activeCount: activeRes.data?.length || 0,
        archivedCount: archivedRes.data?.length || 0,
        dbMaxLines: factoryRes.data?.max_lines,
        dbTier: factoryRes.data?.subscription_tier,
      };
    },
    enabled: !!factoryId,
    staleTime: 60_000, // Cache for 60s — prevents duplicate calls across components
  });

  const status = useMemo<ActiveLinesStatus | null>(() => {
    if (!data) return null;

    const planTier = mapLegacyTier(data.dbTier || factory?.subscription_tier || 'starter');
    const planConfig = PLAN_TIERS[planTier];
    const maxLines = data.dbMaxLines ?? factory?.max_lines ?? planConfig.maxActiveLines;

    const isAtLimit = maxLines !== null && data.activeCount >= maxLines;
    const canActivateMore = maxLines === null || data.activeCount < maxLines;
    const needsEnterprise = data.activeCount >= 100 && planTier !== 'enterprise';

    return {
      activeCount: data.activeCount,
      archivedCount: data.archivedCount,
      maxLines,
      planTier,
      canActivateMore,
      isAtLimit,
      needsEnterprise,
    };
  }, [data, factory?.subscription_tier, factory?.max_lines]);

  return {
    status,
    loading: isLoading,
    error: error?.message ?? null,
    refresh: refetch,
    activeCount: status?.activeCount ?? 0,
    maxLines: status?.maxLines,
    canActivateMore: status?.canActivateMore ?? true,
    isAtLimit: status?.isAtLimit ?? false,
    planTier: status?.planTier ?? 'starter',
  };
}
