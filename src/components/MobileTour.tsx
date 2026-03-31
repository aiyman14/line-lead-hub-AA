import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  BarChart3,
  Rows3,
  ClipboardList,
  AlertTriangle,
  Rocket,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

interface MobileTourProps {
  open: boolean;
  onComplete: () => void;
}

const SLIDES = [
  {
    icon: Rocket,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
    title: "Welcome to ProductionPortal!",
    description:
      "Let's take a quick tour of the key areas. Swipe through or tap the arrows to navigate.",
  },
  {
    icon: CalendarDays,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
    title: "Today Updates",
    description:
      "Line leads log daily production here — sewing, finishing, and cutting outputs. Check this every morning for live factory progress.",
  },
  {
    icon: BarChart3,
    iconColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-900/40",
    title: "Live KPI Dashboard",
    description:
      "At-a-glance numbers: how many lines reported today, active blockers, and total output. Updates in real time as your team submits data.",
  },
  {
    icon: Rows3,
    iconColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-100 dark:bg-violet-900/40",
    title: "Lines",
    description:
      "View live status for every production line — who's on target, who's behind, and where bottlenecks are forming.",
  },
  {
    icon: ClipboardList,
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-900/40",
    title: "Work Orders",
    description:
      "Track completion across all your POs — cutting, sewing, and finishing progress in one place.",
  },
  {
    icon: AlertTriangle,
    iconColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-900/40",
    title: "Blockers",
    description:
      "Any issue slowing production gets logged here. Material shortages, machine breakdowns, and more — resolve them fast to keep lines running.",
  },
  {
    icon: Rocket,
    iconColor: "text-primary",
    iconBg: "bg-primary/10",
    title: "You're ready!",
    description:
      "That's the core of ProductionPortal. Your team can start logging production today. You can restart this tour anytime from the sidebar.",
  },
];

export function MobileTour({ open, onComplete }: MobileTourProps) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const goNext = useCallback(() => {
    if (current < SLIDES.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      onComplete();
    }
  }, [current, onComplete]);

  const goPrev = useCallback(() => {
    if (current > 0) setCurrent((c) => c - 1);
  }, [current]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchDeltaX.current < -50) goNext();
    else if (touchDeltaX.current > 50) goPrev();
    touchDeltaX.current = 0;
  }, [goNext, goPrev]);

  if (!open) return null;

  const slide = SLIDES[current];
  const Icon = slide.icon;
  const isLast = current === SLIDES.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex flex-col bg-background/95 backdrop-blur-sm"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Skip button */}
        <div className="flex justify-end p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onComplete}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Skip
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center max-w-sm"
            >
              <div
                className={`h-20 w-20 rounded-2xl ${slide.iconBg} flex items-center justify-center mb-8`}
              >
                <Icon className={`h-10 w-10 ${slide.iconColor}`} />
              </div>
              <h2 className="text-2xl font-bold mb-3">{slide.title}</h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                {slide.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom nav */}
        <div className="px-6 pb-6 space-y-4">
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {current > 0 && (
              <Button
                variant="outline"
                onClick={goPrev}
                className="flex-1 h-12"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              onClick={goNext}
              className="flex-1 h-12"
            >
              {isLast ? (
                "Let's go!"
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
