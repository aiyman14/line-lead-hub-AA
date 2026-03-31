import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentTimeInTimezone, formatCutoffTime, isTodayInTimezone } from "@/lib/date-utils";

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

      // Check if production date is today (in factory timezone)
      const timezone = factory?.timezone || "Asia/Dhaka";
      if (!isTodayInTimezone(productionDate, timezone)) {
        return { canEdit: false, reason: "Can only edit today's submissions" };
      }

      // Get cutoff time from factory settings (default to 23:59 if not set)
      const cutoffTimeStr = factory?.cutoff_time || "23:59";
      const [cutoffHour, cutoffMinute] = cutoffTimeStr.split(":").map(Number);

      // Use factory timezone for comparison
      const now = getCurrentTimeInTimezone(timezone);

      // Handle midnight (00:00) cutoff - means end of day
      if (cutoffHour === 0 && cutoffMinute === 0) {
        // Cutoff at midnight means submissions can be edited all day
        return { canEdit: true, reason: "" };
      }

      // Check if current time in factory timezone is before cutoff
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const isPastCutoff = currentHour > cutoffHour ||
        (currentHour === cutoffHour && currentMinute >= cutoffMinute);

      if (isPastCutoff) {
        return {
          canEdit: false,
          reason: `Editing closed after ${formatCutoffTime(cutoffTimeStr)}`
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

      // Use factory timezone
      const timezone = factory?.timezone || "Asia/Dhaka";
      const now = getCurrentTimeInTimezone(timezone);

      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Check if past cutoff
      const isPastCutoff = currentHour > cutoffHour ||
        (currentHour === cutoffHour && currentMinute >= cutoffMinute);

      if (isPastCutoff) {
        return null;
      }

      // Calculate time remaining
      let diffMins = (cutoffHour * 60 + cutoffMinute) - (currentHour * 60 + currentMinute);
      const diffHrs = Math.floor(diffMins / 60);
      diffMins = diffMins % 60;

      if (diffHrs > 0) {
        return `${diffHrs}h ${diffMins}m left`;
      }
      return `${diffMins}m left`;
    };
  }, [factory]);

  return { canEditSubmission, getTimeUntilCutoff };
}
