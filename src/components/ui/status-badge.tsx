import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        danger: "bg-destructive/10 text-destructive",
        info: "bg-primary/10 text-primary",
        sewing: "bg-primary/10 text-primary",
        finishing: "bg-info/10 text-info",
        open: "bg-destructive/10 text-destructive",
        in_progress: "bg-warning/10 text-warning",
        resolved: "bg-success/10 text-success",
        critical: "bg-destructive/10 text-destructive",
        high: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
        medium: "bg-warning/10 text-warning",
        low: "bg-success/10 text-success",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
}

export function StatusBadge({
  className,
  variant,
  size,
  dot = false,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant, size }), className)}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "success" && "bg-success",
            variant === "warning" && "bg-warning",
            variant === "danger" && "bg-destructive",
            variant === "info" && "bg-primary",
            variant === "sewing" && "bg-primary",
            variant === "finishing" && "bg-info",
            variant === "open" && "bg-destructive",
            variant === "in_progress" && "bg-warning",
            variant === "resolved" && "bg-success",
            variant === "critical" && "bg-destructive",
            variant === "high" && "bg-orange-500",
            variant === "medium" && "bg-warning",
            variant === "low" && "bg-success",
            (!variant || variant === "default") && "bg-secondary-foreground"
          )}
        />
      )}
      {children}
    </span>
  );
}
