import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Voitures from "./pages/Voitures";
import Reservation from "./pages/Reservation";
import APropos from "./pages/APropos";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import CarDetails from "./pages/CarDetails";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { CarInventoryProvider } from "@/contexts/CarInventoryContext";
import {
  AdminDashboardPage,
  AdminCustomersPage,
  AdminFleetPage,
  AdminPaymentsPage,
  AdminReservationsPage,
  AdminReportsPage,
  AdminSettingsPage,
  AdminShell,
} from "./pages/admin/AdminPortal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CarInventoryProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/voitures" element={<Voitures />} />
              <Route path="/voitures/:slug" element={<CarDetails />} />
              <Route path="/reservation" element={<Reservation />} />
              <Route path="/a-propos" element={<APropos />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/admin"
                element={<ProtectedRoute roles={["admin"]}><Navigate to="/admin/dashboard" replace /></ProtectedRoute>}
              />
              <Route
                path="/admin/dashboard"
                element={<ProtectedRoute roles={["admin"]}><AdminShell><AdminDashboardPage /></AdminShell></ProtectedRoute>}
              />
              <Route
                path="/admin/fleet"
                element={<ProtectedRoute roles={["admin"]}><AdminShell><AdminFleetPage /></AdminShell></ProtectedRoute>}
              />
              <Route
                path="/admin/reservations"
                element={<ProtectedRoute roles={["admin"]}><AdminShell><AdminReservationsPage /></AdminShell></ProtectedRoute>}
              />
              <Route
                path="/admin/customers"
                element={<ProtectedRoute roles={["admin"]}><AdminShell><AdminCustomersPage /></AdminShell></ProtectedRoute>}
              />
              <Route
                path="/admin/payments"
                element={<ProtectedRoute roles={["admin"]}><AdminShell><AdminPaymentsPage /></AdminShell></ProtectedRoute>}
              />
              <Route
                path="/admin/reports"
                element={<ProtectedRoute roles={["admin"]}><AdminShell><AdminReportsPage /></AdminShell></ProtectedRoute>}
              />
              <Route
                path="/admin/settings"
                element={<ProtectedRoute roles={["admin"]}><AdminShell><AdminSettingsPage /></AdminShell></ProtectedRoute>}
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CarInventoryProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
