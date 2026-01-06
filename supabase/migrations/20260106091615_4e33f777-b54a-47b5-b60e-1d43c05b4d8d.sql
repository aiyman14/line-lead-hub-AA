-- Add deactivated_at column to lines for tracking when lines were archived
ALTER TABLE public.lines 
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ DEFAULT NULL;

-- Create a function to count active lines for a factory
CREATE OR REPLACE FUNCTION public.count_active_lines(_factory_id uuid)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.lines
  WHERE factory_id = _factory_id AND is_active = true
$$;

-- Create a function to get max active lines for a factory's plan
CREATE OR REPLACE FUNCTION public.get_plan_max_lines(_factory_id uuid)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(max_lines, 
    CASE subscription_tier
      WHEN 'starter' THEN 30
      WHEN 'growth' THEN 60
      WHEN 'scale' THEN 100
      WHEN 'enterprise' THEN NULL
      WHEN 'professional' THEN 60
      WHEN 'unlimited' THEN NULL
      ELSE 30
    END
  )
  FROM public.factory_accounts
  WHERE id = _factory_id
$$;

-- Create a function to validate line activation (for use in trigger or app)
CREATE OR REPLACE FUNCTION public.can_activate_line(_factory_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN get_plan_max_lines(_factory_id) IS NULL THEN true
      ELSE count_active_lines(_factory_id) < get_plan_max_lines(_factory_id)
    END
$$;

-- Create a trigger function to enforce line limits on activation
CREATE OR REPLACE FUNCTION public.enforce_line_activation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_lines INTEGER;
  current_active INTEGER;
BEGIN
  -- Only check when activating a line (is_active changing from false to true)
  -- or when inserting a new active line
  IF (TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true)
     OR (TG_OP = 'INSERT' AND NEW.is_active = true) THEN
    
    -- Get the max lines for the factory's plan
    max_lines := get_plan_max_lines(NEW.factory_id);
    
    -- If max_lines is NULL, it's enterprise (unlimited)
    IF max_lines IS NOT NULL THEN
      current_active := count_active_lines(NEW.factory_id);
      
      IF current_active >= max_lines THEN
        RAISE EXCEPTION 'Plan limit reached (% of % active lines). Upgrade your plan to activate more lines.', 
          current_active, max_lines
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  
  -- Track deactivation time for reactivation cooldown
  IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    NEW.deactivated_at := NOW();
  END IF;
  
  -- Clear deactivation time when reactivating
  IF TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true THEN
    NEW.deactivated_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_line_activation_limit_trigger ON public.lines;
CREATE TRIGGER enforce_line_activation_limit_trigger
  BEFORE INSERT OR UPDATE ON public.lines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_line_activation_limit();

-- Update factory_accounts defaults based on subscription_tier
UPDATE public.factory_accounts
SET max_lines = CASE subscription_tier
  WHEN 'starter' THEN 30
  WHEN 'growth' THEN 60
  WHEN 'scale' THEN 100
  WHEN 'enterprise' THEN NULL
  WHEN 'professional' THEN 60
  WHEN 'unlimited' THEN NULL
  ELSE 30
END
WHERE max_lines IS NULL OR max_lines = 10;