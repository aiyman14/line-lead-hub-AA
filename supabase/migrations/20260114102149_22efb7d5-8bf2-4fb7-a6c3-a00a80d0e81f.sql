-- Add RLS policies to allow workers to update their own sewing targets (before cutoff)
CREATE POLICY "Users can update their own sewing targets" 
ON public.sewing_targets 
FOR UPDATE 
USING (
  factory_id = get_user_factory_id(auth.uid()) 
  AND submitted_by = auth.uid()
)
WITH CHECK (
  factory_id = get_user_factory_id(auth.uid()) 
  AND submitted_by = auth.uid()
);

-- Add RLS policies to allow workers to update their own sewing actuals (before cutoff)
CREATE POLICY "Users can update their own sewing actuals" 
ON public.sewing_actuals 
FOR UPDATE 
USING (
  factory_id = get_user_factory_id(auth.uid()) 
  AND submitted_by = auth.uid()
)
WITH CHECK (
  factory_id = get_user_factory_id(auth.uid()) 
  AND submitted_by = auth.uid()
);

-- Add RLS policies to allow workers to update their own finishing targets
CREATE POLICY "Users can update their own finishing targets" 
ON public.finishing_targets 
FOR UPDATE 
USING (
  factory_id = get_user_factory_id(auth.uid()) 
  AND submitted_by = auth.uid()
)
WITH CHECK (
  factory_id = get_user_factory_id(auth.uid()) 
  AND submitted_by = auth.uid()
);

-- Add RLS policies to allow workers to update their own finishing actuals
CREATE POLICY "Users can update their own finishing actuals" 
ON public.finishing_actuals 
FOR UPDATE 
USING (
  factory_id = get_user_factory_id(auth.uid()) 
  AND submitted_by = auth.uid()
)
WITH CHECK (
  factory_id = get_user_factory_id(auth.uid()) 
  AND submitted_by = auth.uid()
);