import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { IncomingShipments } from './pages/IncomingShipments';
import { ShipmentDetails } from './pages/ShipmentDetails';
import { ReceiveShipment } from './pages/ReceiveShipment';
import { DisposalManagement } from './pages/DisposalManagement';
import { CertificateUpload } from './pages/CertificateUpload';

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
            {/* Public Facility Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Facility Portal Routes (FACILITY role required) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="shipments" element={<IncomingShipments />} />
              <Route path="shipments/:shipmentId" element={<ShipmentDetails />} />
              <Route path="receive" element={<ReceiveShipment />} />
              <Route path="disposal" element={<DisposalManagement />} />
              <Route path="certificates" element={<CertificateUpload />} />

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

