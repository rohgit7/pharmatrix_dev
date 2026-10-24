import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClient } from '@/services/api';
import { DriverRouteResponse } from '@/types/api';

export const DRIVER_ROUTE_QUERY_KEY = ['driverRoute', 'today'];

export function useTodayRoute(enabled = true) {
  return useQuery<DriverRouteResponse, Error>({
    queryKey: DRIVER_ROUTE_QUERY_KEY,
    queryFn: async () => {
      return await ApiClient.getTodayRoute();
    },
    enabled,
    staleTime: 1000 * 30, // 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry if 404 (no route assigned today)
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });
}

export function useStartRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ routeId }: { routeId: number }) => {
      return await ApiClient.startRoute(routeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_ROUTE_QUERY_KEY });
    },
  });
}

export function useArriveStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routeId,
      stopId,
    }: {
      routeId: number;
      stopId: number;
    }) => {
      return await ApiClient.arriveAtStop(routeId, stopId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_ROUTE_QUERY_KEY });
    },
  });
}

export function useScanQr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routeId,
      stopId,
      qrToken,
    }: {
      routeId: number;
      stopId: number;
      qrToken: string;
    }) => {
      return await ApiClient.scanPickupQr(routeId, stopId, qrToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_ROUTE_QUERY_KEY });
    },
  });
}

export function useVerifyOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routeId,
      stopId,
      otp,
    }: {
      routeId: number;
      stopId: number;
      otp: string;
    }) => {
      return await ApiClient.verifyPickupOtp(routeId, stopId, otp);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_ROUTE_QUERY_KEY });
    },
  });
}

export function useUploadProof() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routeId,
      stopId,
      fileUri,
      fileName,
      mimeType,
    }: {
      routeId: number;
      stopId: number;
      fileUri: string;
      fileName?: string;
      mimeType?: string;
    }) => {
      return await ApiClient.uploadCollectionProof(
        routeId,
        stopId,
        fileUri,
        fileName,
        mimeType
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_ROUTE_QUERY_KEY });
    },
  });
}

export function useCompleteStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routeId,
      stopId,
      collectedWeightKg,
      notes,
    }: {
      routeId: number;
      stopId: number;
      collectedWeightKg?: number;
      notes?: string | null;
    }) => {
      return await ApiClient.completeStop(
        routeId,
        stopId,
        collectedWeightKg,
        notes
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_ROUTE_QUERY_KEY });
    },
  });
}

export function useFailStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      routeId,
      stopId,
      reason,
    }: {
      routeId: number;
      stopId: number;
      reason: string;
    }) => {
      return await ApiClient.failStop(routeId, stopId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVER_ROUTE_QUERY_KEY });
    },
  });
}
