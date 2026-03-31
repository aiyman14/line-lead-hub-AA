import { differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";

interface LiveDotProps {
  lastUpdate: string | null;
  thresholdMinutes?: number;
  className?: string;
}

export function LiveDot({
  lastUpdate,
  thresholdMinutes = 60,
  className,
}: LiveDotProps) {
  if (!lastUpdate) return null;

  const diff = differenceInMinutes(new Date(), new Date(lastUpdate));
  if (diff > thresholdMinutes) return null;

  return (
    <span className={cn("relative flex h-2.5 w-2.5", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}
