import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Pickups } from './pages/Pickups';
import { PickupHistory } from './pages/PickupHistory';
import { RouteOptimization } from './pages/RouteOptimization';
import { Routes as RoutesPage } from './pages/Routes';

import { Fleet } from './pages/Fleet';
import { DispatchMonitoring } from './pages/DispatchMonitoring';
import { Customers } from './pages/Customers';
import { Users } from './pages/Users';
import { PricingBilling } from './pages/PricingBilling';
import { DisposalCertificates } from './pages/DisposalCertificates';
import { AuditLogs } from './pages/AuditLogs';
import { Configuration } from './pages/Configuration';
import { Warehouses } from './pages/Warehouses';
import { Facilities } from './pages/Facilities';
import { Exceptions } from './pages/Exceptions';
import { WarehouseIntakes } from './pages/WarehouseIntakes';
import { DisposalShipments } from './pages/DisposalShipments';
import { CustomerDocuments } from './pages/CustomerDocuments';
import { WhatsAppTemplates } from './pages/WhatsAppTemplates';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public authentication route */}
            <Route path="/login" element={<Login />} />

            {/* Protected administrator dashboard routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              {/* OPERATIONS */}
              <Route index element={<Overview />} />
              <Route path="pickups" element={<Pickups />} />
              <Route path="pickup-history" element={<PickupHistory />} />
              <Route path="pickups/history" element={<PickupHistory />} />
              <Route path="route-optimization" element={<RouteOptimization />} />

              <Route path="routes" element={<RouteOptimization />} />
              <Route path="routes-legacy" element={<RoutesPage />} />
              <Route path="fleet" element={<Fleet />} />
              <Route path="dispatch" element={<DispatchMonitoring />} />
              <Route path="monitoring" element={<DispatchMonitoring />} />
              <Route path="warehouse-intakes" element={<WarehouseIntakes />} />
              <Route path="intakes" element={<WarehouseIntakes />} />
              <Route path="disposal-shipments" element={<DisposalShipments />} />
              <Route path="shipments" element={<DisposalShipments />} />

              {/* BUSINESS */}
              <Route path="customers" element={<Customers />} />
              <Route path="billing" element={<PricingBilling />} />
              <Route path="invoices" element={<PricingBilling />} />
              <Route path="certificates" element={<DisposalCertificates />} />
              <Route path="disposal-certificates" element={<DisposalCertificates />} />

              {/* ADMINISTRATION */}
              <Route path="users" element={<Users />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="configuration" element={<Configuration />} />

              {/* LOGISTICS & UTILITIES */}
              <Route path="warehouses" element={<Warehouses />} />
              <Route path="facilities" element={<Facilities />} />
              <Route path="exceptions" element={<Exceptions />} />
              <Route path="documents" element={<CustomerDocuments />} />
              <Route path="customer-documents" element={<CustomerDocuments />} />
              <Route path="whatsapp-templates" element={<WhatsAppTemplates />} />
              <Route path="settings" element={<Settings />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
