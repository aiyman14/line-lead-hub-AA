-- Add total_chunks and chunks_processed columns to document_ingestion_queue if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'document_ingestion_queue' 
    AND column_name = 'total_chunks'
  ) THEN
    ALTER TABLE public.document_ingestion_queue ADD COLUMN total_chunks integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'document_ingestion_queue' 
    AND column_name = 'chunks_processed'
  ) THEN
    ALTER TABLE public.document_ingestion_queue ADD COLUMN chunks_processed integer DEFAULT 0;
  END IF;
END $$;