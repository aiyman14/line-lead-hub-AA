import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";
import { generateEmbedding, formatEmbeddingForPgVector } from "../_shared/embeddings.ts";

// Minimal edge function: embeds ONE chunk and inserts it via service role.
// Called per-chunk from the client to avoid resource limits.

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    // Check admin/owner role
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const isAdmin = userRoles?.some((r) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) throw new Error("Admin access required");

    // Parse request
    const { document_id, chunk_index, content, section_heading } = await req.json();
    if (!document_id || chunk_index === undefined || !content) {
      throw new Error("document_id, chunk_index, and content are required");
    }

    // Generate embedding
    const embeddingResult = await generateEmbedding(content);

    // Delete existing chunk at this index (for re-ingestion)
    await supabaseAdmin
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", document_id)
      .eq("chunk_index", chunk_index);

    // Insert chunk with embedding (service role bypasses RLS)
    const { error: insertError } = await supabaseAdmin
      .from("knowledge_chunks")
      .insert({
        document_id,
        chunk_index,
        content,
        tokens_count: embeddingResult.tokens,
        section_heading: section_heading || null,
        embedding: formatEmbeddingForPgVector(embeddingResult.embedding),
      });

    if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

    return new Response(
      JSON.stringify({ success: true, chunk_index }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
