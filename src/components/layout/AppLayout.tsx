import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, RefreshCw } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { TrialExpirationBanner } from "@/components/TrialExpirationBanner";
import { NetworkStatusIndicator } from "@/components/NetworkStatusIndicator";

export function AppLayout() {
  const { user, loading, factory, profile } = useAuth();

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
    <SidebarProvider defaultOpen={true} className="w-full overflow-x-hidden">
      {/* 
        Root container: fills viewport including safe areas
        Uses min-h-screen with safe-area padding for proper iOS layout
      */}
      <div 
        className="flex w-full flex-col overflow-x-hidden bg-background"
        style={{
          minHeight: '100dvh',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <TrialExpirationBanner />
        <div className="flex flex-1 min-w-0 overflow-x-hidden">
          <AppSidebar />
          <div className="flex flex-1 min-w-0 flex-col overflow-x-hidden">
            {/* Header - sticky below safe area */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
              <SidebarTrigger className="lg:hidden" />

              <div className="flex-1" />

              <NetworkStatusIndicator />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.reload()}
                className="h-9 w-9"
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

            {/* 
              Main content - single scroll container with momentum scrolling
              Safe area bottom padding handled in CSS
            */}
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-background">
              <div className="w-full px-4 md:px-6 pb-6">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
