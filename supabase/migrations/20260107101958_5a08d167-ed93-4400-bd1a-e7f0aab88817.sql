-- Add invitation_status column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS invitation_status text DEFAULT 'pending' 
CHECK (invitation_status IN ('pending', 'active'));

-- Set existing users to 'active' (they're already using the system)
UPDATE public.profiles SET invitation_status = 'active' WHERE invitation_status IS NULL OR invitation_status = 'pending';

-- Add an index for filtering by status
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_status ON public.profiles(invitation_status);