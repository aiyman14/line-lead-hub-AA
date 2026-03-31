import { Link } from "react-router-dom";
import { Rocket, ChevronRight, X, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/contexts/OnboardingContext";

export function SetupProgressBanner() {
  const onboarding = useOnboarding();

  if (!onboarding.bannerVisible) return null;

  const { currentStep, completedCount, totalCount, allComplete } = onboarding;
  const progress = (completedCount / totalCount) * 100;

  if (allComplete) {
    return (
      <div className="w-full px-4 py-2.5 flex items-center justify-between gap-4 bg-green-600 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <PartyPopper className="h-4 w-4 shrink-0" />
          <span className="text-sm font-semibold">
            You're all set up!
          </span>
          <span className="text-sm opacity-80 hidden sm:inline">
            ProductionPortal is ready — start tracking production across your factory.
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 hover:bg-white/20 text-white shrink-0"
          onClick={onboarding.dismissBanner}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-2.5 flex items-center justify-between gap-4 bg-primary text-primary-foreground">
      <div className="flex items-center gap-3 min-w-0">
        <Rocket className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold whitespace-nowrap">
          Setup: {completedCount}/{totalCount}
        </span>
        <Progress value={progress} className="h-1.5 w-24 hidden sm:block opacity-50" />
        {currentStep && (
          <span className="text-sm opacity-80 truncate hidden md:inline">
            Next: {currentStep.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {currentStep && (
          <Button size="sm" variant="secondary" className="h-7 text-xs" asChild>
            <Link to={currentStep.href}>
              Continue Setup
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Link>
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 hover:bg-primary-foreground/20 text-primary-foreground"
          onClick={onboarding.dismissBanner}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
