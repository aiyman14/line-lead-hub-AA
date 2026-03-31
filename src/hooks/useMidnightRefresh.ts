import { useEffect, useRef } from "react";
import { getTodayInTimezone, getCurrentTimeInTimezone } from "@/lib/date-utils";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Calls `onDateChange` when the factory-timezone date rolls over at midnight,
 * or when the tab regains focus and the date has changed since last check.
 */
export function useMidnightRefresh(onDateChange: (newDate: string) => void) {
  const { factory } = useAuth();
  const timezone = factory?.timezone || "Asia/Dhaka";
  const lastDateRef = useRef<string>(getTodayInTimezone(timezone));
  const onDateChangeRef = useRef(onDateChange);
  onDateChangeRef.current = onDateChange;

  useEffect(() => {
    lastDateRef.current = getTodayInTimezone(timezone);

    function checkDateChange() {
      const newDate = getTodayInTimezone(timezone);
      if (newDate !== lastDateRef.current) {
        lastDateRef.current = newDate;
        onDateChangeRef.current(newDate);
      }
    }

    function scheduleNextMidnight(): ReturnType<typeof setTimeout> {
      const now = getCurrentTimeInTimezone(timezone);
      const msUntilMidnight =
        ((23 - now.getHours()) * 3600 + (59 - now.getMinutes()) * 60 + (60 - now.getSeconds())) * 1000 -
        now.getMilliseconds();
      // Add a 2-second buffer past midnight
      const delay = msUntilMidnight + 2000;

      return setTimeout(() => {
        checkDateChange();
        timerId = scheduleNextMidnight();
      }, delay);
    }

    let timerId = scheduleNextMidnight();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkDateChange();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [timezone]);
}
