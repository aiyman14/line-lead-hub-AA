-- Create enum for finishing log type
CREATE TYPE public.finishing_log_type AS ENUM ('TARGET', 'OUTPUT');

-- Create the finishing_daily_logs table
CREATE TABLE public.finishing_daily_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID NOT NULL REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT NULL, -- A/B or Day/Night
  line_id UUID NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  work_order_id UUID NULL REFERENCES public.work_orders(id) ON DELETE SET NULL,
  log_type public.finishing_log_type NOT NULL,
  
  -- The 8 process category fields (same for TARGET and OUTPUT)
  thread_cutting INTEGER NULL DEFAULT 0,
  inside_check INTEGER NULL DEFAULT 0,
  top_side_check INTEGER NULL DEFAULT 0,
  buttoning INTEGER NULL DEFAULT 0,
  iron INTEGER NULL DEFAULT 0,
  get_up INTEGER NULL DEFAULT 0,
  poly INTEGER NULL DEFAULT 0,
  carton INTEGER NULL DEFAULT 0,
  
  -- Metadata
  remarks TEXT NULL,
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NULL,
  updated_by UUID NULL,
  
  -- For edit permissions: admin override flag
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMP WITH TIME ZONE NULL,
  locked_by UUID NULL,
  
  -- Uniqueness: only one TARGET and one OUTPUT per {date + line_id + work_order_id}
  CONSTRAINT finishing_daily_logs_unique_entry UNIQUE (factory_id, production_date, line_id, work_order_id, log_type),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit log table for finishing daily logs
CREATE TABLE public.finishing_daily_log_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id UUID NOT NULL REFERENCES public.finishing_daily_logs(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  old_values JSONB NULL,
  new_values JSONB NOT NULL,
  change_reason TEXT NULL
);

-- Enable RLS
ALTER TABLE public.finishing_daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finishing_daily_log_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for finishing_daily_logs
CREATE POLICY "Users can view finishing logs in their factory"
ON public.finishing_daily_logs
FOR SELECT
USING (
  factory_id IN (
    SELECT factory_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert finishing logs in their factory"
ON public.finishing_daily_logs
FOR INSERT
WITH CHECK (
  factory_id IN (
    SELECT factory_id FROM public.profiles WHERE id = auth.uid()
  )
  AND submitted_by = auth.uid()
);

CREATE POLICY "Users can update their own unlocked logs or admins can update any"
ON public.finishing_daily_logs
FOR UPDATE
USING (
  factory_id IN (
    SELECT factory_id FROM public.profiles WHERE id = auth.uid()
  )
  AND (
    (submitted_by = auth.uid() AND is_locked = FALSE)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  )
);

-- RLS policies for finishing_daily_log_history
CREATE POLICY "Users can view log history in their factory"
ON public.finishing_daily_log_history
FOR SELECT
USING (
  log_id IN (
    SELECT id FROM public.finishing_daily_logs 
    WHERE factory_id IN (
      SELECT factory_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert log history"
ON public.finishing_daily_log_history
FOR INSERT
WITH CHECK (
  log_id IN (
    SELECT id FROM public.finishing_daily_logs 
    WHERE factory_id IN (
      SELECT factory_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- Create indexes for common queries
CREATE INDEX idx_finishing_daily_logs_factory_date ON public.finishing_daily_logs(factory_id, production_date);
CREATE INDEX idx_finishing_daily_logs_line_date ON public.finishing_daily_logs(line_id, production_date);
CREATE INDEX idx_finishing_daily_logs_type ON public.finishing_daily_logs(log_type);
CREATE INDEX idx_finishing_daily_log_history_log_id ON public.finishing_daily_log_history(log_id);