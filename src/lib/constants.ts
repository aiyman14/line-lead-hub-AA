// Production Portal Constants

export const APP_NAME = "Production Portal";
export const APP_DESCRIPTION = "Garment Factory Production Tracking System";

// Role definitions
export const ROLES = {
  WORKER: 'worker',
  SUPERVISOR: 'supervisor',
  ADMIN: 'admin',
  OWNER: 'owner',
  SUPERADMIN: 'superadmin',
} as const;

export type AppRole = typeof ROLES[keyof typeof ROLES];

// Role display names
export const ROLE_LABELS: Record<AppRole, string> = {
  worker: 'Worker',
  supervisor: 'Supervisor',
  admin: 'Admin',
  owner: 'Owner',
  superadmin: 'Super Admin',
};

// Blocker impact levels
export const BLOCKER_IMPACTS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

export type BlockerImpact = typeof BLOCKER_IMPACTS[keyof typeof BLOCKER_IMPACTS];

export const BLOCKER_IMPACT_LABELS: Record<BlockerImpact, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const BLOCKER_IMPACT_COLORS: Record<BlockerImpact, string> = {
  low: 'blocker-low',
  medium: 'blocker-medium',
  high: 'blocker-high',
  critical: 'blocker-critical',
};

// Blocker status
export const BLOCKER_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
} as const;

export type BlockerStatus = typeof BLOCKER_STATUS[keyof typeof BLOCKER_STATUS];

export const BLOCKER_STATUS_LABELS: Record<BlockerStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

// Subscription tiers
export const SUBSCRIPTION_TIERS = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
  UNLIMITED: 'unlimited',
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
  unlimited: 'Unlimited',
};

export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  starter: 10,
  professional: 30,
  enterprise: 80,
  unlimited: 999,
};

// Shifts
export const SHIFTS = [
  { value: 'day', label: 'Day Shift' },
  { value: 'night', label: 'Night Shift' },
  { value: 'overtime', label: 'Overtime' },
] as const;

// Stage Progress Options (fixed percentage values)
export const STAGE_PROGRESS_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 15, label: '15%' },
  { value: 25, label: '25%' },
  { value: 50, label: '50%' },
  { value: 60, label: '60%' },
  { value: 75, label: '75%' },
  { value: 80, label: '80%' },
  { value: 90, label: '90%' },
  { value: 100, label: '100%' },
] as const;

// Default stages (AppSheet specification)
export const DEFAULT_STAGES = [
  { code: 'PRE_PROD', name: 'Pre Production', sequence: 1 },
  { code: 'MAT_INHOUSE', name: 'Materials In-House', sequence: 2 },
  { code: 'CUT', name: 'Cutting', sequence: 3 },
  { code: 'SEW', name: 'Sewing', sequence: 4 },
  { code: 'PROCESS', name: 'Process (Wash/Print/Embroidery)', sequence: 5 },
  { code: 'FINISH', name: 'Finishing', sequence: 6 },
  { code: 'PACK', name: 'Packing', sequence: 7 },
  { code: 'FINAL_QC', name: 'Final QC', sequence: 8 },
  { code: 'READY_SHIP', name: 'Ready for Shipment', sequence: 9 },
  { code: 'SHIPPED', name: 'Shipped', sequence: 10 },
  { code: 'ON_HOLD', name: 'On Hold', sequence: 11 },
];

// Default blocker types
export const DEFAULT_BLOCKER_TYPES = [
  { code: 'MATERIAL', name: 'Material Shortage', default_owner: 'Procurement', default_impact: 'high' as BlockerImpact },
  { code: 'MACHINE', name: 'Machine Breakdown', default_owner: 'Maintenance', default_impact: 'high' as BlockerImpact },
  { code: 'MANPOWER', name: 'Manpower Issue', default_owner: 'HR', default_impact: 'medium' as BlockerImpact },
  { code: 'QUALITY', name: 'Quality Issue', default_owner: 'QC', default_impact: 'high' as BlockerImpact },
  { code: 'PLANNING', name: 'Planning Issue', default_owner: 'Planning', default_impact: 'medium' as BlockerImpact },
  { code: 'POWER', name: 'Power Outage', default_owner: 'Maintenance', default_impact: 'critical' as BlockerImpact },
  { code: 'OTHER', name: 'Other', default_owner: 'Production', default_impact: 'low' as BlockerImpact },
];

