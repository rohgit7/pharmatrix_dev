import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import storage from '../services/storage';
import { AuthUser, DriverProfile } from '../types/api';

interface AuthContextType {
  user: AuthUser | null;
  driverProfile: DriverProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isProfileDrawerOpen: boolean;
  openProfileDrawer: () => void;
  closeProfileDrawer: () => void;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState<boolean>(false);

  const loadSession = useCallback(async () => {
    try {
      const token = await storage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      // 1. Immediately restore cached user & driver profile if available
      try {
        const cachedUserStr = await storage.getItem('user_profile');
        const cachedDriverStr = await storage.getItem('driver_profile');
        if (cachedUserStr) {
          setUser(JSON.parse(cachedUserStr));
        }
        if (cachedDriverStr) {
          setDriverProfile(JSON.parse(cachedDriverStr));
        }
      } catch {
        // Ignore cache parsing errors
      }

      // 2. Validate and refresh user session with backend
      try {
        const me = await api.getMe();
        setUser(me);
        await storage.setItem('user_profile', JSON.stringify(me));

        try {
          const driver = await api.getDriverProfile();
          setDriverProfile(driver);
          await storage.setItem('driver_profile', JSON.stringify(driver));
        } catch {
          // Keep existing or synthesize from user
          setDriverProfile((prev) => prev || {
            id: me.id,
            user_id: me.id,
            employee_id: `DRV-${me.id.toString().padStart(4, '0')}`,
            name: me.name || me.email.split('@')[0],
            email: me.email,
            phone: '',
            license_number: '',
            status: 'ACTIVE',
            is_available: true,
          });
        }
      } catch (err: any) {
        // ONLY log out if explicitly rejected with 401
        if (err?.status === 401) {
          await storage.clear();
          setUser(null);
          setDriverProfile(null);
        }
        // If network error / timeout, retain current session so driver isn't kicked off
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      await api.login(email, pass);
      const me = await api.getMe();
      setUser(me);
      await storage.setItem('user_profile', JSON.stringify(me));

      try {
        const driver = await api.getDriverProfile();
        setDriverProfile(driver);
        await storage.setItem('driver_profile', JSON.stringify(driver));
      } catch {
        const fallbackDriver: DriverProfile = {
          id: me.id,
          user_id: me.id,
          employee_id: `DRV-${me.id.toString().padStart(4, '0')}`,
          name: me.name || me.email.split('@')[0],
          email: me.email,
          phone: '',
          license_number: '',
          status: 'ACTIVE',
          is_available: true,
        };
        setDriverProfile(fallbackDriver);
        await storage.setItem('driver_profile', JSON.stringify(fallbackDriver));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await storage.clear();
    setUser(null);
    setDriverProfile(null);
    setIsProfileDrawerOpen(false);
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const driver = await api.getDriverProfile();
      setDriverProfile((prev) => ({ ...prev, ...driver }));
      await storage.setItem('driver_profile', JSON.stringify(driver));
    } catch {
      // Ignore
    }
  };

  const openProfileDrawer = () => setIsProfileDrawerOpen(true);
  const closeProfileDrawer = () => setIsProfileDrawerOpen(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        driverProfile,
        isLoading,
        isAuthenticated: !!user,
        isProfileDrawerOpen,
        openProfileDrawer,
        closeProfileDrawer,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
