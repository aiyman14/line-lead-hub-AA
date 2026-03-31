-- Fix search_knowledge to return document_type and source_url (needed by chat citations)
CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  p_factory_id uuid DEFAULT NULL,
  p_language text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_type text,
  content text,
  section_heading text,
  page_number int,
  similarity float,
  source_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id as chunk_id,
    kc.document_id,
    kd.title as document_title,
    kd.document_type,
    kc.content,
    kc.section_heading,
    kc.page_number,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kd.source_url
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.is_active = true
    AND (kd.is_global = true OR kd.factory_id = p_factory_id)
    AND (p_language IS NULL OR kd.language = p_language)
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
