import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  fullName: string;
  factoryId: string;
  role: string;
  department?: string;
  lineIds?: string[];
  temporaryPassword?: string; // Optional: if provided, use this instead of random password
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Admin client with service role
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the caller is authenticated and has admin rights
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await adminClient.auth.getUser(token);
    
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller has admin role for the factory
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id);

    const isAdminOrHigher = callerRoles?.some(r => 
      ["admin", "owner"].includes(r.role)
    );

    if (!isAdminOrHigher) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: InviteRequest = await req.json();
    const { email, fullName, factoryId, role, department, lineIds, temporaryPassword } = body;

    if (!email || !fullName || !factoryId || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let userId: string;
    let isExistingUser = false;

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      userId = existingUser.id;
      isExistingUser = true;
    } else {
      // Create user with admin API (doesn't trigger client-side auth change)
      // Use provided password or generate a random one
      const password = temporaryPassword || (crypto.randomUUID() + crypto.randomUUID());
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm since admin is inviting
        user_metadata: {
          full_name: fullName,
          invited_by_admin: "true",
          factory_id: factoryId,
        },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
    }

    // Update profile with factory_id, department, and set as pending
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        factory_id: factoryId,
        full_name: fullName,
        department: role === "worker" ? (department || null) : null,
        invitation_status: "pending", // New users are pending until they sign in
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Remove existing roles for this factory
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("factory_id", factoryId);

    // Remove accidental global admin role
    await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .is("factory_id", null)
      .eq("role", "admin");

    // Assign new role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: userId,
        role: role,
        factory_id: factoryId,
      });

    if (roleError) {
      console.error("Role assignment error:", roleError);
      return new Response(JSON.stringify({ error: "Failed to assign role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle line assignments
    if (lineIds && lineIds.length > 0) {
      // Delete existing
      await adminClient
        .from("user_line_assignments")
        .delete()
        .eq("user_id", userId);

      // Insert new
      const assignments = lineIds.map(lineId => ({
        user_id: userId,
        line_id: lineId,
        factory_id: factoryId,
      }));

      await adminClient.from("user_line_assignments").insert(assignments);
    }

    // Send password reset email so user can set their password
    const origin = req.headers.get("origin") || "https://lovable.dev";
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${origin}/reset-password`,
      },
    });

    if (resetError) {
      console.error("Reset link error:", resetError);
    }

    // Also trigger a password reset email
    await adminClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        isExistingUser,
        message: `User ${isExistingUser ? "updated" : "created"} successfully`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
