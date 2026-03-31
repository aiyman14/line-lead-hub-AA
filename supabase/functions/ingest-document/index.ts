import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";
import { generateEmbedding, formatEmbeddingForPgVector } from "../_shared/embeddings.ts";

interface IngestRequest {
  document_id: string;
  content?: string; // Raw text content if provided directly
}

const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[INGEST] ${step}${detailsStr}`);
};

/**
 * Split text into overlapping chunks.
 * Uses a for-loop with a guaranteed step size — cannot infinite-loop.
 */
function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): { content: string; index: number }[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: { content: string; index: number }[] = [];
  const step = chunkSize - overlap;

  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push({ content: chunk, index: chunks.length });
    }

    if (end >= text.length) break;
  }

  return chunks;
}

/**
 * Extract section heading from text (simple heuristic)
 */
function extractSectionHeading(text: string): string | null {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Look for lines that look like headings
    if (
      trimmed.length > 0 &&
      trimmed.length < 100 &&
      (trimmed.startsWith("#") ||
        trimmed.toUpperCase() === trimmed ||
        /^[A-Z][^.!?]*$/.test(trimmed))
    ) {
      return trimmed.replace(/^#+\s*/, "");
    }
  }
  return null;
}

async function processIngestion(
  supabaseAdmin: any,
  document_id: string,
  textContent: string
) {
  try {
    // Delete existing chunks for this document
    await supabaseAdmin.from("knowledge_chunks").delete().eq("document_id", document_id);

    // Chunk the content
    const chunks = chunkText(textContent);
    logStep("Content chunked", { chunkCount: chunks.length });

    // Update queue with chunk count
    await supabaseAdmin
      .from("document_ingestion_queue")
      .update({ chunks_created: 0 })
      .eq("document_id", document_id);

    // Process chunks one at a time
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logStep("Embedding chunk", { index: i + 1, total: chunks.length });

      const embeddingResult = await generateEmbedding(chunk.content);

      const { error: insertError } = await supabaseAdmin
        .from("knowledge_chunks")
        .insert({
          document_id,
          chunk_index: chunk.index,
          content: chunk.content,
          tokens_count: embeddingResult.tokens,
          section_heading: extractSectionHeading(chunk.content),
          embedding: formatEmbeddingForPgVector(embeddingResult.embedding),
        });

      if (insertError) {
        throw new Error(`Failed to insert chunk ${i}: ${insertError.message}`);
      }

      // Update progress
      await supabaseAdmin
        .from("document_ingestion_queue")
        .update({ chunks_created: i + 1 })
        .eq("document_id", document_id);
    }

    // Mark as completed
    await supabaseAdmin
      .from("document_ingestion_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        chunks_created: chunks.length,
      })
      .eq("document_id", document_id);

    logStep("Ingestion completed", { chunksInserted: chunks.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Background ingestion ERROR", { message: errorMessage });

    await supabaseAdmin
      .from("document_ingestion_queue")
      .update({
        status: "failed",
        error_message: errorMessage,
      })
      .eq("document_id", document_id);
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Ingest request received");

    // Authenticate and check admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Check if user is admin/owner
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = userRoles?.some((r) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    logStep("Admin authenticated", { userId: user.id });

    // Parse request
    const body: IngestRequest = await req.json();
    const { document_id, content: providedContent } = body;

    if (!document_id) {
      throw new Error("document_id is required");
    }

    // Get document info
    const { data: document, error: docError } = await supabaseAdmin
      .from("knowledge_documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${document_id}`);
    }

    logStep("Document found", { title: document.title, type: document.document_type });

    // Determine content source
    let textContent = providedContent;

    if (!textContent && document.content) {
      textContent = document.content as string;
      logStep("Using stored document content", { length: textContent.length });
    }

    if (!textContent && document.file_path) {
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from("knowledge-docs")
        .download(document.file_path);

      if (downloadError) {
        throw new Error(`Failed to download file: ${downloadError.message}`);
      }

      if (document.file_path.endsWith(".txt") || document.file_path.endsWith(".md")) {
        textContent = await fileData.text();
      } else if (document.file_path.endsWith(".pdf")) {
        throw new Error("PDF parsing not yet implemented. Please provide text content directly.");
      } else {
        textContent = await fileData.text();
      }
    }

    if (!textContent) {
      throw new Error("No content available for ingestion. Please provide content when adding the document.");
    }

    logStep("Content loaded", { length: textContent.length });

    // Clear any old queue entries and create new one
    await supabaseAdmin
      .from("document_ingestion_queue")
      .delete()
      .eq("document_id", document_id);

    await supabaseAdmin
      .from("document_ingestion_queue")
      .insert({
        document_id,
        status: "processing",
        started_at: new Date().toISOString(),
      });

    // Use waitUntil to process in background
    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(processIngestion(supabaseAdmin, document_id, textContent));

    // Return immediately
    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        message: "Ingestion started in background. Check document status for progress.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 202,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
