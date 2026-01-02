-- Add line_id to work_orders to link POs to specific lines
ALTER TABLE public.work_orders 
ADD COLUMN line_id uuid REFERENCES public.lines(id);

-- Create index for better query performance
CREATE INDEX idx_work_orders_line_id ON public.work_orders(line_id);