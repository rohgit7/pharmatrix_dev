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
import { RouteOptimizerMap, MapRoute, MapStop, MapDepot, ROUTE_COLORS } from '../components/map/RouteOptimizerMap';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDistance, formatDuration, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  Sparkles,
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
  XCircle,
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
    color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
    totalDistanceKm: r.distance_km,
    totalDurationMin: Math.round(r.duration_minutes),
    totalLoadKg: r.load_kg,
    stops: r.stop_locations.map((sl) => ({
      id: sl.pickup_id,
      sequenceNumber: sl.sequence_number,
      lat: sl.lat,
      lng: sl.lng,
      name: sl.location_name,
      weightKg: sl.estimated_weight_kg ?? undefined,
      routeIndex: idx,
    })),
  }));
}

export const RouteOptimization: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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
        color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
        totalDistanceKm: r.distance_km,
        totalDurationMin: Math.round(r.duration_minutes),
        totalLoadKg: r.load_kg,
        stops: r.stop_locations.map((sl) => ({
          id: sl.pickup_id,
          sequenceNumber: sl.sequence_number,
          lat: sl.lat,
          lng: sl.lng,
          name: sl.location_name,
          weightKg: sl.estimated_weight_kg ?? undefined,
          routeIndex: idx,
        })),
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

      setAlert({
        type: 'success',
        message: `Run ${data.optimization_run_code || 'created'}: Generated ${data.routes_created} draft route${data.routes_created !== 1 ? 's' : ''} covering ${data.pickups_assigned} pickups for ${data.planning_date}. Review and approve below before fleet assignment.`,
      });
      refetchRoutes();
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

  // Build existing routes for map
  const existingMapRoutes = useMemo((): MapRoute[] => {
    if (!existingRoutes || existingRoutes.length === 0) return [];
    return existingRoutes
      .filter((r) => r.status !== 'CANCELLED')
      .slice(0, 8)
      .map((r, idx) => {
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
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
          stops,
          totalDistanceKm: Number(r.planned_distance_km) || 0,
          totalDurationMin: Math.round((r.planned_duration_seconds || 0) / 60),
          totalLoadKg: stops.reduce((acc, s) => acc + (s.weightKg || 0), 0),
        };
      });
  }, [existingRoutes]);

  const activeMapRoutes = committedMapRoutes ?? existingMapRoutes;
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
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 -m-4 sm:-m-6">
      {/* 1. Header Banner */}
      <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Next-Day Route Optimization & Dispatch Planning
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-periwinkle-900 text-periwinkle-200 border border-periwinkle-700">
              Planning Date: {planningDate} (Asia/Kolkata)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Authoritative next-day operational solver. Pickups are clustered into forward-oriented routes ending at the depot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/pickups"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Work Queue</span>
          </Link>
        </div>
      </div>

      {/* Alert banner */}
      {alert && (
        <div
          className={`mx-6 mt-4 px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            alert.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
              : alert.type === 'error'
              ? 'bg-rose-950/80 border-rose-700 text-rose-200'
              : 'bg-blue-950/80 border-blue-700 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : alert.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-blue-400" />
            )}
            <span>{alert.message}</span>
          </div>
          <button
            onClick={() => setAlert(null)}
            className="text-slate-400 hover:text-white font-bold text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Main Two-Column Layout */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Fleet Constraints Form & Metrics */}
        <div className="lg:col-span-4 bg-white text-slate-900 rounded-xl p-6 shadow-md border border-slate-200 flex flex-col justify-between">
          <form onSubmit={handleOptimizeFleet} className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Optimization Controls
              </h2>
            </div>

            {/* Submitted Optimization Batch Indicator */}
            {currentBatch ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Batch: {currentBatch.batch_code}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-200 text-blue-800">
                    {currentBatch.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-blue-700">
                  {currentBatch.pickup_count} pickups submitted from Pickup Planning
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>No Active Optimization Batch</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700">
                  Optimization consumes only pickups explicitly submitted from Pickup Planning.
                </p>
                <Link
                  to="/pickups"
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 underline"
                >
                  Select pickups in Pickup Planning &rarr;
                </Link>
              </div>
            )}

            {/* Target Warehouse Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Depot warehouse hub
              </label>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.city})
                  </option>
                ))}
              </select>
            </div>

            {/* Next-Day Operational Planning Date (Enforced) */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Operational Planning Date (Tomorrow)
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  disabled
                  value={planningDate}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-100 border border-slate-300 rounded-lg text-slate-800 cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1 font-semibold">
                <Check className="w-3 h-3" />
                Locked strictly to next-day operational cycle ({readiness?.timezone || 'Asia/Kolkata'})
              </p>
            </div>

            {/* Rerun Checkbox */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRerun}
                  onChange={(e) => setIsRerun(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Allow Rerun & Supersede Drafts</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Check if you want to replace existing unapproved draft routes for tomorrow with this new calculation.
                  </p>
                </div>
              </label>
            </div>

            {/* Constraints Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Vehicles to dispatch
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={numVehicles}
                  onChange={(e) => setNumVehicles(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Capacity / vehicle (kg)
                </label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="10"
                  value={vehicleCapacityKg}
                  onChange={(e) => setVehicleCapacityKg(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Max route dist (km)
                </label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  step="5"
                  value={maxDistanceKm}
                  onChange={(e) => setMaxDistanceKm(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Max duration (min)
                </label>
                <input
                  type="number"
                  min="30"
                  max="1440"
                  step="30"
                  value={maxDurationMinutes}
                  onChange={(e) => setMaxDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Service time / stop (min)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={serviceTimeMinutes}
                  onChange={(e) => setServiceTimeMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Back allowance (km)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={localBackwardAllowanceKm}
                  onChange={(e) => setLocalBackwardAllowanceKm(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isOptimizing || !selectedWarehouseId || !currentBatch}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
              >
                {isOptimizing ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Running Optimization…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Optimize Tomorrow's Routes</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-500 mt-1.5 text-center">
                Generates unassigned draft routes for admin review and approval.
              </p>
            </div>
          </form>

          {/* Diagnostic Metrics */}
          {lastResponse && (
            <div className="mt-4 pt-3 border-t border-slate-150 space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>Optimization Run: {lastResponse.optimization_run_code}</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold uppercase">
                  Draft
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 block">Fleet Distance</span>
                  <span className="font-bold text-slate-900">
                    {lastResponse.total_fleet_distance_km ? `${lastResponse.total_fleet_distance_km.toFixed(1)} km` : '—'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 block">Max Duration</span>
                  <span className="font-bold text-slate-900">
                    {lastResponse.max_route_duration_minutes ? `${Math.round(lastResponse.max_route_duration_minutes)} min` : '—'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 block">Utilization</span>
                  <span className="font-bold text-slate-900">
                    {lastResponse.vehicle_utilization_pct !== undefined ? `${lastResponse.vehicle_utilization_pct.toFixed(0)}%` : '—'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-slate-500 block">Assigned Pickups</span>
                  <span className="font-bold text-emerald-700">
                    {lastResponse.pickups_assigned} stops
                  </span>
                </div>
              </div>
            </div>
          )}

          {routingSource && (
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
              {routingSource === 'OSRM' ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>
                Engine: <span className="font-semibold">{routingSource}</span>
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Leaflet Map */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="h-[600px] w-full bg-slate-950 rounded-xl overflow-hidden shadow-lg border border-slate-800">
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
              onSelectRoute={setSelectedRouteIdx}
              className="h-full"
            />
          </div>
        </div>
      </div>

      {/* 3. Linear Workflow: Review & Approve Section */}
      <div className="p-6 bg-slate-950 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Review, Approval & Safe Recovery
              </h3>
              {unapprovedRouteIds.length > 0 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-900 text-amber-200 border border-amber-700">
                  {unapprovedRouteIds.length} Route(s) Awaiting Approval
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict linear operational flow: All routes must be reviewed and explicitly approved before assigning drivers and vehicles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {unapprovedRouteIds.length > 0 && (
              <button
                onClick={() => bulkApproveMutation.mutate(unapprovedRouteIds)}
                disabled={bulkApproveMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve All Routes ({unapprovedRouteIds.length})</span>
              </button>
            )}

            <button
              onClick={() => navigate(`/fleet?tab=routes&date=${planningDate}`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Proceed to Fleet Assignment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Route Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {existingRoutes
            .filter((r) => r.status !== 'CANCELLED')
            .map((route, idx) => {
              const isSelected = selectedRouteIdx === idx;
              const isApproved = route.approved_at !== null && route.approved_at !== undefined;
              return (
                <div
                  key={route.id}
                  onClick={() => setSelectedRouteIdx(isSelected ? null : idx)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border-blue-500 shadow-md ring-1 ring-blue-500'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full inline-block"
                        style={{ backgroundColor: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                      />
                      <span className="font-bold text-sm text-white">{route.route_code}</span>
                    </div>
                    {isApproved ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Approved
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700">
                        Needs Approval
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Distance:</span>
                      <span className="font-semibold">{Number(route.planned_distance_km || 0).toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Duration:</span>
                      <span className="font-semibold">{Math.round((route.planned_duration_seconds || 0) / 60)} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Stops:</span>
                      <span className="font-semibold text-white">{route.stops?.length || 0} stops</span>
                    </div>
                  </div>

                  {/* Approve and Reject actions if not approved */}
                  {!isApproved && (
                    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approveRouteMutation.mutate(route.id);
                        }}
                        disabled={approveRouteMutation.isPending || rejectRouteMutation.isPending}
                        className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rejectRouteMutation.mutate({ routeId: route.id });
                        }}
                        disabled={approveRouteMutation.isPending || rejectRouteMutation.isPending}
                        className="py-1.5 px-3 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        title="Reject and cancel this route, releasing stops back to planning"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}

                  {/* Stop sequence with release recovery */}
                  {route.stops && route.stops.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        Stops &amp; Safe Release
                      </span>
                      <div className="mt-1.5 space-y-1.5">
                        {route.stops.slice(0, 4).map((st) => (
                          <div key={st.id} className="text-[11px] text-slate-400 flex items-center justify-between gap-1">
                            <span className="truncate">#{st.sequence_number} {st.pickup_id ? `Pickup #${st.pickup_id}` : (st.location_name || 'Depot')}</span>
                            {st.pickup_id && route.status === 'DRAFT' && !isApproved && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  releasePickupMutation.mutate({ routeId: route.id, pickupId: st.pickup_id! });
                                }}
                                className="text-[10px] text-rose-400 hover:text-rose-200 underline font-semibold"
                                title="Release pickup back to queue"
                              >
                                Release
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default RouteOptimization;
