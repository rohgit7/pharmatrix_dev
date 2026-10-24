import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { routesApi, warehousesApi, pickupsApi, fleetApi } from '../api/operations';
import { RouteResponse, RouteStatus, RouteCreate, RouteUpdate } from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDistance, formatDuration } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { ErrorState } from '../components/common/ErrorState';
import { MapPin, Navigation, Sparkles, CheckCircle2, AlertCircle, Eye, Plus, Edit, Trash2 } from 'lucide-react';

const statusOptions: Array<RouteStatus | 'ALL'> = [
  'ALL',
  'DRAFT',
  'OPTIMIZING',
  'READY',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export const Routes: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const statusFilter = statusOptions.includes(requestedStatus as RouteStatus)
    ? (requestedStatus as RouteStatus)
    : 'ALL';
  const [selectedRoute, setSelectedRoute] = useState<RouteResponse | null>(null);

  // Optimize modal
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [optWarehouseId, setOptWarehouseId] = useState<number | ''>('');
  const [optRouteDate, setOptRouteDate] = useState<string>('');

  // Manual Route Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [manualWarehouseId, setManualWarehouseId] = useState<number | ''>('');
  const [manualRouteDate, setManualRouteDate] = useState<string>('');
  const [selectedPickupIds, setSelectedPickupIds] = useState<number[]>([]);

  // Edit & Delete Route State
  const [routeToEdit, setRouteToEdit] = useState<RouteResponse | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<RouteResponse | null>(null);
  const [editForm, setEditForm] = useState<{
    status: RouteStatus;
    driver_id: string;
    vehicle_id: string;
    warehouse_id: string;
    route_date: string;
  }>({
    status: 'DRAFT',
    driver_id: '',
    vehicle_id: '',
    warehouse_id: '',
    route_date: '',
  });

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: routes = [], isLoading, error, refetch } = useQuery({
    queryKey: ['adminRoutes', statusFilter],
    queryFn: () => routesApi.list(statusFilter === 'ALL' ? undefined : (statusFilter as RouteStatus)),
  });

  const updateStatusFilter = (status: RouteStatus | 'ALL') => {
    const nextParams = new URLSearchParams(searchParams);
    if (status === 'ALL') {
      nextParams.delete('status');
    } else {
      nextParams.set('status', status);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const { data: warehouses = [] } = useQuery({
    queryKey: ['adminWarehouses'],
    queryFn: () => warehousesApi.list(),
  });

  const { data: scheduledPickups = [] } = useQuery({
    queryKey: ['adminPickupsScheduled'],
    queryFn: () => pickupsApi.list('SCHEDULED'),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['adminDriversListRoutes'],
    queryFn: () => fleetApi.listDrivers(0, 100),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['adminVehiclesListRoutes'],
    queryFn: () => fleetApi.listVehicles(0, 100),
  });

  const optimizeMutation = useMutation({
    mutationFn: (payload: { warehouse_id: number; route_date: string }) =>
      routesApi.optimize(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardSummary'] });
      setAlert({
        type: 'success',
        message: `Optimizer created ${data.routes_created} routes and assigned ${data.pickups_assigned} pickups.`,
      });
      setShowOptimizeModal(false);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const createRouteMutation = useMutation({
    mutationFn: (payload: RouteCreate) => routesApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['adminPickupsScheduled'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardSummary'] });
      setAlert({
        type: 'success',
        message: `Route ${data.route_code} created successfully with ${data.stops?.length || 0} stops.`,
      });
      setShowCreateModal(false);
      setSelectedPickupIds([]);
      setManualRouteDate('');
      setManualWarehouseId('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RouteUpdate }) =>
      routesApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      setAlert({
        type: 'success',
        message: `Route ${data.route_code} updated successfully.`,
      });
      setRouteToEdit(null);
      if (selectedRoute?.id === data.id) setSelectedRoute(data);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: (id: number) => routesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      setAlert({
        type: 'success',
        message: 'Route deleted successfully.',
      });
      setRouteToDelete(null);
      if (selectedRoute?.id === routeToDelete?.id) setSelectedRoute(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const handleOptimizeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!optWarehouseId || !optRouteDate) return;
    optimizeMutation.mutate({
      warehouse_id: Number(optWarehouseId),
      route_date: new Date(optRouteDate).toISOString(),
    });
  };

  const handleManualCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualWarehouseId || !manualRouteDate || selectedPickupIds.length === 0) return;
    createRouteMutation.mutate({
      warehouse_id: Number(manualWarehouseId),
      route_date: new Date(manualRouteDate).toISOString(),
      pickup_ids: selectedPickupIds,
    });
  };

  const togglePickupSelection = (id: number) => {
    setSelectedPickupIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const columns: Column<RouteResponse>[] = [
    {
      key: 'route_code',
      header: 'Route Code',
      sortable: true,
      render: (r) => <span className="font-mono font-semibold text-charcoal-900">{r.route_code}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'route_date',
      header: 'Route Date',
      sortable: true,
      render: (r) => <span className="font-medium text-charcoal-800">{formatDate(r.route_date)}</span>,
    },
    {
      key: 'stops',
      header: 'Stops',
      render: (r) => (
        <span className="inline-flex items-center gap-1 font-medium text-charcoal-700">
          <Navigation className="w-3.5 h-3.5 text-periwinkle-700" />
          {r.stops?.length || 0} stops
        </span>
      ),
    },
    {
      key: 'planned_distance_km',
      header: 'Est. Distance',
      render: (r) => <span>{formatDistance(r.planned_distance_km)}</span>,
    },
    {
      key: 'planned_duration_seconds',
      header: 'Est. Duration',
      render: (r) => <span>{formatDuration(r.planned_duration_seconds)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedRoute(r)}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Inspect Route Stops"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setRouteToEdit(r);
              setEditForm({
                status: r.status,
                driver_id: r.driver_id ? String(r.driver_id) : '',
                vehicle_id: r.vehicle_id ? String(r.vehicle_id) : '',
                warehouse_id: String(r.warehouse_id),
                route_date: r.route_date ? r.route_date.slice(0, 10) : '',
              });
            }}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Edit Route"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRouteToDelete(r)}
            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
            title="Delete Route"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Alert */}
      {alert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-medium">
            {alert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{alert.message}</span>
          </div>
          {alert.type === 'error' &&
            alert.message.toLowerCase().includes('no available driver-vehicle assignments') && (
              <Link
                to="/fleet?tab=assignments"
                className="text-xs font-semibold text-rose-700 underline underline-offset-2 hover:text-rose-900"
              >
                Manage vehicle assignments
              </Link>
            )}
          <button onClick={() => setAlert(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">Routes & Driver Operations</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Create manual routes, run automated OSRM optimizer dispatch, and inspect stop sequences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 text-periwinkle" />
            <span>Create Route</span>
          </button>
          <button
            onClick={() => setShowOptimizeModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Optimize Routes</span>
          </button>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <ErrorState
          title="Unable to load routes"
          message={error instanceof Error ? error.message : 'An unexpected error occurred.'}
          onRetry={() => { void refetch(); }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={routes}
          isLoading={isLoading}
          searchPlaceholder="Filter routes by code..."
          searchFilter={(row, q) =>
            row.route_code.toLowerCase().includes(q) || row.status.toLowerCase().includes(q)
          }
          filterSlot={
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {statusOptions.map((st) => (
                <button
                  key={st}
                  onClick={() => updateStatusFilter(st)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-charcoal-800 text-white border-charcoal-800'
                      : 'bg-white text-charcoal-600 border-ivory-300 hover:bg-ivory-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          }
          onRowClick={(r) => setSelectedRoute(r)}
        />
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedRoute}
        onClose={() => setSelectedRoute(null)}
        title={selectedRoute?.route_code || 'Route Sequence'}
        subtitle={`Warehouse ID #${selectedRoute?.warehouse_id}`}
        width="xl"
      >
        {selectedRoute && (
          <div className="space-y-6 text-sm">
            {/* Summary Banner */}
            <div className="bg-ivory-100 p-4 rounded-xl border border-ivory-300 flex items-center justify-between">
              <div>
                <span className="text-xs text-charcoal-500 font-medium">Execution Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedRoute.status} size="md" />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-charcoal-500 font-medium">Assigned Vehicle / Driver</span>
                <div className="mt-1 text-xs font-mono font-semibold text-charcoal-900">
                  {selectedRoute.vehicle_id ? `VEH-#${selectedRoute.vehicle_id}` : 'Unassigned'} /{' '}
                  {selectedRoute.driver_id ? `DRV-#${selectedRoute.driver_id}` : 'Unassigned'}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-charcoal-600">
              <span>Route ID: #{selectedRoute.id}</span>
              <span>Warehouse ID: #{selectedRoute.warehouse_id}</span>
              <span>Optimized at: {formatDate(selectedRoute.optimized_at)}</span>
              <span>Created / Updated: {formatDate(selectedRoute.created_at)} / {formatDate(selectedRoute.updated_at)}</span>
            </div>

            {/* Stops Timeline */}
            <div>
              <h4 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider mb-4">
                Stop-Level Sequence ({selectedRoute.stops?.length || 0} stops)
              </h4>
              <div className="relative pl-6 border-l-2 border-ivory-300 space-y-6">
                {selectedRoute.stops && selectedRoute.stops.length > 0 ? (
                  selectedRoute.stops
                    .sort((a, b) => a.sequence_number - b.sequence_number)
                    .map((stop) => (
                      <div key={stop.id} className="relative">
                        {/* Dot */}
                        <div
                          className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold ${
                            stop.stop_type === 'WAREHOUSE'
                              ? 'bg-charcoal-900 text-white'
                              : 'bg-periwinkle text-charcoal-900'
                          }`}
                        >
                          {stop.sequence_number}
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-ivory-300 shadow-subtle">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-charcoal-900 text-xs">
                              {stop.stop_type === 'WAREHOUSE'
                                ? `Warehouse Intake #${stop.warehouse_id}`
                                : `Consignment Pickup #${stop.pickup_id}`}
                            </span>
                            <StatusBadge status={stop.stop_type} size="sm" />
                          </div>
                          <div className="mt-2 text-xs text-charcoal-500 flex items-center gap-4">
                            <span>Stop #{stop.id}</span>
                            <span>Arrival: {formatDate(stop.arrival_time)}</span>
                            <span>Departure: {formatDate(stop.departure_time)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-charcoal-400">No stops assigned to this route.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Manual Route Creation Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Manual Route"
        subtitle="Sequence scheduled consignments for driver execution"
      >
        <form onSubmit={handleManualCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Origin & Destination Warehouse
            </label>
            <select
              required
              value={manualWarehouseId}
              onChange={(e) => setManualWarehouseId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="">Select warehouse hub...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Route Execution Date
            </label>
            <input
              type="date"
              required
              value={manualRouteDate}
              onChange={(e) => setManualRouteDate(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Select Scheduled Pickups to Assign ({selectedPickupIds.length} selected)
            </label>
            {scheduledPickups.length === 0 ? (
              <p className="text-charcoal-400 p-3 bg-ivory-50 rounded-lg border border-ivory-200">
                No scheduled pickups available. Pickups must be in SCHEDULED status before creating a route.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-ivory-300 rounded-lg divide-y divide-ivory-200 bg-white">
                {scheduledPickups.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 hover:bg-ivory-50 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPickupIds.includes(p.id)}
                      onChange={() => togglePickupSelection(p.id)}
                      className="rounded border-ivory-300 text-periwinkle focus:ring-periwinkle"
                    />
                    <div className="flex-1 flex items-center justify-between">
                      <span className="font-mono font-semibold text-charcoal-900">{p.pickup_code}</span>
                      <span className="text-[11px] text-charcoal-500">
                        Date: {formatDate(p.scheduled_date)}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRouteMutation.isPending || selectedPickupIds.length === 0}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {createRouteMutation.isPending ? 'Creating Route...' : 'Create Route'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Optimize Modal */}
      <Modal
        isOpen={showOptimizeModal}
        onClose={() => setShowOptimizeModal(false)}
        title="Run OSRM Route Optimizer"
        subtitle="Automated pickup consolidation and vehicle assignment"
      >
        <form onSubmit={handleOptimizeSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5">
              Hub Warehouse
            </label>
            <select
              required
              value={optWarehouseId}
              onChange={(e) => setOptWarehouseId(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:outline-none focus:ring-2 focus:ring-periwinkle"
            >
              <option value="">Select origin hub warehouse...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5">
              Target Route Date
            </label>
            <input
              type="date"
              required
              value={optRouteDate}
              onChange={(e) => setOptRouteDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:outline-none focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowOptimizeModal(false)}
              className="px-4 py-2 text-xs font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={optimizeMutation.isPending}
              className="px-4 py-2 text-xs font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {optimizeMutation.isPending ? 'Optimizing...' : 'Execute Optimizer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Route Modal */}
      <Modal
        isOpen={!!routeToEdit}
        onClose={() => setRouteToEdit(null)}
        title={`Edit Route ${routeToEdit?.route_code}`}
        subtitle={`Route ID #${routeToEdit?.id}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (routeToEdit) {
              updateRouteMutation.mutate({
                id: routeToEdit.id,
                payload: {
                  status: editForm.status,
                  driver_id: editForm.driver_id ? Number(editForm.driver_id) : null,
                  vehicle_id: editForm.vehicle_id ? Number(editForm.vehicle_id) : null,
                  warehouse_id: Number(editForm.warehouse_id),
                  route_date: editForm.route_date ? new Date(editForm.route_date).toISOString() : undefined,
                },
              });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Route Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as RouteStatus })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="READY">READY</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Route Date</label>
              <input
                type="date"
                required
                value={editForm.route_date}
                onChange={(e) => setEditForm({ ...editForm, route_date: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Warehouse Hub *</label>
            <select
              required
              value={editForm.warehouse_id}
              onChange={(e) => setEditForm({ ...editForm, warehouse_id: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Assigned Driver</label>
              <select
                value={editForm.driver_id}
                onChange={(e) => setEditForm({ ...editForm, driver_id: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="">Unassigned</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    #{d.employee_id} ({d.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Assigned Vehicle</label>
              <select
                value={editForm.vehicle_id}
                onChange={(e) => setEditForm({ ...editForm, vehicle_id: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="">Unassigned</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration_number} ({v.vehicle_type} · {v.capacity_kg}kg)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setRouteToEdit(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateRouteMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {updateRouteMutation.isPending ? 'Saving...' : 'Update Route'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!routeToDelete}
        onClose={() => setRouteToDelete(null)}
        title="Delete Route"
        subtitle={`Confirm permanent removal of route ${routeToDelete?.route_code}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-charcoal-700">
            Are you sure you want to delete route <strong className="font-mono text-charcoal-900">{routeToDelete?.route_code}</strong>?
            Any stops and assigned pickups on this route will be returned to Scheduled status for rescheduling.
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <strong>Warning:</strong> Deleting an active route unassigns the driver and vehicle.
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setRouteToDelete(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (routeToDelete) {
                  deleteRouteMutation.mutate(routeToDelete.id);
                }
              }}
              disabled={deleteRouteMutation.isPending}
              className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {deleteRouteMutation.isPending ? 'Deleting...' : 'Delete Route'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
