import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import { DriverRoute, RouteStop } from '../types/api';
import { useAuth } from './AuthContext';

export interface RouteStats {
  totalStops: number;
  completedStops: number;
  pendingStops: number;
  failedStops: number;
  currentStopIndex: number;
}

export interface RouteContextType {
  route: DriverRoute | null;
  activeStop: RouteStop | null;
  selectedStop: RouteStop | null;
  setSelectedStop: (stop: RouteStop | null) => void;
  stats: RouteStats;
  isLoading: boolean;
  actionLoading: boolean;
  error: string | null;
  refreshRoute: () => Promise<void>;
  startRoute: () => Promise<void>;
  arriveAtStop: (stopId: number) => Promise<void>;
  scanQR: (stopId: number, qrToken: string) => Promise<any>;
  verifyOTP: (stopId: number, otp: string) => Promise<any>;
  completeStop: (
    stopId: number,
    weightKg?: number,
    notes?: string
  ) => Promise<{
    message: string;
    stop_id: number;
    status: string;
    completed_at?: string;
    nextStop: RouteStop | null;
    isLastStop: boolean;
  }>;
  failStop: (stopId: number, reason: string) => Promise<any>;
  uploadCollectionProof: (
    stopId: number,
    fileInput: string | Blob | File,
    fileName?: string,
    mimeType?: string
  ) => Promise<any>;
  getCollectionProofUrl: (
    stopId: number,
    expiresIn?: number
  ) => Promise<{ stop_id: number; route_id: number; proof_uploaded: boolean; expires_in: number; signed_url: string }>;
}

const RouteContext = createContext<RouteContextType | undefined>(undefined);

export const RouteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [route, setRoute] = useState<DriverRoute | null>(null);
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchRoute = useCallback(async () => {
    if (!isAuthenticated) {
      setRoute(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getTodayRoute();
      setRoute(data);
    } catch (err: any) {
      if (err?.status === 404) {
        setRoute((prev) => {
          if (prev && prev.stops) {
            return {
              ...prev,
              status: 'COMPLETED',
            };
          }
          return null;
        });
        setError('No active uncompleted route assigned for today.');
      } else {
        setError(err?.message || 'Failed to synchronize assigned route.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRoute();
    } else {
      setRoute(null);
      setSelectedStop(null);
      setError(null);
    }
  }, [isAuthenticated, fetchRoute]);

  const activeStop = useMemo<RouteStop | null>(() => {
    if (!route || !route.stops || route.stops.length === 0) return null;
    const active = route.stops.find(
      (s) => s.execution_status === 'ARRIVED' || s.execution_status === 'IN_PROGRESS'
    );
    if (active) return active;
    const pending = route.stops.find((s) => s.execution_status === 'PENDING');
    return pending || route.stops[route.stops.length - 1];
  }, [route]);

  const stats = useMemo<RouteStats>(() => {
    if (!route || !route.stops || route.stops.length === 0) {
      return { totalStops: 0, completedStops: 0, pendingStops: 0, failedStops: 0, currentStopIndex: 1 };
    }
    const total = route.stops.length;
    const completed = route.stops.filter((s) => s.execution_status === 'COMPLETED').length;
    const failed = route.stops.filter((s) => s.execution_status === 'FAILED').length;
    const activeIdx = activeStop ? route.stops.findIndex((s) => s.id === activeStop.id) + 1 : 1;
    return {
      totalStops: total,
      completedStops: completed,
      pendingStops: total - completed - failed,
      failedStops: failed,
      currentStopIndex: Math.max(1, activeIdx),
    };
  }, [route, activeStop]);

  const startRoute = async () => {
    if (!route) return;
    setActionLoading(true);
    try {
      await api.startRoute(route.id);
      await fetchRoute();
    } finally {
      setActionLoading(false);
    }
  };

  const arriveAtStop = async (stopId: number) => {
    if (!route) return;
    setActionLoading(true);
    try {
      await api.arriveAtStop(route.id, stopId);
      await fetchRoute();
    } finally {
      setActionLoading(false);
    }
  };

  const scanQR = async (stopId: number, qrToken: string) => {
    if (!route) return;
    setActionLoading(true);
    try {
      const res = await api.scanQR(route.id, stopId, qrToken);
      await fetchRoute();
      return res;
    } finally {
      setActionLoading(false);
    }
  };

  const verifyOTP = async (stopId: number, otp: string) => {
    if (!route) return;
    setActionLoading(true);
    try {
      const res = await api.verifyOTP(route.id, stopId, otp);
      await fetchRoute();
      return res;
    } finally {
      setActionLoading(false);
    }
  };

  const completeStop = async (
    stopId: number,
    weightKg: number = 0,
    notes?: string
  ) => {
    if (!route) throw new Error('No active route assigned');
    setActionLoading(true);
    try {
      const res = await api.completeStop(route.id, stopId, weightKg, notes);

      // 1. Identify next stop in sequence
      const currentIdx = route.stops.findIndex((s) => s.id === stopId);
      let nextStop: RouteStop | null = null;
      if (currentIdx !== -1) {
        for (let i = currentIdx + 1; i < route.stops.length; i++) {
          const s = route.stops[i];
          if (s.id !== stopId && s.execution_status !== 'COMPLETED' && s.execution_status !== 'FAILED') {
            nextStop = s;
            break;
          }
        }
      }

      // 2. Set next stop as selectedStop for seamless navigation focus
      setSelectedStop(nextStop);

      // 3. Re-fetch route state
      await fetchRoute();

      return {
        ...res,
        nextStop,
        isLastStop: !nextStop || nextStop.stop_type === 'WAREHOUSE',
      };
    } finally {
      setActionLoading(false);
    }
  };

  const failStop = async (stopId: number, reason: string) => {
    if (!route) return;
    setActionLoading(true);
    try {
      const res = await api.failStop(route.id, stopId, reason);
      await fetchRoute();
      return res;
    } finally {
      setActionLoading(false);
    }
  };

  const uploadCollectionProof = async (
    stopId: number,
    fileInput: string | Blob | File,
    fileName: string = 'collection_proof.jpg',
    mimeType: string = 'image/jpeg'
  ) => {
    if (!route) throw new Error('No active route assigned');
    setActionLoading(true);
    try {
      const res = await api.uploadCollectionProof(route.id, stopId, fileInput, fileName, mimeType);
      await fetchRoute();
      return res;
    } finally {
      setActionLoading(false);
    }
  };

  const getCollectionProofUrl = async (stopId: number, expiresIn: number = 3600) => {
    if (!route) throw new Error('No active route assigned');
    return api.getCollectionProofUrl(route.id, stopId, expiresIn);
  };

  return (
    <RouteContext.Provider
      value={{
        route,
        activeStop,
        selectedStop,
        setSelectedStop,
        stats,
        isLoading,
        actionLoading,
        error,
        refreshRoute: fetchRoute,
        startRoute,
        arriveAtStop,
        scanQR,
        verifyOTP,
        completeStop,
        failStop,
        uploadCollectionProof,
        getCollectionProofUrl,
      }}
    >
      {children}
    </RouteContext.Provider>
  );
};

export const useRouteContext = () => {
  const context = useContext(RouteContext);
  if (!context) {
    throw new Error('useRouteContext must be used within a RouteProvider');
  }
  return context;
};

export default RouteContext;
