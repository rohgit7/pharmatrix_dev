import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { FacilityUser, FacilityProfile } from '../types/facility';
import { facilityAuthApi } from '../api/facility';
import {
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  FACILITY_STORAGE_KEY,
} from '../api/client';

interface AuthContextType {
  user: FacilityUser | null;
  facility: FacilityProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isFacilityUser: boolean;
  login: (email: string, password: string) => Promise<FacilityUser>;
  logout: () => void;
  refreshProfile: () => Promise<FacilityUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [user, setUser] = useState<FacilityUser | null>(() => {
    const saved = sessionStorage.getItem(USER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [facility, setFacility] = useState<FacilityProfile | null>(() => {
    const saved = sessionStorage.getItem(FACILITY_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    sessionStorage.removeItem(FACILITY_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setFacility(null);
  }, []);

  const refreshProfile = useCallback(async (): Promise<FacilityUser | null> => {
    const currentToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!currentToken) {
      setUser(null);
      setFacility(null);
      return null;
    }

    try {
      const [userData, facilityData] = await Promise.all([
        facilityAuthApi.getMe(),
        facilityAuthApi.getMyFacility(),
      ]);

      if (userData.role !== 'FACILITY') {
        logout();
        throw new Error('Access denied: Disposal Facility (FACILITY) role required.');
      }

      setUser(userData);
      setFacility(facilityData);
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      sessionStorage.setItem(FACILITY_STORAGE_KEY, JSON.stringify(facilityData));
      return userData;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        await refreshProfile();
      }
      setIsLoading(false);
    };
    initAuth();
  }, [token, refreshProfile]);

  const login = async (email: string, password: string): Promise<FacilityUser> => {
    setIsLoading(true);
    try {
      const loginRes = await facilityAuthApi.login({ email, password });
      if (loginRes.user.role !== 'FACILITY') {
        logout();
        throw new Error(
          `Access denied: Account role is '${loginRes.user.role}', but 'FACILITY' role is required.`
        );
      }

      sessionStorage.setItem(TOKEN_STORAGE_KEY, loginRes.access_token);
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loginRes.user));
      sessionStorage.setItem(FACILITY_STORAGE_KEY, JSON.stringify(loginRes.facility));

      setToken(loginRes.access_token);
      setUser(loginRes.user);
      setFacility(loginRes.facility);
      return loginRes.user;
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = !!token && !!user && user.role === 'FACILITY';
  const isFacilityUser = user?.role === 'FACILITY';

  return (
    <AuthContext.Provider
      value={{
        user,
        facility,
        token,
        isLoading,
        isAuthenticated,
        isFacilityUser,
        login,
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

