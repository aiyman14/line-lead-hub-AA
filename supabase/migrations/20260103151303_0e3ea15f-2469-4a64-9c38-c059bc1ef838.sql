-- Add department column to profiles table for worker assignment
ALTER TABLE public.profiles 
ADD COLUMN department text DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.profiles.department IS 'Worker department assignment: sewing, finishing, or both';