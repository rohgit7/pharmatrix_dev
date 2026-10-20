import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routesApi, warehousesApi, pickupsApi } from '../api/operations';
import { RouteResponse, RouteStatus, RouteCreate } from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDistance, formatDuration } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { MapPin, Navigation, Sparkles, CheckCircle2, AlertCircle, Eye, Plus } from 'lucide-react';

export const Routes: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
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

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['adminRoutes', statusFilter],
    queryFn: () => routesApi.list(statusFilter === 'ALL' ? undefined : (statusFilter as RouteStatus)),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['adminWarehouses'],
    queryFn: () => warehousesApi.list(),
  });

  const { data: scheduledPickups = [] } = useQuery({
    queryKey: ['adminPickupsScheduled'],
    queryFn: () => pickupsApi.list('SCHEDULED'),
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
        <button
          onClick={() => setSelectedRoute(r)}
          className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
          title="Inspect Route Stops"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const statusOptions = ['ALL', 'DRAFT', 'OPTIMIZING', 'READY', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

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
                onClick={() => setStatusFilter(st)}
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
    </div>
  );
};
