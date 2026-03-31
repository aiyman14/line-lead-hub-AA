import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/** "Jan 5" */
export function formatShortDate(dateString: string): string {
  return format(new Date(dateString), "MMM d");
}

/** "Jan 5, 2026" */
export function formatDate(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy");
}

/** "2:30 PM" - displays in browser's local timezone (legacy) */
export function formatTime(dateString: string): string {
  return format(new Date(dateString), "h:mm a");
}

/** "Jan 5, 2026 at 2:30 PM" - displays in browser's local timezone (legacy) */
export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
}

/**
 * "2026-01-05" — for DB queries / production_date.
 * Prefer `getTodayInTimezone(tz)` for production dates.
 * When a timezone is provided, the date is interpreted in that timezone.
 */
export function toISODate(date: Date = new Date(), timezone?: string): string {
  if (timezone) {
    const zonedDate = toZonedTime(date, timezone);
    return format(zonedDate, "yyyy-MM-dd");
  }
  return format(date, "yyyy-MM-dd");
}

// ============================================
// TIMEZONE-AWARE FUNCTIONS
// ============================================

/**
 * "2:30 PM" - displays in the specified timezone
 * @param dateString - UTC ISO date string from database
 * @param timezone - IANA timezone (e.g., "Asia/Dhaka")
 */
export function formatTimeInTimezone(dateString: string, timezone: string): string {
  const date = new Date(dateString);
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, "h:mm a");
}

/**
 * "Jan 5, 2026 at 2:30 PM" - displays in the specified timezone
 * @param dateString - UTC ISO date string from database
 * @param timezone - IANA timezone (e.g., "Asia/Dhaka")
 */
export function formatDateTimeInTimezone(dateString: string, timezone: string): string {
  const date = new Date(dateString);
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Get the current time in a specific timezone
 * @param timezone - IANA timezone (e.g., "Asia/Dhaka")
 * @returns Date object representing current time in that timezone
 */
export function getCurrentTimeInTimezone(timezone: string): Date {
  const now = new Date();
  return toZonedTime(now, timezone);
}

/**
 * Get today's date string (YYYY-MM-DD) in a specific timezone
 * @param timezone - IANA timezone (e.g., "Asia/Dhaka")
 * @returns Date string like "2026-01-05"
 */
export function getTodayInTimezone(timezone: string): string {
  const zonedNow = getCurrentTimeInTimezone(timezone);
  return format(zonedNow, "yyyy-MM-dd");
}

/**
 * Check if the current time in the given timezone is past the cutoff time
 * @param cutoffTime - Time string in "HH:MM" or "HH:MM:SS" format
 * @param timezone - IANA timezone (e.g., "Asia/Dhaka")
 * @returns true if current time in timezone is past cutoff
 */
export function isLateForCutoff(cutoffTime: string, timezone: string): boolean {
  const zonedNow = getCurrentTimeInTimezone(timezone);
  const [cutoffHour, cutoffMinute] = cutoffTime.split(':').map(Number);

  const currentHour = zonedNow.getHours();
  const currentMinute = zonedNow.getMinutes();

  // Compare hours first, then minutes
  if (currentHour > cutoffHour) return true;
  if (currentHour === cutoffHour && currentMinute > cutoffMinute) return true;
  return false;
}

/**
 * Get a formatted cutoff time for display
 * @param cutoffTime - Time string in "HH:MM" or "HH:MM:SS" format
 * @returns Formatted time like "10:30 AM"
 */
export function formatCutoffTime(cutoffTime: string): string {
  const [hour, minute] = cutoffTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return format(date, "h:mm a");
}

/**
 * Check if a date string (YYYY-MM-DD) represents "today" in the given timezone.
 * Replaces date-fns isToday() which uses browser local time.
 * @param dateString - Date string in "YYYY-MM-DD" format
 * @param timezone - IANA timezone (e.g., "Asia/Dhaka")
 */
export function isTodayInTimezone(dateString: string, timezone: string): boolean {
  return dateString === getTodayInTimezone(timezone);
}

/**
 * Format a date for display in a specific timezone (full date with day name)
 * @param date - Date object
 * @param timezone - IANA timezone (e.g., "Asia/Dhaka")
 * @param locale - Optional locale string (e.g., "bn-BD" for Bengali)
 */
export function formatFullDateInTimezone(
  date: Date,
  timezone: string,
  locale?: string
): string {
  const zonedDate = toZonedTime(date, timezone);
  // For localized display, we use toLocaleDateString with the timezone
  return zonedDate.toLocaleDateString(locale || 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
