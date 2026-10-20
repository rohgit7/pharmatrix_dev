import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Pickups } from './pages/Pickups';
import { Routes as RoutesPage } from './pages/Routes';
import { Warehouses } from './pages/Warehouses';
import { Facilities } from './pages/Facilities';
import { Exceptions } from './pages/Exceptions';
import { Documents } from './pages/Documents';
import { Fleet } from './pages/Fleet';
import { Invoices } from './pages/Invoices';
import { Configuration } from './pages/Configuration';
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
              <Route index element={<Overview />} />
              <Route path="pickups" element={<Pickups />} />
              <Route path="routes" element={<RoutesPage />} />
              <Route path="warehouses" element={<Warehouses />} />
              <Route path="facilities" element={<Facilities />} />
              <Route path="exceptions" element={<Exceptions />} />
              <Route path="documents" element={<Documents />} />
              <Route path="fleet" element={<Fleet />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="configuration" element={<Configuration />} />
              <Route path="whatsapp-templates" element={<WhatsAppTemplates />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
