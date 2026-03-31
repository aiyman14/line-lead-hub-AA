import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify the user from their token
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    console.log("[terminate-account] Starting account termination for:", userEmail);

    // Get user's factory_id before deletion
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("factory_id")
      .eq("id", userId)
      .single();

    const factoryId = profile?.factory_id;

    // Nullify submitted_by on production records so they don't block auth deletion.
    // Production data belongs to the factory and is preserved.
    if (factoryId) {
      await Promise.all([
        supabaseAdmin.from("sewing_targets").update({ submitted_by: null }).eq("submitted_by", userId).eq("factory_id", factoryId),
        supabaseAdmin.from("sewing_actuals").update({ submitted_by: null }).eq("submitted_by", userId).eq("factory_id", factoryId),
        supabaseAdmin.from("finishing_targets").update({ submitted_by: null }).eq("submitted_by", userId).eq("factory_id", factoryId),
        supabaseAdmin.from("finishing_actuals").update({ submitted_by: null }).eq("submitted_by", userId).eq("factory_id", factoryId),
        supabaseAdmin.from("cutting_targets").update({ submitted_by: null }).eq("submitted_by", userId).eq("factory_id", factoryId),
        supabaseAdmin.from("cutting_actuals").update({ submitted_by: null }).eq("submitted_by", userId).eq("factory_id", factoryId),
        supabaseAdmin.from("storage_bin_card_transactions").update({ submitted_by: null }).eq("submitted_by", userId).eq("factory_id", factoryId),
      ]);
    }

    // Delete all user-specific data
    await Promise.all([
      supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
      supabaseAdmin.from("user_line_assignments").delete().eq("user_id", userId),
      supabaseAdmin.from("notification_preferences").delete().eq("user_id", userId),
      supabaseAdmin.from("email_schedules").delete().eq("user_id", userId),
      supabaseAdmin.from("notifications").delete().eq("user_id", userId),
      supabaseAdmin.from("chat_conversations").delete().eq("user_id", userId),
    ]);

    // Delete profile
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    // Finally, delete from auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("[terminate-account] Failed to delete auth user:", deleteAuthError.message);
      throw new Error("Failed to delete authentication account");
    }

    console.log("[terminate-account] Successfully terminated account for:", userEmail);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[terminate-account] Error:", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
