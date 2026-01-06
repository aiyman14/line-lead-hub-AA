import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create a client with the user's token to verify their identity
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 2. Verify JWT and get caller's user ID
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getUser();
    if (claimsError || !claimsData?.user) {
      console.error("Failed to verify token:", claimsError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const callerId = claimsData.user.id;
    console.log(`Password reset request from user ${callerId}`);

    // 3. Check if caller has admin or higher role using database function
    const { data: isAdminOrHigher, error: roleError } = await supabaseAdmin.rpc(
      "is_admin_or_higher",
      { _user_id: callerId }
    );

    if (roleError) {
      console.error("Error checking admin role:", roleError);
      return new Response(
        JSON.stringify({ success: false, error: "Authorization check failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!isAdminOrHigher) {
      console.error(`User ${callerId} attempted password reset without admin privileges`);
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: Admin privileges required" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 4. Parse request body
    const { email, newPassword }: ResetPasswordRequest = await req.json();
    console.log(`Admin ${callerId} requesting password reset for ${email}`);

    // 5. Get caller's factory_id
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("profiles")
      .select("factory_id")
      .eq("id", callerId)
      .single();

    if (callerProfileError || !callerProfile?.factory_id) {
      console.error("Error fetching caller profile:", callerProfileError);
      return new Response(
        JSON.stringify({ success: false, error: "Caller profile not found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 6. Find the target user by email
    const { data: userData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw listError;
    }

    const targetUser = userData.users.find(u => u.email === email);
    
    if (!targetUser) {
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 7. Verify target user is in the same factory (unless caller is superadmin)
    const { data: isSuperadmin } = await supabaseAdmin.rpc("is_superadmin", { _user_id: callerId });

    if (!isSuperadmin) {
      const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
        .from("profiles")
        .select("factory_id")
        .eq("id", targetUser.id)
        .single();

      if (targetProfileError) {
        console.error("Error fetching target profile:", targetProfileError);
        return new Response(
          JSON.stringify({ success: false, error: "Target user profile not found" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (targetProfile.factory_id !== callerProfile.factory_id) {
        console.error(`User ${callerId} attempted to reset password for user in different factory`);
        return new Response(
          JSON.stringify({ success: false, error: "Forbidden: Cannot reset password for users outside your factory" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // 8. Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw updateError;
    }

    console.log(`Password updated successfully for ${email} by admin ${callerId}`);

    return new Response(
      JSON.stringify({ success: true, userId: targetUser.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in admin-reset-password:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
