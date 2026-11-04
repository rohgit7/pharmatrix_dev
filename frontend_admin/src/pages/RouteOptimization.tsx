import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { routesApi, warehousesApi, pickupsApi, fleetApi } from '../api/operations';
import {
  RouteResponse,
  RouteCreate,
  WarehouseResponse,
  OptimizeRoutesResponse,
  PlanningReadinessResponse,
} from '../types/operations';
import { RouteOptimizerMap, MapRoute, MapStop, MapDepot, ROUTE_COLORS, getRouteColor } from '../components/map/RouteOptimizerMap';
import { fetchMultiVehicleRoadRoutes } from '../services/routingService';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDistance, formatDuration, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  Route,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Truck,
  Layers,
  MapPin,
  Clock,
  ShieldAlert,
  RotateCcw,
  Plus,
  Wifi,
  WifiOff,
  Check,
  AlertTriangle,
  Info,
  CalendarCheck,
  Calendar,
  Filter,
  XCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
} from 'lucide-react';

const DEFAULT_DEPOT: MapDepot = {
  name: 'Warehouse (loading…)',
  lat: 12.9716,
  lng: 77.5946,
};

function optimizerResponseToMapRoutes(
  data: OptimizeRoutesResponse,
): MapRoute[] {
  return data.routes.map((r, idx) => ({
    vehicleIndex: idx,
    vehicleLabel: r.route_code,
    color: getRouteColor({ id: r.route_id, route_code: r.route_code, vehicleIndex: idx }),
    totalDistanceKm: r.distance_km,
    totalDurationMin: Math.round(r.duration_minutes),
    totalLoadKg: r.load_kg,
    roadGeometry:
      Array.isArray(r.polyline) && r.polyline.length > 2
        ? (r.polyline as [number, number][])
        : undefined,
    stops: r.stop_locations.map((sl) => ({
      id: sl.pickup_id,
      sequenceNumber: sl.sequence_number,
      lat: sl.lat,
      lng: sl.lng,
      name: sl.location_name,
      weightKg: sl.estimated_weight_kg ?? undefined,
      routeIndex: idx,
    })),
    routeId: r.route_id,
  }));
}

