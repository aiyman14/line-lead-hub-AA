import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { TrialExpirationBanner } from "@/components/TrialExpirationBanner";

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
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full flex-col">
        <TrialExpirationBanner />
        <div className="flex flex-1">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
              <SidebarTrigger className="lg:hidden" />
              
              <div className="flex-1" />
              
              <NotificationBell />
              
              {factory && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm">
                  <span className="text-muted-foreground">Factory:</span>
                  <span className="font-medium">{factory.name}</span>
                </div>
              )}
            </header>
            
            {/* Main content */}
            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
