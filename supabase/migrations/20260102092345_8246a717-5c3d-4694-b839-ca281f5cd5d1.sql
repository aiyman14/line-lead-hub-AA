-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- ENUMS
-- ================================

-- App roles enum
CREATE TYPE public.app_role AS ENUM ('worker', 'supervisor', 'admin', 'owner', 'superadmin');

-- Blocker impact levels
CREATE TYPE public.blocker_impact AS ENUM ('low', 'medium', 'high', 'critical');

-- Blocker status
CREATE TYPE public.blocker_status AS ENUM ('open', 'in_progress', 'resolved');

-- Update type for combined views
CREATE TYPE public.update_type AS ENUM ('sewing', 'finishing');

-- Subscription tier
CREATE TYPE public.subscription_tier AS ENUM ('starter', 'professional', 'enterprise', 'unlimited');

-- ================================
-- CORE TABLES
-- ================================

-- Factory Accounts (Tenants)
CREATE TABLE public.factory_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    subscription_tier subscription_tier DEFAULT 'starter',
    max_lines INTEGER DEFAULT 10,
    cutoff_time TIME DEFAULT '16:00:00',
    timezone TEXT DEFAULT 'Asia/Dhaka',
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    assigned_unit_id UUID,
    assigned_floor_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles (separate table for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, role, factory_id)
);

-- ================================
-- FACTORY STRUCTURE
-- ================================

-- Units (Buildings/Sections)
CREATE TABLE public.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (factory_id, code)
);

-- Floors
CREATE TABLE public.floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (factory_id, unit_id, code)
);

-- Production Lines
CREATE TABLE public.lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    floor_id UUID REFERENCES public.floors(id) ON DELETE SET NULL,
    line_id TEXT NOT NULL,
    name TEXT,
    target_per_hour INTEGER DEFAULT 0,
    target_per_day INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (factory_id, line_id)
);

-- ================================
-- WORK ORDERS / PO
-- ================================

CREATE TABLE public.work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    po_number TEXT NOT NULL,
    buyer TEXT NOT NULL,
    style TEXT NOT NULL,
    item TEXT,
    color TEXT,
    order_qty INTEGER NOT NULL DEFAULT 0,
    smv DECIMAL(10,2),
    target_per_hour INTEGER,
    target_per_day INTEGER,
    planned_ex_factory DATE,
    actual_ex_factory DATE,
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (factory_id, po_number)
);

-- ================================
-- STAGES & BLOCKERS CONFIG
-- ================================

-- Production Stages
CREATE TABLE public.stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    sequence INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (factory_id, code)
);

-- Blocker Types
CREATE TABLE public.blocker_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    default_owner TEXT,
    default_impact blocker_impact DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (factory_id, code)
);

-- ================================
-- PRODUCTION UPDATES (Append-only)
-- ================================

-- Sewing Line Updates
CREATE TABLE public.production_updates_sewing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES public.lines(id) ON DELETE SET NULL NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift TEXT DEFAULT 'day',
    
    -- Production metrics
    output_qty INTEGER NOT NULL DEFAULT 0,
    target_qty INTEGER DEFAULT 0,
    manpower INTEGER DEFAULT 0,
    ot_hours DECIMAL(5,2) DEFAULT 0,
    ot_manpower INTEGER DEFAULT 0,
    
    -- Stage progress
    stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
    stage_progress INTEGER DEFAULT 0,
    
    -- Quality
    reject_qty INTEGER DEFAULT 0,
    rework_qty INTEGER DEFAULT 0,
    
    -- Blocker info
    has_blocker BOOLEAN DEFAULT false,
    blocker_type_id UUID REFERENCES public.blocker_types(id) ON DELETE SET NULL,
    blocker_description TEXT,
    blocker_owner TEXT,
    blocker_impact blocker_impact,
    blocker_status blocker_status DEFAULT 'open',
    
    -- Meta
    notes TEXT,
    photo_urls TEXT[],
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finishing/QC/Packing Updates
CREATE TABLE public.production_updates_finishing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    line_id UUID REFERENCES public.lines(id) ON DELETE SET NULL NOT NULL,
    work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift TEXT DEFAULT 'day',
    
    -- Finishing metrics
    qc_pass_qty INTEGER NOT NULL DEFAULT 0,
    qc_fail_qty INTEGER DEFAULT 0,
    packed_qty INTEGER DEFAULT 0,
    shipped_qty INTEGER DEFAULT 0,
    
    -- Manpower
    manpower INTEGER DEFAULT 0,
    ot_hours DECIMAL(5,2) DEFAULT 0,
    ot_manpower INTEGER DEFAULT 0,
    
    -- Stage progress
    stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
    stage_progress INTEGER DEFAULT 0,
    
    -- Blocker info
    has_blocker BOOLEAN DEFAULT false,
    blocker_type_id UUID REFERENCES public.blocker_types(id) ON DELETE SET NULL,
    blocker_description TEXT,
    blocker_owner TEXT,
    blocker_impact blocker_impact,
    blocker_status blocker_status DEFAULT 'open',
    
    -- Meta
    notes TEXT,
    photo_urls TEXT[],
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- INSIGHTS & NOTIFICATIONS
-- ================================

-- Daily Insights (stored snapshots)
CREATE TABLE public.daily_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    insight_date DATE NOT NULL DEFAULT CURRENT_DATE,
    insights_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (factory_id, insight_date)
);

-- Notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- INDEXES
-- ================================

CREATE INDEX idx_profiles_factory ON public.profiles(factory_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_factory ON public.user_roles(factory_id);
CREATE INDEX idx_lines_factory ON public.lines(factory_id);
CREATE INDEX idx_work_orders_factory ON public.work_orders(factory_id);
CREATE INDEX idx_sewing_factory_date ON public.production_updates_sewing(factory_id, production_date);
CREATE INDEX idx_sewing_line ON public.production_updates_sewing(line_id);
CREATE INDEX idx_finishing_factory_date ON public.production_updates_finishing(factory_id, production_date);
CREATE INDEX idx_finishing_line ON public.production_updates_finishing(line_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);

-- ================================
-- ENABLE RLS
-- ================================

ALTER TABLE public.factory_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocker_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_updates_sewing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_updates_finishing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ================================
-- SECURITY FUNCTIONS
-- ================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Get user's factory_id
CREATE OR REPLACE FUNCTION public.get_user_factory_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT factory_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- Check if user belongs to factory
CREATE OR REPLACE FUNCTION public.user_belongs_to_factory(_user_id UUID, _factory_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND factory_id = _factory_id
    )
$$;

-- Check if user is admin or higher
CREATE OR REPLACE FUNCTION public.is_admin_or_higher(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'owner', 'superadmin')
    )
$$;

-- Check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = 'superadmin'
    )
$$;

-- ================================
-- RLS POLICIES
-- ================================

-- Factory Accounts policies
CREATE POLICY "Users can view their factory"
ON public.factory_accounts FOR SELECT
TO authenticated
USING (
    id = public.get_user_factory_id(auth.uid())
    OR public.is_superadmin(auth.uid())
);

CREATE POLICY "Superadmins can manage all factories"
ON public.factory_accounts FOR ALL
TO authenticated
USING (public.is_superadmin(auth.uid()));

-- Profiles policies
CREATE POLICY "Users can view profiles in their factory"
ON public.profiles FOR SELECT
TO authenticated
USING (
    factory_id = public.get_user_factory_id(auth.uid())
    OR id = auth.uid()
    OR public.is_superadmin(auth.uid())
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- User Roles policies
CREATE POLICY "Users can view roles in their factory"
ON public.user_roles FOR SELECT
TO authenticated
USING (
    factory_id = public.get_user_factory_id(auth.uid())
    OR user_id = auth.uid()
    OR public.is_superadmin(auth.uid())
);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- Units policies
CREATE POLICY "Users can view units in their factory"
ON public.units FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage units"
ON public.units FOR ALL
TO authenticated
USING (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- Floors policies
CREATE POLICY "Users can view floors in their factory"
ON public.floors FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage floors"
ON public.floors FOR ALL
TO authenticated
USING (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- Lines policies
CREATE POLICY "Users can view lines in their factory"
ON public.lines FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage lines"
ON public.lines FOR ALL
TO authenticated
USING (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- Work Orders policies
CREATE POLICY "Users can view work orders in their factory"
ON public.work_orders FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage work orders"
ON public.work_orders FOR ALL
TO authenticated
USING (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- Stages policies
CREATE POLICY "Users can view stages in their factory"
ON public.stages FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage stages"
ON public.stages FOR ALL
TO authenticated
USING (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- Blocker Types policies
CREATE POLICY "Users can view blocker types in their factory"
ON public.blocker_types FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage blocker types"
ON public.blocker_types FOR ALL
TO authenticated
USING (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- Production Updates Sewing policies
CREATE POLICY "Users can view sewing updates in their factory"
ON public.production_updates_sewing FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users can submit sewing updates"
ON public.production_updates_sewing FOR INSERT
TO authenticated
WITH CHECK (
    factory_id = public.get_user_factory_id(auth.uid())
    AND submitted_by = auth.uid()
);

-- Production Updates Finishing policies
CREATE POLICY "Users can view finishing updates in their factory"
ON public.production_updates_finishing FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users can submit finishing updates"
ON public.production_updates_finishing FOR INSERT
TO authenticated
WITH CHECK (
    factory_id = public.get_user_factory_id(auth.uid())
    AND submitted_by = auth.uid()
);

-- Daily Insights policies
CREATE POLICY "Users can view insights in their factory"
ON public.daily_insights FOR SELECT
TO authenticated
USING (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()));

CREATE POLICY "System can insert insights"
ON public.daily_insights FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- Notifications policies
CREATE POLICY "Users can view their notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_superadmin(auth.uid()));

CREATE POLICY "Users can update their notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Audit Log policies
CREATE POLICY "Admins can view audit logs"
ON public.audit_log FOR SELECT
TO authenticated
USING (
    public.is_admin_or_higher(auth.uid())
    AND (factory_id = public.get_user_factory_id(auth.uid()) OR public.is_superadmin(auth.uid()))
);

-- ================================
-- TRIGGERS
-- ================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_factory_accounts_updated_at
    BEFORE UPDATE ON public.factory_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON public.units
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_floors_updated_at
    BEFORE UPDATE ON public.floors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lines_updated_at
    BEFORE UPDATE ON public.lines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_orders_updated_at
    BEFORE UPDATE ON public.work_orders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        NEW.email
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();