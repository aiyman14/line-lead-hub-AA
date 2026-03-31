import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/security.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[GET-SOURCE] ${step}${detailsStr}`);
};

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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Get chunk ID from URL
    const url = new URL(req.url);
    const chunkId = url.pathname.split("/").pop();

    if (!chunkId) {
      throw new Error("Chunk ID is required");
    }

    logStep("Fetching source", { chunkId });

    // Get user's factory for access check
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("factory_id")
      .eq("id", user.id)
      .single();

    // Get chunk with document info
    const { data: chunk, error: chunkError } = await supabaseAdmin
      .from("knowledge_chunks")
      .select(`
        id,
        content,
        section_heading,
        page_number,
        chunk_index,
        document:knowledge_documents!inner (
          id,
          title,
          document_type,
          source_url,
          is_global,
          factory_id
        )
      `)
      .eq("id", chunkId)
      .single();

    if (chunkError || !chunk) {
      throw new Error("Source not found");
    }

    // Check access
    const doc = chunk.document as any;
    if (!doc.is_global && doc.factory_id !== profile?.factory_id) {
      throw new Error("Access denied to this source");
    }

    logStep("Source found", { documentTitle: doc.title });

    return new Response(
      JSON.stringify({
        id: chunk.id,
        content: chunk.content,
        section_heading: chunk.section_heading,
        page_number: chunk.page_number,
        chunk_index: chunk.chunk_index,
        document: {
          id: doc.id,
          title: doc.title,
          document_type: doc.document_type,
          source_url: doc.source_url,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error instanceof Error && error.message.includes("denied") ? 403 : 500,
    });
  }
});
