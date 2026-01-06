// Plan tier configuration for active-line-based billing
// 
// STRIPE SETUP INSTRUCTIONS:
// You need to create these products and prices in your Stripe Dashboard (Test Mode):
// 1. Go to https://dashboard.stripe.com/test/products
// 2. Create a product for each tier with a monthly recurring price
// 3. Copy the price IDs (price_xxx) and replace the placeholders below

export type PlanTier = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface PlanTierConfig {
  id: PlanTier;
  name: string;
  description: string;
  priceMonthly: number; // in cents
  maxActiveLines: number | null; // null = unlimited
  features: string[];
  popular?: boolean;
  // Stripe IDs - Replace with your actual Stripe price/product IDs
  stripePriceId: string | null;
  stripeProductId: string | null;
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
    // TODO: Replace with your Stripe price ID from Dashboard
    stripePriceId: 'price_starter_monthly',
    stripeProductId: 'prod_Tk0Z6QU3HYNqmx',
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
    // TODO: Replace with your Stripe price ID from Dashboard
    stripePriceId: 'price_growth_monthly',
    stripeProductId: 'prod_Tk0Zyl3J739mGp',
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
    // TODO: Replace with your Stripe price ID from Dashboard
    stripePriceId: 'price_scale_monthly',
    stripeProductId: 'prod_Tk0ZNeXFFFP9jz',
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
    stripePriceId: null, // Custom pricing - contact sales
    stripeProductId: null,
  },
};

// Price ID to tier mapping for webhook/check-subscription use
export const STRIPE_PRICE_TO_TIER: Record<string, PlanTier> = {
  'price_starter_monthly': 'starter',
  'price_growth_monthly': 'growth',
  'price_scale_monthly': 'scale',
};

// Product ID to tier mapping
export const STRIPE_PRODUCT_TO_TIER: Record<string, PlanTier> = {
  'prod_Tk0Z6QU3HYNqmx': 'starter',
  'prod_Tk0Zyl3J739mGp': 'growth',
  'prod_Tk0ZNeXFFFP9jz': 'scale',
};

export const getPlanById = (planId: string): PlanTierConfig | undefined => {
  return PLAN_TIERS[planId as PlanTier];
};

export const getPlanByPriceId = (priceId: string): PlanTierConfig | undefined => {
  const tier = STRIPE_PRICE_TO_TIER[priceId];
  return tier ? PLAN_TIERS[tier] : undefined;
};

export const getPlanByProductId = (productId: string): PlanTierConfig | undefined => {
  const tier = STRIPE_PRODUCT_TO_TIER[productId];
  return tier ? PLAN_TIERS[tier] : undefined;
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

// Get max lines for a tier
export const getMaxLinesForTier = (tier: PlanTier): number | null => {
  return PLAN_TIERS[tier].maxActiveLines;
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
