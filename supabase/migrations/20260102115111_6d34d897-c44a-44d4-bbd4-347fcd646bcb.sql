-- Add target_efficiency column to lines table
ALTER TABLE public.lines 
ADD COLUMN IF NOT EXISTS target_efficiency integer DEFAULT 85;

-- Create email schedule preferences table
CREATE TABLE public.email_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    factory_id uuid NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    schedule_type text NOT NULL CHECK (schedule_type IN ('daily', 'weekly')),
    is_active boolean DEFAULT true,
    send_time time DEFAULT '18:00:00',
    day_of_week integer DEFAULT 5, -- Friday for weekly (0=Sunday, 6=Saturday)
    last_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(factory_id, user_id, schedule_type)
);

-- Enable RLS
ALTER TABLE public.email_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_schedules
CREATE POLICY "Users can view their own email schedules"
ON public.email_schedules
FOR SELECT
USING (user_id = auth.uid() OR is_superadmin(auth.uid()));

CREATE POLICY "Users can manage their own email schedules"
ON public.email_schedules
FOR ALL
USING (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Add trigger for updated_at on email_schedules
CREATE TRIGGER update_email_schedules_updated_at
BEFORE UPDATE ON public.email_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create insert policy for notifications (admins can insert)
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (is_admin_or_higher(auth.uid()) AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())));