// Navigation items per role
// Worker navigation is determined dynamically based on department
export const NAV_ITEMS = {
  worker_sewing: [
    { path: '/sewing/morning-targets', label: 'Sewing Morning Targets', icon: 'Crosshair' },
    { path: '/sewing/end-of-day', label: 'Sewing End of Day', icon: 'ClipboardCheck' },
    { path: '/report-blocker', label: 'Report Blocker', icon: 'AlertTriangle' },
    { path: '/my-submissions', label: 'My Submissions', icon: 'FileText' },
    { path: '/preferences', label: 'My Preferences', icon: 'UserCog' },
  ],
  worker_finishing: [
    { path: '/finishing/morning-targets', label: 'Finishing Morning Targets', icon: 'Crosshair' },
    { path: '/finishing/end-of-day', label: 'Finishing End of Day', icon: 'ClipboardCheck' },
    { path: '/report-blocker', label: 'Report Blocker', icon: 'AlertTriangle' },
    { path: '/my-submissions', label: 'My Submissions', icon: 'FileText' },
    { path: '/preferences', label: 'My Preferences', icon: 'UserCog' },
  ],
  worker: [
    { path: '/sewing/morning-targets', label: 'Sewing Morning Targets', icon: 'Crosshair' },
    { path: '/sewing/end-of-day', label: 'Sewing End of Day', icon: 'ClipboardCheck' },
    { path: '/finishing/morning-targets', label: 'Finishing Morning Targets', icon: 'Crosshair' },
    { path: '/finishing/end-of-day', label: 'Finishing End of Day', icon: 'ClipboardCheck' },
    { path: '/report-blocker', label: 'Report Blocker', icon: 'AlertTriangle' },
    { path: '/my-submissions', label: 'My Submissions', icon: 'FileText' },
    { path: '/preferences', label: 'My Preferences', icon: 'UserCog' },
  ],
  supervisor: [
    { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { path: '/today', label: 'Today Updates', icon: 'CalendarDays' },
    { path: '/blockers', label: 'Blockers', icon: 'AlertTriangle' },
    { path: '/week', label: 'This Week', icon: 'Calendar' },
    { path: '/submissions', label: 'All Submissions', icon: 'FileText' },
    { path: '/lines', label: 'Lines', icon: 'Rows3' },
    { path: '/work-orders', label: 'Work Orders', icon: 'ClipboardList' },
    { path: '/insights', label: 'Insights', icon: 'TrendingUp' },
    { path: '/setup', label: 'Factory Setup', icon: 'Settings' },
    { path: '/users', label: 'Users', icon: 'Users' },
    { path: '/preferences', label: 'My Preferences', icon: 'UserCog' },
  ],
  admin: [
    { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { path: '/today', label: 'Today Updates', icon: 'CalendarDays' },
    { path: '/blockers', label: 'Blockers', icon: 'AlertTriangle' },
    { path: '/week', label: 'This Week', icon: 'Calendar' },
    { path: '/submissions', label: 'All Submissions', icon: 'FileText' },
    { path: '/lines', label: 'Lines', icon: 'Rows3' },
    { path: '/work-orders', label: 'Work Orders', icon: 'ClipboardList' },
    { path: '/insights', label: 'Insights', icon: 'TrendingUp' },
    { path: '/setup', label: 'Factory Setup', icon: 'Settings' },
    { path: '/users', label: 'Users', icon: 'Users' },
    { path: '/preferences', label: 'My Preferences', icon: 'UserCog' },
  ],
  owner: [
    { path: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { path: '/today', label: 'Today Updates', icon: 'CalendarDays' },
    { path: '/blockers', label: 'Blockers', icon: 'AlertTriangle' },
    { path: '/week', label: 'This Week', icon: 'Calendar' },
    { path: '/submissions', label: 'All Submissions', icon: 'FileText' },
    { path: '/lines', label: 'Lines', icon: 'Rows3' },
    { path: '/work-orders', label: 'Work Orders', icon: 'ClipboardList' },
    { path: '/insights', label: 'Insights', icon: 'TrendingUp' },
    { path: '/setup', label: 'Factory Setup', icon: 'Settings' },
    { path: '/users', label: 'Users', icon: 'Users' },
    { path: '/preferences', label: 'My Preferences', icon: 'UserCog' },
  ],
  superadmin: [
    { path: '/admin/tenants', label: 'Tenants', icon: 'Building2' },
    { path: '/admin/plans', label: 'Plans', icon: 'CreditCard' },
    { path: '/admin/support', label: 'Support', icon: 'HeadphonesIcon' },
  ],
};
