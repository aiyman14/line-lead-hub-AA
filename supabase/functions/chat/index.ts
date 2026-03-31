import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/security.ts";
import { generateEmbedding, formatEmbeddingForPgVector } from "../_shared/embeddings.ts";
import {
  generateChatResponse,
  buildSystemPrompt,
  detectLanguage,
  type ChatMessage,
  type SourceChunk,
} from "../_shared/llm.ts";
import { fetchLiveData, type LiveDataContext } from "../_shared/live-data.ts";

interface ChatRequest {
  message: string;
  conversation_id?: string;
  language?: "en" | "bn" | "zh";
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHAT] ${step}${detailsStr}`);
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
    logStep("Chat request received");

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
    logStep("User authenticated", { userId: user.id });

    // Get user profile and roles
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("factory_id, full_name")
      .eq("id", user.id)
      .single();

    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = userRoles?.map((r) => r.role) || ["worker"];
    const primaryRole = roles.includes("owner")
      ? "owner"
      : roles.includes("admin")
        ? "admin"
        : roles[0] || "worker";

    // Get factory timezone for date queries
    let factoryTimezone: string | null = null;
    if (profile?.factory_id) {
      const { data: factoryData } = await supabaseAdmin
        .from("factory_accounts")
        .select("timezone")
        .eq("id", profile.factory_id)
        .single();
      factoryTimezone = factoryData?.timezone || null;
    }

    logStep("User context", { roles, primaryRole, factoryId: profile?.factory_id });

    // Parse request
    const body: ChatRequest = await req.json();
    const { message, conversation_id, language: requestedLanguage } = body;

    if (!message || message.trim().length === 0) {
      throw new Error("Message is required");
    }

    // Detect language
    const detectedLanguage = detectLanguage(message);
    const language = requestedLanguage || detectedLanguage;
    logStep("Language", { detected: detectedLanguage, using: language });

    // Get or create conversation
    let conversationId = conversation_id;
    if (!conversationId) {
      const { data: newConversation, error: convError } = await supabaseAdmin
        .from("chat_conversations")
        .insert({
          user_id: user.id,
          factory_id: profile?.factory_id,
          language,
          title: message.substring(0, 100),
        })
        .select("id")
        .single();

      if (convError) throw new Error(`Failed to create conversation: ${convError.message}`);
      conversationId = newConversation.id;
      logStep("Created conversation", { conversationId });
    } else {
      // Verify the conversation belongs to this user (prevent cross-factory data access)
      const { data: convOwner } = await supabaseAdmin
        .from("chat_conversations")
        .select("user_id")
        .eq("id", conversationId)
        .single();
      if (!convOwner || convOwner.user_id !== user.id) {
        throw new Error("Conversation not found");
      }
    }

    // Save user message
    await supabaseAdmin.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    // Get conversation history (last 10 messages for context)
    const { data: historyData } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(10);

    const conversationHistory: ChatMessage[] = (historyData || []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Generate embedding for the query
    logStep("Generating query embedding");
    const { embedding } = await generateEmbedding(message);
    const embeddingStr = formatEmbeddingForPgVector(embedding);

    // Search knowledge base — primary search with threshold 0.3
    logStep("Searching knowledge base");
    const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
      "search_knowledge",
      {
        query_embedding: embeddingStr,
        match_threshold: 0.3,
        match_count: 10,
        p_factory_id: profile?.factory_id,
        p_language: null, // Search all languages, let context decide
      }
    );

    if (searchError) {
      logStep("Search error", { error: searchError.message });
    }

    let sources: SourceChunk[] = searchResults || [];

    // Log detailed search results for debugging
    if (sources.length > 0) {
      logStep("Found sources", {
        count: sources.length,
        results: sources.map((s) => ({
          title: s.document_title,
          similarity: (s.similarity * 100).toFixed(1) + "%",
          section: s.section_heading || "General",
        })),
      });
    } else {
      logStep("No sources found at threshold 0.3, trying fallback at 0.15");
      // Fallback: broader search with very low threshold to surface anything remotely relevant
      const { data: fallbackResults, error: fallbackError } = await supabaseAdmin.rpc(
        "search_knowledge",
        {
          query_embedding: embeddingStr,
          match_threshold: 0.15,
          match_count: 5,
          p_factory_id: profile?.factory_id,
          p_language: null,
        }
      );
      if (fallbackError) {
        logStep("Fallback search error", { error: fallbackError.message });
      }
      sources = fallbackResults || [];
      logStep("Fallback sources", {
        count: sources.length,
        results: sources.map((s) => ({
          title: s.document_title,
          similarity: (s.similarity * 100).toFixed(1) + "%",
        })),
      });
    }

    // Fetch live factory data if the question relates to production data
    logStep("Checking for live data queries");
    let liveDataContext: LiveDataContext | null = null;
    try {
    liveDataContext = await fetchLiveData(
        supabaseAdmin as any,
        profile?.factory_id,
        message,
        factoryTimezone,
        primaryRole,
      );
      if (liveDataContext) {
        logStep("Live data fetched", {
          categories: liveDataContext.results.map((r) => r.category),
          rowCounts: liveDataContext.results.map((r) => ({
            [r.category]: r.data.length,
          })),
        });
      } else {
        logStep("No live data categories matched");
      }
    } catch (liveDataError) {
      // Live data errors should never block the chat response
      logStep("Live data error (non-fatal)", {
        error: liveDataError instanceof Error ? liveDataError.message : String(liveDataError),
      });
    }

    // Get user's accessible features
    const { data: features } = await supabaseAdmin.rpc("get_user_accessible_features", {
      p_user_id: user.id,
    });

    // Build system prompt
    const hasLiveData = liveDataContext !== null && liveDataContext.results.length > 0;
    const systemPrompt = buildSystemPrompt(primaryRole, features || [], language, hasLiveData);

    // Generate response
    logStep("Generating response");
    const response = await generateChatResponse(conversationHistory, sources, systemPrompt, liveDataContext);

    // Save assistant message
    const { data: assistantMessage } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        content: response.content,
        citations: response.citations,
        tokens_used: response.tokensUsed,
        model: response.model,
        no_evidence: response.noEvidence,
      })
      .select("id")
      .single();

    // Log analytics
    await supabaseAdmin.from("chat_analytics").insert({
      message_id: assistantMessage?.id,
      conversation_id: conversationId,
      factory_id: profile?.factory_id,
      user_role: primaryRole,
      question_text: message,
      answer_length: response.content.length,
      citations_count: response.citations.length,
      no_evidence: response.noEvidence,
      language,
    });

    logStep("Response generated", {
      tokensUsed: response.tokensUsed,
      citationsCount: response.citations.length,
      noEvidence: response.noEvidence,
    });

    return new Response(
      JSON.stringify({
        message: response.content,
        citations: response.citations,
        conversation_id: conversationId,
        no_evidence: response.noEvidence,
        suggested_questions: response.suggestedQuestions,
        language,
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
      status: 500,
    });
  }
});
