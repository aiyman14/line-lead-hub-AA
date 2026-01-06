// Plan tier configuration for active-line-based billing

export type PlanTier = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface PlanTierConfig {
  id: PlanTier;
  name: string;
  description: string;
  priceMonthly: number; // in cents
  maxActiveLines: number | null; // null = unlimited
  features: string[];
  popular?: boolean;
}

export const PLAN_TIERS: Record<PlanTier, PlanTierConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small factories',
    priceMonthly: 39999, // $399.99
    maxActiveLines: 30,
    features: [
      'Up to 30 active production lines',
      'All production modules included',
      'Real-time insights & analytics',
      'Work order management',
      'Blocker tracking & alerts',
      'Unlimited users',
      'Email support',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    description: 'For growing operations',
    priceMonthly: 54999, // $549.99
    maxActiveLines: 60,
    popular: true,
    features: [
      'Up to 60 active production lines',
      'All Starter features',
      'Priority email support',
      'Monthly insights reports',
    ],
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    description: 'For large factories',
    priceMonthly: 62999, // $629.99
    maxActiveLines: 100,
    features: [
      'Up to 100 active production lines',
      'All Growth features',
      'Phone support',
      'Dedicated success manager',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For enterprise operations',
    priceMonthly: 0, // Custom pricing
    maxActiveLines: null, // Unlimited
    features: [
      'Unlimited active production lines',
      'All Scale features',
      'Custom integrations',
      'SLA guarantee',
      'API access',
      'On-site training',
    ],
  },
};

export const getPlanById = (planId: string): PlanTierConfig | undefined => {
  return PLAN_TIERS[planId as PlanTier];
};

export const formatPlanPrice = (priceInCents: number): string => {
  if (priceInCents === 0) return 'Custom';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceInCents / 100);
};

export const getMaxLinesDisplay = (maxLines: number | null): string => {
  return maxLines === null ? 'Unlimited' : maxLines.toString();
};

// Map legacy subscription_tier values to new plan tiers
export const mapLegacyTier = (tier: string | null): PlanTier => {
  switch (tier) {
    case 'starter':
      return 'starter';
    case 'professional':
    case 'growth':
      return 'growth';
    case 'scale':
      return 'scale';
    case 'enterprise':
    case 'unlimited':
      return 'enterprise';
    default:
      return 'starter';
  }
};

// Get next upgrade tier
export const getNextTier = (currentTier: PlanTier): PlanTier | null => {
  const tierOrder: PlanTier[] = ['starter', 'growth', 'scale', 'enterprise'];
  const currentIndex = tierOrder.indexOf(currentTier);
  if (currentIndex < tierOrder.length - 1) {
    return tierOrder[currentIndex + 1];
  }
  return null;
};
