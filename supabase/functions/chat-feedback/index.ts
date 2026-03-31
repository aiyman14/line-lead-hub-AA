import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";

interface FeedbackRequest {
  message_id: string;
  feedback: "thumbs_up" | "thumbs_down";
  comment?: string;
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

    const body: FeedbackRequest = await req.json();
    const { message_id, feedback, comment } = body;

    if (!message_id || !feedback) {
      throw new Error("message_id and feedback are required");
    }

    if (!["thumbs_up", "thumbs_down"].includes(feedback)) {
      throw new Error("feedback must be 'thumbs_up' or 'thumbs_down'");
    }

    // Verify the message belongs to user's conversation
    const { data: message } = await supabaseAdmin
      .from("chat_messages")
      .select(`
        id,
        conversation:chat_conversations!inner (
          user_id
        )
      `)
      .eq("id", message_id)
      .single();

    if (!message || (message.conversation as any).user_id !== user.id) {
      throw new Error("Message not found or access denied");
    }

    // Update analytics with feedback
    const { error: updateError } = await supabaseAdmin
      .from("chat_analytics")
      .update({
        feedback,
        feedback_comment: comment || null,
      })
      .eq("message_id", message_id);

    if (updateError) {
      // If no existing record, create one
      await supabaseAdmin.from("chat_analytics").insert({
        message_id,
        feedback,
        feedback_comment: comment || null,
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
