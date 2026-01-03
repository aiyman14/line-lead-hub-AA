import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
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
              
              {/* Protected routes */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/update/sewing" element={<SewingUpdate />} />
                <Route path="/update/finishing" element={<FinishingUpdate />} />
                <Route path="/today" element={<TodayUpdates />} />
                <Route path="/blockers" element={<Blockers />} />
                <Route path="/week" element={<ThisWeek />} />
                <Route path="/lines" element={<Lines />} />
                <Route path="/work-orders" element={<WorkOrdersView />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/setup" element={<SetupHome />} />
                <Route path="/setup/factory" element={<FactorySetup />} />
                <Route path="/setup/work-orders" element={<WorkOrders />} />
                <Route path="/setup/dropdowns" element={<DropdownSettings />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/submissions" element={<AllSubmissions />} />
                <Route path="/my-submissions" element={<MySubmissions />} />
                <Route path="/preferences" element={<Preferences />} />
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
