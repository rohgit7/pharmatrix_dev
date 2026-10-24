import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { fleetApi, routesApi } from '../api/operations';
import {
  DriverOnboardRequest,
  DriverResponse,
  VehicleCreate,
  VehicleResponse,
  RouteResponse,
  DriverVehicleAssignmentCreate,
  DriverVehicleAssignmentResponse,
  DriverStatus,
  VehicleStatus,
  VehicleType,
  DriverUpdate,
  VehicleUpdate,
  RouteAssignRequest,
  RouteReassignRequest,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { ErrorState } from '../components/common/ErrorState';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { formatDate, formatDistance, formatDuration, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  Users,
  Truck,
  Plus,
  CheckCircle2,
  AlertCircle,
  Shield,
  Link2,
  Unlink,
  MapPin,
  ArrowRight,
  Send,
  AlertTriangle,
  Clock,
  Edit,
  Trash2,
  RotateCcw,
  FileCheck,
} from 'lucide-react';

type VehicleFormState = Omit<VehicleCreate, 'vehicle_type' | 'capacity_kg'> & {
  vehicle_type: VehicleCreate['vehicle_type'] | '';
  capacity_kg: number | '';
};

interface ActiveAssignmentView extends DriverVehicleAssignmentResponse {
  driver: DriverResponse;
  vehicle: VehicleResponse;
}

export const Fleet: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: 'drivers' | 'vehicles' | 'assignments' | 'routes' =
    tabParam === 'vehicles' || tabParam === 'assignments' || tabParam === 'routes'
      ? tabParam
      : 'drivers';
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string; actionLink?: string; actionText?: string } | null>(null);

  // Driver Onboarding Modal
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverForm, setDriverForm] = useState<DriverOnboardRequest>({
    name: '',
    email: '',
    employee_id: '',
    phone: '',
    license_number: '',
    license_expiry: '',
  });

  // Vehicle Modal
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>({
    registration_number: '',
    vehicle_type: '',
    capacity_kg: '',
  });

  // Active Assignment Modal
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<DriverVehicleAssignmentCreate>({
    driver_id: 0,
    vehicle_id: 0,
    notes: '',
  });
  const [unassignDriver, setUnassignDriver] = useState<ActiveAssignmentView | null>(null);

  // Driver CRUD State
  const [driverToEdit, setDriverToEdit] = useState<DriverResponse | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<DriverResponse | null>(null);
  const [driverEditForm, setDriverEditForm] = useState<{
    status: DriverStatus;
    phone: string;
    license_number: string;
    license_expiry: string;
    is_available: boolean;
  }>({
    status: 'ACTIVE',
    phone: '',
    license_number: '',
    license_expiry: '',
    is_available: true,
  });

  // Vehicle CRUD State
  const [vehicleToEdit, setVehicleToEdit] = useState<VehicleResponse | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<VehicleResponse | null>(null);
  const [vehicleEditForm, setVehicleEditForm] = useState<{
    status: VehicleStatus;
    vehicle_type: VehicleType;
    capacity_kg: number;
  }>({
    status: 'AVAILABLE',
    vehicle_type: 'VAN',
    capacity_kg: 500,
  });

  // Route-to-Fleet Assignment Modal
  const [routeToPair, setRouteToPair] = useState<RouteResponse | null>(null);
  const [pairDriverId, setPairDriverId] = useState<number | ''>('');
  const [pairVehicleId, setPairVehicleId] = useState<number | ''>('');
  const [pairNotes, setPairNotes] = useState<string>('');
  const [confirmPairRoute, setConfirmPairRoute] = useState<boolean>(false);

  // Safe Recovery & Reassignment State
  const [routeToReassign, setRouteToReassign] = useState<RouteResponse | null>(null);
  const [reassignDriverId, setReassignDriverId] = useState<number | ''>('');
  const [reassignVehicleId, setReassignVehicleId] = useState<number | ''>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [routeToUnassign, setRouteToUnassign] = useState<RouteResponse | null>(null);

  const selectTab = (tab: 'drivers' | 'vehicles' | 'assignments' | 'routes') => {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'drivers') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const {
    data: drivers = [],
    isLoading: isDriversLoading,
    error: driversError,
    refetch: refetchDrivers,
  } = useQuery({
    queryKey: ['adminDrivers'],
    queryFn: () => fleetApi.listDrivers(0, 100),
  });

  const {
    data: vehicles = [],
    isLoading: isVehiclesLoading,
    error: vehiclesError,
    refetch: refetchVehicles,
  } = useQuery({
    queryKey: ['adminVehicles'],
    queryFn: () => fleetApi.listVehicles(0, 100),
  });

  const {
    data: routes = [],
    isLoading: isRoutesLoading,
    error: routesError,
    refetch: refetchRoutes,
  } = useQuery({
    queryKey: ['adminRoutes'],
    queryFn: () => routesApi.list(),
  });

  const assignmentQuery = useQuery({
    queryKey: ['adminDriverVehicleAssignments'],
    enabled: !isDriversLoading && !driversError && !isVehiclesLoading && !vehiclesError,
    queryFn: async (): Promise<ActiveAssignmentView[]> => {
      const assignments = await fleetApi.listActiveAssignments();
      const driverById = new Map(drivers.map((driver) => [driver.id, driver]));
      const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
      return assignments.map((assignment) => {
        const driver = driverById.get(assignment.driver_id);
        const vehicle = vehicleById.get(assignment.vehicle_id);
        if (!driver || !vehicle) {
          throw new Error(
            `Active assignment #${assignment.id} references a driver or vehicle missing from the loaded fleet.`
          );
        }
        return { ...assignment, driver, vehicle };
      });
    },
  });

  const onboardDriverMutation = useMutation({
    mutationFn: fleetApi.onboardDriver,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      setAlert({
        type: 'success',
        message: data.message || 'Driver onboarded successfully.',
      });
      setShowDriverModal(false);
      setDriverForm({
        name: '',
        email: '',
        employee_id: '',
        phone: '',
        license_number: '',
        license_expiry: '',
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const createVehicleMutation = useMutation({
    mutationFn: fleetApi.createVehicle,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Vehicle ${data.registration_number} registered successfully.`,
      });
      setShowVehicleModal(false);
      setVehicleForm({
        registration_number: '',
        vehicle_type: '',
        capacity_kg: '',
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const assignVehicleMutation = useMutation({
    mutationFn: fleetApi.assignVehicle,
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ['adminDriverVehicleAssignments'] });
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Vehicle #${assignment.vehicle_id} assigned to driver #${assignment.driver_id}.`,
      });
      setShowAssignmentModal(false);
      setAssignmentForm({ driver_id: 0, vehicle_id: 0, notes: '' });
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const unassignVehicleMutation = useMutation({
    mutationFn: fleetApi.unassignVehicle,
    onSuccess: (assignment) => {
      void queryClient.invalidateQueries({ queryKey: ['adminDriverVehicleAssignments'] });
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Vehicle #${assignment.vehicle_id} unassigned from driver #${assignment.driver_id}.`,
      });
      setUnassignDriver(null);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const updateDriverMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DriverUpdate }) =>
      fleetApi.updateDriver(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      setAlert({ type: 'success', message: 'Driver details updated successfully.' });
      setDriverToEdit(null);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const deleteDriverMutation = useMutation({
    mutationFn: (id: number) => fleetApi.deleteDriver(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      setAlert({ type: 'success', message: 'Driver record removed.' });
      setDriverToDelete(null);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: VehicleUpdate }) =>
      fleetApi.updateVehicle(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({ type: 'success', message: 'Vehicle details updated successfully.' });
      setVehicleToEdit(null);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: (id: number) => fleetApi.deleteVehicle(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({ type: 'success', message: 'Vehicle record removed.' });
      setVehicleToDelete(null);
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const activeAssignments = assignmentQuery.data ?? [];
  const assignedDriverIds = new Set(activeAssignments.map((assignment) => assignment.driver_id));
  const availableDrivers = drivers.filter(
    (driver) =>
      driver.status === 'ACTIVE' &&
      driver.is_available &&
      !assignedDriverIds.has(driver.id)
  );
  const availableVehicles = vehicles.filter((vehicle) => vehicle.status === 'AVAILABLE');

  // Routes awaiting fleet assignment: Strictly APPROVED routes awaiting driver/vehicle pairing
  const routesAwaitingAssignment = routes.filter(
    (r) =>
      r.approved_at !== null &&
      r.status !== 'CANCELLED' &&
      r.status !== 'COMPLETED' &&
      (r.driver_id === null || r.vehicle_id === null)
  );

  // Assigned routes awaiting dispatch (pre-dispatch recovery)
  const assignedPreDispatchRoutes = routes.filter(
    (r) => (r.status === 'ASSIGNED' || r.status === 'READY') && r.driver_id !== null && r.vehicle_id !== null
  );

  const selectedVehicleForPair = vehicles.find((v) => v.id === pairVehicleId);
  const selectedDriverForPair = drivers.find((d) => d.id === pairDriverId);

  // Validation Checks for selected pairing
  const estimatedRouteLoad = (routeToPair?.stops?.length || 0) * 15; // kg approximate
  const isCapacityViolated =
    selectedVehicleForPair &&
    selectedVehicleForPair.capacity_kg &&
    Number(selectedVehicleForPair.capacity_kg) < estimatedRouteLoad;

  const isDriverLicenseExpired =
    selectedDriverForPair?.license_expiry &&
    new Date(selectedDriverForPair.license_expiry) < new Date();

  const assignRouteMutation = useMutation({
    mutationFn: ({ routeId, payload }: { routeId: number; payload: RouteAssignRequest }) =>
      routesApi.assign(routeId, payload),
    onSuccess: (updatedRoute) => {
      void queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Route ${updatedRoute.route_code} assigned to Driver #${updatedRoute.driver_id} and Vehicle #${updatedRoute.vehicle_id}. Ready for dispatch.`,
        actionLink: '/dispatch',
        actionText: 'Proceed to Route Dispatch',
      });
      setConfirmPairRoute(false);
      setRouteToPair(null);
      setPairDriverId('');
      setPairVehicleId('');
      setPairNotes('');
      refetchRoutes();
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const reassignRouteMutation = useMutation({
    mutationFn: ({ routeId, payload }: { routeId: number; payload: RouteReassignRequest }) =>
      routesApi.reassign(routeId, payload),
    onSuccess: (updatedRoute) => {
      void queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Route ${updatedRoute.route_code} successfully reassigned to Driver #${updatedRoute.driver_id} and Vehicle #${updatedRoute.vehicle_id}.`,
      });
      setRouteToReassign(null);
      setReassignDriverId('');
      setReassignVehicleId('');
      setReassignReason('');
      refetchRoutes();
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const unassignRouteMutation = useMutation({
    mutationFn: (routeId: number) => routesApi.unassign(routeId),
    onSuccess: (updatedRoute) => {
      void queryClient.invalidateQueries({ queryKey: ['adminRoutes'] });
      void queryClient.invalidateQueries({ queryKey: ['adminDrivers'] });
      void queryClient.invalidateQueries({ queryKey: ['adminVehicles'] });
      setAlert({
        type: 'success',
        message: `Route ${updatedRoute.route_code} fleet unassigned. Route is back to approved state awaiting new pairing.`,
      });
      setRouteToUnassign(null);
      refetchRoutes();
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const handleConfirmRoutePair = () => {
    if (!routeToPair || !pairDriverId || !pairVehicleId) return;

    assignRouteMutation.mutate({
      routeId: routeToPair.id,
      payload: {
        driver_id: Number(pairDriverId),
        vehicle_id: Number(pairVehicleId),
        notes: pairNotes.trim() || undefined,
      },
    });
  };

  const assignmentColumns: Column<ActiveAssignmentView>[] = [
    {
      key: 'driver_id',
      header: 'Driver',
      sortable: true,
      render: (assignment) => (
        <div>
          <span className="block font-semibold text-charcoal-900">
            Employee {assignment.driver.employee_id}
          </span>
          <span className="block text-[11px] text-charcoal-500">
            Driver #{assignment.driver_id} · User #{assignment.driver.user_id}
          </span>
        </div>
      ),
    },
    {
      key: 'vehicle_id',
      header: 'Vehicle',
      sortable: true,
      render: (assignment) => (
        <div>
          <span className="block font-mono font-semibold text-charcoal-900">
            {assignment.vehicle.registration_number}
          </span>
          <span className="block text-[11px] text-charcoal-500">
            {assignment.vehicle.vehicle_type} · {formatWeight(assignment.vehicle.capacity_kg)} · Vehicle #{assignment.vehicle_id}
          </span>
        </div>
      ),
    },
    {
      key: 'assigned_at',
      header: 'Assigned At',
      sortable: true,
      render: (assignment) => <span>{formatDate(assignment.assigned_at)}</span>,
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (assignment) => (
        <span className="text-xs text-charcoal-600 truncate max-w-xs block">
          {assignment.notes || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (assignment) => (
        <button
          onClick={() => setUnassignDriver(assignment)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200"
        >
          <Unlink className="w-3.5 h-3.5" />
          <span>Unassign</span>
        </button>
      ),
    },
  ];

  const driverColumns: Column<DriverResponse>[] = [
    {
      key: 'employee_id',
      header: 'Employee ID',
      sortable: true,
      render: (d) => <span className="font-mono font-semibold text-charcoal-900">{d.employee_id}</span>,
    },
    {
      key: 'phone',
      header: 'Contact',
      render: (d) => <span className="font-mono text-xs">{d.phone}</span>,
    },
    {
      key: 'license_number',
      header: 'License Number',
      render: (d) => (
        <div>
          <span className="font-mono text-xs text-charcoal-800">{d.license_number}</span>
          {d.license_expiry && (
            <div
              className={`text-[10px] ${
                new Date(d.license_expiry) < new Date()
                  ? 'text-rose-600 font-bold'
                  : 'text-charcoal-500'
              }`}
            >
              Exp: {formatDate(d.license_expiry)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Driver Status',
      sortable: true,
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'is_available',
      header: 'Availability',
      sortable: true,
      render: (d) => (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
            d.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-charcoal-200 text-charcoal-700'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${d.is_available ? 'bg-emerald-500' : 'bg-charcoal-400'}`} />
          {d.is_available ? 'Available' : 'Unavailable'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (d) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setDriverToEdit(d);
              setDriverEditForm({
                status: d.status,
                phone: d.phone,
                license_number: d.license_number,
                license_expiry: d.license_expiry ? d.license_expiry.slice(0, 10) : '',
                is_available: d.is_available,
              });
            }}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Edit Driver"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDriverToDelete(d)}
            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
            title="Delete Driver"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const vehicleColumns: Column<VehicleResponse>[] = [
    {
      key: 'registration_number',
      header: 'Registration #',
      sortable: true,
      render: (v) => <span className="font-mono font-bold text-charcoal-900">{v.registration_number}</span>,
    },
    {
      key: 'vehicle_type',
      header: 'Type',
      sortable: true,
      render: (v) => <span className="font-semibold text-xs text-charcoal-800">{v.vehicle_type}</span>,
    },
    {
      key: 'capacity_kg',
      header: 'Payload Capacity',
      sortable: true,
      render: (v) => <span className="font-semibold text-emerald-800">{formatWeight(v.capacity_kg)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (v) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setVehicleToEdit(v);
              setVehicleEditForm({
                status: v.status,
                vehicle_type: v.vehicle_type,
                capacity_kg: Number(v.capacity_kg),
              });
            }}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Edit Vehicle"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setVehicleToDelete(v)}
            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
            title="Delete Vehicle"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const routeAwaitingColumns: Column<RouteResponse>[] = [
    {
      key: 'route_code',
      header: 'Route Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-charcoal-900">{r.route_code}</span>,
    },
    {
      key: 'route_date',
      header: 'Date',
      sortable: true,
      render: (r) => <span className="text-xs">{formatDate(r.route_date)}</span>,
    },
    {
      key: 'warehouse_id',
      header: 'Warehouse',
      render: (r) => <span className="font-mono text-xs">Hub #{r.warehouse_id}</span>,
    },
    {
      key: 'stops',
      header: 'Stops',
      render: (r) => (
        <span className="font-semibold text-charcoal-800">
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
      key: 'status',
      header: 'Status & Approval',
      render: (r) => (
        <div className="space-y-1">
          <StatusBadge status={r.status} />
          {r.approved_at ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              <span>Approved</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              <Clock className="w-3 h-3" />
              <span>Approval Required</span>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Assignment Action',
      className: 'text-right',
      render: (r) => {
        if (!r.approved_at) {
          return (
            <Link
              to="/route-optimization"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors border border-amber-300"
              title="Route must be approved in Route Optimizer before driver/vehicle assignment"
            >
              <span>Review & Approve</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          );
        }
        return (
          <button
            onClick={() => {
              setRouteToPair(r);
              setPairDriverId(availableDrivers[0]?.id || '');
              setPairVehicleId(availableVehicles[0]?.id || '');
              setPairNotes('');
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Assign Fleet Pair</span>
          </button>
        );
      },
    },
  ];

  const assignedPreDispatchColumns: Column<RouteResponse>[] = [
    {
      key: 'route_code',
      header: 'Route Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-charcoal-900">{r.route_code}</span>,
    },
    {
      key: 'route_date',
      header: 'Date',
      sortable: true,
      render: (r) => <span className="text-xs">{formatDate(r.route_date)}</span>,
    },
    {
      key: 'driver_id',
      header: 'Assigned Driver',
      render: (r) => {
        const d = drivers.find((drv) => drv.id === r.driver_id);
        return (
          <div>
            <span className="font-semibold text-xs text-charcoal-900">
              {d ? `Employee ${d.employee_id}` : `Driver #${r.driver_id}`}
            </span>
            {d?.phone && <span className="block text-[11px] text-charcoal-500 font-mono">{d.phone}</span>}
          </div>
        );
      },
    },
    {
      key: 'vehicle_id',
      header: 'Assigned Vehicle',
      render: (r) => {
        const v = vehicles.find((veh) => veh.id === r.vehicle_id);
        return (
          <div>
            <span className="font-mono font-semibold text-xs text-charcoal-900">
              {v ? v.registration_number : `Vehicle #${r.vehicle_id}`}
            </span>
            {v?.capacity_kg && (
              <span className="block text-[11px] text-emerald-700 font-medium">
                {v.vehicle_type} · {formatWeight(v.capacity_kg)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Fleet Recovery Actions',
      className: 'text-right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setRouteToReassign(r);
              setReassignDriverId(r.driver_id || availableDrivers[0]?.id || '');
              setReassignVehicleId(r.vehicle_id || availableVehicles[0]?.id || '');
              setReassignReason('');
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
            title="Reassign driver or vehicle before dispatch"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reassign</span>
          </button>
          <button
            onClick={() => setRouteToUnassign(r)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200"
            title="Release driver and vehicle back to pool"
          >
            <Unlink className="w-3.5 h-3.5" />
            <span>Unassign</span>
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
            {alert.actionLink && (
              <Link
                to={alert.actionLink}
                className="ml-2 underline font-bold text-emerald-950 inline-flex items-center gap-1 hover:text-black"
              >
                <span>{alert.actionText}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          <button onClick={() => setAlert(null)} className="font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-charcoal-900 tracking-tight">
            Drivers, Vehicles & Route Assignment
          </h1>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Manage driver readiness, vehicle payload capacities, driver-vehicle pairings, and route assignment verification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'drivers' && (
            <button
              onClick={() => setShowDriverModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-charcoal-900 hover:bg-charcoal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 text-periwinkle" />
              <span>Onboard Driver</span>
            </button>
          )}

          {activeTab === 'vehicles' && (
            <button
              onClick={() => setShowVehicleModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-charcoal-900 hover:bg-charcoal-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 text-periwinkle" />
              <span>Register Vehicle</span>
            </button>
          )}

          {activeTab === 'assignments' && (
            <button
              onClick={() => {
                if (availableDrivers.length === 0 || availableVehicles.length === 0) return;
                setAssignmentForm({
                  driver_id: availableDrivers[0]?.id ?? 0,
                  vehicle_id: availableVehicles[0]?.id ?? 0,
                  notes: '',
                });
                setShowAssignmentModal(true);
              }}
              disabled={availableDrivers.length === 0 || availableVehicles.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              <span>Pair Driver & Vehicle</span>
            </button>
          )}

          {activeTab === 'routes' && (
            <Link
              to="/route-optimization"
              className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span>Optimize New Routes</span>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-ivory-300 overflow-x-auto">
        <button
          onClick={() => selectTab('routes')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'routes'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <MapPin className="w-4 h-4 text-periwinkle-700" />
          <span>Routes Awaiting Assignment ({routesAwaitingAssignment.length})</span>
        </button>

        <button
          onClick={() => selectTab('drivers')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'drivers'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <Users className="w-4 h-4 text-periwinkle-700" />
          <span>Collection Drivers ({drivers.length})</span>
        </button>

        <button
          onClick={() => selectTab('vehicles')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'vehicles'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <Truck className="w-4 h-4 text-periwinkle-700" />
          <span>Fleet Vehicles ({vehicles.length})</span>
        </button>

        <button
          onClick={() => selectTab('assignments')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${
            activeTab === 'assignments'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <Link2 className="w-4 h-4 text-periwinkle-700" />
          <span>Vehicle Pairings ({activeAssignments.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'routes' ? (
        routesError ? (
          <ErrorState
            title="Unable to load routes"
            message={getErrorMessage(routesError)}
            onRetry={() => { void refetchRoutes(); }}
          />
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="p-4 bg-ivory-100 rounded-xl border border-ivory-300 text-xs text-charcoal-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-charcoal-900">Step 5 Prerequisites: </span>
                  Routes must be reviewed & approved before fleet assignment. After pairing, routes progress to Ready for Dispatch.
                </div>
                <span className="font-bold text-amber-700">{routesAwaitingAssignment.length} awaiting assignment</span>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-charcoal-900">
                  Routes Awaiting Fleet Pairing ({routesAwaitingAssignment.length})
                </h3>
              </div>

              <DataTable
                columns={routeAwaitingColumns}
                data={routesAwaitingAssignment}
                isLoading={isRoutesLoading}
                searchPlaceholder="Search routes by code..."
                searchFilter={(row, q) => row.route_code.toLowerCase().includes(q)}
                emptyTitle="No routes awaiting assignment"
                emptyDescription="All approved routes have been assigned to drivers and vehicles."
              />
            </div>

            {assignedPreDispatchRoutes.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-ivory-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-charcoal-900 flex items-center gap-2">
                      <span>Assigned Routes (Pre-Dispatch Recovery)</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {assignedPreDispatchRoutes.length}
                      </span>
                    </h3>
                    <p className="text-xs text-charcoal-500 mt-0.5">
                      Routes paired with drivers and vehicles. Use recovery tools if an assigned driver or vehicle becomes unavailable before dispatch.
                    </p>
                  </div>
                </div>

                <DataTable
                  columns={assignedPreDispatchColumns}
                  data={assignedPreDispatchRoutes}
                  isLoading={isRoutesLoading}
                  searchPlaceholder="Search assigned routes..."
                  searchFilter={(row, q) => row.route_code.toLowerCase().includes(q)}
                  emptyTitle="No assigned routes pending dispatch"
                  emptyDescription="Routes will appear here once paired with a driver and vehicle."
                />
              </div>
            )}
          </div>
        )
      ) : activeTab === 'drivers' ? (
        driversError ? (
          <ErrorState
            title="Unable to load drivers"
            message={getErrorMessage(driversError)}
            onRetry={() => { void refetchDrivers(); }}
          />
        ) : (
          <DataTable
            columns={driverColumns}
            data={drivers}
            isLoading={isDriversLoading}
            searchPlaceholder="Search drivers by ID, phone..."
            searchFilter={(row, q) =>
              row.employee_id.toLowerCase().includes(q) ||
              row.phone.toLowerCase().includes(q) ||
              row.license_number.toLowerCase().includes(q)
            }
          />
        )
      ) : activeTab === 'vehicles' ? (
        vehiclesError ? (
          <ErrorState
            title="Unable to load vehicles"
            message={getErrorMessage(vehiclesError)}
            onRetry={() => { void refetchVehicles(); }}
          />
        ) : (
          <DataTable
            columns={vehicleColumns}
            data={vehicles}
            isLoading={isVehiclesLoading}
            searchPlaceholder="Search vehicles by plate number..."
            searchFilter={(row, q) =>
              row.registration_number.toLowerCase().includes(q) ||
              row.vehicle_type.toLowerCase().includes(q)
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {availableDrivers.length === 0 || availableVehicles.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950">
              {availableDrivers.length === 0 && availableVehicles.length === 0
                ? 'No unassigned active drivers or available vehicles are currently eligible.'
                : availableDrivers.length === 0
                ? 'No unassigned active drivers who are available for assignment.'
                : 'No available vehicles. Vehicles in maintenance, inactive, or already assigned cannot be selected.'}
            </div>
          ) : null}

          <DataTable
            columns={assignmentColumns}
            data={activeAssignments}
            isLoading={isDriversLoading || isVehiclesLoading || assignmentQuery.isLoading}
            searchPlaceholder="Search assignments by employee or vehicle..."
            searchFilter={(row, q) =>
              row.driver.employee_id.toLowerCase().includes(q) ||
              row.vehicle.registration_number.toLowerCase().includes(q)
            }
            emptyTitle="No active vehicle assignments"
            emptyDescription="Assign an available vehicle to an active driver to make the pair eligible for route optimization."
          />
        </div>
      )}

      {/* Driver Onboarding Modal */}
      <Modal
        isOpen={showDriverModal}
        onClose={() => setShowDriverModal(false)}
        title="Onboard Collection Driver"
        subtitle="Provision driver account and send secure email invite"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onboardDriverMutation.mutate({
              ...driverForm,
              license_expiry: driverForm.license_expiry || null,
            });
          }}
          className="space-y-3.5 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Full Legal Name
            </label>
            <input
              required
              type="text"
              value={driverForm.name}
              onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Work Email Address
            </label>
            <input
              required
              type="email"
              value={driverForm.email}
              onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Employee ID
              </label>
              <input
                required
                type="text"
                placeholder="DRV-001"
                value={driverForm.employee_id}
                onChange={(e) => setDriverForm({ ...driverForm, employee_id: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                required
                type="tel"
                placeholder="+91..."
                value={driverForm.phone}
                onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Commercial Driver License #
              </label>
              <input
                required
                type="text"
                value={driverForm.license_number}
                onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                License Expiry Date
              </label>
              <input
                type="date"
                value={driverForm.license_expiry || ''}
                onChange={(e) => setDriverForm({ ...driverForm, license_expiry: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowDriverModal(false)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={onboardDriverMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {onboardDriverMutation.isPending ? 'Onboarding...' : 'Onboard Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Vehicle Registration Modal */}
      <Modal
        isOpen={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
        title="Register Fleet Vehicle"
        subtitle="Add a recovery vehicle with weight carrying limits"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!vehicleForm.vehicle_type) return;
            createVehicleMutation.mutate({
              registration_number: vehicleForm.registration_number,
              vehicle_type: vehicleForm.vehicle_type,
              capacity_kg: vehicleForm.capacity_kg === '' ? null : Number(vehicleForm.capacity_kg),
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Registration / License Plate Number
            </label>
            <input
              required
              type="text"
              placeholder="e.g. KA-01-AB-1234"
              value={vehicleForm.registration_number}
              onChange={(e) => setVehicleForm({ ...vehicleForm, registration_number: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Vehicle Type
              </label>
              <select
                required
                value={vehicleForm.vehicle_type}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value as any })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="">Select vehicle type...</option>
                <option value="VAN">Delivery Van</option>
                <option value="TRUCK">Heavy Truck</option>
                <option value="THREE_WHEELER">Three Wheeler</option>
                <option value="BIKE">Motorbike / Scooter</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Payload Capacity (kg)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Defaults to 70 kg"
                value={vehicleForm.capacity_kg}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    capacity_kg: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowVehicleModal(false)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createVehicleMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {createVehicleMutation.isPending ? 'Registering...' : 'Register Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Driver-Vehicle Pairing Modal */}
      <Modal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        title="Pair Driver & Vehicle"
        subtitle="The backend validates availability and prevents duplicate active assignments."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!assignmentForm.driver_id || !assignmentForm.vehicle_id) return;
            assignVehicleMutation.mutate({
              driver_id: assignmentForm.driver_id,
              vehicle_id: assignmentForm.vehicle_id,
              notes: assignmentForm.notes?.trim() || null,
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="mb-1 block font-semibold text-charcoal-700">
              Available active driver
            </label>
            <select
              required
              value={assignmentForm.driver_id || ''}
              onChange={(event) =>
                setAssignmentForm({ ...assignmentForm, driver_id: Number(event.target.value) })
              }
              className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2 text-charcoal"
            >
              <option value="">Select driver...</option>
              {availableDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.employee_id} · Driver #{driver.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-charcoal-700">
              Available vehicle
            </label>
            <select
              required
              value={assignmentForm.vehicle_id || ''}
              onChange={(event) =>
                setAssignmentForm({ ...assignmentForm, vehicle_id: Number(event.target.value) })
              }
              className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2 text-charcoal"
            >
              <option value="">Select vehicle...</option>
              {availableVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration_number} · {vehicle.vehicle_type} · {formatWeight(vehicle.capacity_kg)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-charcoal-700">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={assignmentForm.notes ?? ''}
              onChange={(event) =>
                setAssignmentForm({ ...assignmentForm, notes: event.target.value })
              }
              className="w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2 text-charcoal"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-ivory-200 pt-4">
            <button
              type="button"
              onClick={() => setShowAssignmentModal(false)}
              className="rounded-lg border border-ivory-300 bg-white px-4 py-2 font-semibold text-charcoal-700 hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                assignVehicleMutation.isPending ||
                availableDrivers.length === 0 ||
                availableVehicles.length === 0
              }
              className="rounded-lg bg-periwinkle px-4 py-2 font-semibold text-charcoal-900 hover:bg-periwinkle-600 disabled:opacity-50"
            >
              {assignVehicleMutation.isPending ? 'Pairing...' : 'Confirm Pairing'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Route-to-Fleet Assignment Modal with Validation Checks */}
      <Modal
        isOpen={!!routeToPair}
        onClose={() => setRouteToPair(null)}
        title="Assign Driver & Vehicle to Route"
        subtitle={`Route ${routeToPair?.route_code} · ${routeToPair?.stops?.length || 0} stops`}
      >
        <div className="space-y-4 text-xs">
          {/* Route Summary */}
          <div className="p-3 bg-ivory-100 rounded-lg border border-ivory-300 flex items-center justify-between">
            <div>
              <span className="text-charcoal-500 font-medium">Estimated Load</span>
              <div className="font-bold text-charcoal-900">~{estimatedRouteLoad} kg</div>
            </div>
            <div>
              <span className="text-charcoal-500 font-medium">Distance & Time</span>
              <div className="font-bold text-charcoal-900">
                {formatDistance(routeToPair?.planned_distance_km)} · {formatDuration(routeToPair?.planned_duration_seconds)}
              </div>
            </div>
            <div>
              <span className="text-charcoal-500 font-medium">Execution Date</span>
              <div className="font-bold text-charcoal-900">{formatDate(routeToPair?.route_date)}</div>
            </div>
          </div>

          {/* Driver Selection */}
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Select Active Driver
            </label>
            <select
              required
              value={pairDriverId}
              onChange={(e) => setPairDriverId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="">Select available driver...</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.employee_id} (Driver #{d.id}) — Phone: {d.phone}
                </option>
              ))}
            </select>
            {isDriverLicenseExpired && (
              <div className="mt-1 text-rose-600 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Warning: Selected driver commercial license appears expired.</span>
              </div>
            )}
          </div>

          {/* Vehicle Selection */}
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Select Available Vehicle
            </label>
            <select
              required
              value={pairVehicleId}
              onChange={(e) => setPairVehicleId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="">Select available vehicle...</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration_number} · {v.vehicle_type} · Capacity: {formatWeight(v.capacity_kg)}
                </option>
              ))}
            </select>
            {isCapacityViolated && (
              <div className="mt-1 text-amber-700 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Capacity Warning: Selected vehicle payload is lower than estimated route load.</span>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Assignment Notes
            </label>
            <textarea
              placeholder="Driver instructions or special route requirements..."
              value={pairNotes}
              onChange={(e) => setPairNotes(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              rows={2}
            />
          </div>

          {!routeToPair?.approved_at && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Prerequisite Missing:</strong> This route is currently an unapproved draft. You must approve the route in the Route Optimizer before assigning a driver and vehicle.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setRouteToPair(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!routeToPair?.approved_at || !pairDriverId || !pairVehicleId}
              onClick={() => setConfirmPairRoute(true)}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-emerald-500 hover:bg-emerald-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              Proceed to Confirmation
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Step before Finalizing Assignment */}
      <ConfirmDialog
        isOpen={confirmPairRoute}
        onClose={() => setConfirmPairRoute(false)}
        onConfirm={handleConfirmRoutePair}
        title="Confirm Route & Fleet Assignment"
        description={`Assign route ${routeToPair?.route_code} to Driver #${pairDriverId} (${selectedDriverForPair?.employee_id}) and Vehicle #${pairVehicleId} (${selectedVehicleForPair?.registration_number})?`}
        confirmText="Confirm Assignment"
      />

      {/* Reassign Route Fleet Modal (Safe Recovery) */}
      <Modal
        isOpen={!!routeToReassign}
        onClose={() => setRouteToReassign(null)}
        title="Reassign Route Fleet"
        subtitle={`Route ${routeToReassign?.route_code} · Currently assigned to Driver #${routeToReassign?.driver_id} & Vehicle #${routeToReassign?.vehicle_id}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!routeToReassign || !reassignDriverId || !reassignVehicleId || !reassignReason.trim()) return;
            reassignRouteMutation.mutate({
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
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Pre-Dispatch Safe Recovery:</strong> Reassign the route to an alternate driver or vehicle before dispatch. An audit log entry will record this modification.
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
              placeholder="e.g. Driver called in sick; vehicle undergoing emergency maintenance..."
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
              disabled={reassignRouteMutation.isPending || !reassignDriverId || !reassignVehicleId || !reassignReason.trim()}
              className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {reassignRouteMutation.isPending ? 'Reassigning...' : 'Confirm Reassignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Unassign Route Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!routeToUnassign}
        onClose={() => setRouteToUnassign(null)}
        onConfirm={() => {
          if (routeToUnassign) unassignRouteMutation.mutate(routeToUnassign.id);
        }}
        title="Unassign Route Fleet"
        description={`Release driver and vehicle from Route ${routeToUnassign?.route_code}? The route will return to approved state and be available for re-pairing.`}
        confirmText="Unassign Fleet"
      />

      {/* Unassign Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!unassignDriver}
        onClose={() => setUnassignDriver(null)}
        onConfirm={() => {
          if (unassignDriver) unassignVehicleMutation.mutate(unassignDriver.driver_id);
        }}
        title="Unassign vehicle"
        description={
          unassignDriver
            ? `Unassign ${unassignDriver.vehicle.registration_number} from employee ${unassignDriver.driver.employee_id}? The vehicle will be returned to available status.`
            : ''
        }
        confirmText="Unassign vehicle"
      />

      {/* Edit Driver Modal */}
      <Modal
        isOpen={!!driverToEdit}
        onClose={() => setDriverToEdit(null)}
        title={`Edit Driver #${driverToEdit?.employee_id}`}
        subtitle={`Driver ID #${driverToEdit?.id}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (driverToEdit) {
              updateDriverMutation.mutate({
                id: driverToEdit.id,
                payload: {
                  status: driverEditForm.status,
                  phone: driverEditForm.phone.trim(),
                  license_number: driverEditForm.license_number.trim(),
                  license_expiry: driverEditForm.license_expiry || undefined,
                  is_available: driverEditForm.is_available,
                },
              });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Status</label>
              <select
                value={driverEditForm.status}
                onChange={(e) =>
                  setDriverEditForm({ ...driverEditForm, status: e.target.value as DriverStatus })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Contact Phone</label>
              <input
                type="text"
                required
                value={driverEditForm.phone}
                onChange={(e) => setDriverEditForm({ ...driverEditForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">License Number</label>
              <input
                type="text"
                required
                value={driverEditForm.license_number}
                onChange={(e) =>
                  setDriverEditForm({ ...driverEditForm, license_number: e.target.value })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">License Expiry</label>
              <input
                type="date"
                value={driverEditForm.license_expiry}
                onChange={(e) =>
                  setDriverEditForm({ ...driverEditForm, license_expiry: e.target.value })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_driver_available"
              checked={driverEditForm.is_available}
              onChange={(e) =>
                setDriverEditForm({ ...driverEditForm, is_available: e.target.checked })
              }
              className="rounded border-ivory-300 text-charcoal-900 focus:ring-periwinkle"
            />
            <label htmlFor="is_driver_available" className="text-charcoal-700 font-medium">
              Driver is currently available for dispatch assignment
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setDriverToEdit(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateDriverMutation.isPending}
              className="px-4 py-2 font-semibold text-white bg-charcoal-900 hover:bg-charcoal-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {updateDriverMutation.isPending ? 'Saving...' : 'Update Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Driver Dialog */}
      <ConfirmDialog
        isOpen={!!driverToDelete}
        onClose={() => setDriverToDelete(null)}
        onConfirm={() => {
          if (driverToDelete) deleteDriverMutation.mutate(driverToDelete.id);
        }}
        title="Remove Driver"
        description={
          driverToDelete
            ? `Remove driver ${driverToDelete.employee_id} (ID #${driverToDelete.id}) from the fleet? If active assignments or historical routes exist, driver will be safely set to Inactive.`
            : ''
        }
        confirmText="Remove Driver"
      />

      {/* Edit Vehicle Modal */}
      <Modal
        isOpen={!!vehicleToEdit}
        onClose={() => setVehicleToEdit(null)}
        title={`Edit Vehicle ${vehicleToEdit?.registration_number}`}
        subtitle={`Vehicle ID #${vehicleToEdit?.id}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (vehicleToEdit) {
              updateVehicleMutation.mutate({
                id: vehicleToEdit.id,
                payload: {
                  status: vehicleEditForm.status,
                  vehicle_type: vehicleEditForm.vehicle_type,
                  capacity_kg: Number(vehicleEditForm.capacity_kg),
                },
              });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Status</label>
              <select
                value={vehicleEditForm.status}
                onChange={(e) =>
                  setVehicleEditForm({ ...vehicleEditForm, status: e.target.value as VehicleStatus })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Vehicle Type</label>
              <select
                value={vehicleEditForm.vehicle_type}
                onChange={(e) =>
                  setVehicleEditForm({ ...vehicleEditForm, vehicle_type: e.target.value as VehicleType })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="BIKE">BIKE</option>
                <option value="THREE_WHEELER">THREE_WHEELER</option>
                <option value="VAN">VAN</option>
                <option value="TRUCK">TRUCK</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Capacity (kg) *</label>
            <input
              type="number"
              required
              min="1"
              step="0.1"
              value={vehicleEditForm.capacity_kg}
              onChange={(e) =>
                setVehicleEditForm({ ...vehicleEditForm, capacity_kg: Number(e.target.value) })
              }
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setVehicleToEdit(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateVehicleMutation.isPending}
              className="px-4 py-2 font-semibold text-white bg-charcoal-900 hover:bg-charcoal-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {updateVehicleMutation.isPending ? 'Saving...' : 'Update Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Vehicle Dialog */}
      <ConfirmDialog
        isOpen={!!vehicleToDelete}
        onClose={() => setVehicleToDelete(null)}
        onConfirm={() => {
          if (vehicleToDelete) deleteVehicleMutation.mutate(vehicleToDelete.id);
        }}
        title="Remove Vehicle"
        description={
          vehicleToDelete
            ? `Remove vehicle ${vehicleToDelete.registration_number} (ID #${vehicleToDelete.id}) from the fleet? If active route assignments exist, vehicle status will be safely updated to Inactive.`
            : ''
        }
        confirmText="Remove Vehicle"
      />
    </div>
  );
};

export default Fleet;
