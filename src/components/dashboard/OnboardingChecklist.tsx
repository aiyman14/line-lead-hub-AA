import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Lock, X, Rocket, ChevronRight } from "lucide-react";
import type { ChecklistStep } from "@/hooks/useOnboardingChecklist";

interface OnboardingChecklistProps {
  steps: ChecklistStep[];
  completedCount: number;
  totalCount: number;
  onDismiss: () => void;
}

export function OnboardingChecklist({ steps, completedCount, totalCount, onDismiss }: OnboardingChecklistProps) {
  const progress = (completedCount / totalCount) * 100;

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Get Started with Your Factory</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Complete these steps in order to start tracking production
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Progress value={progress} className="h-2" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {completedCount} of {totalCount}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-1">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                step.completed ? "opacity-60" :
                step.locked ? "opacity-40" :
                "hover:bg-muted/50"
              }`}
            >
              {step.completed ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : step.locked ? (
                <Lock className="h-5 w-5 text-muted-foreground/30 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-primary shrink-0" />
              )}
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${
                  step.completed ? "line-through text-muted-foreground" :
                  step.locked ? "text-muted-foreground" : ""
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {!step.completed && !step.locked && (
                <Button variant="ghost" size="sm" className="shrink-0 h-8 px-2" asChild>
                  <Link to={step.href}>
                    Go <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
