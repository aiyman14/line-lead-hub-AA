import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SewingUpdate from "./pages/SewingUpdate";
import FinishingUpdate from "./pages/FinishingUpdate";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/subscription" element={<Subscription />} />
              
              {/* Protected routes with subscription gate */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<SubscriptionGate><Dashboard /></SubscriptionGate>} />
                <Route path="/update/sewing" element={<SubscriptionGate><SewingUpdate /></SubscriptionGate>} />
                <Route path="/update/finishing" element={<SubscriptionGate><FinishingUpdate /></SubscriptionGate>} />
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
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
