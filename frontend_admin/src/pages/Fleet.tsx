import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fleetApi } from '../api/operations';
import {
  DriverOnboardRequest,
  DriverResponse,
  VehicleCreate,
  VehicleResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { formatDate, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { Users, Truck, Plus, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

type VehicleFormState = Omit<VehicleCreate, 'vehicle_type' | 'capacity_kg'> & {
  vehicle_type: VehicleCreate['vehicle_type'] | '';
  capacity_kg: number | '';
};

export const Fleet: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'drivers' | 'vehicles'>('drivers');
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const { data: drivers = [], isLoading: isDriversLoading } = useQuery({
    queryKey: ['adminDrivers'],
    queryFn: () => fleetApi.listDrivers(0, 100),
  });

  const { data: vehicles = [], isLoading: isVehiclesLoading } = useQuery({
    queryKey: ['adminVehicles'],
    queryFn: () => fleetApi.listVehicles(0, 100),
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

  const driverColumns: Column<DriverResponse>[] = [
    {
      key: 'id',
      header: 'Driver ID',
      sortable: true,
      render: (d) => <span className="font-mono">#{d.id}</span>,
    },
    {
      key: 'user_id',
      header: 'User ID',
      render: (d) => <span className="font-mono">#{d.user_id}</span>,
    },
    {
      key: 'employee_id',
      header: 'Employee ID',
      sortable: true,
      render: (d) => <span className="font-mono font-semibold text-charcoal-900">{d.employee_id}</span>,
    },
    {
      key: 'phone',
      header: 'Contact Phone',
      render: (d) => <span className="font-mono text-xs">{d.phone}</span>,
    },
    {
      key: 'license_number',
      header: 'Commercial License',
      render: (d) => (
        <div>
          <span className="font-mono text-xs text-charcoal-900 block">{d.license_number}</span>
          <span className="text-[11px] text-charcoal-400 block">Exp: {formatDate(d.license_expiry)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'is_available',
      header: 'Availability',
      render: (d) => (
        <span className={`text-xs font-semibold ${d.is_available ? 'text-emerald-700' : 'text-charcoal-400'}`}>
          {d.is_available ? 'Available' : 'Dispatched / Off-Duty'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Onboarded',
      render: (d) => <span>{formatDate(d.created_at)}</span>,
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      render: (d) => <span>{formatDate(d.updated_at)}</span>,
    },
  ];

  const vehicleColumns: Column<VehicleResponse>[] = [
    {
      key: 'id',
      header: 'Vehicle ID',
      render: (v) => <span className="font-mono">#{v.id}</span>,
    },
    {
      key: 'registration_number',
      header: 'Plate / Reg Number',
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
      render: (v) => <span className="font-semibold text-charcoal-900">{formatWeight(v.capacity_kg)}</span>,
    },
    {
      key: 'status',
      header: 'Operational Status',
      sortable: true,
      render: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: 'created_at',
      header: 'Registered',
      render: (v) => <span>{formatDate(v.created_at)}</span>,
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      render: (v) => <span>{formatDate(v.updated_at)}</span>,
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
          <button onClick={() => setAlert(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">Fleet & Driver Management</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Manage certified collection drivers, transport vehicles, and onboarding invitations.
          </p>
        </div>
        <div>
          {activeTab === 'drivers' ? (
            <button
              onClick={() => setShowDriverModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Onboard Driver</span>
            </button>
          ) : (
            <button
              onClick={() => setShowVehicleModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Register Vehicle</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-ivory-300">
        <button
          onClick={() => setActiveTab('drivers')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'drivers'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <Users className="w-4 h-4 text-periwinkle-700" />
          <span>Collection Drivers ({drivers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition-colors border-b-2 ${
            activeTab === 'vehicles'
              ? 'border-periwinkle text-charcoal-900'
              : 'border-transparent text-charcoal-500 hover:text-charcoal-700'
          }`}
        >
          <Truck className="w-4 h-4 text-periwinkle-700" />
          <span>Fleet Vehicles ({vehicles.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'drivers' ? (
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
              maxLength={150}
              placeholder="Driver Full Name"
              value={driverForm.name}
              onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Employee ID
            </label>
            <input
              required
              type="text"
              maxLength={50}
              value={driverForm.employee_id}
              onChange={(e) => setDriverForm({ ...driverForm, employee_id: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                required
                type="email"
                placeholder="driver@pharmatrix.local"
                value={driverForm.email}
                onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <input
                required
                type="text"
                maxLength={20}
                placeholder="+91 9999999999"
                value={driverForm.phone}
                onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Commercial License No.
              </label>
              <input
                required
                type="text"
                maxLength={100}
                placeholder="KA-01-2024-001928"
                value={driverForm.license_number}
                onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                License Expiry Date (Optional)
              </label>
              <input
                type="date"
                value={driverForm.license_expiry ?? ''}
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
              {onboardDriverMutation.isPending ? 'Provisioning...' : 'Complete Onboarding'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Vehicle Registration Modal */}
      <Modal
        isOpen={showVehicleModal}
        onClose={() => setShowVehicleModal(false)}
        title="Register Fleet Vehicle"
        subtitle="Add a collection vehicle to the operational fleet"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (vehicleForm.vehicle_type === '') return;
            createVehicleMutation.mutate({
              registration_number: vehicleForm.registration_number,
              vehicle_type: vehicleForm.vehicle_type,
              ...(vehicleForm.capacity_kg === ''
                ? {}
                : { capacity_kg: vehicleForm.capacity_kg }),
            });
          }}
          className="space-y-3.5 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Vehicle Registration Number
            </label>
            <input
              required
              type="text"
              maxLength={50}
              placeholder="KA-04-AB-1234"
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
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    vehicle_type: e.target.value as VehicleCreate['vehicle_type'],
                  })
                }
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
                Payload Capacity (kg, optional; configured default applies when omitted)
              </label>
              <input
                type="number"
                min="0.01"
                max="99999999.99"
                step="0.01"
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
    </div>
  );
};
