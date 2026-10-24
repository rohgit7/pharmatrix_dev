import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { routesApi, fleetApi, exceptionsApi } from '../api/operations';
import { RouteResponse, RouteStatus, RouteStopResponse, RouteReassignRequest } from '../types/operations';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { DataTable, Column } from '../components/common/DataTable';
import { formatDate, formatDateTime, formatDistance, formatDuration, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { ErrorState } from '../components/common/ErrorState';
import { LoadingSkeleton } from '../components/common/LoadingSkeleton';
import {
  Navigation,
  CheckCircle2,
  AlertCircle,
  Truck,
  Eye,
  Radio,
  Clock,
  ShieldCheck,
  AlertOctagon,
  Image as ImageIcon,
  ArrowRight,
  ExternalLink,
  Send,
  Warehouse,
  RotateCcw,
  History,
  Calendar,
  Filter,
} from 'lucide-react';

export const DispatchMonitoring: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [selectedRoute, setSelectedRoute] = useState<RouteResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'READY' | 'ASSIGNED' | 'IN_PROGRESS'>('ALL');

  // History filters
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [historyStatus, setHistoryStatus] = useState<string>('ALL');

  // Proof inspection modal
  const [proofStop, setProofStop] = useState<RouteStopResponse | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [isProofLoading, setIsProofLoading] = useState<boolean>(false);
  const [proofError, setProofError] = useState<string | null>(null);

  // Dispatch confirmation
  const [routeToDispatch, setRouteToDispatch] = useState<RouteResponse | null>(null);

  // Safe Recovery / Reassign Modal
  const [routeToReassign, setRouteToReassign] = useState<RouteResponse | null>(null);
  const [reassignDriverId, setReassignDriverId] = useState<number | ''>('');
  const [reassignVehicleId, setReassignVehicleId] = useState<number | ''>('');
  const [reassignReason, setReassignReason] = useState<string>('');

  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Queries: Active Operations only (completed routes disappear from current operations)
  const { data: routes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['adminRoutesDispatch', 'active'],
    queryFn: () => routesApi.list({ active_only: true }),
    refetchInterval: 15000, // Live poll every 15s for execution progress
  });

  // Queries: Route Execution History
  const { data: historyRoutes = [], isLoading: isHistoryLoading, error: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['adminRoutesHistory', historyStartDate, historyEndDate, historyStatus],
    queryFn: () =>
      routesApi.getHistory({
        start_date: historyStartDate || undefined,
        end_date: historyEndDate || undefined,
        status: historyStatus !== 'ALL' ? historyStatus : undefined,
      }),
    enabled: activeTab === 'HISTORY',
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['adminDrivers'],
    queryFn: () => fleetApi.listDrivers(0, 100),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['adminVehicles'],
    queryFn: () => fleetApi.listVehicles(0, 100),
  });

  const { data: exceptions = [] } = useQuery({
    queryKey: ['adminExceptions'],
    queryFn: () => exceptionsApi.list({ status: 'OPEN' }),
  });

  // Drivers & Vehicles map
  const driverMap = new Map(drivers.map((d) => [d.id, d]));
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

  // Filter routes for active monitoring
  const filteredRoutes = routes.filter((r) => {
    if (filterStatus === 'ALL') {
      return ['ASSIGNED', 'IN_PROGRESS', 'READY'].includes(r.status);
    }
    return r.status === filterStatus;
  });

  const readyCount = routes.filter((r) => r.status === 'READY').length;
  const assignedCount = routes.filter((r) => r.status === 'ASSIGNED').length;
  const inProgressCount = routes.filter((r) => r.status === 'IN_PROGRESS').length;

  const readyForDispatchRoutes = routes.filter(
    (r) => r.status === 'READY' || (r.status === 'ASSIGNED' && r.driver_id && r.vehicle_id)
  );

  const dispatchMutation = useMutation({
    mutationFn: (routeId: number) => routesApi.dispatch(routeId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['adminRoutesDispatch'] });
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Route ${data.route_code} dispatched successfully. Driver notified and route is now active for execution.`,
      });
      setRouteToDispatch(null);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const reassignMutation = useMutation({
    mutationFn: ({ routeId, payload }: { routeId: number; payload: RouteReassignRequest }) =>
      routesApi.reassign(routeId, payload),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['adminRoutesDispatch'] });
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Route ${data.route_code} reassigned to Driver #${data.driver_id} & Vehicle #${data.vehicle_id}.`,
      });
      setRouteToReassign(null);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const bulkDispatchMutation = useMutation({
    mutationFn: (routeIds: number[]) => routesApi.bulkDispatch(routeIds),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['adminRoutesDispatch'] });
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Bulk dispatch completed: ${data.dispatched_count} dispatched, ${data.failed_count} failed.`,
      });
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const handleInspectProof = async (stop: RouteStopResponse) => {
    setProofStop(stop);
    setIsProofLoading(true);
    setProofUrl(null);
    setProofError(null);

    try {
      const res = await routesApi.getProofUrl(stop.id);
      setProofUrl(res.signed_url);
    } catch (err) {
      setProofError(getErrorMessage(err));
    } finally {
      setIsProofLoading(false);
    }
  };

  const handleConfirmDispatch = () => {
    if (!routeToDispatch) return;
    dispatchMutation.mutate(routeToDispatch.id);
  };

  const historyColumns: Column<RouteResponse>[] = [
    {
      key: 'route_code',
      header: 'Route Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-charcoal-900">{r.route_code}</span>,
    },
    {
      key: 'route_date',
      header: 'Execution Date',
      sortable: true,
      render: (r) => <span className="text-xs">{formatDate(r.route_date)}</span>,
    },
    {
      key: 'warehouse_id',
      header: 'Hub',
      render: (r) => <span className="font-mono text-xs">Hub #{r.warehouse_id}</span>,
    },
    {
      key: 'driver_id',
      header: 'Assigned Driver',
      render: (r) => {
        const d = r.driver_id ? driverMap.get(r.driver_id) : undefined;
        return (
          <span className="text-xs font-medium text-charcoal-900">
            {d ? `Employee ${d.employee_id}` : r.driver_id ? `Driver #${r.driver_id}` : '—'}
          </span>
        );
      },
    },
    {
      key: 'vehicle_id',
      header: 'Vehicle',
      render: (r) => {
        const v = r.vehicle_id ? vehicleMap.get(r.vehicle_id) : undefined;
        return (
          <span className="text-xs font-mono text-charcoal-900">
            {v ? `${v.registration_number} (${v.vehicle_type})` : r.vehicle_id ? `Vehicle #${r.vehicle_id}` : '—'}
          </span>
        );
      },
    },
    {
      key: 'stops',
      header: 'Stops',
      render: (r) => (
        <span className="text-xs font-semibold text-charcoal-800">
          {r.stops?.length || 0} stops
        </span>
      ),
    },
    {
      key: 'planned_distance_km',
      header: 'Est. Distance & Duration',
      render: (r) => (
        <span className="text-xs text-charcoal-600">
          {formatDistance(r.planned_distance_km)} · {formatDuration(r.planned_duration_seconds)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Final Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (r) => (
        <button
          onClick={() => setSelectedRoute(r)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-ivory-100 text-charcoal-800 hover:bg-ivory-200 transition-colors border border-ivory-300"
        >
          <Eye className="w-3.5 h-3.5 text-charcoal-500" />
          <span>Stops Feed</span>
        </button>
      ),
    },
  ];


  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {alert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{alert.message}</span>
          </div>
          <button onClick={() => setAlert(null)} className="font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-charcoal-900 tracking-tight">
              Dispatch & Live Monitoring
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 animate-pulse">
              <Radio className="w-3 h-3 text-emerald-600" /> Live Feed
            </span>
          </div>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Monitor route execution, driver progress, OTP/QR pickup verifications, and warehouse handovers in real time.
          </p>
        </div>

        {/* Telemetry note banner */}
        <div className="text-[11px] bg-ivory-100 border border-ivory-300 text-charcoal-600 px-3 py-1.5 rounded-lg max-w-sm">
          <span className="font-semibold text-charcoal-800">Telemetry notice:</span> Live progress is driven by driver checkpoint confirmations and collection proofs; GPS tracking is not currently exposed by backend.
        </div>
      </div>

      {/* View Mode Switcher: Active Operations vs History */}
      <div className="flex items-center gap-3 border-b border-ivory-300 pb-1">
        <button
          onClick={() => setActiveTab('ACTIVE')}
          className={`pb-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'ACTIVE'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <Radio className="w-4 h-4 text-emerald-600" />
          <span>Active Operations ({routes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`pb-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'HISTORY'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <History className="w-4 h-4 text-charcoal-600" />
          <span>Historical Dispatches & Routes</span>
        </button>
      </div>

      {activeTab === 'ACTIVE' ? (
        <>
          {/* KPI Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-ivory-300 shadow-subtle flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Ready for Dispatch</span>
                <div className="text-2xl font-bold text-amber-600 mt-1">{readyCount + assignedCount}</div>
              </div>
              <Clock className="w-8 h-8 text-amber-400 opacity-60" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-ivory-300 shadow-subtle flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">In Progress</span>
                <div className="text-2xl font-bold text-blue-600 mt-1">{inProgressCount}</div>
              </div>
              <Navigation className="w-8 h-8 text-blue-400 opacity-60" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-ivory-300 shadow-subtle flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Total Active Routes</span>
                <div className="text-2xl font-bold text-emerald-600 mt-1">{routes.length}</div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-60" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-ivory-300 shadow-subtle flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-charcoal-500 uppercase tracking-wider">Open Exceptions</span>
                <div className="text-2xl font-bold text-rose-600 mt-1">{exceptions.length}</div>
              </div>
              <AlertOctagon className="w-8 h-8 text-rose-400 opacity-60" />
            </div>
          </div>

          {/* Filter Tabs & Bulk Dispatch Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ivory-300 pb-2">
            <div className="flex items-center gap-2">
              {(['ALL', 'READY', 'ASSIGNED', 'IN_PROGRESS'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    filterStatus === st
                      ? 'bg-charcoal-900 text-white'
                      : 'bg-white text-charcoal-600 hover:bg-ivory-100 border border-ivory-300'
                  }`}
                >
                  {st === 'ALL' ? 'All Active Routes' : st === 'READY' ? 'Ready to Dispatch' : st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {readyForDispatchRoutes.length > 0 && (
              <button
                onClick={() => bulkDispatchMutation.mutate(readyForDispatchRoutes.map((r) => r.id))}
                disabled={bulkDispatchMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{bulkDispatchMutation.isPending ? 'Dispatching...' : `Bulk Dispatch Ready Routes (${readyForDispatchRoutes.length})`}</span>
              </button>
            )}
          </div>


      {/* Route Cards */}
      {error ? (
        <ErrorState
          title="Unable to load routes"
          message={error instanceof Error ? error.message : 'An unexpected error occurred.'}
          onRetry={() => { void refetch(); }}
        />
      ) : isLoading ? (
        <LoadingSkeleton type="card" count={3} />
      ) : filteredRoutes.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-ivory-300 text-charcoal-500 text-xs">
          No routes match the selected monitoring status.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRoutes.map((route) => {
            const driver = route.driver_id ? driverMap.get(route.driver_id) : undefined;
            const vehicle = route.vehicle_id ? vehicleMap.get(route.vehicle_id) : undefined;
            const stops = route.stops || [];
            const pickupStops = stops.filter((s) => s.stop_type === 'PICKUP');
            const warehouseStop = stops.find((s) => s.stop_type === 'WAREHOUSE');

            return (
              <div
                key={route.id}
                className="bg-white rounded-xl border border-ivory-300 shadow-subtle p-5 flex flex-col justify-between hover:border-ivory-400 transition-all"
              >
                <div>
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-charcoal-900">
                          {route.route_code}
                        </span>
                        <StatusBadge status={route.status} size="sm" />
                      </div>
                      <div className="text-xs text-charcoal-500 mt-1">
                        Execution Date: {formatDate(route.route_date)} · Hub #{route.warehouse_id}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedRoute(route)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-ivory-100 text-charcoal-800 hover:bg-ivory-200 transition-colors border border-ivory-300"
                    >
                      <Eye className="w-3.5 h-3.5 text-charcoal-500" />
                      <span>Stops Feed</span>
                    </button>
                  </div>

                  {/* Driver & Vehicle Details */}
                  <div className="grid grid-cols-2 gap-3 mt-4 p-3 bg-ivory-50 rounded-lg text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-charcoal-400 tracking-wider">
                        Assigned Driver
                      </span>
                      <div className="font-semibold text-charcoal-900 mt-0.5">
                        {driver ? `Employee ${driver.employee_id}` : route.driver_id ? `Driver #${route.driver_id}` : 'Unassigned'}
                      </div>
                      {driver?.phone && (
                        <div className="text-[11px] text-charcoal-500">{driver.phone}</div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-charcoal-400 tracking-wider">
                        Assigned Vehicle
                      </span>
                      <div className="font-semibold text-charcoal-900 mt-0.5">
                        {vehicle ? `${vehicle.registration_number} (${vehicle.vehicle_type})` : route.vehicle_id ? `Vehicle #${route.vehicle_id}` : 'Unassigned'}
                      </div>
                      {vehicle?.capacity_kg && (
                        <div className="text-[11px] text-emerald-700 font-medium">
                          Capacity: {formatWeight(vehicle.capacity_kg)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center justify-between text-xs text-charcoal-600 mt-3 px-1">
                    <span>Est. Distance: {formatDistance(route.planned_distance_km)}</span>
                    <span>Est. Duration: {formatDuration(route.planned_duration_seconds)}</span>
                    <span>Total Stops: {stops.length}</span>
                  </div>

                  {/* Stops Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-medium text-charcoal-600 mb-1">
                      <span>Pickup Stops ({pickupStops.length})</span>
                      <span className="text-emerald-700 font-semibold">
                        {warehouseStop ? 'Warehouse Stop Included' : ''}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {stops.map((stop, sIdx) => {
                        const isWarehouse = stop.stop_type === 'WAREHOUSE';
                        return (
                          <div
                            key={stop.id || sIdx}
                            title={`Stop ${stop.sequence_number}: ${isWarehouse ? 'Warehouse Hub' : `Pickup #${stop.pickup_id}`}`}
                            className={`h-2 flex-1 rounded-sm ${
                              isWarehouse
                                ? 'bg-charcoal-800'
                                : 'bg-emerald-500'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="mt-5 pt-3 border-t border-ivory-200 flex items-center justify-between">
                  {route.status === 'READY' || route.status === 'ASSIGNED' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRouteToDispatch(route)}
                        disabled={dispatchMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{dispatchMutation.isPending && routeToDispatch?.id === route.id ? 'Dispatching...' : 'Dispatch Route'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setRouteToReassign(route);
                          setReassignDriverId(route.driver_id || '');
                          setReassignVehicleId(route.vehicle_id || '');
                          setReassignReason('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-ivory-100 hover:bg-ivory-200 text-charcoal-700 rounded-lg text-xs font-semibold transition-colors border border-ivory-300"
                        title="Reassign driver or vehicle before dispatch"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-charcoal-500" />
                        <span>Reassign</span>
                      </button>
                    </div>
                  ) : route.status === 'IN_PROGRESS' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      <span>In Route Execution</span>
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-charcoal-500">
                      Route Completed
                    </span>
                  )}

                  <Link
                    to={`/warehouses?route=${route.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-charcoal-700 hover:text-charcoal-950"
                  >
                    <Warehouse className="w-3.5 h-3.5 text-charcoal-500" />
                    <span>Intake Handover</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  ) : (
    /* Historical Dispatches View */
    <div className="space-y-4">
      <div className="p-4 bg-white rounded-xl border border-ivory-300 shadow-subtle flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-charcoal-500" />
            <span className="font-semibold text-charcoal-700">Date Range:</span>
            <input
              type="date"
              value={historyStartDate}
              onChange={(e) => setHistoryStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
            <span className="text-charcoal-400">to</span>
            <input
              type="date"
              value={historyEndDate}
              onChange={(e) => setHistoryEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-charcoal-500" />
            <span className="font-semibold text-charcoal-700">Status:</span>
            <select
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="ALL">All Completed & Cancelled</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            setHistoryStartDate('');
            setHistoryEndDate('');
            setHistoryStatus('ALL');
          }}
          className="text-xs font-semibold text-charcoal-600 hover:text-charcoal-900 underline"
        >
          Reset Filters
        </button>
      </div>

      {historyError ? (
        <ErrorState
          title="Unable to load route history"
          message={getErrorMessage(historyError)}
          onRetry={() => { void refetchHistory(); }}
        />
      ) : (
        <DataTable
          columns={historyColumns}
          data={historyRoutes}
          isLoading={isHistoryLoading}
          searchPlaceholder="Search historical routes by code..."
          searchFilter={(row, q) => row.route_code.toLowerCase().includes(q)}
          emptyTitle="No historical routes found"
          emptyDescription="Completed or archived routes for the selected date range will appear here."
        />
      )}
    </div>
  )}

      {/* Stop Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedRoute}
        onClose={() => setSelectedRoute(null)}
        title={selectedRoute?.route_code || 'Route Execution Feed'}
        subtitle={`Warehouse ID #${selectedRoute?.warehouse_id} · ${selectedRoute?.stops?.length || 0} stops`}
        width="xl"
      >
        {selectedRoute && (
          <div className="space-y-6 text-sm">
            <div className="p-4 bg-ivory-100 rounded-xl border border-ivory-300 flex items-center justify-between">
              <div>
                <span className="text-xs text-charcoal-500 font-medium">Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedRoute.status} size="md" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-charcoal-500 font-medium">Est. Distance & Duration</span>
                <div className="mt-1 text-xs font-bold text-charcoal-900">
                  {formatDistance(selectedRoute.planned_distance_km)} · {formatDuration(selectedRoute.planned_duration_seconds)}
                </div>
              </div>
            </div>

            {/* Sequence of stops */}
            <div>
              <h4 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider mb-3">
                Ordered Checkpoint Timeline
              </h4>
              <div className="relative pl-6 border-l-2 border-ivory-300 space-y-4">
                {selectedRoute.stops
                  ?.sort((a, b) => a.sequence_number - b.sequence_number)
                  .map((stop) => {
                    const isWh = stop.stop_type === 'WAREHOUSE';
                    return (
                      <div key={stop.id} className="relative">
                        <div
                          className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${
                            isWh ? 'bg-charcoal-900 text-white' : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {stop.sequence_number}
                        </div>

                        <div className="p-3 bg-white rounded-lg border border-ivory-300 shadow-subtle">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-charcoal-900 text-xs">
                              {isWh ? `Warehouse Depot Intake #${stop.warehouse_id}` : `Consignment Pickup #${stop.pickup_id}`}
                            </span>
                            <StatusBadge status={stop.stop_type} size="sm" />
                          </div>

                          <div className="mt-2 text-xs text-charcoal-500 flex flex-wrap gap-4">
                            <span>Arrival: {formatDate(stop.arrival_time)}</span>
                            <span>Departure: {formatDate(stop.departure_time)}</span>
                          </div>

                          {!isWh && (
                            <div className="mt-2 pt-2 border-t border-ivory-200 flex items-center justify-between">
                              <button
                                onClick={() => handleInspectProof(stop)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-periwinkle-800 hover:underline"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>Inspect Collection Proof</span>
                              </button>

                              <Link
                                to={`/exceptions?search=${stop.id}`}
                                className="text-[11px] text-charcoal-500 hover:text-rose-700"
                              >
                                Report Exception
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Proof Inspection Modal */}
      <Modal
        isOpen={!!proofStop}
        onClose={() => setProofStop(null)}
        title="Collection Proof Inspection"
        subtitle={`Stop #${proofStop?.id} — Consignment Pickup #${proofStop?.pickup_id}`}
      >
        <div className="space-y-4 text-xs">
          {isProofLoading ? (
            <div className="p-8 text-center text-charcoal-500">Loading verified photo proof...</div>
          ) : proofError ? (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{proofError}</span>
            </div>
          ) : proofUrl ? (
            <div className="space-y-3">
              <div className="rounded-lg overflow-hidden border border-ivory-300 bg-black flex items-center justify-center max-h-80">
                <img
                  src={proofUrl}
                  alt="Proof of collection"
                  className="max-h-80 w-auto object-contain"
                />
              </div>
              <div className="flex items-center justify-between text-charcoal-600">
                <span>Signed secure URL valid for 60 minutes</span>
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-periwinkle-700 hover:underline inline-flex items-center gap-1"
                >
                  <span>Open Full Size</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-charcoal-500 bg-ivory-50 rounded-lg border border-ivory-200">
              No photo proof has been uploaded for this stop yet.
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-ivory-200">
            <button
              onClick={() => setProofStop(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dispatch Dialog */}
      <ConfirmDialog
        isOpen={!!routeToDispatch}
        onClose={() => setRouteToDispatch(null)}
        onConfirm={handleConfirmDispatch}
        title="Confirm Route Dispatch"
        description={`Are you ready to dispatch route ${routeToDispatch?.route_code}? This will notify the assigned driver and activate stop-level progression.`}
        confirmText="Confirm & Dispatch"
      />

      {/* Reassign Route Modal (Emergency Driver/Vehicle Recovery) */}
      <Modal
        isOpen={!!routeToReassign}
        onClose={() => setRouteToReassign(null)}
        title="Emergency Reassign Driver / Vehicle"
        subtitle={`Route ${routeToReassign?.route_code} · Currently assigned to Driver #${routeToReassign?.driver_id} & Vehicle #${routeToReassign?.vehicle_id}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!routeToReassign || !reassignDriverId || !reassignVehicleId || !reassignReason.trim()) return;
            reassignMutation.mutate({
              routeId: routeToReassign.id,
              payload: {
                driver_id: Number(reassignDriverId),
                vehicle_id: Number(reassignVehicleId),
                reason: reassignReason.trim(),
              },
            });
          }}
          className="space-y-4 text-xs"
        >
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Operational Reassignment:</strong> Reassign this route before dispatch if the designated driver or vehicle is unavailable. This action will be audited.
            </span>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Select Replacement Active Driver *
            </label>
            <select
              required
              value={reassignDriverId}
              onChange={(e) => setReassignDriverId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="">Select available driver...</option>
              {drivers
                .filter((d) => d.status === 'ACTIVE' && d.is_available)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.employee_id} (Driver #{d.id}) — {d.phone}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Select Replacement Vehicle *
            </label>
            <select
              required
              value={reassignVehicleId}
              onChange={(e) => setReassignVehicleId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="">Select available vehicle...</option>
              {vehicles
                .filter((v) => v.status === 'AVAILABLE' || v.id === routeToReassign?.vehicle_id)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration_number} · {v.vehicle_type} · Capacity: {formatWeight(v.capacity_kg)}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Reassignment Reason (Mandatory Audit Requirement) *
            </label>
            <textarea
              required
              placeholder="e.g. Driver reported sick; vehicle breakdown prior to departure..."
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setRouteToReassign(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reassignMutation.isPending || !reassignDriverId || !reassignVehicleId || !reassignReason.trim()}
              className="px-4 py-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {reassignMutation.isPending ? 'Reassigning...' : 'Confirm Reassignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DispatchMonitoring;
