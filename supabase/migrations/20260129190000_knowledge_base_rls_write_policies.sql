-- Allow admins to INSERT, UPDATE, DELETE knowledge_chunks (needed for client-side ingestion)
CREATE POLICY "Admins can insert knowledge chunks" ON public.knowledge_chunks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = knowledge_chunks.document_id
      AND is_admin_or_higher(auth.uid())
      AND (d.factory_id = get_user_factory_id(auth.uid()) OR d.is_global = true OR is_superadmin(auth.uid()))
    )
  );

CREATE POLICY "Admins can delete knowledge chunks" ON public.knowledge_chunks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = knowledge_chunks.document_id
      AND is_admin_or_higher(auth.uid())
      AND (d.factory_id = get_user_factory_id(auth.uid()) OR d.is_global = true OR is_superadmin(auth.uid()))
    )
  );

-- Allow admins to INSERT, UPDATE, DELETE on document_ingestion_queue (needed for client-side ingestion)
CREATE POLICY "Admins can insert ingestion queue" ON public.document_ingestion_queue
  FOR INSERT WITH CHECK (
    is_admin_or_higher(auth.uid())
  );

CREATE POLICY "Admins can update ingestion queue" ON public.document_ingestion_queue
  FOR UPDATE USING (
    is_admin_or_higher(auth.uid())
  );

CREATE POLICY "Admins can delete ingestion queue" ON public.document_ingestion_queue
  FOR DELETE USING (
    is_admin_or_higher(auth.uid())
  );
