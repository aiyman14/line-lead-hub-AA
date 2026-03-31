import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const TOUR_VERSION = "v1";

function getCacheKey(userId: string, factoryId: string) {
  return `tour_${TOUR_VERSION}_completed_${userId}_${factoryId}`;
}

export function useTour() {
  const { user, profile } = useAuth();

  const isCompleted = useCallback((): boolean => {
    if (!user?.id || !profile?.factory_id) return true; // no profile = don't show

    // Fast path: localStorage cache
    const cacheKey = getCacheKey(user.id, profile.factory_id);
    if (localStorage.getItem(cacheKey) === "true") return true;

    // DB path: check profile column (available because AuthContext does select('*'))
    const p = profile as any;
    if (
      p.onboarding_tour_completed_at != null &&
      (p.onboarding_version || "v1") === TOUR_VERSION
    ) {
      // Backfill cache so next call is instant
      localStorage.setItem(cacheKey, "true");
      return true;
    }

    return false;
  }, [user?.id, profile]);

  const markCompleted = useCallback(async () => {
    if (!user?.id || !profile?.factory_id) return;

    // Write localStorage immediately (prevents re-trigger on fast re-renders)
    localStorage.setItem(getCacheKey(user.id, profile.factory_id), "true");

    // Persist to DB
    await supabase
      .from("profiles")
      .update({
        onboarding_tour_completed_at: new Date().toISOString(),
        onboarding_version: TOUR_VERSION,
      } as any)
      .eq("id", user.id);
  }, [user?.id, profile?.factory_id]);

  const resetTour = useCallback(async () => {
    if (!user?.id || !profile?.factory_id) return;

    localStorage.removeItem(getCacheKey(user.id, profile.factory_id));

    await supabase
      .from("profiles")
      .update({
        onboarding_tour_completed_at: null,
      } as any)
      .eq("id", user.id);
  }, [user?.id, profile?.factory_id]);

  return { isCompleted, markCompleted, resetTour };
}
