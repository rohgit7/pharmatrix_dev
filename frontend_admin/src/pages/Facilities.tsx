import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi } from '../api/operations';
import {
  FacilityResponse,
  FacilityCreate,
  FacilityUpdate,
  DisposalShipmentCreate,
  DisposalShipmentResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { formatDate, formatDateTime, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { Factory, Plus, Send, Eye, CheckCircle2, AlertCircle, Trash2, Edit2 } from 'lucide-react';

type FacilityFormState = Omit<FacilityCreate, 'user_id' | 'latitude' | 'longitude'> & {
  user_id: number | '';
  latitude: number | '';
  longitude: number | '';
};

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export const Facilities: React.FC = () => {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<FacilityResponse | null>(null);
  const [editFacility, setEditFacility] = useState<FacilityResponse | null>(null);
  const [editForm, setEditForm] = useState<FacilityUpdate>({});

  // Register Facility Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<FacilityFormState>({
    user_id: '',
    facility_code: '',
    legal_name: '',
    phone: '',
    email: '',
    license_number: '',
    license_expiry: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    latitude: '',
    longitude: '',
  });

  // Create Shipment Modal
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [shipmentFacilityId, setShipmentFacilityId] = useState<number | ''>('');
  const [shipmentIntakeId, setShipmentIntakeId] = useState<number | ''>('');
  const [shipmentItems, setShipmentItems] = useState<
    { warehouse_intake_item_id: number | ''; expected_weight_kg: number | '' }[]
  >([{ warehouse_intake_item_id: '', expected_weight_kg: '' }]);
  const [shipmentNotes, setShipmentNotes] = useState('');
  const [createdShipment, setCreatedShipment] = useState<DisposalShipmentResponse | null>(null);

  // Dispatch Action
  const [dispatchShipmentId, setDispatchShipmentId] = useState('');

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['adminFacilities', includeInactive],
    queryFn: () => facilitiesApi.list(includeInactive),
  });

  const createFacilityMutation = useMutation({
    mutationFn: facilitiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminFacilities'] });
      setAlert({ type: 'success', message: 'Treatment facility registered successfully.' });
      setShowCreateModal(false);
      setCreateForm({
        user_id: '',
        facility_code: '',
        legal_name: '',
        phone: '',
        email: '',
        license_number: '',
        license_expiry: '',
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

  const updateFacilityMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: FacilityUpdate }) =>
      facilitiesApi.update(id, payload),
    onSuccess: (facility) => {
      queryClient.invalidateQueries({ queryKey: ['adminFacilities'] });
      setSelectedFacility(facility);
      setEditFacility(null);
      setAlert({ type: 'success', message: `Facility ${facility.facility_code} updated successfully.` });
    },
    onError: (err) => setAlert({ type: 'error', message: getErrorMessage(err) }),
  });

  const createShipmentMutation = useMutation({
    mutationFn: (payload: DisposalShipmentCreate) => facilitiesApi.createShipment(payload),
    onSuccess: (res) => {
      setAlert({
        type: 'success',
        message: `Disposal shipment ${res.shipment_code} created. Public ID: ${res.public_id}`,
      });
      setShowShipmentModal(false);
      setDispatchShipmentId(String(res.id));
      setCreatedShipment(res);
      setShipmentFacilityId('');
      setShipmentIntakeId('');
      setShipmentItems([{ warehouse_intake_item_id: '', expected_weight_kg: '' }]);
      setShipmentNotes('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const dispatchShipmentMutation = useMutation({
    mutationFn: (id: string) => facilitiesApi.dispatchShipment(id),
    onSuccess: (res) => {
      setAlert({
        type: 'success',
        message: `Shipment ${res.shipment_code} successfully dispatched in transit to facility.`,
      });
      setCreatedShipment(res);
      setDispatchShipmentId('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const handleCreateShipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !shipmentFacilityId ||
      !shipmentIntakeId ||
      shipmentItems.length === 0 ||
      shipmentItems.some(
        (item) =>
          item.warehouse_intake_item_id === '' ||
          item.expected_weight_kg === '' ||
          item.expected_weight_kg <= 0
      )
    ) return;
    createShipmentMutation.mutate({
      facility_id: Number(shipmentFacilityId),
      intake_id: Number(shipmentIntakeId),
      items: shipmentItems.map((item) => ({
        warehouse_intake_item_id: Number(item.warehouse_intake_item_id),
        expected_weight_kg: Number(item.expected_weight_kg),
      })),
      notes: shipmentNotes || undefined,
    });
  };

  const columns: Column<FacilityResponse>[] = [
    {
      key: 'facility_code',
      header: 'Facility Code',
      sortable: true,
      render: (f) => <span className="font-mono font-semibold text-charcoal-900">{f.facility_code}</span>,
    },
    {
      key: 'legal_name',
      header: 'Facility Name',
      sortable: true,
      render: (f) => <span className="font-semibold text-charcoal-900">{f.legal_name}</span>,
    },
    {
      key: 'license_number',
      header: 'CPCB / State License',
      sortable: true,
      render: (f) => <span className="font-mono text-xs text-charcoal-700">{f.license_number}</span>,
    },
    {
      key: 'city',
      header: 'Location',
      sortable: true,
      render: (f) => (
        <span>
          {f.city}, {f.state}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      sortable: true,
      render: (f) => <StatusBadge status={f.active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (f) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setSelectedFacility(f)}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Inspect Facility"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setEditFacility(f);
              setEditForm({
                facility_code: f.facility_code,
                legal_name: f.legal_name,
                phone: f.phone,
                email: f.email,
                license_number: f.license_number,
                license_expiry: f.license_expiry ? toLocalDateTimeInput(f.license_expiry) : null,
                address: f.address,
                city: f.city,
                state: f.state,
                postal_code: f.postal_code,
                latitude: f.latitude,
                longitude: f.longitude,
                active: f.active,
              });
            }}
            className="p-1.5 rounded-lg text-periwinkle-700 hover:bg-periwinkle-50 transition-colors"
            title="Edit Facility"
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
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">Authorized Disposal Facilities</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Licensed biomedical waste treatment plants, custody transfers, and disposal shipments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShipmentModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Send className="w-4 h-4 text-periwinkle" />
            <span>Create Disposal Shipment</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Register Facility</span>
          </button>
        </div>
      </div>

      {/* Dispatch Action Banner if a shipment ID is ready */}
      {createdShipment && (
        <div className="p-4 bg-periwinkle-50 border border-periwinkle-200 rounded-xl space-y-3 text-xs">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="font-bold text-periwinkle-900 block">
                Shipment {createdShipment.shipment_code} · {createdShipment.status}
              </span>
              <span className="font-mono text-periwinkle-700">
                ID #{createdShipment.id} · Public ID {createdShipment.public_id}
              </span>
            </div>
            {dispatchShipmentId && (
              <button
                onClick={() => dispatchShipmentMutation.mutate(dispatchShipmentId)}
                disabled={dispatchShipmentMutation.isPending}
                className="px-4 py-2 bg-periwinkle hover:bg-periwinkle-600 text-charcoal-900 font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {dispatchShipmentMutation.isPending ? 'Dispatching...' : 'Dispatch Shipment to Plant'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-charcoal-700">
            <span>Intake ID: #{createdShipment.intake_id}</span>
            <span>Facility ID: #{createdShipment.facility_id}</span>
            <span>Expected: {formatWeight(createdShipment.expected_weight_kg)}</span>
            <span>Received: {formatWeight(createdShipment.received_weight_kg)}</span>
            <span>Dispatched: {formatDateTime(createdShipment.dispatched_at)}</span>
            <span>Received at: {formatDateTime(createdShipment.received_at)}</span>
            <span>Discrepancy: {createdShipment.discrepancy_reason || '—'}</span>
            <span>Notes: {createdShipment.notes || '—'}</span>
          </div>
          {createdShipment.items.map((item) => (
            <div key={item.id} className="border-t border-periwinkle-200 pt-2 text-charcoal-700">
              Item #{item.id} · Intake item #{item.warehouse_intake_item_id} · Expected{' '}
              {formatWeight(item.expected_weight_kg)} · Received {formatWeight(item.received_weight_kg)} ·{' '}
              {item.notes || 'No item notes'}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={facilities}
        isLoading={isLoading}
        searchPlaceholder="Filter facilities..."
        searchFilter={(row, q) =>
          row.legal_name.toLowerCase().includes(q) ||
          row.facility_code.toLowerCase().includes(q) ||
          row.license_number.toLowerCase().includes(q) ||
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
        onRowClick={(f) => setSelectedFacility(f)}
      />

      {/* Inspection Drawer */}
      <DetailDrawer
        isOpen={!!selectedFacility}
        onClose={() => setSelectedFacility(null)}
        title={selectedFacility?.legal_name || 'Treatment Facility'}
        subtitle={`Code: ${selectedFacility?.facility_code}`}
      >
        {selectedFacility && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-ivory-100 rounded-lg flex items-center justify-between">
              <span className="text-charcoal-500 font-medium">Compliance License</span>
              <span className="font-mono font-bold text-charcoal-900">{selectedFacility.license_number}</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Facility / User ID</span>
                <span className="font-mono text-charcoal-900">
                  #{selectedFacility.id} / #{selectedFacility.user_id}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Email</span>
                <span className="text-charcoal-900">{selectedFacility.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Phone</span>
                <span className="text-charcoal-900">{selectedFacility.phone}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">License Expiry</span>
                <span className="text-charcoal-900">{formatDate(selectedFacility.license_expiry)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Address</span>
                <span className="text-charcoal-900 text-right">{selectedFacility.address}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Location</span>
                <span className="text-charcoal-900">
                  {selectedFacility.city}, {selectedFacility.state} - {selectedFacility.postal_code}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Coordinates</span>
                <span className="font-mono text-charcoal-900">
                  {selectedFacility.latitude}, {selectedFacility.longitude}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Registration Date</span>
                <span className="text-charcoal-800">{formatDate(selectedFacility.created_at)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-200">
                <span className="text-charcoal-500">Last Updated</span>
                <span className="text-charcoal-800">{formatDate(selectedFacility.updated_at)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-charcoal-500">Status</span>
                <StatusBadge status={selectedFacility.active ? 'ACTIVE' : 'INACTIVE'} />
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setEditFacility(selectedFacility);
                  setEditForm({
                    facility_code: selectedFacility.facility_code,
                    legal_name: selectedFacility.legal_name,
                    phone: selectedFacility.phone,
                    email: selectedFacility.email,
                    license_number: selectedFacility.license_number,
                    license_expiry: selectedFacility.license_expiry
                      ? toLocalDateTimeInput(selectedFacility.license_expiry)
                      : null,
                    address: selectedFacility.address,
                    city: selectedFacility.city,
                    state: selectedFacility.state,
                    postal_code: selectedFacility.postal_code,
                    latitude: selectedFacility.latitude,
                    longitude: selectedFacility.longitude,
                    active: selectedFacility.active,
                  });
                }}
                className="px-4 py-2 rounded-lg bg-periwinkle text-charcoal-900 font-semibold hover:bg-periwinkle-600"
              >
                Edit Facility
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Register Facility Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Register Treatment Facility"
        subtitle="Authorize an external disposal / incineration plant"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              createForm.user_id === '' ||
              createForm.latitude === '' ||
              createForm.longitude === ''
            ) return;
            createFacilityMutation.mutate({
              ...createForm,
              user_id: Number(createForm.user_id),
              latitude: Number(createForm.latitude),
              longitude: Number(createForm.longitude),
              license_expiry: createForm.license_expiry
                ? new Date(createForm.license_expiry).toISOString()
                : null,
            });
          }}
          className="space-y-3.5 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Existing Facility User ID
            </label>
            <input
              required
              type="number"
              min="1"
              step="1"
              value={createForm.user_id}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  user_id: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Facility Code
              </label>
              <input
                required
                type="text"
                minLength={1}
                maxLength={50}
                placeholder="FAC-BLR-01"
                value={createForm.facility_code}
                onChange={(e) => setCreateForm({ ...createForm, facility_code: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                License Number
              </label>
              <input
                required
                type="text"
                maxLength={100}
                placeholder="CPCB/BMW/2026/09"
                value={createForm.license_number}
                onChange={(e) => setCreateForm({ ...createForm, license_number: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Facility Legal Name
            </label>
            <input
              required
              type="text"
              maxLength={200}
              placeholder="EcoClean Waste Solutions Pvt Ltd"
              value={createForm.legal_name}
              onChange={(e) => setCreateForm({ ...createForm, legal_name: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Phone
              </label>
              <input
                required
                type="text"
                maxLength={20}
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Email
              </label>
              <input
                required
                type="email"
                maxLength={255}
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                License Expiry (Optional)
              </label>
              <input
                type="datetime-local"
                value={createForm.license_expiry || ''}
                onChange={(e) => setCreateForm({ ...createForm, license_expiry: e.target.value || null })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Postal Code
              </label>
              <input
                required
                type="text"
                maxLength={20}
                value={createForm.postal_code}
                onChange={(e) => setCreateForm({ ...createForm, postal_code: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
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
              maxLength={500}
              value={createForm.address}
              onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">City</label>
              <input
                required
                type="text"
                maxLength={100}
                value={createForm.city}
                onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">State</label>
              <input
                required
                type="text"
                maxLength={100}
                value={createForm.state}
                onChange={(e) => setCreateForm({ ...createForm, state: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">Latitude</label>
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
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">Longitude</label>
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
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
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
              disabled={createFacilityMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {createFacilityMutation.isPending ? 'Registering...' : 'Register Plant'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!editFacility}
        onClose={() => setEditFacility(null)}
        title={`Edit Facility ${editFacility?.facility_code ?? ''}`}
        subtitle="Update facility fields and active status"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editFacility) return;
            updateFacilityMutation.mutate({
              id: editFacility.id,
              payload: {
                ...editForm,
                license_expiry: editForm.license_expiry
                  ? new Date(editForm.license_expiry).toISOString()
                  : null,
              },
            });
          }}
          className="space-y-3.5 text-xs"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="font-semibold text-charcoal-700">
              Facility Code
              <input required minLength={1} maxLength={50} value={editForm.facility_code || ''} onChange={(e) => setEditForm({ ...editForm, facility_code: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
            <label className="font-semibold text-charcoal-700">
              Legal Name
              <input required minLength={1} maxLength={200} value={editForm.legal_name || ''} onChange={(e) => setEditForm({ ...editForm, legal_name: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
            <label className="font-semibold text-charcoal-700">
              Phone
              <input required minLength={1} maxLength={20} value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
            <label className="font-semibold text-charcoal-700">
              Email
              <input required type="email" minLength={1} maxLength={255} value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
            <label className="font-semibold text-charcoal-700">
              License Number
              <input required minLength={1} maxLength={100} value={editForm.license_number || ''} onChange={(e) => setEditForm({ ...editForm, license_number: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
            <label className="font-semibold text-charcoal-700">
              License Expiry (Optional)
              <input type="datetime-local" value={editForm.license_expiry || ''} onChange={(e) => setEditForm({ ...editForm, license_expiry: e.target.value || null })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
          </div>
          <label className="block font-semibold text-charcoal-700">
            Address
            <input required minLength={1} maxLength={500} value={editForm.address || ''} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="font-semibold text-charcoal-700">
              City
              <input required minLength={1} maxLength={100} value={editForm.city || ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
            <label className="font-semibold text-charcoal-700">
              State
              <input required minLength={1} maxLength={100} value={editForm.state || ''} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
            <label className="font-semibold text-charcoal-700">
              Postal Code
              <input required minLength={1} maxLength={20} value={editForm.postal_code || ''} onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="font-semibold text-charcoal-700">
              Latitude
              <input required type="number" min="-90" max="90" step="0.0000001" value={editForm.latitude ?? ''} onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
            <label className="font-semibold text-charcoal-700">
              Longitude
              <input required type="number" min="-180" max="180" step="0.0000001" value={editForm.longitude ?? ''} onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value === '' ? undefined : Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-ivory-300 bg-ivory-50 px-3 py-2" />
            </label>
          </div>
          <label className="flex items-center gap-2 font-semibold text-charcoal-700">
            <input type="checkbox" checked={editForm.active ?? false} onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })} />
            Facility Active
          </label>
          <div className="flex justify-end gap-2 border-t border-ivory-200 pt-4">
            <button type="button" onClick={() => setEditFacility(null)} className="rounded-lg border border-ivory-300 bg-white px-4 py-2 font-semibold text-charcoal-700">
              Cancel
            </button>
            <button type="submit" disabled={updateFacilityMutation.isPending} className="rounded-lg bg-periwinkle px-4 py-2 font-semibold text-charcoal-900 disabled:opacity-50">
              {updateFacilityMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Disposal Shipment Modal */}
      <Modal
        isOpen={showShipmentModal}
        onClose={() => setShowShipmentModal(false)}
        title="Create Disposal Consignment Shipment"
        subtitle="Transfer consolidated warehouse intake to licensed disposal facility"
      >
        <form onSubmit={handleCreateShipment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Destination Facility
            </label>
            <select
              required
              value={shipmentFacilityId}
              onChange={(e) => setShipmentFacilityId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            >
              <option value="">Select receiving facility...</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.legal_name} ({f.facility_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Source Intake ID
            </label>
            <input
              required
              type="number"
              min="1"
              step="1"
              value={shipmentIntakeId}
              onChange={(e) => setShipmentIntakeId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          {shipmentItems.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                  Intake Item ID
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={item.warehouse_intake_item_id}
                  onChange={(e) =>
                    setShipmentItems((items) =>
                      items.map((current, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...current,
                              warehouse_intake_item_id: e.target.value === '' ? '' : Number(e.target.value),
                            }
                          : current
                      )
                    )
                  }
                  className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
                />
              </div>
              <div>
                <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                  Expected Weight (kg)
                </label>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.expected_weight_kg}
                  onChange={(e) =>
                    setShipmentItems((items) =>
                      items.map((current, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...current,
                              expected_weight_kg: e.target.value === '' ? '' : Number(e.target.value),
                            }
                          : current
                      )
                    )
                  }
                  className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
                />
              </div>
              <button
                type="button"
                disabled={shipmentItems.length === 1}
                onClick={() => setShipmentItems((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                className="p-2 text-rose-700 disabled:opacity-30"
                aria-label="Remove shipment item"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setShipmentItems((items) => [
                ...items,
                { warehouse_intake_item_id: '', expected_weight_kg: '' },
              ])
            }
            className="inline-flex items-center gap-1 text-periwinkle-800 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" /> Add intake item
          </button>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Manifest Notes
            </label>
            <textarea
              placeholder="Handling instructions, CDSCO manifest reference..."
              value={shipmentNotes}
              onChange={(e) => setShipmentNotes(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setShowShipmentModal(false)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createShipmentMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {createShipmentMutation.isPending ? 'Creating...' : 'Create Shipment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
