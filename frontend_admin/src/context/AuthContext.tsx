import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '../types/auth';
import { authApi } from '../api/auth';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem(USER_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    const currentToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!currentToken) {
      setUser(null);
      return null;
    }

    try {
      const userData = await authApi.getMe();
      if (userData.role !== 'ADMIN') {
        logout();
        throw new Error('Access restricted: Administrator role required.');
      }
      setUser(userData);
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      return userData;
    } catch (err) {
      logout();
      return null;
    }
  }, [logout]);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        await refreshUser();
      }
      setIsLoading(false);
    };
    initAuth();
  }, [token, refreshUser]);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const loginRes = await authApi.login({ email, password });
      sessionStorage.setItem(TOKEN_STORAGE_KEY, loginRes.access_token);
      setToken(loginRes.access_token);

      const profile = await authApi.getMe();
      if (profile.role !== 'ADMIN') {
        logout();
        throw new Error('Access denied: You must be an administrator to log into this portal.');
      }

      setUser(profile);
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        login,
        logout,
        refreshUser,
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
