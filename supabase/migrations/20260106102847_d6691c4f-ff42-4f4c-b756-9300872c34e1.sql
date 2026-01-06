-- Create junction table for work order line assignments
CREATE TABLE public.work_order_line_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  factory_id UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(work_order_id, line_id)
);

-- Enable RLS
ALTER TABLE public.work_order_line_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage work order line assignments"
ON public.work_order_line_assignments
FOR ALL
USING (
  is_admin_or_higher(auth.uid()) 
  AND ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()))
);

CREATE POLICY "Users can view work order line assignments in their factory"
ON public.work_order_line_assignments
FOR SELECT
USING ((factory_id = get_user_factory_id(auth.uid())) OR is_superadmin(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_work_order_line_assignments_work_order ON public.work_order_line_assignments(work_order_id);
CREATE INDEX idx_work_order_line_assignments_line ON public.work_order_line_assignments(line_id);