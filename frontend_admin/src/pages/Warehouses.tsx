import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { warehousesApi } from '../api/operations';
import {
  WarehouseResponse,
  WarehouseCreate,
  WarehouseUpdate,
  WarehouseIntakeResponse,
  WarehouseIntakeItemRequest,
  WarehouseReceiveRequest,
  WasteBinColor,
  WasteType,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { formatWeight, formatDate, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  Warehouse as WarehouseIcon,
  Plus,
  Eye,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  Scale,
  Edit2,
  Layers,
} from 'lucide-react';

type WarehouseCreateForm = Omit<WarehouseCreate, 'latitude' | 'longitude'> & {
  latitude: number | '';
  longitude: number | '';
};

export const Warehouses: React.FC = () => {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseResponse | null>(null);

  // Create Warehouse Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<WarehouseCreateForm>({
    code: '',
    name: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    latitude: '',
    longitude: '',
  });

  // Edit Warehouse Modal
  const [editWarehouse, setEditWarehouse] = useState<WarehouseResponse | null>(null);
  const [editForm, setEditForm] = useState<WarehouseUpdate>({});

  // Intake Lookup & Receipt State
  const [intakeIdInput, setIntakeIdInput] = useState('');
  const [inspectedIntake, setInspectedIntake] = useState<WarehouseIntakeResponse | null>(null);
  const [isIntakeLoading, setIsIntakeLoading] = useState(false);

  // Receive Intake Modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveWeight, setReceiveWeight] = useState<number | ''>('');
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [intakeNotes, setIntakeNotes] = useState('');

  // Classify Intake Modal
  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [classifyBinColor, setClassifyBinColor] = useState<WasteBinColor | ''>('');
  const [classifyWasteType, setClassifyWasteType] = useState<WasteType | ''>('');
  const [classifyExpectedWeight, setClassifyExpectedWeight] = useState<number | ''>('');
  const [classifyReceivedWeight, setClassifyReceivedWeight] = useState<number | ''>('');
  const [classifyNotes, setClassifyNotes] = useState('');

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['adminWarehouses', includeInactive],
    queryFn: () => warehousesApi.list(includeInactive),
  });

  const createMutation = useMutation({
    mutationFn: warehousesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWarehouses'] });
      setAlert({ type: 'success', message: 'Warehouse registered successfully.' });
      setShowCreateModal(false);
      setCreateForm({
        code: '',
        name: '',
        address: '',
        city: '',
        state: '',
        postal_code: '',
        latitude: '',
        longitude: '',
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: WarehouseUpdate }) =>
      warehousesApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWarehouses'] });
      setAlert({ type: 'success', message: `Warehouse ${data.name} updated successfully.` });
      setEditWarehouse(null);
      if (selectedWarehouse && selectedWarehouse.id === data.id) {
        setSelectedWarehouse(data);
      }
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const receiveIntakeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: WarehouseReceiveRequest }) =>
      warehousesApi.receiveIntake(id, payload),
    onSuccess: (data) => {
      setAlert({ type: 'success', message: `Intake ${data.intake_code} marked as RECEIVED.` });
      setInspectedIntake(data);
      setShowReceiveModal(false);
      setReceiveWeight('');
      setDiscrepancyReason('');
      setIntakeNotes('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const classifyIntakeMutation = useMutation({
    mutationFn: ({ id, items }: { id: number; items: WarehouseIntakeItemRequest[] }) =>
      warehousesApi.classifyIntake(id, { items }),
    onSuccess: (data) => {
      setAlert({ type: 'success', message: `Intake ${data.intake_code} classification recorded.` });
      setInspectedIntake(data);
      setShowClassifyModal(false);
      setClassifyNotes('');
      setClassifyBinColor('');
      setClassifyWasteType('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const handleLookupIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeIdInput.trim()) return;
    setIsIntakeLoading(true);
    try {
      const intake = await warehousesApi.getIntake(Number(intakeIdInput.trim()));
      setInspectedIntake(intake);
      setReceiveWeight(intake.expected_weight_kg);
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setIsIntakeLoading(false);
    }
  };

  const openEditModal = (w: WarehouseResponse) => {
    setEditWarehouse(w);
    setEditForm({
      code: w.code,
      name: w.name,
      address: w.address,
      city: w.city,
      state: w.state,
      postal_code: w.postal_code,
      latitude: w.latitude,
      longitude: w.longitude,
      active: w.active,
    });
  };

  const columns: Column<WarehouseResponse>[] = [
    {
      key: 'code',
      header: 'Warehouse Code',
      sortable: true,
      render: (w) => <span className="font-mono font-semibold text-charcoal-900">{w.code}</span>,
    },
    {
      key: 'name',
      header: 'Hub Name',
      sortable: true,
      render: (w) => <span className="font-semibold text-charcoal-900">{w.name}</span>,
    },
    {
      key: 'city',
      header: 'Location',
      sortable: true,
      render: (w) => (
        <span>
          {w.city}, {w.state}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      sortable: true,
      render: (w) => <StatusBadge status={w.active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'created_at',
      header: 'Registered',
      sortable: true,
      render: (w) => <span>{formatDate(w.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (w) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedWarehouse(w)}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Inspect"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEditModal(w)}
            className="p-1.5 rounded-lg text-periwinkle-700 hover:text-periwinkle-900 hover:bg-periwinkle-50 transition-colors"
            title="Edit Warehouse"
          >
            <Edit2 className="w-4 h-4" />
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
          <button onClick={() => setAlert(null)} className="text-xs font-bold opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">Warehouse Network & Intake</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Consolidation hubs, custodial intake reconciliation, and waste category classification.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Register Warehouse</span>
        </button>
      </div>

      {/* Intake Lookup Banner */}
      <div className="bg-white p-5 rounded-xl border border-ivory-300 shadow-subtle">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-charcoal-900 font-bold text-sm">
              <PackageCheck className="w-4 h-4 text-periwinkle-700" />
              <span>Direct Warehouse Intake Inspection & Receipt</span>
            </div>
            <p className="text-xs text-charcoal-500 mt-0.5">
              Enter an intake identifier to reconcile received driver weights or classify waste streams.
            </p>
          </div>
          <form onSubmit={handleLookupIntake} className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Intake ID (e.g. 1)"
              value={intakeIdInput}
              onChange={(e) => setIntakeIdInput(e.target.value)}
              className="px-3 py-1.5 text-xs bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:outline-none focus:ring-2 focus:ring-periwinkle w-36"
            />
            <button
              type="submit"
              disabled={isIntakeLoading}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-charcoal-800 text-white hover:bg-charcoal-700 transition-colors disabled:opacity-50"
            >
              {isIntakeLoading ? 'Loading...' : 'Inspect Intake'}
            </button>
          </form>
        </div>

        {inspectedIntake && (
          <div className="mt-4 p-4 rounded-xl bg-ivory-50 border border-ivory-300 text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-charcoal-900 text-sm">
                Intake Code: {inspectedIntake.intake_code}
              </span>
              <div className="flex items-center gap-2">
                <StatusBadge status={inspectedIntake.status} />
                {inspectedIntake.status === 'PENDING' && (
                  <button
                    onClick={() => {
                      setReceiveWeight(inspectedIntake.expected_weight_kg);
                      setShowReceiveModal(true);
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-semibold hover:bg-emerald-200 transition-colors"
                  >
                    Record Receipt
                  </button>
                )}
                <button
                  onClick={() => setShowClassifyModal(true)}
                  className="px-2.5 py-1 rounded bg-periwinkle-100 text-periwinkle-800 font-semibold hover:bg-periwinkle-200 transition-colors"
                >
                  Classify Items
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-charcoal-500 block">Expected Weight</span>
                <span className="font-semibold text-charcoal-900">
                  {formatWeight(inspectedIntake.expected_weight_kg)}
                </span>
              </div>
              <div>
                <span className="text-charcoal-500 block">Received Weight</span>
                <span className="font-semibold text-charcoal-900">
                  {formatWeight(inspectedIntake.received_weight_kg)}
                </span>
              </div>
              <div>
                <span className="text-charcoal-500 block">Route ID</span>
                <span className="font-mono font-semibold text-charcoal-900">
                  RT-#{inspectedIntake.route_id}
                </span>
              </div>
              <div>
                <span className="text-charcoal-500 block">Discrepancy Reason</span>
                <span className="text-charcoal-800">{inspectedIntake.discrepancy_reason || 'None'}</span>
              </div>
              <div>
                <span className="text-charcoal-500 block">Received At</span>
                <span className="text-charcoal-800">{formatDateTime(inspectedIntake.received_at)}</span>
              </div>
              <div>
                <span className="text-charcoal-500 block">Warehouse / Driver / Vehicle</span>
                <span className="font-mono text-charcoal-800">
                  #{inspectedIntake.warehouse_id} / #{inspectedIntake.driver_id} / #{inspectedIntake.vehicle_id}
                </span>
              </div>
              <div>
                <span className="text-charcoal-500 block">Created / Updated</span>
                <span className="text-charcoal-800">
                  {formatDateTime(inspectedIntake.created_at)} / {formatDateTime(inspectedIntake.updated_at)}
                </span>
              </div>
            </div>
            {inspectedIntake.notes && <p className="text-charcoal-700">Notes: {inspectedIntake.notes}</p>}

            {inspectedIntake.items && inspectedIntake.items.length > 0 && (
              <div className="mt-2 pt-2 border-t border-ivory-200">
                <span className="font-semibold text-charcoal-700 block mb-1">
                  Classified Waste Streams ({inspectedIntake.items.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {inspectedIntake.items.map((item) => (
                    <span key={item.id} className="px-2 py-0.5 rounded bg-white border border-ivory-300 text-[11px]">
                      Item #{item.id}: {item.bin_color} | {item.waste_type}
                      {' '}(Expected: {formatWeight(item.expected_weight_kg)}, received:{' '}
                      {formatWeight(item.received_weight_kg)})
                      {item.notes ? ` — ${item.notes}` : ''}
                      {' '}(Recorded {formatDateTime(item.created_at)})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={warehouses}
        isLoading={isLoading}
        searchPlaceholder="Filter warehouses..."
        searchFilter={(row, q) =>
          row.code.toLowerCase().includes(q) ||
          row.name.toLowerCase().includes(q) ||
          row.city.toLowerCase().includes(q)
        }
        filterSlot={
          <label className="flex items-center gap-2 text-xs font-medium text-charcoal-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-ivory-300 text-periwinkle focus:ring-periwinkle"
            />
            <span>Include Inactive</span>
          </label>
        }
        onRowClick={(w) => setSelectedWarehouse(w)}
      />

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedWarehouse}
        onClose={() => setSelectedWarehouse(null)}
        title={selectedWarehouse?.name || 'Warehouse Hub'}
        subtitle={`Code: ${selectedWarehouse?.code}`}
      >
        {selectedWarehouse && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-ivory-100 rounded-lg flex items-center justify-between">
              <span className="text-charcoal-500">Operational Status</span>
              <StatusBadge status={selectedWarehouse.active ? 'ACTIVE' : 'INACTIVE'} />
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Address</span>
                <span className="font-medium text-charcoal-900 text-right">{selectedWarehouse.address}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">City / State</span>
                <span className="font-medium text-charcoal-900">
                  {selectedWarehouse.city}, {selectedWarehouse.state} - {selectedWarehouse.postal_code}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">GPS Coordinates</span>
                <span className="font-mono text-charcoal-900">
                  {selectedWarehouse.latitude}, {selectedWarehouse.longitude}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Registered At</span>
                <span className="text-charcoal-800">{formatDate(selectedWarehouse.created_at)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-charcoal-500">Last Updated</span>
                <span className="text-charcoal-800">{formatDateTime(selectedWarehouse.updated_at)}</span>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => openEditModal(selectedWarehouse)}
                className="px-4 py-2 rounded-lg bg-periwinkle text-charcoal-900 font-semibold hover:bg-periwinkle-600 transition-colors"
              >
                Edit Warehouse Properties
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Register Consolidation Warehouse"
        subtitle="Provision a certified regional storage hub"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (createForm.latitude === '' || createForm.longitude === '') return;
            createMutation.mutate({
              ...createForm,
              latitude: Number(createForm.latitude),
              longitude: Number(createForm.longitude),
            });
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Warehouse Code
              </label>
              <input
                required
                type="text"
                minLength={1}
                maxLength={50}
                placeholder="WH-BLR-01"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Hub Name
              </label>
              <input
                required
                type="text"
                minLength={1}
                maxLength={150}
                placeholder="Bengaluru Central Hub"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Address
            </label>
            <input
              required
              type="text"
              minLength={1}
              maxLength={500}
              placeholder="Plot 42, Peenya Industrial Area"
              value={createForm.address}
              onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                City
              </label>
              <input
                required
                type="text"
                minLength={1}
                maxLength={100}
                placeholder="Bengaluru"
                value={createForm.city}
                onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                State
              </label>
              <input
                required
                type="text"
                minLength={1}
                maxLength={100}
                placeholder="Karnataka"
                value={createForm.state}
                onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Postal Code
              </label>
              <input
                required
                type="text"
                minLength={1}
                maxLength={20}
                placeholder="560058"
                value={createForm.postal_code}
                onChange={(e) => setCreateForm({ ...createForm, postal_code: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Latitude
              </label>
              <input
                required
                type="number"
                min="-90"
                max="90"
                step="0.0000001"
                value={createForm.latitude}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    latitude: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Longitude
              </label>
              <input
                required
                type="number"
                min="-180"
                max="180"
                step="0.0000001"
                value={createForm.longitude}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    longitude: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              />
            </div>
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
              disabled={createMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Registering...' : 'Register Hub'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Warehouse Modal */}
      <Modal
        isOpen={!!editWarehouse}
        onClose={() => setEditWarehouse(null)}
        title={`Edit Warehouse (${editWarehouse?.code})`}
        subtitle="Update hub properties and active status"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editWarehouse) {
              updateMutation.mutate({ id: editWarehouse.id, payload: editForm });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Warehouse Code
            </label>
            <input
              type="text"
              maxLength={50}
              value={editForm.code || ''}
              onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Hub Name
            </label>
            <input
              type="text"
              maxLength={150}
              value={editForm.name || ''}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Address
            </label>
            <input
              type="text"
              maxLength={500}
              value={editForm.address || ''}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                City
              </label>
              <input
                type="text"
                maxLength={100}
                value={editForm.city || ''}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                State
              </label>
              <input
                type="text"
                maxLength={100}
                value={editForm.state || ''}
                onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Postal Code
              </label>
              <input
                type="text"
                maxLength={20}
                value={editForm.postal_code || ''}
                onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Latitude
              </label>
              <input
                type="number"
                min="-90"
                max="90"
                step="0.0000001"
                value={editForm.latitude ?? ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    latitude: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Longitude
              </label>
              <input
                type="number"
                min="-180"
                max="180"
                step="0.0000001"
                value={editForm.longitude ?? ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    longitude: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-charcoal-800">
              <input
                type="checkbox"
                checked={editForm.active ?? true}
                onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                className="rounded border-ivory-300 text-periwinkle focus:ring-periwinkle"
              />
              <span>Warehouse Hub Active</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setEditWarehouse(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Intake Modal */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        title={`Receive Custodial Intake (${inspectedIntake?.intake_code})`}
        subtitle="Weigh and verify driver load transfer"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inspectedIntake && receiveWeight) {
              receiveIntakeMutation.mutate({
                id: inspectedIntake.id,
                payload: {
                  received_weight_kg: Number(receiveWeight),
                  discrepancy_reason: discrepancyReason.trim() || undefined,
                  notes: intakeNotes.trim() || undefined,
                },
              });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Actual Received Weight (kg)
            </label>
            <input
              required
              type="number"
              min="0"
              max="100000"
              step="any"
              value={receiveWeight}
              onChange={(e) => setReceiveWeight(Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
            />
            <p className="mt-1 text-charcoal-500">
              Expected from driver route: {formatWeight(inspectedIntake?.expected_weight_kg)}
            </p>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Discrepancy Reason (if variance exceeds tolerance)
            </label>
            <input
              type="text"
              maxLength={1000}
              placeholder="e.g. Broken container, moisture weight..."
              value={discrepancyReason}
              onChange={(e) => setDiscrepancyReason(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Warehouse Notes
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              placeholder="Intake officer comments..."
              value={intakeNotes}
              onChange={(e) => setIntakeNotes(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowReceiveModal(false)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={receiveIntakeMutation.isPending}
              className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {receiveIntakeMutation.isPending ? 'Recording...' : 'Confirm Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Classify Items Modal */}
      <Modal
        isOpen={showClassifyModal}
        onClose={() => setShowClassifyModal(false)}
        title={`Classify Intake Waste Streams (${inspectedIntake?.intake_code})`}
        subtitle="Categorize biomedical waste categories & bin segregation"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              inspectedIntake &&
              classifyBinColor &&
              classifyWasteType &&
              classifyExpectedWeight &&
              classifyReceivedWeight
            ) {
              classifyIntakeMutation.mutate({
                id: inspectedIntake.id,
                items: [
                  {
                    bin_color: classifyBinColor,
                    waste_type: classifyWasteType,
                    expected_weight_kg: Number(classifyExpectedWeight),
                    received_weight_kg: Number(classifyReceivedWeight),
                    notes: classifyNotes.trim() || undefined,
                  },
                ],
              });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Waste Bin Color
              </label>
              <select
                required
                value={classifyBinColor}
                onChange={(e) => setClassifyBinColor(e.target.value as WasteBinColor | '')}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="">Select bin color...</option>
                <option value="YELLOW">YELLOW (Incinerable)</option>
                <option value="RED">RED (Contaminated Recyclable)</option>
                <option value="WHITE">WHITE (Sharps Translucent)</option>
                <option value="BLUE">BLUE (Glassware & Implants)</option>
                <option value="BROWN">BROWN (Cytotoxic / Discarded)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Waste Category Type
              </label>
              <select
                required
                value={classifyWasteType}
                onChange={(e) => setClassifyWasteType(e.target.value as WasteType | '')}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="">Select waste type...</option>
                <option value="EXPIRED_DISCARDED_MEDICINE">EXPIRED_DISCARDED_MEDICINE</option>
                <option value="HUMAN_ANATOMICAL">HUMAN_ANATOMICAL</option>
                <option value="ANIMAL_ANATOMICAL">ANIMAL_ANATOMICAL</option>
                <option value="SOILED">SOILED</option>
                <option value="CHEMICAL">CHEMICAL</option>
                <option value="CHEMICAL_LIQUID">CHEMICAL_LIQUID</option>
                <option value="CONTAMINATED_RECYCLABLE">CONTAMINATED_RECYCLABLE</option>
                <option value="SHARPS">SHARPS</option>
                <option value="GLASSWARE">GLASSWARE</option>
                <option value="METALLIC_IMPLANT">METALLIC_IMPLANT</option>
                <option value="HAZARDOUS_OTHER">HAZARDOUS_OTHER</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Expected Weight (kg)
              </label>
              <input
                required
                type="number"
                min="0"
                max="100000"
                step="any"
                placeholder="e.g. 15.0"
                value={classifyExpectedWeight}
                onChange={(e) => setClassifyExpectedWeight(Number(e.target.value))}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Received Weight (kg)
              </label>
              <input
                required
                type="number"
                min="0"
                max="100000"
                step="any"
                placeholder="e.g. 15.0"
                value={classifyReceivedWeight}
                onChange={(e) => setClassifyReceivedWeight(Number(e.target.value))}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Item Notes (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={classifyNotes}
              onChange={(e) => setClassifyNotes(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowClassifyModal(false)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={classifyIntakeMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {classifyIntakeMutation.isPending ? 'Classifying...' : 'Save Classification'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
