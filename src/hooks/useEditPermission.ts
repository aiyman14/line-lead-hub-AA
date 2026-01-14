import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { parseISO, isToday, format } from "date-fns";

/**
 * Hook to determine if a submission can be edited based on:
 * 1. Production date is today
 * 2. Current time is before the factory's cutoff time
 * 3. User has the appropriate role
 */
export function useEditPermission() {
  const { factory, user, profile } = useAuth();

  const canEditSubmission = useMemo(() => {
    return (productionDate: string, submittedBy?: string | null): { canEdit: boolean; reason: string } => {
      // Must be logged in
      if (!user || !profile) {
        return { canEdit: false, reason: "Not logged in" };
      }

      // Check if production date is today
      const prodDate = parseISO(productionDate);
      if (!isToday(prodDate)) {
        return { canEdit: false, reason: "Can only edit today's submissions" };
      }

      // Get cutoff time from factory settings (default to 23:59 if not set)
      const cutoffTimeStr = factory?.cutoff_time || "23:59";
      const [cutoffHour, cutoffMinute] = cutoffTimeStr.split(":").map(Number);
      
      const now = new Date();
      const cutoffToday = new Date();
      cutoffToday.setHours(cutoffHour, cutoffMinute, 0, 0);

      // Handle midnight (00:00) cutoff - means end of day
      if (cutoffHour === 0 && cutoffMinute === 0) {
        // Cutoff at midnight means submissions can be edited all day
        return { canEdit: true, reason: "" };
      }

      // Check if current time is before cutoff
      if (now >= cutoffToday) {
        return { 
          canEdit: false, 
          reason: `Editing closed after ${format(cutoffToday, "h:mm a")}` 
        };
      }

      return { canEdit: true, reason: "" };
    };
  }, [factory, user, profile]);

  const getTimeUntilCutoff = useMemo(() => {
    return (): string | null => {
      if (!factory?.cutoff_time) return null;
      
      const cutoffTimeStr = factory.cutoff_time;
      const [cutoffHour, cutoffMinute] = cutoffTimeStr.split(":").map(Number);
      
      // Handle midnight cutoff
      if (cutoffHour === 0 && cutoffMinute === 0) {
        return "End of day";
      }
      
      const now = new Date();
      const cutoffToday = new Date();
      cutoffToday.setHours(cutoffHour, cutoffMinute, 0, 0);

      if (now >= cutoffToday) {
        return null;
      }

      const diffMs = cutoffToday.getTime() - now.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (diffHrs > 0) {
        return `${diffHrs}h ${diffMins}m left`;
      }
      return `${diffMins}m left`;
    };
  }, [factory]);

  return { canEditSubmission, getTimeUntilCutoff };
}
