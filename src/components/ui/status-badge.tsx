import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground shadow-sm",
        success: "bg-success/10 text-success border border-success/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        danger: "bg-destructive/10 text-destructive border border-destructive/20",
        info: "bg-primary/10 text-primary border border-primary/20",
        sewing: "bg-primary/10 text-primary border border-primary/20",
        finishing: "bg-info/10 text-info border border-info/20",
        open: "bg-destructive/10 text-destructive border border-destructive/20",
        in_progress: "bg-warning/10 text-warning border border-warning/20",
        resolved: "bg-success/10 text-success border border-success/20",
        critical: "bg-destructive/10 text-destructive border border-destructive/20",
        high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
        medium: "bg-warning/10 text-warning border border-warning/20",
        low: "bg-success/10 text-success border border-success/20",
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
