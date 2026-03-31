import { useEffect } from "react";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, RefreshCw, AlertTriangle, Home } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { TrialExpirationBanner } from "@/components/TrialExpirationBanner";
import { SetupProgressBanner } from "@/components/SetupProgressBanner";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";
import { DMGWarningModal } from "@/components/DMGWarningModal";
import { ChatWidget } from "@/components/chat";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { TourProvider } from "@/contexts/TourContext";

const APP_THEME_COLOR = '#f1f3f5';
const DEFAULT_THEME_COLOR = '#0f172a';

function PageErrorFallback() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        This page crashed unexpectedly. You can reload or go back to the dashboard.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <Home className="h-4 w-4 mr-2" />
          Dashboard
        </Button>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reload Page
        </Button>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, loading, factory, profile } = useAuth();
  const location = useLocation();

  // Switch status bar to light color for the authenticated app
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', APP_THEME_COLOR);
    return () => { meta?.setAttribute('content', DEFAULT_THEME_COLOR); };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider defaultOpen={true} className="w-full min-h-[100dvh] overflow-x-hidden bg-background">
      {/* DMG Warning Modal - startup check (blocks until moved to Applications on macOS) */}
      <DMGWarningModal forceCheck={true} />
      
      {/* Root container: fills viewport INCLUDING safe areas */}
      <div className="flex w-full flex-col overflow-x-hidden bg-background" style={{ minHeight: '100dvh' }}>
        {/* Safe-area background filler (top) */}
        <div
          className="w-full bg-background"
          style={{ height: 'env(safe-area-inset-top, 0px)' }}
          aria-hidden="true"
        />

        <div className="flex flex-1 min-w-0 overflow-x-hidden">
          <TourProvider>
          <AppSidebar />
          <OnboardingProvider>
          <div className="flex flex-1 min-w-0 flex-col overflow-x-hidden">
            <TrialExpirationBanner />
            <SetupProgressBanner />
            {/* Header */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
              <SidebarTrigger className="lg:hidden" />

              <div className="flex-1" />

              <NetworkStatusIndicator />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.reload()}
                title="Refresh page"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              <NotificationBell />

              {factory && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
                  <span className="text-muted-foreground">Factory:</span>
                  <span className="font-medium">{factory.name}</span>
                </div>
              )}
            </header>

            {/* Main content - single scroll container */}
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-background">
              <div className="w-full px-4 md:px-6 pb-6">
                <ErrorBoundary key={location.pathname} fallback={<PageErrorFallback />}>
                  <Outlet />
                </ErrorBoundary>
              </div>
            </main>
          </div>
          </OnboardingProvider>
          </TourProvider>
        </div>

        {/* Safe-area background filler (bottom) */}
        <div
          className="w-full bg-background"
          style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
          aria-hidden="true"
        />
      </div>

      {/* Chat Assistant Widget */}
      <ChatWidget />
    </SidebarProvider>
  );
}
