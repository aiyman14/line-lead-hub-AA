import { createContext, useContext, useCallback, useRef, useEffect, useState, type ReactNode } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useTour } from "@/hooks/useTour";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileTour } from "@/components/MobileTour";

interface TourContextValue {
  startTour: () => void;
  resetTour: () => Promise<void>;
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const { markCompleted, isCompleted, resetTour } = useTour();
  const { setOpen } = useSidebar();
  const location = useLocation();
  const isMobile = useIsMobile();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const hasAutoStarted = useRef(false);
  const tourInProgress = useRef(false);
  const [mobileTourOpen, setMobileTourOpen] = useState(false);

  // Desktop tour using driver.js
  const startDesktopTour = useCallback(() => {
    if (tourInProgress.current) return;
    tourInProgress.current = true;

    // Open sidebar so nav items are visible and highlightable
    setOpen(true);

    // Destroy any previously active tour
    driverRef.current?.destroy();

    const driverObj = driver({
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Let's go! 🚀",
      allowClose: true,
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 8,
      animate: true,
      steps: [
        {
          popover: {
            title: "👋 Welcome to ProductionPortal!",
            description:
              "Let's take a quick 30-second tour to show you the key areas of the app. You can skip at any time by pressing <b>Esc</b>.",
          },
        },
        {
          element: '[data-tour="nav-today"]',
          popover: {
            title: "📅 Today Updates",
            description:
              "Line leads log daily production here — sewing, finishing, and cutting outputs. Check this every morning for live factory progress.",
            side: "right",
            align: "center",
          },
        },
        {
          element: '[data-tour="dashboard-kpis"]',
          popover: {
            title: "📊 Live KPI Dashboard",
            description:
              "At-a-glance numbers: how many lines reported today, active blockers, and total output. Updates in real time as your team submits data.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="nav-lines"]',
          popover: {
            title: "🪡 Lines",
            description:
              "View live status for every production line — who's on target, who's behind, and where bottlenecks are forming.",
            side: "right",
            align: "center",
          },
        },
        {
          element: '[data-tour="nav-work-orders"]',
          popover: {
            title: "📋 Work Orders",
            description:
              "Track completion across all your POs — cutting, sewing, and finishing progress in one place.",
            side: "right",
            align: "center",
          },
        },
        {
          element: '[data-tour="nav-blockers"]',
          popover: {
            title: "🚨 Blockers",
            description:
              "Any issue slowing production gets logged here. Material shortages, machine breakdowns, and more — resolve them fast to keep lines running.",
            side: "right",
            align: "center",
          },
        },
        {
          popover: {
            title: "🎉 You're ready!",
            description:
              "That's the core of ProductionPortal. Your team can start logging production today. You can restart this tour anytime from the sidebar.",
          },
        },
      ],
      onDestroyStarted: () => {
        tourInProgress.current = false;
        markCompleted();
        driverObj.destroy();
      },
    });

    driverRef.current = driverObj;
    driverObj.drive();
  }, [markCompleted, setOpen]);

  // Mobile tour: full-screen card slides
  const startMobileTour = useCallback(() => {
    if (tourInProgress.current) return;
    tourInProgress.current = true;
    setMobileTourOpen(true);
  }, []);

  const handleMobileTourComplete = useCallback(() => {
    setMobileTourOpen(false);
    tourInProgress.current = false;
    markCompleted();
  }, [markCompleted]);

  // Route to the correct tour based on device
  const startTour = useCallback(() => {
    if (isMobile) {
      startMobileTour();
    } else {
      startDesktopTour();
    }
  }, [isMobile, startMobileTour, startDesktopTour]);

  // Auto-start on first dashboard visit (once per session, only if not completed)
  useEffect(() => {
    if (location.pathname !== "/dashboard") return;
    if (hasAutoStarted.current) return;
    if (tourInProgress.current) return;
    if (isCompleted()) return;

    hasAutoStarted.current = true;
    const timer = setTimeout(() => {
      startTour();
    }, 1000);

    return () => clearTimeout(timer);
  }, [location.pathname, isCompleted, startTour]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return (
    <TourContext.Provider value={{ startTour, resetTour }}>
      {children}
      <MobileTour open={mobileTourOpen} onComplete={handleMobileTourComplete} />
    </TourContext.Provider>
  );
}

export function useTourContext() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTourContext must be used within TourProvider");
  return ctx;
}
