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
import {
  deactivatePushNotificationsAsync,
  registerForPushNotificationsAsync,
} from '../services/notifications';

interface AuthContextType {
  user: AuthUser | null;
  customer: CustomerMeResponse | null;
  locations: CustomerLocation[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerAndLogin: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  registerAccountTokenOnly: (
    name: string,
    email: string,
    password: string,
    phone?: string
  ) => Promise<AuthUser>;
  submitOnboardingPayload: (payload: CustomerOnboardPayload) => Promise<CustomerMeResponse>;
  finalizeOnboardingSession: () => Promise<void>;
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
    await deactivatePushNotificationsAsync().catch(() => {});
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

    // Register push notification token on login / session restore
    registerForPushNotificationsAsync().catch(() => {});

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

  const registerAccountTokenOnly = async (
    name: string,
    email: string,
    password: string,
    phone?: string
  ): Promise<AuthUser> => {
    const regRes = await api.registerCustomer(name, email, password, phone);
    if (regRes.access_token) {
      await storage.setItem('access_token', regRes.access_token);
      if (regRes.refresh_token) {
        await storage.setItem('refresh_token', regRes.refresh_token);
      }
    } else {
      const authData = await api.login(email, password);
      await storage.setItem('access_token', authData.access_token);
      if (authData.refresh_token) {
        await storage.setItem('refresh_token', authData.refresh_token);
      }
    }
    const me = await api.getMe();
    return me;
  };

  const submitOnboardingPayload = async (
    payload: CustomerOnboardPayload
  ): Promise<CustomerMeResponse> => {
    const created = await api.onboardCustomer(payload);
    return created;
  };

  const finalizeOnboardingSession = async () => {
    await loadCustomerContext();
  };

  const registerAndLogin = async (
    name: string,
    email: string,
    password: string,
    phone?: string
  ) => {
    try {
      await registerAccountTokenOnly(name, email, password, phone);
      await loadCustomerContext();
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
        registerAccountTokenOnly,
        submitOnboardingPayload,
        finalizeOnboardingSession,
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
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
