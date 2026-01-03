-- Fix: prevent invited users from receiving default admin role
-- Invited users are marked via raw_user_meta_data.invited_by_admin = 'true'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Insert profile (only if not already exists)
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;

    -- If this user was created via the admin invite flow, do NOT assign a default role.
    -- The inviter will assign the correct factory-scoped role explicitly.
    IF COALESCE(NEW.raw_user_meta_data ->> 'invited_by_admin', 'false') = 'true' THEN
        RETURN NEW;
    END IF;

    -- Self-signup: if user has NO existing roles, assign admin role by default
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.id) THEN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'admin');
    END IF;

    RETURN NEW;
END;
$function$;