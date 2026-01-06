import { useContext } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, AuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { LoadingScreen } from "@/components/LoadingScreen";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SewingUpdate from "./pages/SewingUpdate";
import FinishingUpdate from "./pages/FinishingUpdate";
import SewingMorningTargets from "./pages/SewingMorningTargets";
import SewingEndOfDay from "./pages/SewingEndOfDay";
import FinishingMorningTargets from "./pages/FinishingMorningTargets";
import FinishingEndOfDay from "./pages/FinishingEndOfDay";
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
import MySubmissions from "./pages/MySubmissions";
import Preferences from "./pages/Preferences";
import Subscription from "./pages/Subscription";
import Billing from "./pages/Billing";
import BillingPlan from "./pages/BillingPlan";
import NotFound from "./pages/NotFound";
import ReportBlocker from "./pages/ReportBlocker";

const queryClient = new QueryClient();

function AppRoutes() {
  const { loading } = useContext(AuthContext)!;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/subscription" element={<Subscription />} />
      
      {/* Protected routes with subscription gate */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<SubscriptionGate><Dashboard /></SubscriptionGate>} />
        <Route path="/update/sewing" element={<SubscriptionGate><SewingUpdate /></SubscriptionGate>} />
        <Route path="/update/finishing" element={<SubscriptionGate><FinishingUpdate /></SubscriptionGate>} />
        <Route path="/sewing/morning-targets" element={<SubscriptionGate><SewingMorningTargets /></SubscriptionGate>} />
        <Route path="/sewing/end-of-day" element={<SubscriptionGate><SewingEndOfDay /></SubscriptionGate>} />
        <Route path="/finishing/morning-targets" element={<SubscriptionGate><FinishingMorningTargets /></SubscriptionGate>} />
        <Route path="/finishing/end-of-day" element={<SubscriptionGate><FinishingEndOfDay /></SubscriptionGate>} />
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
        <Route path="/setup/factory" element={<SubscriptionGate><FactorySetup /></SubscriptionGate>} />
        <Route path="/setup/work-orders" element={<SubscriptionGate><WorkOrders /></SubscriptionGate>} />
        <Route path="/setup/dropdowns" element={<SubscriptionGate><DropdownSettings /></SubscriptionGate>} />
        <Route path="/users" element={<SubscriptionGate><UsersPage /></SubscriptionGate>} />
        <Route path="/submissions" element={<SubscriptionGate><AllSubmissions /></SubscriptionGate>} />
        <Route path="/my-submissions" element={<SubscriptionGate><MySubmissions /></SubscriptionGate>} />
        <Route path="/preferences" element={<SubscriptionGate><Preferences /></SubscriptionGate>} />
        <Route path="/billing" element={<SubscriptionGate><Billing /></SubscriptionGate>} />
        <Route path="/billing-plan" element={<BillingPlan />} />
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
