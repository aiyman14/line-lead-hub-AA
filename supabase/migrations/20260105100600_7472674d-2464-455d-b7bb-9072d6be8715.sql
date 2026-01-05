-- Update handle_new_user to accept factory_id from user metadata for invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _factory_id uuid;
BEGIN
    -- Check if factory_id was passed in metadata (for invited users)
    IF NEW.raw_user_meta_data ->> 'factory_id' IS NOT NULL THEN
      _factory_id := (NEW.raw_user_meta_data ->> 'factory_id')::uuid;
    ELSE
      _factory_id := NULL;
    END IF;

    -- Insert profile with factory_id if provided
    INSERT INTO public.profiles (id, full_name, email, factory_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        NEW.email,
        _factory_id
    )
    ON CONFLICT (id) DO UPDATE SET
        factory_id = COALESCE(EXCLUDED.factory_id, profiles.factory_id),
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);

    -- If this user was created via the admin invite flow, do NOT assign a default role.
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