-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_documents table
CREATE TABLE public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL DEFAULT 'manual',
  source_url TEXT,
  language TEXT DEFAULT 'en',
  is_global BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create knowledge_chunks table with vector embeddings
CREATE TABLE public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  section_heading TEXT,
  page_number INTEGER,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  tokens_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create document_ingestion_queue table
CREATE TABLE public.document_ingestion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  chunks_created INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create chat_conversations table
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  title TEXT,
  language TEXT DEFAULT 'en',
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  tokens_used INTEGER,
  model TEXT,
  no_evidence BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create chat_analytics table
CREATE TABLE public.chat_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES public.factory_accounts(id) ON DELETE CASCADE,
  user_role TEXT,
  question_text TEXT,
  answer_length INTEGER,
  citations_count INTEGER DEFAULT 0,
  no_evidence BOOLEAN DEFAULT false,
  language TEXT,
  feedback TEXT CHECK (feedback IN ('thumbs_up', 'thumbs_down')),
  feedback_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create role_feature_access table
CREATE TABLE public.role_feature_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  feature TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, feature)
);

-- Insert default role-feature mappings
INSERT INTO public.role_feature_access (role, feature) VALUES
  ('worker', 'sewing_forms'),
  ('worker', 'finishing_forms'),
  ('worker', 'submissions'),
  ('worker', 'blockers'),
  ('admin', 'sewing_forms'),
  ('admin', 'finishing_forms'),
  ('admin', 'submissions'),
  ('admin', 'blockers'),
  ('admin', 'setup'),
  ('admin', 'users'),
  ('admin', 'analytics'),
  ('admin', 'insights'),
  ('owner', 'sewing_forms'),
  ('owner', 'finishing_forms'),
  ('owner', 'submissions'),
  ('owner', 'blockers'),
  ('owner', 'setup'),
  ('owner', 'users'),
  ('owner', 'analytics'),
  ('owner', 'insights'),
  ('owner', 'billing'),
  ('storage', 'storage_bin_cards'),
  ('storage', 'storage_transactions'),
  ('cutting', 'cutting_targets'),
  ('cutting', 'cutting_submissions');

-- Create indexes for performance
CREATE INDEX idx_knowledge_chunks_document ON public.knowledge_chunks(document_id);
CREATE INDEX idx_knowledge_chunks_embedding ON public.knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_conversations_user ON public.chat_conversations(user_id);
CREATE INDEX idx_chat_analytics_factory ON public.chat_analytics(factory_id);
CREATE INDEX idx_chat_analytics_created ON public.chat_analytics(created_at);

-- Enable RLS on all tables
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_ingestion_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_feature_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_documents
CREATE POLICY "Users can view global or factory docs" ON public.knowledge_documents
  FOR SELECT USING (
    is_global = true 
    OR factory_id = get_user_factory_id(auth.uid()) 
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Admins can manage factory docs" ON public.knowledge_documents
  FOR ALL USING (
    is_admin_or_higher(auth.uid()) 
    AND (factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
  );

-- RLS Policies for knowledge_chunks
CREATE POLICY "Users can view chunks of accessible docs" ON public.knowledge_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = knowledge_chunks.document_id
      AND (d.is_global = true OR d.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid()))
    )
  );

-- RLS Policies for document_ingestion_queue
CREATE POLICY "Admins can view ingestion queue" ON public.document_ingestion_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = document_ingestion_queue.document_id
      AND (is_admin_or_higher(auth.uid()) AND (d.factory_id = get_user_factory_id(auth.uid()) OR is_superadmin(auth.uid())))
    )
  );

-- RLS Policies for chat_conversations
CREATE POLICY "Users can view own conversations" ON public.chat_conversations
  FOR SELECT USING (user_id = auth.uid() OR is_superadmin(auth.uid()));

CREATE POLICY "Users can create conversations" ON public.chat_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations" ON public.chat_conversations
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in own conversations" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND (c.user_id = auth.uid() OR is_superadmin(auth.uid()))
    )
  );

CREATE POLICY "Users can insert messages in own conversations" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

-- RLS Policies for chat_analytics
CREATE POLICY "Admins can view factory analytics" ON public.chat_analytics
  FOR SELECT USING (
    (factory_id = get_user_factory_id(auth.uid()) AND is_admin_or_higher(auth.uid()))
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Users can insert analytics" ON public.chat_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own message analytics" ON public.chat_analytics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      JOIN public.chat_conversations c ON c.id = m.conversation_id
      WHERE m.id = chat_analytics.message_id AND c.user_id = auth.uid()
    )
  );

-- RLS Policies for role_feature_access
CREATE POLICY "Anyone can view role features" ON public.role_feature_access
  FOR SELECT USING (true);

-- Create function to search knowledge base
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
  content text,
  section_heading text,
  similarity float
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
    kc.content,
    kc.section_heading,
    1 - (kc.embedding <=> query_embedding) as similarity
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

-- Create function to get user accessible features
CREATE OR REPLACE FUNCTION public.get_user_accessible_features(p_user_id uuid)
RETURNS TABLE (feature text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT rfa.feature
  FROM role_feature_access rfa
  JOIN user_roles ur ON ur.role::text = rfa.role
  WHERE ur.user_id = p_user_id;
$$;