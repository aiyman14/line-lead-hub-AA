import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RemoveUserAccessRequest = {
  userId: string;
};

serve(async (req) => {
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

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requesterId = userData.user.id;

    const { userId: targetUserId }: RemoveUserAccessRequest = await req.json();
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch requester profile/factory
    const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
      .from("profiles")
      .select("factory_id")
      .eq("id", requesterId)
      .single();

    if (requesterProfileError) throw requesterProfileError;

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

    if (isAdminError) throw isAdminError;

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperadmin, error: isSuperadminError } = await supabaseAdmin.rpc(
      "is_superadmin",
      { _user_id: requesterId }
    );

    if (isSuperadminError) throw isSuperadminError;

    // Ensure target belongs to same factory (unless superadmin)
    if (!isSuperadmin) {
      const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
        .from("profiles")
        .select("factory_id")
        .eq("id", targetUserId)
        .single();

      if (targetProfileError) throw targetProfileError;

      if (targetProfile?.factory_id !== requesterFactoryId) {
        return new Response(JSON.stringify({ error: "Target user not in your factory" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("[remove-user-access]", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
