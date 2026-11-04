import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  api,
  AuthUser,
  CustomerLocation,
  CustomerMeResponse,
  CustomerOnboardPayload,
  setUnauthorizedHandler,
} from '../services/api';
import { storage } from '../services/storage';

interface AuthContextType {
  user: AuthUser | null;
  customer: CustomerMeResponse | null;
  locations: CustomerLocation[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerAndLogin: (name: string, email: string, password: string) => Promise<void>;
  completeOnboarding: (payload: CustomerOnboardPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [customer, setCustomer] = useState<CustomerMeResponse | null>(null);
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clearSession = useCallback(async () => {
    await storage.removeItem('access_token');
    await storage.removeItem('refresh_token');
    setUser(null);
    setCustomer(null);
    setLocations([]);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const loadCustomerContext = useCallback(async () => {
    const me = await api.getMe();
    if (me.role !== 'CUSTOMER') {
      await clearSession();
      throw new Error(
        `Access denied: Account role is ${me.role}. Only registered CUSTOMER accounts may access the Pharmatrix Customer Portal.`
      );
    }
    setUser(me);

    const cust = await api.getCustomerMe();
    setCustomer(cust);

    if (cust.onboarded) {
      try {
        const locs = await api.getLocations();
        setLocations(locs);
      } catch {
        setLocations(cust.locations || []);
      }
    } else {
      setLocations([]);
    }
  }, [clearSession]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await storage.getItem('access_token');
        if (token) {
          await loadCustomerContext();
        }
      } catch {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, [loadCustomerContext, clearSession]);

  const login = async (email: string, password: string) => {
    try {
      const authData = await api.login(email, password);
      await storage.setItem('access_token', authData.access_token);
      if (authData.refresh_token) {
        await storage.setItem('refresh_token', authData.refresh_token);
      }
      await loadCustomerContext();
    } catch (error) {
      await clearSession();
      throw error;
    }
  };

  const registerAndLogin = async (name: string, email: string, password: string) => {
    try {
      const regRes = await api.registerCustomer(name, email, password);
      if (regRes.access_token) {
        await storage.setItem('access_token', regRes.access_token);
        if (regRes.refresh_token) {
          await storage.setItem('refresh_token', regRes.refresh_token);
        }
        await loadCustomerContext();
      } else {
        await login(email, password);
      }
    } catch (error) {
      await clearSession();
      throw error;
    }
  };

  const completeOnboarding = async (payload: CustomerOnboardPayload) => {
    await api.onboardCustomer(payload);
    await loadCustomerContext();
  };

  const logout = async () => {
    await clearSession();
  };

  const refreshProfile = async () => {
    if (!user) return;
    await loadCustomerContext();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customer,
        locations,
        isLoading,
        isAuthenticated: !!user,
        isOnboarded: !!customer?.onboarded,
        login,
        registerAndLogin,
        completeOnboarding,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

