import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function useSwitchWorkspace() {
  const { user, profile } = useAuth();
  const [switching, setSwitching] = useState(false);

  async function switchWorkspace(newFactoryId: string): Promise<boolean> {
    if (!user?.id) return false;
    if (profile?.factory_id === newFactoryId) return true; // Already active

    setSwitching(true);

    try {
      // 1. Validate membership exists and is active
      const { data: membership } = await supabase
        .from("buyer_factory_memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("factory_id", newFactoryId)
        .eq("is_active", true)
        .maybeSingle();

      if (!membership) {
        console.error("[switchWorkspace] No active membership for factory:", newFactoryId);
        return false;
      }

      // 2. Update server-side active workspace
      const { error } = await supabase
        .from("profiles")
        .update({ factory_id: newFactoryId })
        .eq("id", user.id);

      if (error) {
        console.error("[switchWorkspace] Failed to update factory_id:", error.message);
        return false;
      }

      // 3. Update localStorage for optimistic UI
      localStorage.setItem("buyer_active_workspace", newFactoryId);

      // 4. Reload to pick up new factory context in AuthContext
      window.location.href = "/buyer/dashboard";
      return true;
    } catch (err) {
      console.error("[switchWorkspace] Error:", err);
      return false;
    } finally {
      setSwitching(false);
    }
  }

  return { switchWorkspace, switching };
}
