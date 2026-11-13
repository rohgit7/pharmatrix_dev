import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pickupsApi } from '../api/operations';
import { TOKEN_STORAGE_KEY } from '../api/client';
import { PickupMonitoringDetailResponse } from '../types/operations';

interface UseLivePickupReturn {
  data: PickupMonitoringDetailResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isLiveConnected: boolean;
  lastUpdated: Date | null;
  isStale: boolean;
  isTerminal: boolean;
  refetch: () => Promise<any>;
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'FAILED']);

export function useLivePickup(pickupId: string | number | null | undefined): UseLivePickupReturn {
  const queryClient = useQueryClient();
  const [liveData, setLiveData] = useState<PickupMonitoringDetailResponse | null>(null);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [isPageVisible, setIsPageVisible] = useState<boolean>(
    typeof document !== 'undefined' ? !document.hidden : true
  );
  const eventSourceRef = useRef<EventSource | null>(null);

  const pickupIdStr = pickupId ? String(pickupId) : '';

  // Track page visibility to pause connections when tab is inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // TanStack React Query for initial load and fallback polling
  const {
    data: initialData,
    isLoading,
    isError,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: ['adminPickupMonitoringDetail', pickupIdStr],
    queryFn: () => pickupsApi.getMonitoringDetail(pickupIdStr),
    enabled: Boolean(pickupIdStr),
    // If live SSE is active, or if pickup is terminal (completed/cancelled), or if tab hidden: NO POLLING!
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status;
      if (isLiveConnected) return false;
      if (currentStatus && TERMINAL_STATUSES.has(currentStatus)) return false;
      if (!isPageVisible) return false;
      return 15000; // Adaptive 15s fallback only when SSE is offline and tab is active
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const activeData = liveData || initialData;
  const isTerminal = useMemo(() => {
    return Boolean(activeData?.status && TERMINAL_STATUSES.has(activeData.status));
  }, [activeData?.status]);

  // Stale detection timer (only for active non-terminal pickups)
  useEffect(() => {
    if (!lastUpdated || isTerminal) {
      setIsStale(false);
      return;
    }

    const interval = setInterval(() => {
      const elapsedSeconds = (Date.now() - lastUpdated.getTime()) / 1000;
      // Active pickups without updates for >35s are flagged as stale
      setIsStale(elapsedSeconds > 35);
    }, 10000);

    return () => clearInterval(interval);
  }, [lastUpdated, isTerminal]);

  // Sync initial query data into state
  useEffect(() => {
    if (initialData) {
      setLiveData(initialData);
      setLastUpdated(new Date());
      setIsStale(false);
    }
  }, [initialData]);

  // Server-Sent Events (SSE) connection: event-driven and visibility-aware
  useEffect(() => {
    // Optimization: Do NOT open persistent SSE streams for terminal pickups or when tab is hidden
    if (!pickupIdStr || isTerminal || !isPageVisible) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsLiveConnected(false);
      return;
    }

    const apiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '';
    const token =
      sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
      localStorage.getItem(TOKEN_STORAGE_KEY) ||
      sessionStorage.getItem('access_token') ||
      '';
    const sseUrl = `${apiUrl}/api/admin/pickups/${pickupIdStr}/live-stream${
      token ? `?token=${encodeURIComponent(token)}` : ''
    }`;

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsLiveConnected(true);
        setIsStale(false);
      };

      eventSource.addEventListener('pickup_update', (event: MessageEvent) => {
        try {
          const parsed: PickupMonitoringDetailResponse = JSON.parse(event.data);
          setLiveData(parsed);
          setLastUpdated(new Date());
          setIsStale(false);
          // Sync with TanStack cache
          queryClient.setQueryData(['adminPickupMonitoringDetail', pickupIdStr], parsed);
        } catch (err) {
          console.warn('Failed to parse SSE payload:', err);
        }
      });

      // Backend notifies stream_end when pickup reaches terminal lifecycle state
      eventSource.addEventListener('stream_end', () => {
        setIsLiveConnected(false);
        try {
          eventSource.close();
        } catch (_) {}
      });

      eventSource.onerror = () => {
        setIsLiveConnected(false);
        try {
          eventSource.close();
        } catch (_) {}
      };

      return () => {
        eventSource.close();
        eventSourceRef.current = null;
        setIsLiveConnected(false);
      };
    } catch {
      setIsLiveConnected(false);
    }
  }, [pickupIdStr, isTerminal, isPageVisible, queryClient]);

  const handleManualRefresh = useCallback(async () => {
    const res = await queryRefetch();
    if (res.data) {
      setLiveData(res.data);
      setLastUpdated(new Date());
      setIsStale(false);
    }
    return res;
  }, [queryRefetch]);

  const hasError = isError && !activeData;

  return {
    data: activeData,
    isLoading: isLoading && !activeData,
    isError: hasError,
    error: activeData ? null : (error as Error | null),
    isLiveConnected,
    lastUpdated,
    isStale,
    isTerminal,
    refetch: handleManualRefresh,
  };
}
