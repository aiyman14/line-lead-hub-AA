// Subscription tier configuration
// Using existing ProductionPortal product/price as Professional tier

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  priceId: string;
  productId: string;
  features: string[];
  maxLines: number;
  popular?: boolean;
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Essential features for small factories',
    price: 15000, // $150/month
    priceId: 'price_starter', // Will use Stripe portal for tier changes
    productId: 'prod_starter',
    maxLines: 5,
    features: [
      'Up to 5 production lines',
      'Basic production tracking',
      'Daily insights',
      'Up to 10 users',
      'Email support',
    ],
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Advanced features for growing factories',
    price: 35000, // $350/month
    priceId: 'price_1SlX0pHuCf2bKZx0PL2u7wGh',
    productId: 'prod_TiyyTbfdb4jtLQ',
    maxLines: 15,
    popular: true,
    features: [
      'Up to 15 production lines',
      'Real-time insights & analytics',
      'Work order management',
      'Blocker tracking & alerts',
      'Unlimited users',
      'Email reports & notifications',
      'Priority support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full features for large operations',
    price: 75000, // $750/month
    priceId: 'price_enterprise', // Will use Stripe portal for tier changes
    productId: 'prod_enterprise',
    maxLines: -1, // Unlimited
    features: [
      'Unlimited production lines',
      'All Professional features',
      'Custom integrations',
      'Dedicated account manager',
      'API access',
      'SLA guarantee',
      'Phone support',
    ],
  },
};

export const getTierById = (tierId: string): SubscriptionTier | undefined => {
  return SUBSCRIPTION_TIERS[tierId];
};

export const getTierByProductId = (productId: string): SubscriptionTier | undefined => {
  return Object.values(SUBSCRIPTION_TIERS).find(tier => tier.productId === productId);
};

export const formatPrice = (priceInCents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceInCents / 100);
};
