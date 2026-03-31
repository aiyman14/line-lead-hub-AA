-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base documents table
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID REFERENCES factory_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN ('manual', 'tutorial', 'certificate', 'readme', 'faq', 'policy')),
  source_url TEXT,
  file_path TEXT,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'bn')),
  is_global BOOLEAN DEFAULT false, -- Global docs visible to all factories
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with embeddings
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_tokens INTEGER,
  section_heading TEXT,
  page_number INTEGER,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(document_id, chunk_index)
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
ON knowledge_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Chat conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  factory_id UUID REFERENCES factory_accounts(id) ON DELETE CASCADE,
  title TEXT,
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]', -- Array of chunk IDs with snippets
  tokens_used INTEGER,
  model TEXT,
  no_evidence BOOLEAN DEFAULT false, -- Flag when assistant couldn't find evidence
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat analytics for tracking unanswered questions
CREATE TABLE IF NOT EXISTS chat_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE SET NULL,
  factory_id UUID REFERENCES factory_accounts(id) ON DELETE SET NULL,
  user_role TEXT,
  question_text TEXT,
  answer_length INTEGER,
  citations_count INTEGER,
  no_evidence BOOLEAN DEFAULT false,
  feedback TEXT CHECK (feedback IN ('thumbs_up', 'thumbs_down', NULL)),
  feedback_comment TEXT,
  language TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document ingestion queue
CREATE TABLE IF NOT EXISTS document_ingestion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  chunks_processed INTEGER DEFAULT 0,
  total_chunks INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role-based feature access mapping for chatbot
CREATE TABLE IF NOT EXISTS role_feature_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  feature_category TEXT NOT NULL, -- e.g., 'dashboard', 'sewing', 'cutting', 'storage', 'admin'
  feature_name TEXT NOT NULL,
  description TEXT,
  help_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(role, feature_category, feature_name)
);

-- Seed role-feature mappings
INSERT INTO role_feature_access (role, feature_category, feature_name, description) VALUES
-- Worker (sewing) features
('worker', 'sewing', 'morning_targets', 'Set morning production targets for sewing lines'),
('worker', 'sewing', 'end_of_day', 'Submit end of day actual output for sewing'),
('worker', 'sewing', 'blockers', 'Report and manage production blockers'),
('worker', 'sewing', 'submissions', 'View submission history'),
('worker', 'general', 'preferences', 'Manage personal preferences and notifications'),

-- Admin features (includes worker features)
('admin', 'dashboard', 'overview', 'View factory-wide production dashboard'),
('admin', 'dashboard', 'analytics', 'View efficiency metrics and charts'),
('admin', 'sewing', 'all_submissions', 'View all sewing submissions'),
('admin', 'sewing', 'edit_submissions', 'Edit sewing submissions within cutoff'),
('admin', 'finishing', 'all_submissions', 'View all finishing submissions'),
('admin', 'work_orders', 'manage', 'Create and manage work orders'),
('admin', 'setup', 'factory', 'Configure factory settings'),
('admin', 'setup', 'lines', 'Manage production lines'),
('admin', 'setup', 'users', 'Manage factory users'),
('admin', 'insights', 'reports', 'View and schedule insight reports'),
('admin', 'billing', 'manage', 'Manage subscription and billing'),

-- Owner features (includes admin)
('owner', 'billing', 'full_access', 'Full billing and subscription control'),
('owner', 'setup', 'factory_delete', 'Delete or terminate factory account'),

-- Storage features
('storage', 'storage', 'bin_cards', 'Manage storage bin cards'),
('storage', 'storage', 'transactions', 'Record storage transactions'),
('storage', 'storage', 'dashboard', 'View storage dashboard'),
('storage', 'storage', 'history', 'View transaction history'),

-- Cutting features
('cutting', 'cutting', 'morning_targets', 'Set cutting targets'),
('cutting', 'cutting', 'end_of_day', 'Submit cutting actuals'),
('cutting', 'cutting', 'submissions', 'View cutting submissions'),
('cutting', 'cutting', 'leftover', 'Track leftover fabric')
ON CONFLICT (role, feature_category, feature_name) DO NOTHING;

-- Enable RLS
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_ingestion_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_feature_access ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Knowledge documents: users can see global docs or their factory's docs
CREATE POLICY "Users can view knowledge documents" ON knowledge_documents
  FOR SELECT USING (
    is_global = true
    OR factory_id IN (
      SELECT factory_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Knowledge documents: only admins can insert/update
CREATE POLICY "Admins can manage knowledge documents" ON knowledge_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
      AND (factory_id = knowledge_documents.factory_id OR knowledge_documents.is_global = true)
    )
  );

-- Knowledge chunks: same as documents
CREATE POLICY "Users can view knowledge chunks" ON knowledge_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM knowledge_documents kd
      WHERE kd.id = knowledge_chunks.document_id
      AND (kd.is_global = true OR kd.factory_id IN (
        SELECT factory_id FROM profiles WHERE id = auth.uid()
      ))
    )
  );

-- Chat conversations: users can only see their own
CREATE POLICY "Users can manage own conversations" ON chat_conversations
  FOR ALL USING (user_id = auth.uid());

-- Chat messages: users can see messages in their conversations
CREATE POLICY "Users can view own chat messages" ON chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  );

-- Chat analytics: users can insert, admins can view all
CREATE POLICY "Users can insert analytics" ON chat_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view analytics" ON chat_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Role feature access: everyone can read
CREATE POLICY "Anyone can view role features" ON role_feature_access
  FOR SELECT USING (true);

-- Ingestion queue: admins only
CREATE POLICY "Admins can manage ingestion queue" ON document_ingestion_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Function to search knowledge base using vector similarity
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  p_factory_id uuid DEFAULT NULL,
  p_language text DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  document_type text,
  section_heading text,
  page_number int,
  content text,
  similarity float,
  source_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id as chunk_id,
    kd.id as document_id,
    kd.title as document_title,
    kd.document_type,
    kc.section_heading,
    kc.page_number,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kd.source_url
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE
    kd.is_active = true
    AND (kd.is_global = true OR kd.factory_id = p_factory_id)
    AND (p_language IS NULL OR kd.language = p_language)
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get user's accessible features based on roles
CREATE OR REPLACE FUNCTION get_user_accessible_features(p_user_id uuid)
RETURNS TABLE (
  feature_category text,
  feature_name text,
  description text,
  help_text text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    rfa.feature_category,
    rfa.feature_name,
    rfa.description,
    rfa.help_text
  FROM role_feature_access rfa
  WHERE rfa.role IN (
    SELECT ur.role FROM user_roles ur WHERE ur.user_id = p_user_id
  )
  ORDER BY rfa.feature_category, rfa.feature_name;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
