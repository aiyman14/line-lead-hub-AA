import { useContext, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, AuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { LoadingScreen } from "@/components/LoadingScreen";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import SewingUpdate from "./pages/SewingUpdate";
import FinishingUpdate from "./pages/FinishingUpdate";
import SewingMorningTargets from "./pages/SewingMorningTargets";
import SewingEndOfDay from "./pages/SewingEndOfDay";
import FinishingDailySheet from "./pages/FinishingDailySheet";
import FinishingMySubmissions from "./pages/FinishingMySubmissions";
import SewingMySubmissions from "./pages/SewingMySubmissions";
import FinishingOverview from "./pages/FinishingOverview";
import MorningTargets from "./pages/MorningTargets";
import EndOfDay from "./pages/EndOfDay";
import FactorySetup from "./pages/FactorySetup";
import SetupHome from "./pages/SetupHome";
import WorkOrders from "./pages/WorkOrders";
import DropdownSettings from "./pages/DropdownSettings";
import TodayUpdates from "./pages/TodayUpdates";
import Blockers from "./pages/Blockers";
import ThisWeek from "./pages/ThisWeek";
import Lines from "./pages/Lines";
import WorkOrdersView from "./pages/WorkOrdersView";
import Insights from "./pages/Insights";
import UsersPage from "./pages/Users";
import AllSubmissions from "./pages/AllSubmissions";
import LegacyMySubmissionsRedirect from "./pages/LegacyMySubmissionsRedirect";

import Preferences from "./pages/Preferences";
import Subscription from "./pages/Subscription";
import Billing from "./pages/Billing";
import BillingPlan from "./pages/BillingPlan";
import NotFound from "./pages/NotFound";
import ReportBlocker from "./pages/ReportBlocker";
import StorageBinCard from "./pages/StorageBinCard";
import StorageHistory from "./pages/StorageHistory";
import StorageDashboard from "./pages/StorageDashboard";
import CuttingForm from "./pages/CuttingForm";
import CuttingSummary from "./pages/CuttingSummary";
import CuttingAllSubmissions from "./pages/CuttingAllSubmissions";
import CuttingHandoffs from "./pages/CuttingHandoffs";
const queryClient = new QueryClient();

function AppRoutes() {
  const { loading } = useContext(AuthContext)!;
  const location = useLocation();

  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(location.search);

  const recoveryType = hashParams.get("type") ?? searchParams.get("type");
  const hasRecoverySignal = recoveryType === "recovery";

  const isForcedPasswordReset =
    typeof window !== "undefined" && sessionStorage.getItem("pp_force_password_reset") === "1";

  useEffect(() => {
    if (hasRecoverySignal && typeof window !== "undefined") {
      sessionStorage.setItem("pp_force_password_reset", "1");
    }
  }, [hasRecoverySignal]);

  // Guard: during password recovery, always force /reset-password first.
  // Note: some flows don't include access_token in the hash; we still must route to reset UI.
  if (!loading && hasRecoverySignal && location.pathname !== "/reset-password") {
    return <Navigate to={`/reset-password${location.search}${location.hash}`} replace />;
  }

  // Guard: if we previously detected a recovery flow, block app navigation until it is completed.
  if (!loading && isForcedPasswordReset && location.pathname !== "/reset-password" && location.pathname !== "/auth") {
    return <Navigate to={`/reset-password${location.search}${location.hash}`} replace />;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/subscription" element={<Subscription />} />

      {/* Protected routes with subscription gate */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<SubscriptionGate><Dashboard /></SubscriptionGate>} />
        <Route path="/update/sewing" element={<SubscriptionGate><SewingUpdate /></SubscriptionGate>} />
        <Route path="/update/finishing" element={<SubscriptionGate><FinishingUpdate /></SubscriptionGate>} />
        <Route path="/sewing/morning-targets" element={<SubscriptionGate><SewingMorningTargets /></SubscriptionGate>} />
        <Route path="/sewing/end-of-day" element={<SubscriptionGate><SewingEndOfDay /></SubscriptionGate>} />
        <Route path="/finishing/daily-sheet" element={<SubscriptionGate><FinishingDailySheet /></SubscriptionGate>} />
        <Route path="/finishing/my-submissions" element={<SubscriptionGate><FinishingMySubmissions /></SubscriptionGate>} />
        <Route path="/finishing/overview" element={<SubscriptionGate><FinishingOverview /></SubscriptionGate>} />
        <Route path="/morning-targets" element={<SubscriptionGate><MorningTargets /></SubscriptionGate>} />
        <Route path="/end-of-day" element={<SubscriptionGate><EndOfDay /></SubscriptionGate>} />
        <Route path="/report-blocker" element={<SubscriptionGate><ReportBlocker /></SubscriptionGate>} />
        <Route path="/today" element={<SubscriptionGate><TodayUpdates /></SubscriptionGate>} />
        <Route path="/blockers" element={<SubscriptionGate><Blockers /></SubscriptionGate>} />
        <Route path="/week" element={<SubscriptionGate><ThisWeek /></SubscriptionGate>} />
        <Route path="/lines" element={<SubscriptionGate><Lines /></SubscriptionGate>} />
        <Route path="/work-orders" element={<SubscriptionGate><WorkOrdersView /></SubscriptionGate>} />
        <Route path="/insights" element={<SubscriptionGate><Insights /></SubscriptionGate>} />
        <Route path="/setup" element={<SubscriptionGate><SetupHome /></SubscriptionGate>} />
        <Route path="/setup/factory" element={<FactorySetup />} />
        <Route path="/setup/work-orders" element={<SubscriptionGate><WorkOrders /></SubscriptionGate>} />
        <Route path="/setup/dropdowns" element={<SubscriptionGate><DropdownSettings /></SubscriptionGate>} />
        <Route path="/users" element={<SubscriptionGate><UsersPage /></SubscriptionGate>} />
        <Route path="/submissions" element={<SubscriptionGate><AllSubmissions /></SubscriptionGate>} />
        <Route path="/my-submissions" element={<SubscriptionGate><LegacyMySubmissionsRedirect /></SubscriptionGate>} />

        <Route path="/preferences" element={<SubscriptionGate><Preferences /></SubscriptionGate>} />
        <Route path="/billing" element={<SubscriptionGate><Billing /></SubscriptionGate>} />
        <Route path="/billing-plan" element={<BillingPlan />} />
        {/* Storage module routes */}
        <Route path="/storage" element={<SubscriptionGate><StorageBinCard /></SubscriptionGate>} />
        <Route path="/storage/history" element={<SubscriptionGate><StorageHistory /></SubscriptionGate>} />
        <Route path="/storage/dashboard" element={<SubscriptionGate><StorageDashboard /></SubscriptionGate>} />
        {/* Cutting module routes */}
        <Route path="/cutting/form" element={<SubscriptionGate><CuttingForm /></SubscriptionGate>} />
        <Route path="/cutting/summary" element={<SubscriptionGate><CuttingSummary /></SubscriptionGate>} />
        <Route path="/cutting/submissions" element={<SubscriptionGate><CuttingAllSubmissions /></SubscriptionGate>} />
        {/* Sewing module routes */}
        <Route path="/sewing/cutting-handoffs" element={<SubscriptionGate><CuttingHandoffs /></SubscriptionGate>} />
        <Route path="/sewing/my-submissions" element={<SubscriptionGate><SewingMySubmissions /></SubscriptionGate>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
