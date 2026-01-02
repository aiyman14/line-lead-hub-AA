import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "positive" | "negative" | "warning" | "neutral";
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: KPICardProps) {
  const variantClasses = {
    default: "",
    positive: "kpi-card-positive",
    negative: "kpi-card-negative",
    warning: "kpi-card-warning",
    neutral: "kpi-card-neutral",
  };

  const trendColor = trend
    ? trend.value > 0
      ? "text-success"
      : trend.value < 0
      ? "text-destructive"
      : "text-muted-foreground"
    : "";

  return (
    <div
      className={cn(
        "kpi-card animate-fade-in",
        variantClasses[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="kpi-label">{title}</p>
          <p className="kpi-number">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-sm">
          <span className={cn("font-medium", trendColor)}>
            {trend.value > 0 ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
