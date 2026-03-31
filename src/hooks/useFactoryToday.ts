import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getTodayInTimezone } from "@/lib/date-utils";
import { useMidnightRefresh } from "./useMidnightRefresh";

/**
 * Returns factory "today" as "YYYY-MM-DD", auto-updating at midnight
 * and on tab refocus.
 */
export function useFactoryToday(): string {
  const { factory } = useAuth();
  const timezone = factory?.timezone || "Asia/Dhaka";
  const [today, setToday] = useState(() => getTodayInTimezone(timezone));

  const handleDateChange = useCallback((newDate: string) => {
    setToday(newDate);
  }, []);

  useMidnightRefresh(handleDateChange);

  return today;
}
