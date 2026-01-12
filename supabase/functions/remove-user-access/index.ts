import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// UUID validation regex
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Input validation schema
const removeUserSchema = z.object({
  userId: z.string().regex(uuidRegex, "Invalid user ID format"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requesterId = userData.user.id;

    // Parse and validate request body
    const rawBody = await req.json();
    const validation = removeUserSchema.safeParse(rawBody);
    
    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message).join(", ");
      console.error("[remove-user-access] Validation failed:", errors);
      return new Response(JSON.stringify({ error: `Invalid input: ${errors}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId: targetUserId } = validation.data;

    // Fetch requester profile/factory
    const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
      .from("profiles")
      .select("factory_id")
      .eq("id", requesterId)
      .single();

    if (requesterProfileError) {
      console.error("[remove-user-access] Error fetching requester profile:", requesterProfileError);
      return new Response(JSON.stringify({ error: "Failed to verify permissions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requesterFactoryId = requesterProfile?.factory_id as string | null;
    if (!requesterFactoryId) {
      return new Response(JSON.stringify({ error: "Requester has no factory" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: must be admin or higher
    const { data: isAdmin, error: isAdminError } = await supabaseAdmin.rpc(
      "is_admin_or_higher",
      { _user_id: requesterId }
    );

    if (isAdminError) {
      console.error("[remove-user-access] Error checking admin status:", isAdminError);
      return new Response(JSON.stringify({ error: "Failed to verify permissions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure target belongs to same factory
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("factory_id")
      .eq("id", targetUserId)
      .single();

    if (targetProfileError) {
      console.error("[remove-user-access] Error fetching target profile:", targetProfileError);
      return new Response(JSON.stringify({ error: "Target user not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetProfile?.factory_id !== requesterFactoryId) {
      return new Response(JSON.stringify({ error: "Target user not in your factory" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete user_roles for this user in the factory
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId)
      .eq("factory_id", requesterFactoryId);

    // Delete user_line_assignments for this user in the factory
    await supabaseAdmin
      .from("user_line_assignments")
      .delete()
      .eq("user_id", targetUserId)
      .eq("factory_id", requesterFactoryId);

    // Delete profile (this will cascade or be cleaned up)
    await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", targetUserId);

    // Fully delete user from auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (deleteAuthError) {
      console.error("[remove-user-access] Failed to delete auth user:", deleteAuthError.message);
      // Continue anyway - profile is already deleted
    }

    console.log("[remove-user-access] Fully deleted user:", targetUserId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[remove-user-access] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
