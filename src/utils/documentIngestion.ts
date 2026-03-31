// Client-side document ingestion logic
// Processes chunks one at a time to avoid memory limits

import { supabase } from "@/integrations/supabase/client";
import { chunkText, type TextChunk } from "./chunking";

export interface IngestionProgress {
  total: number;
  processed: number;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

export type ProgressCallback = (progress: IngestionProgress) => void;

/**
 * Ingest a document by chunking and embedding on the client side
 * This avoids memory limits by processing one chunk at a time
 */
export async function ingestDocument(
  documentId: string,
  content: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("Not authenticated");
  }

  // Chunk the content
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    throw new Error("No content to ingest");
  }

  // Initialize queue status
  await supabase.from("document_ingestion_queue").upsert({
    document_id: documentId,
    status: "processing",
    started_at: new Date().toISOString(),
    total_chunks: chunks.length,
    chunks_processed: 0,
    error_message: null,
    completed_at: null,
  });

  onProgress?.({
    total: chunks.length,
    processed: 0,
    status: "processing",
  });

  // Delete existing chunks for this document
  await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);

  let processedCount = 0;

  try {
    for (const chunk of chunks) {
      // Call the lightweight generate-embedding function
      const { data: embeddingResult, error: embeddingError } = await supabase.functions.invoke(
        "generate-embedding",
        {
          body: { text: chunk.content },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (embeddingError) {
        throw new Error(`Embedding error: ${embeddingError.message}`);
      }

      if (!embeddingResult?.embedding) {
        throw new Error("No embedding returned");
      }

      // Format embedding for pgvector
      const embeddingStr = `[${embeddingResult.embedding.join(",")}]`;

      // Insert the chunk with embedding
      const { error: insertError } = await supabase.from("knowledge_chunks").insert({
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        tokens_count: embeddingResult.tokens || 0,
        section_heading: chunk.sectionHeading,
        embedding: embeddingStr,
      });

      if (insertError) {
        throw new Error(`Insert error: ${insertError.message}`);
      }

      processedCount++;

      // Update progress
      await supabase
        .from("document_ingestion_queue")
        .update({ chunks_processed: processedCount })
        .eq("document_id", documentId);

      onProgress?.({
        total: chunks.length,
        processed: processedCount,
        status: "processing",
      });
    }

    // Mark as completed
    await supabase
      .from("document_ingestion_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        chunks_processed: processedCount,
      })
      .eq("document_id", documentId);

    onProgress?.({
      total: chunks.length,
      processed: processedCount,
      status: "completed",
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await supabase
      .from("document_ingestion_queue")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("document_id", documentId);

    onProgress?.({
      total: chunks.length,
      processed: processedCount,
      status: "failed",
      error: errorMessage,
    });

    throw error;
  }
}
