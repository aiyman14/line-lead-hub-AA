-- Update is_admin_or_higher function to include supervisors
CREATE OR REPLACE FUNCTION public.is_admin_or_higher(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'owner', 'superadmin', 'supervisor')
    )
$$;