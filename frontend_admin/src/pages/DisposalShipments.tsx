import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { facilitiesApi, warehousesApi } from '../api/operations';
import {
  DisposalShipmentResponse,
  DisposalShipmentCreate,
  DisposalShipmentUpdate,
  DisposalShipmentStatus,
  FacilityResponse,
  WarehouseIntakeResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDateTime, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  Flame,
  Truck,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  Send,
  Building2,
  FileText,
  Boxes,
  Clock,
  ExternalLink,
  ShieldCheck,
  Scale,
  Edit,
  Trash2,
} from 'lucide-react';

const statusOptions: Array<DisposalShipmentStatus | 'ALL'> = [
  'ALL',
  'CREATED',
  'IN_TRANSIT',
  'RECEIVED',
  'DISCREPANCY',
  'CANCELLED',
];

export const DisposalShipments: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<DisposalShipmentStatus | 'ALL'>('ALL');
  const [selectedShipment, setSelectedShipment] = useState<DisposalShipmentResponse | null>(null);

  // Edit / Delete Modal State
  const [shipmentToEdit, setShipmentToEdit] = useState<DisposalShipmentResponse | null>(null);
  const [shipmentToDelete, setShipmentToDelete] = useState<DisposalShipmentResponse | null>(null);

  // Create Shipment Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | ''>('');
  const [selectedFacilityId, setSelectedFacilityId] = useState<number | ''>('');
  const [consignmentNotes, setConsignmentNotes] = useState<string>('');

  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Queries
  const { data: facilities = [] } = useQuery({
    queryKey: ['adminFacilities'],
    queryFn: () => facilitiesApi.list(),
  });

  const { data: intakes = [] } = useQuery({
    queryKey: ['adminWarehouseIntakesEligible'],
    queryFn: () => warehousesApi.listIntakes(),
  });

  const {
    data: shipments = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['adminDisposalShipments'],
    queryFn: () => facilitiesApi.listShipments(),
  });

  // Filtered shipments
  const filteredShipments = shipments.filter((s) => {
    if (statusFilter === 'ALL') return true;
    return s.status === statusFilter;
  });

  // Selected intake details for modal
  const activeModalIntake = intakes.find((i) => i.id === selectedIntakeId);

  // Mutations
  const updateShipmentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DisposalShipmentUpdate }) =>
      facilitiesApi.updateShipment(id, payload),
    onSuccess: (shipment) => {
      queryClient.invalidateQueries({ queryKey: ['adminDisposalShipments'] });
      setAlert({
        type: 'success',
        message: `Consignment ${shipment.shipment_code} updated successfully.`,
      });
      setShipmentToEdit(null);
      if (selectedShipment?.id === shipment.id) setSelectedShipment(shipment);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const deleteShipmentMutation = useMutation({
    mutationFn: (id: string) => facilitiesApi.deleteShipment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDisposalShipments'] });
      setAlert({
        type: 'success',
        message: 'Consignment deleted successfully.',
      });
      setShipmentToDelete(null);
      if (selectedShipment?.id === shipmentToDelete?.id) setSelectedShipment(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const createShipmentMutation = useMutation({
    mutationFn: (payload: DisposalShipmentCreate) => facilitiesApi.createShipment(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminDisposalShipments'] });
      setAlert({
        type: 'success',
        message: `Consignment shipment ${data.shipment_code || data.id} created successfully.`,
      });
      setIsCreateModalOpen(false);
      resetCreateForm();
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: (shipmentId: string) => facilitiesApi.dispatchShipment(shipmentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminDisposalShipments'] });
      setAlert({
        type: 'success',
        message: `Shipment ${data.shipment_code || data.id} dispatched to CBMWTF facility. Status: IN_TRANSIT.`,
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const resetCreateForm = () => {
    setSelectedIntakeId('');
    setSelectedFacilityId('');
    setConsignmentNotes('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntakeId || !selectedFacilityId) {
      setAlert({ type: 'error', message: 'Please select both an intake and a destination facility.' });
      return;
    }

    if (!activeModalIntake || !activeModalIntake.items || activeModalIntake.items.length === 0) {
      setAlert({
        type: 'error',
        message: 'The selected intake has no classified waste items. Please classify it first.',
      });
      return;
    }

    createShipmentMutation.mutate({
      intake_id: Number(selectedIntakeId),
      facility_id: Number(selectedFacilityId),
      items: activeModalIntake.items.map((it) => ({
        warehouse_intake_item_id: it.id,
        expected_weight_kg: Number(it.received_weight_kg || it.expected_weight_kg),
      })),
      notes: consignmentNotes || undefined,
    });
  };

  // KPIs
  const totalShipmentsCount = shipments.length;
  const inTransitCount = shipments.filter(
    (s) => s.status === 'IN_TRANSIT'
  ).length;
  const completedCount = shipments.filter(
    (s) => s.status === 'RECEIVED'
  ).length;
  const totalWeightDispatched = shipments.reduce(
    (acc, s) => acc + (Number(s.expected_weight_kg) || 0),
    0
  );

  // Columns
  const columns: Column<DisposalShipmentResponse>[] = [
    {
      key: 'shipment_code',
      header: 'Consignment Code',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-xs text-blue-600 block">
            {row.shipment_code || `SHP-${row.id.toString().slice(0, 8)}`}
          </span>
          <span className="text-[11px] text-slate-500">Intake #{row.intake_id}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'facility',
      header: 'CBMWTF Facility',
      render: (row) => {
        const fac = facilities.find((f) => f.id === row.facility_id);
        return (
          <div>
            <span className="text-xs font-semibold text-slate-800 block">
              {fac ? fac.legal_name : `Facility #${row.facility_id}`}
            </span>
            {fac && <span className="text-[10px] text-slate-500">{fac.facility_code}</span>}
          </div>
        );
      },
    },
    {
      key: 'total_weight',
      header: 'Consignment Weight',
      render: (row) => (
        <span className="text-xs font-bold text-slate-900">
          {formatWeight(row.expected_weight_kg)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'dispatched_at',
      header: 'Dispatched At',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.dispatched_at ? formatDateTime(row.dispatched_at) : 'Not dispatched'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'CREATED' && (
            <button
              onClick={() => dispatchMutation.mutate(row.id.toString())}
              disabled={dispatchMutation.isPending}
              className="px-2.5 py-1 text-[11px] font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1"
            >
              <Send className="w-3 h-3" />
              <span>Dispatch</span>
            </button>
          )}

          <button
            onClick={() => setShipmentToEdit(row)}
            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
            title="Edit Consignment"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShipmentToDelete(row)}
            className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50"
            title="Delete Consignment"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedShipment(row)}
            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-amber-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              CBMWTF Consignments &amp; Disposal Shipments
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch verified biomedical waste consignments from warehouse intakes to certified Common Biomedical Waste Treatment Facilities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create CBMWTF Consignment</span>
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {alert && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : alert.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
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
          <button onClick={() => setAlert(null)} className="text-slate-400 hover:text-slate-600 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Total Consignments</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{totalShipmentsCount}</span>
            <Boxes className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">In-Transit to Treatment</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-600">{inTransitCount}</span>
            <Truck className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Processed &amp; Certified</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-emerald-600">{completedCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Total Dispatched Mass</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{totalWeightDispatched.toFixed(1)} kg</span>
            <Scale className="w-5 h-5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* 3. Status Filters */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
        {statusOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => setStatusFilter(opt)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
              statusFilter === opt
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {opt === 'ALL' ? 'All Consignments' : opt}
          </button>
        ))}
      </div>

      {/* 4. Shipments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredShipments}
          isLoading={isLoading}
          onRowClick={(item) => setSelectedShipment(item)}
          emptyTitle="No disposal consignments found"
          emptyDescription="No disposal consignments match the selected criteria."
        />
      </div>

      {/* 5. Create Shipment Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => {
            setIsCreateModalOpen(false);
            resetCreateForm();
          }}
          title="Create CBMWTF Consignment Shipment"
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Source Warehouse Intake *
              </label>
              <select
                required
                value={selectedIntakeId}
                onChange={(e) => setSelectedIntakeId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose verified warehouse intake…</option>
                {intakes
                  .filter((i) => i.status === 'RECEIVED' || i.status === 'PENDING')
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.intake_code} — {formatWeight(i.received_weight_kg || i.expected_weight_kg)} (Route #{i.route_id})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Destination CBMWTF Treatment Facility *
              </label>
              <select
                required
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose authorized facility…</option>
                {facilities
                  .filter((f) => f.active)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.legal_name} ({f.facility_code}) — {f.city}
                    </option>
                  ))}
              </select>
            </div>

            {/* Waste items preview */}
            {activeModalIntake && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Intake Waste Streams Included
                </span>
                {activeModalIntake.items && activeModalIntake.items.length > 0 ? (
                  <div className="space-y-1">
                    {activeModalIntake.items.map((it) => (
                      <div key={it.id} className="text-xs flex justify-between text-slate-600">
                        <span>
                          {it.bin_color} ({it.waste_type})
                        </span>
                        <span className="font-mono font-bold">
                          {formatWeight(it.received_weight_kg || it.expected_weight_kg)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">
                    No classified items in this intake. Please classify bins first.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Consignment Manifest Notes &amp; Vehicle Seal Number
              </label>
              <textarea
                rows={2}
                value={consignmentNotes}
                onChange={(e) => setConsignmentNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Seal #SEAL-9821, CBMWTF vehicle registration KA-01-XX-0000..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetCreateForm();
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createShipmentMutation.isPending || !selectedIntakeId || !selectedFacilityId}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {createShipmentMutation.isPending ? 'Creating…' : 'Create Consignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Shipment Detail Drawer */}
      <DetailDrawer
        isOpen={Boolean(selectedShipment)}
        onClose={() => setSelectedShipment(null)}
        title={selectedShipment ? `Consignment: ${selectedShipment.shipment_code || selectedShipment.id}` : ''}
        subtitle="CBMWTF Chain of Custody Record"
      >
        {selectedShipment && (
          <div className="space-y-6 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Consignment Status</span>
                <StatusBadge status={selectedShipment.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source Warehouse Intake:</span>
                <span className="font-semibold text-slate-800">Intake #{selectedShipment.intake_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Facility:</span>
                <span className="font-semibold text-slate-800">Facility #{selectedShipment.facility_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Consignment Weight:</span>
                <span className="font-bold text-emerald-700">
                  {formatWeight(selectedShipment.expected_weight_kg)}
                </span>
              </div>
              {selectedShipment.notes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5 font-semibold">Manifest Notes:</span>
                  <p className="text-slate-700">{selectedShipment.notes}</p>
                </div>
              )}
            </div>

            {/* Consignment Items */}
            <div>
              <h3 className="font-bold text-slate-900 mb-2">Consignment Items</h3>
              {selectedShipment.items && selectedShipment.items.length > 0 ? (
                <div className="space-y-2">
                  {selectedShipment.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 block">Item #{it.id}</span>
                        <span className="text-[11px] text-slate-500">Intake Item #{it.warehouse_intake_item_id}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatWeight(it.expected_weight_kg)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">No specific consignment items listed.</p>
              )}
            </div>

            {/* Timestamps */}
            <div className="pt-4 border-t border-slate-200 space-y-1.5 text-slate-500">
              {selectedShipment.dispatched_at && (
                <div className="flex justify-between">
                  <span>Dispatched At:</span>
                  <span>{formatDateTime(selectedShipment.dispatched_at)}</span>
                </div>
              )}
              {selectedShipment.received_at && (
                <div className="flex justify-between">
                  <span>Received at Facility:</span>
                  <span>{formatDateTime(selectedShipment.received_at)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Edit Consignment Modal */}
      {shipmentToEdit && (
        <EditShipmentModal
          shipment={shipmentToEdit}
          facilities={facilities}
          onClose={() => setShipmentToEdit(null)}
          onSubmit={(payload) =>
            updateShipmentMutation.mutate({ id: shipmentToEdit.public_id, payload })
          }
          isSubmitting={updateShipmentMutation.isPending}
        />
      )}

      {/* Delete Consignment Modal */}
      {shipmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              Delete CBMWTF Consignment
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete consignment{' '}
              <strong className="text-slate-900">{shipmentToDelete.shipment_code}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShipmentToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteShipmentMutation.mutate(shipmentToDelete.public_id)}
                disabled={deleteShipmentMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deleteShipmentMutation.isPending ? 'Deleting...' : 'Delete Consignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Subcomponent: Edit Shipment Modal
// ==========================================
interface EditShipmentModalProps {
  shipment: DisposalShipmentResponse;
  facilities: FacilityResponse[];
  onClose: () => void;
  onSubmit: (payload: DisposalShipmentUpdate) => void;
  isSubmitting: boolean;
}

const EditShipmentModal: React.FC<EditShipmentModalProps> = ({
  shipment,
  facilities,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [status, setStatus] = useState<DisposalShipmentStatus>(shipment.status);
  const [facilityId, setFacilityId] = useState<number>(shipment.facility_id);
  const [receivedWeight, setReceivedWeight] = useState(shipment.received_weight_kg || '');
  const [discrepancyReason, setDiscrepancyReason] = useState(shipment.discrepancy_reason || '');
  const [notes, setNotes] = useState(shipment.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      status,
      facility_id: facilityId,
      received_weight_kg: receivedWeight ? parseFloat(receivedWeight.toString()) : null,
      discrepancy_reason: discrepancyReason.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Consignment Status & Weights"
      subtitle={`Consignment ${shipment.shipment_code}`}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DisposalShipmentStatus)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="CREATED">CREATED</option>
              <option value="IN_TRANSIT">IN_TRANSIT</option>
              <option value="RECEIVED">RECEIVED</option>
              <option value="DISCREPANCY">DISCREPANCY</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Destination CBMWTF</label>
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.legal_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Actual Weight Received (kg)</label>
          <input
            type="number"
            step="any"
            value={receivedWeight}
            onChange={(e) => setReceivedWeight(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Discrepancy Reason (if any)</label>
          <input
            type="text"
            placeholder="e.g. Broken tare weight seal, 2kg moisture evaporation"
            value={discrepancyReason}
            onChange={(e) => setDiscrepancyReason(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
          />
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Consignment Manifest Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Update Consignment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default DisposalShipments;
