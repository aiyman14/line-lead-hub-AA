-- Add content column to knowledge_documents to store original text for re-ingestion
ALTER TABLE public.knowledge_documents 
ADD COLUMN IF NOT EXISTS content TEXT;