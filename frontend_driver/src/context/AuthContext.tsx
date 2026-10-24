import React, { createContext, useContext, useEffect, useState } from 'react';
import { ApiClient, ApiError } from '@/services/api';
import { TokenStorage } from '@/services/storage';
import { DriverMeResponse, UserMeResponse } from '@/types/api';

interface AuthContextType {
  user: UserMeResponse | null;
  driver: DriverMeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  driver: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [driver, setDriver] = useState<DriverMeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const token = await TokenStorage.getAccessToken();
      if (!token) {
        setUser(null);
        setDriver(null);
        return;
      }

      const userMe = await ApiClient.getMe();
      if (userMe.role !== 'DRIVER') {
        throw new Error('Access denied: You must be a DRIVER to use this app.');
      }
      if (!userMe.is_active) {
        throw new Error('Your driver account has been deactivated. Contact dispatch.');
      }

      const driverMe = await ApiClient.getDriverMe();
      setUser(userMe);
      setDriver(driverMe);
    } catch (err) {
      await TokenStorage.clearTokens();
      setUser(null);
      setDriver(null);
      throw err;
    }
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const token = await TokenStorage.getAccessToken();
        if (token) {
          const userMe = await ApiClient.getMe();
          if (userMe.role === 'DRIVER' && userMe.is_active) {
            const driverMe = await ApiClient.getDriverMe();
            if (isMounted) {
              setUser(userMe);
              setDriver(driverMe);
            }
          } else {
            await TokenStorage.clearTokens();
          }
        }
      } catch (err) {
        await TokenStorage.clearTokens();
        if (isMounted) {
          setUser(null);
          setDriver(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const authRes = await ApiClient.login(email.trim(), password);
      await TokenStorage.setAccessToken(authRes.access_token);
      if (authRes.refresh_token) {
        await TokenStorage.setRefreshToken(authRes.refresh_token);
      }

      const userMe = await ApiClient.getMe();
      if (userMe.role !== 'DRIVER') {
        await TokenStorage.clearTokens();
        throw new Error('Insufficient permissions: This app is restricted to authorized Pharmatrix drivers.');
      }

      if (!userMe.is_active) {
        await TokenStorage.clearTokens();
        throw new Error('Your driver account is inactive. Please contact dispatch or administrator.');
      }

      const driverMe = await ApiClient.getDriverMe();
      setUser(userMe);
      setDriver(driverMe);
    } catch (err) {
      await TokenStorage.clearTokens();
      setUser(null);
      setDriver(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await TokenStorage.clearTokens();
      setUser(null);
      setDriver(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        driver,
        isLoading,
        isAuthenticated: !!user && !!driver,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
