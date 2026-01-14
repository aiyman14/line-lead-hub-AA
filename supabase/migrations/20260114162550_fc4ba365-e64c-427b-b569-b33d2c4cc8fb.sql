-- Add leftover/fabric saved fields to cutting_actuals table
ALTER TABLE public.cutting_actuals
ADD COLUMN leftover_recorded boolean DEFAULT false,
ADD COLUMN leftover_type text,
ADD COLUMN leftover_unit text,
ADD COLUMN leftover_quantity numeric,
ADD COLUMN leftover_notes text,
ADD COLUMN leftover_location text,
ADD COLUMN leftover_photo_urls text[];

-- Add check constraint for leftover_type values
ALTER TABLE public.cutting_actuals
ADD CONSTRAINT cutting_actuals_leftover_type_check 
CHECK (leftover_type IS NULL OR leftover_type IN ('Left Over Fabric', 'Saved Fabric', 'Left Over Cutting Panels', 'Other'));

-- Add check constraint for leftover_unit values
ALTER TABLE public.cutting_actuals
ADD CONSTRAINT cutting_actuals_leftover_unit_check 
CHECK (leftover_unit IS NULL OR leftover_unit IN ('kg', 'meter', 'yard', 'roll', 'pcs'));

-- Add check constraint for leftover_quantity (must be >= 0 if provided)
ALTER TABLE public.cutting_actuals
ADD CONSTRAINT cutting_actuals_leftover_quantity_check 
CHECK (leftover_quantity IS NULL OR leftover_quantity >= 0);

-- Create storage bucket for cutting leftover photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('cutting-leftover-photos', 'cutting-leftover-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the cutting leftover photos bucket
-- Allow authenticated users to view all photos (public bucket)
CREATE POLICY "Anyone can view cutting leftover photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'cutting-leftover-photos');

-- Allow cutting users to upload photos to their factory folder
CREATE POLICY "Cutting users can upload leftover photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cutting-leftover-photos' 
  AND auth.uid() IS NOT NULL
  AND (has_cutting_role(auth.uid()) OR is_admin_or_higher(auth.uid()))
);

-- Allow cutting users to delete their own photos
CREATE POLICY "Cutting users can delete their leftover photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cutting-leftover-photos' 
  AND auth.uid() IS NOT NULL
  AND (has_cutting_role(auth.uid()) OR is_admin_or_higher(auth.uid()))
);