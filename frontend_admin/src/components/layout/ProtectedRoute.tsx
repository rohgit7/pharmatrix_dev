import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ivory-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-periwinkle-100 flex items-center justify-center text-periwinkle mb-4 border border-periwinkle-200">
          <Loader2 className="w-6 h-6 animate-spin text-periwinkle-700" />
        </div>
        <h2 className="text-sm font-semibold text-charcoal-800">Verifying administrator credentials...</h2>
        <p className="text-xs text-charcoal-500 mt-1">Connecting to Pharmatrix security services</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