export const RouteOptimization: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mobile / Tablet Tab Switcher
  const [mobileTab, setMobileTab] = useState<'controls' | 'workspace'>('workspace');

  // Collapsible sections in Controls panel
  const [isConstraintsCollapsed, setIsConstraintsCollapsed] = useState<boolean>(false);

  // Authoritative Next-Day Planning Readiness
  const { data: readiness, isLoading: isReadinessLoading } = useQuery({
    queryKey: ['adminPlanningReadiness'],
    queryFn: routesApi.getReadiness,
    refetchInterval: 15000,
  });

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const planningDate = readiness?.planning_date || tomorrowStr;

  // Route execution date (strictly locked to tomorrow's planning date)
  const [routeDate, setRouteDate] = useState<string>(planningDate);
  const [isRerun, setIsRerun] = useState<boolean>(false);

  useEffect(() => {
    if (readiness?.planning_date) {
      setRouteDate(readiness.planning_date);
    }
  }, [readiness?.planning_date]);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number | null>(null);

  // Selected Batch & Date for Date-Specific Map Filtering
  const [selectedBatchId, setSelectedBatchId] = useState<number | string | null>(null);
  const [selectedPlanningDate, setSelectedPlanningDate] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [hasInitializedBatch, setHasInitializedBatch] = useState<boolean>(false);
  const [cardDateFilter, setCardDateFilter] = useState<string>('all');

  // Routes from optimizer response
  const [committedMapRoutes, setCommittedMapRoutes] = useState<MapRoute[] | null>(null);
  const [routingSource, setRoutingSource] = useState<string | null>(null);

  // Constraints
  const [numVehicles, setNumVehicles] = useState<number | ''>(4);
  const [vehicleCapacityKg, setVehicleCapacityKg] = useState<number | ''>(500);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number | ''>(120);
  const [maxDurationMinutes, setMaxDurationMinutes] = useState<number | ''>(360);
  const [serviceTimeMinutes, setServiceTimeMinutes] = useState<number | ''>(15);
  const [localBackwardAllowanceKm, setLocalBackwardAllowanceKm] = useState<number | ''>(2.0);

  // Selected pickups handed off from work queue or submitted batch
  const batchIdParam = searchParams.get('batch_id');
  const parsedBatchId = batchIdParam ? Number(batchIdParam) : undefined;
  const pickupIdsParam = searchParams.get('selected_pickup_ids') || searchParams.get('pickup_ids') || searchParams.get('pickups');
  const preselectedPickupIds = useMemo(() => {
    if (!pickupIdsParam) return undefined;
    return pickupIdsParam
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }, [pickupIdsParam]);

  // Last optimization response
  const [lastResponse, setLastResponse] = useState<OptimizeRoutesResponse | null>(null);

  // Queries
  const { data: warehouses = [] } = useQuery({
    queryKey: ['adminWarehouses'],
    queryFn: () => warehousesApi.list(),
  });

  const { data: currentBatch, refetch: refetchBatch } = useQuery({
    queryKey: ['adminOptimizationBatch', parsedBatchId, selectedWarehouseId, routeDate],
    queryFn: async () => {
      if (parsedBatchId) {
        return routesApi.getBatch(parsedBatchId);
      }
      return routesApi.getActiveBatch({
        warehouse_id: typeof selectedWarehouseId === 'number' ? selectedWarehouseId : undefined,
        planning_date: routeDate,
      });
    },
    enabled: !!(parsedBatchId || (typeof selectedWarehouseId === 'number' && selectedWarehouseId > 0)),
    refetchInterval: 15000,
  });

  // Restore routes from persisted batch on mount or browser refresh
  useEffect(() => {
    if (currentBatch && currentBatch.routes && currentBatch.routes.length > 0 && !lastResponse) {
      const mapRoutes: MapRoute[] = currentBatch.routes.map((r, idx) => ({
        vehicleIndex: idx,
        vehicleLabel: r.route_code,
        color: getRouteColor({ id: r.route_id, route_code: r.route_code, vehicleIndex: idx }),
        totalDistanceKm: r.distance_km,
        totalDurationMin: Math.round(r.duration_minutes),
        totalLoadKg: r.load_kg,
        roadGeometry:
          Array.isArray(r.polyline) && r.polyline.length > 2
            ? (r.polyline as [number, number][])
            : undefined,
        stops: r.stop_locations.map((sl) => ({
          id: sl.pickup_id,
          sequenceNumber: sl.sequence_number,
          lat: sl.lat,
          lng: sl.lng,
          name: sl.location_name,
          weightKg: sl.estimated_weight_kg ?? undefined,
          routeIndex: idx,
        })),
        routeId: r.route_id,
      }));
      setCommittedMapRoutes(mapRoutes);
      setRoutingSource('PERSISTED');
      setLastResponse({
        route_date: currentBatch.planning_date,
        warehouse_id: currentBatch.warehouse_id,
        vehicles_available: 4,
        routes_created: currentBatch.routes_created,
        pickups_assigned: currentBatch.pickup_count,
        routes: currentBatch.routes,
        routing_source: 'PERSISTED',
        optimization_run_id: currentBatch.batch_id,
        optimization_run_code: currentBatch.batch_code,
        planning_date: currentBatch.planning_date,
      });
    }
  }, [currentBatch, lastResponse]);

  const { data: activeAssignments = [] } = useQuery({
    queryKey: ['adminDriverVehicleAssignments'],
    queryFn: fleetApi.listActiveAssignments,
  });

  const { data: existingRoutes = [], refetch: refetchRoutes } = useQuery({
    queryKey: ['adminRoutes'],
    queryFn: () => routesApi.list(),
  });

  // Filter out cancelled routes
  const validExistingRoutes = useMemo(() => {
    return existingRoutes.filter((r) => r.status !== 'CANCELLED');
  }, [existingRoutes]);

  // Unique operational planning dates present in the route database
  const availablePlanningDates = useMemo(() => {
    const dates = new Set<string>();
    validExistingRoutes.forEach((r) => {
      if (r.route_date) {
        dates.add(r.route_date.split('T')[0]);
      }
    });
    return Array.from(dates).sort().reverse();
  }, [validExistingRoutes]);

  // Initialize batch selection on first load:
  // - If URL has parsedBatchId, pick that.
  // - Else if routes exist for planningDate, pick the latest batch for planningDate.
  // - Else (no routes for planningDate), leave selection empty so map shows clean empty state.
  useEffect(() => {
    if (hasInitializedBatch || existingRoutes.length === 0) return;

    if (parsedBatchId) {
      const match = validExistingRoutes.find((r) => r.optimization_run_id === parsedBatchId);
      if (match) {
        setSelectedBatchId(parsedBatchId);
        setSelectedPlanningDate(match.route_date ? match.route_date.split('T')[0] : planningDate);
        setHasInitializedBatch(true);
        return;
      }
    }

    // Check if any routes exist for the active planningDate
    const dateRoutes = validExistingRoutes.filter(
      (r) => r.route_date && r.route_date.startsWith(planningDate)
    );

    if (dateRoutes.length > 0) {
      // Find latest optimization batch for this date
      const latestBatchId = dateRoutes.reduce<number | null>(
        (max, r) => (r.optimization_run_id && (!max || r.optimization_run_id > max) ? r.optimization_run_id : max),
        null
      );
      if (latestBatchId !== null) {
        setSelectedBatchId(latestBatchId);
      } else {
        setSelectedBatchId(`date-${planningDate}`);
      }
      setSelectedPlanningDate(planningDate);
    } else {
      // Clean initial state: no routes for planningDate, show empty map state
      setSelectedBatchId(null);
      setSelectedPlanningDate(null);
      setCommittedMapRoutes(null);
    }

    setHasInitializedBatch(true);
  }, [hasInitializedBatch, existingRoutes, parsedBatchId, planningDate, validExistingRoutes]);

  // Default warehouse selection
  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length > 0) {
      const activeWh = warehouses.find((w) => w.active) || warehouses[0];
      setSelectedWarehouseId(activeWh.id);
    }
  }, [warehouses, selectedWarehouseId]);

  // Compute active depot from selected warehouse
  const activeDepot: MapDepot = useMemo(() => {
    if (lastResponse?.warehouse_coordinates && lastResponse.warehouse_coordinates.length >= 2) {
      return {
        name: 'Warehouse Depot',
        lat: lastResponse.warehouse_coordinates[0],
        lng: lastResponse.warehouse_coordinates[1],
      };
    }
    const wh = warehouses.find((w) => w.id === selectedWarehouseId);
    if (wh && wh.latitude && wh.longitude) {
      return {
        name: `${wh.name} (${wh.city})`,
        lat: Number(wh.latitude),
        lng: Number(wh.longitude),
        address: `${wh.address}, ${wh.city}, ${wh.state} ${wh.postal_code}`,
      };
    }
    return DEFAULT_DEPOT;
  }, [warehouses, selectedWarehouseId, lastResponse]);

  // Backend Optimization Mutation
  const optimizeBackendMutation = useMutation({
    mutationFn: (payload: Parameters<typeof routesApi.optimize>[0]) =>
      routesApi.optimize(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardSummary'] });

      const mapRoutes = optimizerResponseToMapRoutes(data);
      setCommittedMapRoutes(mapRoutes);
      setRoutingSource(data.routing_source);
      setLastResponse(data);
      setSelectedBatchId(data.optimization_run_id ?? null);
      setSelectedPlanningDate(data.planning_date ?? routeDate);
      setSelectedRouteId(null);
      setSelectedRouteIdx(null);

      setAlert({
        type: 'success',
        message: `Run ${data.optimization_run_code || 'created'}: Generated ${data.routes_created} draft route${data.routes_created !== 1 ? 's' : ''} covering ${data.pickups_assigned} pickups for ${data.planning_date}. Review and approve below before fleet assignment.`,
      });
      refetchRoutes();
      // On mobile/tablet, switch to map view automatically after optimization
      setMobileTab('workspace');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  // Route Approval & Rejection Mutations
  const approveRouteMutation = useMutation({
    mutationFn: (routeId: number) => routesApi.approve(routeId),
    onSuccess: (updatedRoute) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      queryClient.invalidateQueries({ queryKey: ['adminOptimizationBatch'] });
      setAlert({
        type: 'success',
        message: `Route ${updatedRoute.route_code} approved! You can now assign a driver and vehicle.`,
      });
      refetchRoutes();
      void refetchBatch();
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const rejectRouteMutation = useMutation({
    mutationFn: ({ routeId, reason }: { routeId: number; reason?: string }) =>
      routesApi.reject(routeId, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      queryClient.invalidateQueries({ queryKey: ['adminOptimizationBatch'] });
      setAlert({
        type: 'info',
        message: res.message || 'Route rejected. Pickups released back to planning queue.',
      });
      refetchRoutes();
      void refetchBatch();
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (routeIds: number[]) => routesApi.bulkApprove(routeIds),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      queryClient.invalidateQueries({ queryKey: ['adminOptimizationBatch'] });
      setAlert({
        type: 'success',
        message: `Approved ${res.approved_count} route${res.approved_count !== 1 ? 's' : ''}. Proceed to Drivers & Vehicles to assign fleet.`,
      });
      refetchRoutes();
      void refetchBatch();
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  // Safe Recovery: Release Pickup from Draft Route
  const releasePickupMutation = useMutation({
    mutationFn: ({ routeId, pickupId }: { routeId: number; pickupId: number }) =>
      routesApi.releasePickup(routeId, pickupId, 'Released by administrator from optimization draft'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsWorkQueue'] });
      queryClient.invalidateQueries({ queryKey: ['adminPlanningReadiness'] });
      setAlert({ type: 'success', message: res.message });
      refetchRoutes();
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  // Submit Handler
  const handleOptimizeFleet = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWarehouseId) {
      setAlert({ type: 'error', message: 'Please select a warehouse depot before running optimization.' });
      return;
    }

    if (!currentBatch && !parsedBatchId) {
      setAlert({
        type: 'error',
        message: 'No active optimization batch found. Pickups must be explicitly submitted from Pickup Planning before optimization.',
      });
      return;
    }

    // Strictly enforce next-day date
    if (planningDate && routeDate !== planningDate) {
      setAlert({
        type: 'error',
        message: `Operational planning is strictly next-day only (${planningDate}). Today or past dates cannot be optimized.`,
      });
      return;
    }

    const routeDateISO = new Date(planningDate + 'T00:00:00Z').toISOString();

    optimizeBackendMutation.mutate({
      warehouse_id: Number(selectedWarehouseId),
      route_date: routeDateISO,
      batch_id: currentBatch?.batch_id || parsedBatchId,
      num_vehicles: numVehicles ? Number(numVehicles) : undefined,
      vehicle_capacity_kg: vehicleCapacityKg ? Number(vehicleCapacityKg) : undefined,
      max_distance_km: maxDistanceKm ? Number(maxDistanceKm) : undefined,
      max_duration_minutes: maxDurationMinutes ? Number(maxDurationMinutes) : undefined,
      service_time_minutes: serviceTimeMinutes ? Number(serviceTimeMinutes) : undefined,
      local_backward_allowance_km: localBackwardAllowanceKm ? Number(localBackwardAllowanceKm) : undefined,
      auto_dispatch: false,
      rerun: isRerun,
    });
  };

  // Date-Specific Batch Filtering:
  // Strictly filter routes by the selected optimization batch ID and operational planning date.
  const routesForActiveBatch = useMemo((): RouteResponse[] => {
    // If no batch is selected, do not display any routes on the map (clean initial empty state)
    if (selectedBatchId === null && selectedPlanningDate === null) {
      return [];
    }

    return validExistingRoutes.filter((r) => {
      const rDate = r.route_date ? r.route_date.split('T')[0] : '';

      // Match operational planning date
      if (selectedPlanningDate && rDate !== selectedPlanningDate) {
        return false;
      }

      // Match optimization batch ID if numeric
      if (typeof selectedBatchId === 'number') {
        return r.optimization_run_id === selectedBatchId;
      }

      // Match synthetic date batch if string (e.g. 'date-2026-11-04')
      if (typeof selectedBatchId === 'string' && selectedBatchId.startsWith('date-')) {
        return rDate === selectedBatchId.replace('date-', '');
      }

      return true;
    });
  }, [validExistingRoutes, selectedBatchId, selectedPlanningDate]);

  // Convert selected batch routes into MapRoute objects with vehicle assignments
  const batchMapRoutes = useMemo((): MapRoute[] => {
    if (routesForActiveBatch.length === 0) return [];
    return routesForActiveBatch.map((r, idx) => {
      const stops: MapStop[] = (r.stops || [])
        .filter((st) => st.stop_type === 'PICKUP' && st.lat && st.lng)
        .map((st) => ({
          id: st.pickup_id ?? st.id,
          sequenceNumber: st.sequence_number,
          lat: Number(st.lat),
          lng: Number(st.lng),
          name: st.location_name || `Stop #${st.sequence_number}`,
          address: st.address || undefined,
          weightKg: st.estimated_weight_kg ? Number(st.estimated_weight_kg) : undefined,
          routeIndex: idx,
        }));

      return {
        vehicleIndex: idx,
        vehicleLabel: r.route_code,
        color: getRouteColor({ id: r.id, route_code: r.route_code, vehicleIndex: idx }),
        stops,
        totalDistanceKm: Number(r.planned_distance_km) || 0,
        totalDurationMin: Math.round((r.planned_duration_seconds || 0) / 60),
        totalLoadKg: stops.reduce((acc, s) => acc + (s.weightKg || 0), 0),
        roadGeometry:
          Array.isArray(r.polyline) && r.polyline.length > 2
            ? (r.polyline as [number, number][])
            : undefined,
        routeId: r.id,
      };
    });
  }, [routesForActiveBatch]);

  // Base map routes: in-memory optimization result if fresh, otherwise persisted batch routes
  const baseMapRoutes = committedMapRoutes ?? batchMapRoutes;

  // Reset road route geometries whenever the selected batch or planning date changes
  useEffect(() => {
    setRoadRoutesMap({});
  }, [selectedBatchId, selectedPlanningDate]);

  // Synchronize map vehicle highlight with selectedRouteId
  useEffect(() => {
    if (!selectedRouteId) {
      setSelectedRouteIdx(null);
      return;
    }
    const idx = baseMapRoutes.findIndex((r) => r.routeId === selectedRouteId);
    if (idx >= 0) {
      setSelectedRouteIdx(idx);
    }
  }, [selectedRouteId, baseMapRoutes]);

  // Handle clicking a route card: updates map to display only routes of that batch & date
  const handleSelectRouteCard = (route: RouteResponse) => {
    const rDate = route.route_date ? route.route_date.split('T')[0] : planningDate;
    const batchId = route.optimization_run_id ?? `date-${rDate}`;

    // If clicking the currently selected route card again, toggle vehicle focus but keep batch visible
    if (selectedRouteId === route.id) {
      setSelectedRouteId(null);
      setSelectedRouteIdx(null);
      return;
    }

    // Switch to this card's batch and date
    setCommittedMapRoutes(null);
    setSelectedBatchId(batchId);
    setSelectedPlanningDate(rDate);
    setSelectedRouteId(route.id);

    // If route has warehouse ID, align selected warehouse
    if (route.warehouse_id && route.warehouse_id !== selectedWarehouseId) {
      setSelectedWarehouseId(route.warehouse_id);
    }
  };

  // Road-network route geometries state
  const [roadRoutesMap, setRoadRoutesMap] = useState<
    Record<
      number,
      {
        roadGeometry: [number, number][];
        roadDistanceKm: number;
        roadDurationMin: number;
        error?: string;
      }
    >
  >({});
  const [isRoadRoutingLoading, setIsRoadRoutingLoading] = useState<boolean>(false);
  const [roadRoutingError, setRoadRoutingError] = useState<string | null>(null);

  // Function to resolve road routes
  const resolveRoadRoutes = React.useCallback(() => {
    if (!baseMapRoutes || baseMapRoutes.length === 0 || !activeDepot.lat || !activeDepot.lng) {
      return;
    }

    setIsRoadRoutingLoading(true);
    setRoadRoutingError(null);

    fetchMultiVehicleRoadRoutes(
      { lat: activeDepot.lat, lng: activeDepot.lng },
      baseMapRoutes.map((r) => ({
        vehicleIndex: r.vehicleIndex,
        vehicleLabel: r.vehicleLabel,
        stops: r.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      }))
    )
      .then((results) => {
        const updates: Record<number, any> = {};
        let errCount = 0;

        results.forEach((res) => {
          if (res.roadGeometry && res.roadGeometry.length > 1) {
            updates[res.vehicleIndex] = {
              roadGeometry: res.roadGeometry,
              roadDistanceKm: res.roadDistanceKm,
              roadDurationMin: res.roadDurationMin,
            };
          } else if (res.error) {
            errCount++;
            updates[res.vehicleIndex] = {
              roadGeometry: null,
              error: res.error,
            };
          }
        });

        setRoadRoutesMap((prev) => ({ ...prev, ...updates }));
        if (errCount > 0) {
          setRoadRoutingError(`${errCount} vehicle route(s) could not obtain road geometry.`);
        }
      })
      .catch((err) => {
        console.error('Road routing engine error:', err);
        setRoadRoutingError(err.message || 'Road routing service failed');
      })
      .finally(() => {
        setIsRoadRoutingLoading(false);
      });
  }, [baseMapRoutes, activeDepot]);

  // Trigger road routing when base routes or depot change
  useEffect(() => {
    if (!baseMapRoutes || baseMapRoutes.length === 0) {
      setRoadRoutesMap({});
      return;
    }

    // Check if any route needs road calculation (missing roadGeometry or <= 2 points)
    const needsFetch = baseMapRoutes.some(
      (r) =>
        r.stops.length > 0 &&
        (!r.roadGeometry || r.roadGeometry.length <= 2) &&
        (!roadRoutesMap[r.vehicleIndex]?.roadGeometry ||
          roadRoutesMap[r.vehicleIndex]?.roadGeometry.length <= 2)
    );

    if (needsFetch) {
      resolveRoadRoutes();
    }
  }, [baseMapRoutes, activeDepot, resolveRoadRoutes]);

  // Combine base routes with road-following geometry
  const activeMapRoutes = useMemo((): MapRoute[] => {
    return baseMapRoutes.map((r) => {
      const roadData = roadRoutesMap[r.vehicleIndex];
      if (roadData?.roadGeometry && roadData.roadGeometry.length > 1) {
        return {
          ...r,
          roadGeometry: roadData.roadGeometry,
          totalDistanceKm: roadData.roadDistanceKm ?? r.totalDistanceKm,
          totalDurationMin: roadData.roadDurationMin ?? r.totalDurationMin,
          roadRoutingError: undefined,
        };
      }
      return {
        ...r,
        roadGeometry: r.roadGeometry,
        roadRoutingError: roadData?.error,
      };
    });
  }, [baseMapRoutes, roadRoutesMap]);
  const isOptimizing = optimizeBackendMutation.isPending;

  // Filter tomorrow's draft routes that require approval
  const tomorrowDraftRoutes = useMemo(() => {
    return existingRoutes.filter(
      (r) =>
        r.status === 'DRAFT' &&
        (!r.approved_at || r.is_approved === false)
    );
  }, [existingRoutes]);

  const unapprovedRouteIds = useMemo(() => tomorrowDraftRoutes.map((r) => r.id), [tomorrowDraftRoutes]);

  return (
    <div className="flex flex-col h-full w-full bg-[#FDFBF8] text-[#201E1C] overflow-hidden">
      {/* 1. Compact Header Bar */}
      <div className="h-12 bg-white px-4 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#E5EBFF] flex items-center justify-center shrink-0">
            <Route className="w-4 h-4 text-[#7B91EE]" />
          </div>
          <div className="min-w-0 flex items-center gap-2">
            <h1 className="text-sm font-bold text-[#201E1C] tracking-tight truncate">
              Route Optimization
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#E5EBFF] text-[#201E1C] border border-[#7B91EE]/30">
              <Calendar className="w-3 h-3 text-[#7B91EE]" />
              <span>{planningDate}</span>
            </span>
          </div>

          {/* Mobile / Tablet View Switcher (< lg) */}
          <div className="flex lg:hidden ml-2 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setMobileTab('controls')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                mobileTab === 'controls'
                  ? 'bg-white text-[#201E1C] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Controls
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('workspace')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                mobileTab === 'workspace'
                  ? 'bg-white text-[#201E1C] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Map &amp; Review
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/pickups"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            title="Open Pickup Planning Queue"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Work Queue</span>
          </Link>
          <button
            type="button"
            onClick={() => navigate(`/fleet?tab=routes&date=${planningDate}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#201E1C] text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            title="Navigate to Fleet Assignment"
          >
            <Truck className="w-3.5 h-3.5 text-[#7B91EE]" />
            <span className="hidden sm:inline">Fleet Assignment</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {alert && (
        <div
          className={`mx-3 sm:mx-4 mt-2 px-3.5 py-2 rounded-lg border flex items-center justify-between text-xs font-semibold shrink-0 animate-fadeIn ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : alert.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : alert.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Route className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="truncate">{alert.message}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-slate-400 hover:text-slate-700 ml-2 p-0.5"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Main Two-Panel Workspace Layout (Viewport-Aware, Zero Whole-Page Scrolling) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden p-2.5 sm:p-3 gap-2.5 sm:gap-3">
        {/* Left Column: Optimization Controls Panel */}
        <div
          className={`w-full lg:w-[350px] xl:w-[380px] shrink-0 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm flex-col min-h-0 overflow-hidden ${
            mobileTab === 'controls' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Panel Top Header */}
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#7B91EE]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Optimization Controls
              </h2>
            </div>
            {currentBatch && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#E5EBFF] text-[#201E1C] border border-[#7B91EE]/30">
                {currentBatch.batch_code}
              </span>
            )}
          </div>

          {/* Independently Scrollable Controls Body */}
          <form onSubmit={handleOptimizeFleet} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin">
              {/* Batch State Card */}
              {currentBatch ? (
                <div className="p-2.5 bg-blue-50/80 border border-blue-200/90 rounded-lg text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950">Active Batch</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-blue-200 text-blue-900">
                      {currentBatch.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-blue-800">
                    <span className="font-bold">{currentBatch.pickup_count}</span> pickups queued from Pickup Planning.
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>No Active Batch</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700 leading-tight">
                    Submit pickups from Pickup Planning to enable optimization.
                  </p>
                  <Link
                    to="/pickups"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#7B91EE] hover:underline"
                  >
                    Select Pickups &rarr;
                  </Link>
                </div>
              )}

              {/* Depot Warehouse Hub */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Depot Warehouse Hub
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7B91EE] transition-all"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Next-Day Operational Planning Date (Locked) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Planning Date (Tomorrow)
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> Locked
                  </span>
                </div>
                <input
                  type="date"
                  required
                  disabled
                  value={planningDate}
                  className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-not-allowed"
                />
              </div>

              {/* Allow Rerun & Supersede Drafts Checkbox */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRerun}
                    onChange={(e) => setIsRerun(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#7B91EE] focus:ring-[#7B91EE]"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800">Allow Rerun &amp; Supersede</span>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      Replaces existing unapproved draft routes with this calculation.
                    </p>
                  </div>
                </label>
              </div>

              {/* Collapsible Constraints Header */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsConstraintsCollapsed(!isConstraintsCollapsed)}
                  className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 py-1"
                >
                  <span>Fleet &amp; Routing Constraints</span>
                  {isConstraintsCollapsed ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </button>

                {!isConstraintsCollapsed && (
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                        Vehicles
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={numVehicles}
                        onChange={(e) => setNumVehicles(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#7B91EE]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                        Capacity (kg)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="5000"
                        step="10"
                        value={vehicleCapacityKg}
                        onChange={(e) => setVehicleCapacityKg(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#7B91EE]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                        Max Dist (km)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        step="5"
                        value={maxDistanceKm}
                        onChange={(e) => setMaxDistanceKm(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#7B91EE]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                        Max Duration (min)
                      </label>
                      <input
                        type="number"
                        min="30"
                        max="1440"
                        step="30"
                        value={maxDurationMinutes}
                        onChange={(e) => setMaxDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#7B91EE]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                        Service Time (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={serviceTimeMinutes}
                        onChange={(e) => setServiceTimeMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#7B91EE]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                        Back Allowance (km)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.5"
                        value={localBackwardAllowanceKm}
                        onChange={(e) => setLocalBackwardAllowanceKm(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-2.5 py-1 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#7B91EE]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Diagnostic Metrics when lastResponse is available */}
              {lastResponse && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                    <span>Run: {lastResponse.optimization_run_code}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-bold">
                      DRAFT
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Fleet Dist</span>
                      <span className="font-bold text-slate-900">
                        {lastResponse.total_fleet_distance_km ? `${lastResponse.total_fleet_distance_km.toFixed(1)} km` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Max Duration</span>
                      <span className="font-bold text-slate-900">
                        {lastResponse.max_route_duration_minutes ? `${Math.round(lastResponse.max_route_duration_minutes)} min` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Utilization</span>
                      <span className="font-bold text-slate-900">
                        {lastResponse.vehicle_utilization_pct !== undefined ? `${lastResponse.vehicle_utilization_pct.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Assigned</span>
                      <span className="font-bold text-emerald-700">
                        {lastResponse.pickups_assigned} stops
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 space-y-1.5">
              <button
                type="submit"
                disabled={isOptimizing || !selectedWarehouseId || !currentBatch}
                className="w-full py-2.5 px-3 bg-[#7B91EE] hover:bg-[#687ee0] active:bg-[#576ecc] disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isOptimizing ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Optimization…</span>
                  </>
                ) : (
                  <>
                    <Route className="w-3.5 h-3.5" />
                    <span>Optimize Tomorrow's Routes</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
                <div className="flex items-center gap-1">
                  {activeMapRoutes.some((r) => r.roadGeometry && r.roadGeometry.length > 1) ? (
                    <Wifi className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-amber-500" />
                  )}
                  <span>
                    Engine: <span className="font-semibold">{activeMapRoutes.some((r) => r.roadGeometry && r.roadGeometry.length > 1) ? 'OSRM Road Network' : routingSource || 'OSRM'}</span>
                  </span>
                </div>
                {isRoadRoutingLoading && (
                  <span className="text-[#7B91EE] font-semibold animate-pulse text-[10px]">
                    Calculating roads…
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Primary Workspace (Map + Docked Route Review Strip) */}
        <div
          className={`flex-1 flex flex-col min-h-0 min-w-0 bg-slate-950 rounded-xl border border-slate-800 shadow-sm overflow-hidden ${
            mobileTab === 'workspace' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Upper Section: Interactive Road-Network Map */}
          <div className="flex-1 min-h-[300px] relative overflow-hidden">
            {roadRoutingError && (
              <div className="absolute top-2 left-2 right-2 z-20 bg-amber-950/90 border border-amber-800 text-amber-200 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between backdrop-blur-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{roadRoutingError}</span>
                </div>
                <button
                  type="button"
                  onClick={resolveRoadRoutes}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-2 py-0.5 rounded text-[11px] transition-colors shrink-0 ml-2"
                >
                  Retry Road Alignment
                </button>
              </div>
            )}

            <RouteOptimizerMap
              depot={activeDepot}
              routes={activeMapRoutes}
              totalStoresCovered={activeMapRoutes.reduce((acc, r) => acc + r.stops.length, 0)}
              maxRouteMinutes={
                activeMapRoutes.length > 0
                  ? Math.max(...activeMapRoutes.map((r) => r.totalDurationMin))
                  : 0
              }
              selectedRouteIndex={selectedRouteIdx}
              onSelectRoute={(idx) => {
                setSelectedRouteIdx(idx);
                if (idx !== null && baseMapRoutes[idx]?.routeId) {
                  setSelectedRouteId(baseMapRoutes[idx].routeId!);
                } else if (idx === null) {
                  setSelectedRouteId(null);
                }
              }}
              isRoadRoutingLoading={isRoadRoutingLoading}
              onRetryRoadRouting={resolveRoadRoutes}
              selectedBatchInfo={{
                batchId: selectedBatchId,
                planningDate: selectedPlanningDate,
              }}
              emptyMessage="Select an optimization batch to view its routes."
              className="w-full h-full"
            />
          </div>

          {/* Lower Section: Docked Route Review Strip (Direct Visual Correlation) */}
          <div className="h-60 sm:h-64 shrink-0 bg-slate-900 border-t border-slate-800 flex flex-col overflow-hidden">
            {/* Review Header Bar */}
            <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-white tracking-tight shrink-0">
                  Route Review
                </span>

                {/* Active Map Filter Indicator */}
                {selectedPlanningDate ? (
                  <div className="flex items-center gap-1.5 bg-[#7B91EE]/10 border border-[#7B91EE]/30 rounded-md px-2 py-0.5 text-[11px]">
                    <span className="font-extrabold text-[#7B91EE]">{selectedPlanningDate}</span>
                    {typeof selectedBatchId === 'number' && (
                      <span className="text-slate-300 font-mono text-[10px]">
                        · Batch #{selectedBatchId}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBatchId(null);
                        setSelectedPlanningDate(null);
                        setSelectedRouteId(null);
                        setSelectedRouteIdx(null);
                        setCommittedMapRoutes(null);
                      }}
                      className="ml-1 text-slate-400 hover:text-white"
                      title="Clear Map Selection"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400 truncate">
                    Click a card to filter map
                  </span>
                )}
              </div>

              {/* Date Filter Tabs & Approval Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Date Filter Pills */}
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCardDateFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                      cardDateFilter === 'all'
                        ? 'bg-[#7B91EE] text-white'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-800'
                    }`}
                  >
                    All ({validExistingRoutes.length})
                  </button>
                  {availablePlanningDates.slice(0, 3).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setCardDateFilter(d)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                        cardDateFilter === d
                          ? 'bg-[#7B91EE] text-white'
                          : 'text-slate-400 hover:text-slate-200 bg-slate-800'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {/* Bulk Approve Action */}
                {unapprovedRouteIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => bulkApproveMutation.mutate(unapprovedRouteIds)}
                    disabled={bulkApproveMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-md shadow-xs transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Approve All ({unapprovedRouteIds.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Horizontal Scrollable Route Cards Strip */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden p-2.5 flex items-stretch gap-2.5 scrollbar-thin">
              {validExistingRoutes
                .filter((r) => {
                  if (cardDateFilter === 'all') return true;
                  const rDate = r.route_date ? r.route_date.split('T')[0] : '';
                  return rDate === cardDateFilter;
                })
                .map((route) => {
                  const routeDateStr = route.route_date ? route.route_date.split('T')[0] : planningDate;
                  const isSelectedVehicle = selectedRouteId === route.id;
                  const isBatchActive =
                    (typeof selectedBatchId === 'number' && route.optimization_run_id === selectedBatchId) ||
                    (typeof selectedBatchId === 'string' && selectedBatchId === `date-${routeDateStr}`) ||
                    (selectedPlanningDate === routeDateStr && selectedBatchId === null);
                  const isApproved = route.approved_at !== null && route.approved_at !== undefined;
                  const routeColor = getRouteColor(route);

                  return (
                    <div
                      key={route.id}
                      onClick={() => handleSelectRouteCard(route)}
                      className={`w-[260px] sm:w-[280px] shrink-0 h-full rounded-lg border p-2.5 flex flex-col justify-between transition-all cursor-pointer relative select-none ${
                        isSelectedVehicle
                          ? 'bg-slate-850 shadow-md'
                          : isBatchActive
                          ? 'bg-slate-900/90 shadow-xs'
                          : 'bg-slate-950/80 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                      style={{
                        borderColor: isSelectedVehicle ? routeColor : isBatchActive ? `${routeColor}90` : undefined,
                        boxShadow: isSelectedVehicle ? `0 0 0 2px ${routeColor}80` : undefined,
                      }}
                    >
                      {/* Top: Route Code & Approval Status */}
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full inline-block shrink-0 shadow-xs"
                              style={{ backgroundColor: routeColor }}
                            />
                            <span className="font-bold text-xs text-white truncate">{route.route_code}</span>
                          </div>
                          {isApproved ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-0.5">
                              <Check className="w-2.5 h-2.5" /> Approved
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                              Needs Approval
                            </span>
                          )}
                        </div>

                        {/* Date & Batch Meta */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#7B91EE]" />
                            <span>{routeDateStr}</span>
                          </span>
                          {route.optimization_run_id ? (
                            <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-1 py-0.2 rounded border border-slate-700">
                              Batch #{route.optimization_run_id}
                            </span>
                          ) : null}
                        </div>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-3 gap-1 mt-1.5 py-1 px-1.5 bg-slate-950/60 rounded border border-slate-800/80 text-[10px] text-slate-300">
                          <div>
                            <span className="text-slate-500 block text-[9px]">DIST</span>
                            <span className="font-semibold">{Number(route.planned_distance_km || 0).toFixed(1)} km</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">DUR</span>
                            <span className="font-semibold">{Math.round((route.planned_duration_seconds || 0) / 60)} min</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px]">STOPS</span>
                            <span className="font-semibold text-white">{route.stops?.length || 0}</span>
                          </div>
                        </div>

                        {/* Stops Preview & Safe Release */}
                        {route.stops && route.stops.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {route.stops.slice(0, 2).map((st) => (
                              <div key={st.id} className="text-[10px] text-slate-400 flex items-center justify-between gap-1">
                                <span className="truncate">#{st.sequence_number} {st.pickup_id ? `Pickup #${st.pickup_id}` : (st.location_name || 'Depot')}</span>
                                {st.pickup_id && route.status === 'DRAFT' && !isApproved && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      releasePickupMutation.mutate({ routeId: route.id, pickupId: st.pickup_id! });
                                    }}
                                    className="text-[9px] text-rose-400 hover:text-rose-200 underline font-semibold shrink-0"
                                    title="Release stop back to planning queue"
                                  >
                                    Release
                                  </button>
                                )}
                              </div>
                            ))}
                            {route.stops.length > 2 && (
                              <div className="text-[9px] text-slate-500 italic">
                                +{route.stops.length - 2} more stop(s)
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom Actions: Approve / Reject buttons */}
                      <div className="mt-1 pt-1.5 border-t border-slate-800/80 flex items-center gap-1.5">
                        {!isApproved ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                approveRouteMutation.mutate(route.id);
                              }}
                              disabled={approveRouteMutation.isPending || rejectRouteMutation.isPending}
                              className="flex-1 py-1 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                rejectRouteMutation.mutate({ routeId: route.id });
                              }}
                              disabled={approveRouteMutation.isPending || rejectRouteMutation.isPending}
                              className="py-1 px-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-[11px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              title="Reject route and release pickups"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : (
                          <div className="w-full text-center text-[10px] text-emerald-400/90 font-medium py-0.5">
                            Approved &amp; Ready for Fleet
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteOptimization;