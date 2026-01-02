import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
              <Route path="/today" element={<Dashboard />} />
              <Route path="/blockers" element={<Dashboard />} />
              <Route path="/week" element={<Dashboard />} />
              <Route path="/lines" element={<Dashboard />} />
              <Route path="/work-orders" element={<Dashboard />} />
              <Route path="/insights" element={<Dashboard />} />
              <Route path="/setup" element={<SetupHome />} />
              <Route path="/setup/factory" element={<FactorySetup />} />
              <Route path="/setup/work-orders" element={<WorkOrders />} />
              <Route path="/setup/dropdowns" element={<DropdownSettings />} />
              <Route path="/users" element={<Dashboard />} />
              <Route path="/my-submissions" element={<Dashboard />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
