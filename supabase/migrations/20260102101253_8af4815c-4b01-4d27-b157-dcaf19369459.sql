
-- Create stage_progress_options table
CREATE TABLE public.stage_progress_options (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  factory_id uuid NOT NULL,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create next_milestone_options table
CREATE TABLE public.next_milestone_options (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  factory_id uuid NOT NULL,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create blocker_owner_options table
CREATE TABLE public.blocker_owner_options (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  factory_id uuid NOT NULL,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create blocker_impact_options table (per-factory customizable)
CREATE TABLE public.blocker_impact_options (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  factory_id uuid NOT NULL,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Add work_order_status enum for work orders
DO $$ BEGIN
  CREATE TYPE work_order_status AS ENUM ('not_started', 'in_progress', 'completed', 'on_hold');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add color column to work_orders if not exists
DO $$ BEGIN
  ALTER TABLE public.work_orders ADD COLUMN color text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.stage_progress_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.next_milestone_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocker_owner_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocker_impact_options ENABLE ROW LEVEL SECURITY;

-- RLS policies for stage_progress_options
CREATE POLICY "Users can view stage_progress_options in their factory" 
ON public.stage_progress_options FOR SELECT 
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage stage_progress_options" 
ON public.stage_progress_options FOR ALL 
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

-- RLS policies for next_milestone_options
CREATE POLICY "Users can view next_milestone_options in their factory" 
ON public.next_milestone_options FOR SELECT 
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage next_milestone_options" 
ON public.next_milestone_options FOR ALL 
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

-- RLS policies for blocker_owner_options
CREATE POLICY "Users can view blocker_owner_options in their factory" 
ON public.blocker_owner_options FOR SELECT 
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage blocker_owner_options" 
ON public.blocker_owner_options FOR ALL 
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));

-- RLS policies for blocker_impact_options
CREATE POLICY "Users can view blocker_impact_options in their factory" 
ON public.blocker_impact_options FOR SELECT 
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));

CREATE POLICY "Admins can manage blocker_impact_options" 
ON public.blocker_impact_options FOR ALL 
USING (is_admin_or_higher(auth.uid()) AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid())));
