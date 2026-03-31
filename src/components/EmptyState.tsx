import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  iconClassName?: string;
}

/**
 * Full-page centered empty state with icon, heading, description, and optional action button.
 * Used for "No Factory Assigned", "Access Denied", and similar states.
 */
export function EmptyState({ icon: Icon, title, description, action, iconClassName = "text-muted-foreground" }: EmptyStateProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-4">
      <Card className="max-w-md">
        <CardContent className="pt-6 text-center">
          <Icon className={`h-12 w-12 mx-auto mb-4 ${iconClassName}`} />
          <h2 className="text-lg font-semibold mb-2">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
          {action && (
            <Button variant="outline" className="mt-4" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
