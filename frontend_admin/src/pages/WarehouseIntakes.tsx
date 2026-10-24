import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { warehousesApi, fleetApi, routesApi } from '../api/operations';
import {
  WarehouseIntakeResponse,
  WarehouseIntakeCreate,
  WarehouseIntakeUpdate,
  WarehouseIntakeStatus,
  WarehouseReceiveRequest,
  WarehouseClassifyRequest,
  WarehouseIntakeItemRequest,
  WasteBinColor,
  WasteType,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDateTime, formatWeight } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  Scale,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  FileCheck2,
  Boxes,
  HelpCircle,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Warehouse,
  Edit,
  X,
} from 'lucide-react';

const statusOptions: Array<WarehouseIntakeStatus | 'ALL'> = [
  'ALL',
  'PENDING',
  'RECEIVED',
  'DISCREPANCY',
  'REJECTED',
];

const BIN_COLORS: WasteBinColor[] = ['YELLOW', 'RED', 'WHITE', 'BLUE'];
const WASTE_TYPES: WasteType[] = [
  'EXPIRED_DISCARDED_MEDICINE',
  'CONTAMINATED_RECYCLABLE',
  'SHARPS',
  'GLASSWARE',
  'SOILED',
];

export const WarehouseIntakes: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<WarehouseIntakeStatus | 'ALL'>('ALL');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
  const [selectedIntake, setSelectedIntake] = useState<WarehouseIntakeResponse | null>(null);

  // Weigh & Receive Modal State
  const [receiveModalIntake, setReceiveModalIntake] = useState<WarehouseIntakeResponse | null>(null);
  const [grossWeight, setGrossWeight] = useState<number | ''>('');
  const [tareWeight, setTareWeight] = useState<number | ''>('');
  const [discrepancyReason, setDiscrepancyReason] = useState<string>('');
  const [receiveNotes, setReceiveNotes] = useState<string>('');

  // Classify Modal State
  const [classifyModalIntake, setClassifyModalIntake] = useState<WarehouseIntakeResponse | null>(null);
  const [classifyItems, setClassifyItems] = useState<WarehouseIntakeItemRequest[]>([
    {
      bin_color: 'YELLOW',
      waste_type: 'SOILED',
      expected_weight_kg: 0,
      received_weight_kg: 0,
      notes: '',
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [intakeToEdit, setIntakeToEdit] = useState<WarehouseIntakeResponse | null>(null);
  const [intakeToDelete, setIntakeToDelete] = useState<WarehouseIntakeResponse | null>(null);

  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Queries
  const { data: warehouses = [] } = useQuery({
    queryKey: ['adminWarehouses'],
    queryFn: () => warehousesApi.list(),
  });

  const {
    data: intakes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['adminWarehouseIntakes', selectedWarehouseId, statusFilter],
    queryFn: () =>
      warehousesApi.listIntakes({
        warehouse_id: selectedWarehouseId ? Number(selectedWarehouseId) : undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
  });

  // Derived net weight
  const netReceivedWeight = useMemo(() => {
    if (grossWeight === '' || tareWeight === '') return 0;
    const net = Number(grossWeight) - Number(tareWeight);
    return Math.max(0, Number(net.toFixed(2)));
  }, [grossWeight, tareWeight]);

  // Derived variance vs expected driver weight
  const weightVariance = useMemo(() => {
    if (!receiveModalIntake || netReceivedWeight === 0) return null;
    const expected = Number(receiveModalIntake.expected_weight_kg);
    const diff = netReceivedWeight - expected;
    const pct = expected > 0 ? (diff / expected) * 100 : 0;
    return {
      diff: Number(diff.toFixed(2)),
      pct: Number(pct.toFixed(1)),
      isSignificant: Math.abs(pct) > 5.0,
    };
  }, [receiveModalIntake, netReceivedWeight]);

  // Mutations
  const receiveMutation = useMutation({
    mutationFn: ({ intakeId, payload }: { intakeId: number; payload: WarehouseReceiveRequest }) =>
      warehousesApi.receiveIntake(intakeId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWarehouseIntakes'] });
      setAlert({
        type: 'success',
        message: `Intake ${data.intake_code} verified and weighed at ${formatWeight(data.received_weight_kg)}.`,
      });
      setReceiveModalIntake(null);
      resetReceiveForm();
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const classifyMutation = useMutation({
    mutationFn: ({ intakeId, payload }: { intakeId: number; payload: WarehouseClassifyRequest }) =>
      warehousesApi.classifyIntake(intakeId, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWarehouseIntakes'] });
      setAlert({
        type: 'success',
        message: `Intake ${data.intake_code} classified into ${data.items.length} segregated bin stream(s).`,
      });
      setClassifyModalIntake(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const createIntakeMutation = useMutation({
    mutationFn: (payload: WarehouseIntakeCreate) => warehousesApi.createIntake(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWarehouseIntakes'] });
      setAlert({
        type: 'success',
        message: `Warehouse intake ${data.intake_code} manually created.`,
      });
      setShowCreateModal(false);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const updateIntakeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: WarehouseIntakeUpdate }) =>
      warehousesApi.updateIntake(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminWarehouseIntakes'] });
      setAlert({
        type: 'success',
        message: `Intake ${data.intake_code} updated.`,
      });
      setIntakeToEdit(null);
      if (selectedIntake?.id === data.id) setSelectedIntake(data);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const deleteIntakeMutation = useMutation({
    mutationFn: (id: number) => warehousesApi.deleteIntake(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminWarehouseIntakes'] });
      setAlert({
        type: 'success',
        message: 'Warehouse intake record deleted.',
      });
      setIntakeToDelete(null);
      if (selectedIntake?.id === intakeToDelete?.id) setSelectedIntake(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const resetReceiveForm = () => {
    setGrossWeight('');
    setTareWeight('');
    setDiscrepancyReason('');
    setReceiveNotes('');
  };

  const handleOpenReceive = (intake: WarehouseIntakeResponse) => {
    setReceiveModalIntake(intake);
    setGrossWeight(Number(intake.expected_weight_kg) || '');
    setTareWeight(0);
    setDiscrepancyReason(intake.discrepancy_reason || '');
    setReceiveNotes(intake.notes || '');
  };

  const handleOpenClassify = (intake: WarehouseIntakeResponse) => {
    setClassifyModalIntake(intake);
    if (intake.items && intake.items.length > 0) {
      setClassifyItems(
        intake.items.map((it) => ({
          bin_color: it.bin_color,
          waste_type: it.waste_type,
          expected_weight_kg: Number(it.expected_weight_kg),
          received_weight_kg: Number(it.received_weight_kg || it.expected_weight_kg),
          notes: it.notes || '',
        }))
      );
    } else {
      setClassifyItems([
        {
          bin_color: 'YELLOW',
          waste_type: 'SOILED',
          expected_weight_kg: Number(intake.received_weight_kg || intake.expected_weight_kg),
          received_weight_kg: Number(intake.received_weight_kg || intake.expected_weight_kg),
          notes: 'Primary intake load',
        },
      ]);
    }
  };

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalIntake) return;
    if (netReceivedWeight <= 0) {
      setAlert({ type: 'error', message: 'Net verified scale weight must be greater than 0 kg.' });
      return;
    }

    receiveMutation.mutate({
      intakeId: receiveModalIntake.id,
      payload: {
        received_weight_kg: netReceivedWeight,
        discrepancy_reason: discrepancyReason || undefined,
        notes: receiveNotes || undefined,
      },
    });
  };

  const handleClassifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!classifyModalIntake) return;
    classifyMutation.mutate({
      intakeId: classifyModalIntake.id,
      payload: { items: classifyItems },
    });
  };

  const addClassifyRow = () => {
    setClassifyItems((prev) => [
      ...prev,
      {
        bin_color: 'RED',
        waste_type: 'CONTAMINATED_RECYCLABLE',
        expected_weight_kg: 0,
        received_weight_kg: 0,
        notes: '',
      },
    ]);
  };

  const removeClassifyRow = (idx: number) => {
    setClassifyItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // KPI Calculations
  const totalIntakesCount = intakes.length;
  const pendingCount = intakes.filter((i) => i.status === 'PENDING').length;
  const totalVerifiedWeight = intakes.reduce(
    (acc, i) => acc + (Number(i.received_weight_kg) || 0),
    0
  );
  const discrepancyCount = intakes.filter(
    (i) => i.status === 'DISCREPANCY' || Boolean(i.discrepancy_reason)
  ).length;

  // Table Columns
  const columns: Column<WarehouseIntakeResponse>[] = [
    {
      key: 'intake_code',
      header: 'Intake Code',
      render: (row) => (
        <div>
          <span className="font-mono font-bold text-xs text-blue-600 block">{row.intake_code}</span>
          <span className="text-[11px] text-slate-500">Route #{row.route_id}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (row) => {
        const wh = warehouses.find((w) => w.id === row.warehouse_id);
        return (
          <span className="text-xs font-medium text-slate-800">
            {wh ? wh.name : `Hub #${row.warehouse_id}`}
          </span>
        );
      },
    },
    {
      key: 'expected_weight',
      header: 'Expected (Driver)',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700">
          {formatWeight(row.expected_weight_kg)}
        </span>
      ),
    },
    {
      key: 'received_weight',
      header: 'Verified Scale Weight',
      render: (row) => {
        if (!row.received_weight_kg) {
          return <span className="text-xs italic text-amber-600 font-medium">Pending Scale</span>;
        }
        return (
          <span className="text-xs font-bold text-emerald-700">
            {formatWeight(row.received_weight_kg)}
          </span>
        );
      },
    },
    {
      key: 'variance',
      header: 'Variance',
      render: (row) => {
        if (!row.received_weight_kg) return <span className="text-xs text-slate-400">—</span>;
        const diff = Number(row.received_weight_kg) - Number(row.expected_weight_kg);
        const isHigher = diff > 0;
        const isZero = Math.abs(diff) < 0.01;
        return (
          <span
            className={`text-xs font-semibold inline-flex items-center gap-0.5 ${
              isZero
                ? 'text-slate-500'
                : isHigher
                ? 'text-blue-600'
                : 'text-rose-600'
            }`}
          >
            {!isZero && (isHigher ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
            {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} kg
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      header: 'Intake Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.received_at ? formatDateTime(row.received_at) : formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {row.status === 'PENDING' && (
            <button
              onClick={() => handleOpenReceive(row)}
              className="px-2.5 py-1 text-[11px] font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-xs inline-flex items-center gap-1"
            >
              <Scale className="w-3 h-3" />
              <span>Weigh</span>
            </button>
          )}

          {(row.status === 'RECEIVED' || row.status === 'PENDING') && (
            <button
              onClick={() => handleOpenClassify(row)}
              className="px-2.5 py-1 text-[11px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-xs inline-flex items-center gap-1"
            >
              <Layers className="w-3 h-3 text-slate-500" />
              <span>Classify</span>
            </button>
          )}

          <button
            onClick={() => setIntakeToEdit(row)}
            className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
            title="Edit Intake"
          >
            <Edit className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIntakeToDelete(row)}
            className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50"
            title="Delete Intake"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedIntake(row)}
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
            <Warehouse className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Warehouse Intakes &amp; Verified Scale Verification
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official CDSCO verified gross and tare scale weighing. Verified scale weight is used for billing and facility consignment dispatch.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value === '' ? '' : Number(e.target.value))}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Intake Entry</span>
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
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Total Intakes</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{totalIntakesCount}</span>
            <Boxes className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Pending Scale Weighing</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-600">{pendingCount}</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Verified Scale Net</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-emerald-600">{totalVerifiedWeight.toFixed(1)} kg</span>
            <Scale className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Discrepancy Intakes</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-rose-600">{discrepancyCount}</span>
            <AlertCircle className="w-5 h-5 text-rose-400" />
          </div>
        </div>
      </div>

      {/* 3. Status Filter Tabs */}
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
            {opt === 'ALL' ? 'All Intakes' : opt}
          </button>
        ))}
      </div>

      {/* 4. Intakes Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={intakes}
          isLoading={isLoading}
          onRowClick={(item) => setSelectedIntake(item)}
          emptyTitle="No warehouse intakes found"
          emptyDescription="No warehouse intakes match the selected criteria."
        />
      </div>

      {/* 5. Weigh & Receive Modal */}
      {receiveModalIntake && (
        <Modal
          isOpen={true}
          onClose={() => {
            setReceiveModalIntake(null);
            resetReceiveForm();
          }}
          title={`Scale Verification — ${receiveModalIntake.intake_code}`}
        >
          <form onSubmit={handleReceiveSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Driver Reported Weight:</span>
                <span>{formatWeight(receiveModalIntake.expected_weight_kg)}</span>
              </div>
              <p className="text-[11px] text-blue-700">
                Place the delivery on the calibrated warehouse scale. Enter the Gross and Tare weight below to compute verified net weight.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Gross Scale Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.1"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 142.50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tare Container Weight (kg) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={tareWeight}
                  onChange={(e) => setTareWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. 5.20"
                />
              </div>
            </div>

            {/* Calculated Net Scale Weight */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Verified Net Scale Weight
                </span>
                <span className="text-xl font-extrabold text-slate-900">
                  {netReceivedWeight.toFixed(2)} kg
                </span>
              </div>

              {weightVariance && (
                <div className="text-right">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Driver Variance
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      weightVariance.isSignificant ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {weightVariance.diff > 0 ? `+${weightVariance.diff}` : weightVariance.diff} kg (
                    {weightVariance.pct > 0 ? `+${weightVariance.pct}` : weightVariance.pct}%)
                  </span>
                </div>
              )}
            </div>

            {weightVariance?.isSignificant && (
              <div>
                <label className="block text-xs font-semibold text-rose-700 mb-1">
                  Discrepancy Justification * (Variance exceeds 5%)
                </label>
                <input
                  type="text"
                  required
                  value={discrepancyReason}
                  onChange={(e) => setDiscrepancyReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-rose-300 bg-rose-50/50 rounded-lg text-slate-900 focus:ring-2 focus:ring-rose-500"
                  placeholder="Explain moisture loss, packaging tare mismatch, or driver scale variance..."
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Inspection &amp; Scale Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Scale ID, calibration certificate date, seal condition..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setReceiveModalIntake(null);
                  resetReceiveForm();
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={receiveMutation.isPending || netReceivedWeight <= 0}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {receiveMutation.isPending ? 'Verifying…' : 'Confirm Scale Weight & Receive'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Classify Bins Modal */}
      {classifyModalIntake && (
        <Modal
          isOpen={true}
          onClose={() => setClassifyModalIntake(null)}
          title={`Waste Classification — ${classifyModalIntake.intake_code}`}
        >
          <form onSubmit={handleClassifySubmit} className="space-y-4">
            <p className="text-xs text-slate-500">
              Segregate the intake into standard colored biomedical waste streams before CBMWTF consignment.
            </p>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {classifyItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Bin Stream #{idx + 1}</span>
                    {classifyItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeClassifyRow(idx)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Bin Color</label>
                      <select
                        value={item.bin_color}
                        onChange={(e) => {
                          const val = e.target.value as WasteBinColor;
                          setClassifyItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, bin_color: val } : row))
                          );
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      >
                        {BIN_COLORS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Waste Stream</label>
                      <select
                        value={item.waste_type}
                        onChange={(e) => {
                          const val = e.target.value as WasteType;
                          setClassifyItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, waste_type: val } : row))
                          );
                        }}
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      >
                        {WASTE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                        Verified Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={item.received_weight_kg || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setClassifyItems((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, received_weight_kg: val, expected_weight_kg: val } : row
                            )
                          );
                        }}
                        className="w-full px-2 py-1.5 text-xs font-bold border border-slate-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Notes</label>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setClassifyItems((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, notes: val } : row))
                          );
                        }}
                        placeholder="Batch / lot code..."
                        className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addClassifyRow}
              className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-slate-400 text-slate-600 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Waste Stream Bin</span>
            </button>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setClassifyModalIntake(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={classifyMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
              >
                {classifyMutation.isPending ? 'Saving…' : 'Save Classification'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 7. Intake Detail Drawer */}
      <DetailDrawer
        isOpen={Boolean(selectedIntake)}
        onClose={() => setSelectedIntake(null)}
        title={selectedIntake ? `Intake: ${selectedIntake.intake_code}` : ''}
        subtitle="CDSCO Biomedical Waste Intake Record"
      >
        {selectedIntake && (
          <div className="space-y-6 text-xs">
            {/* Status and Weights */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Intake Status</span>
                <StatusBadge status={selectedIntake.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Route Assignment:</span>
                <span className="font-semibold text-slate-800">Route #{selectedIntake.route_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expected Weight (Driver):</span>
                <span className="font-semibold text-slate-800">
                  {formatWeight(selectedIntake.expected_weight_kg)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Verified Scale Weight:</span>
                <span className="font-bold text-emerald-700">
                  {selectedIntake.received_weight_kg
                    ? formatWeight(selectedIntake.received_weight_kg)
                    : 'Pending verification'}
                </span>
              </div>
              {selectedIntake.discrepancy_reason && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5 font-semibold">Discrepancy Justification:</span>
                  <span className="text-rose-700 bg-rose-50 px-2 py-1 rounded block">
                    {selectedIntake.discrepancy_reason}
                  </span>
                </div>
              )}
            </div>

            {/* Waste Stream Items */}
            <div>
              <h3 className="font-bold text-slate-900 mb-2 flex items-center justify-between">
                <span>Segregated Bin Streams</span>
                <span className="text-[10px] font-semibold text-slate-500">
                  {selectedIntake.items?.length || 0} stream(s)
                </span>
              </h3>

              {selectedIntake.items && selectedIntake.items.length > 0 ? (
                <div className="space-y-2">
                  {selectedIntake.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{it.bin_color} BIN</span>
                          <span className="text-[10px] text-slate-500 uppercase">{it.waste_type}</span>
                        </div>
                        {it.notes && <p className="text-[11px] text-slate-500 mt-0.5">{it.notes}</p>}
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatWeight(it.received_weight_kg || it.expected_weight_kg)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">No bins classified yet.</p>
              )}
            </div>

            {/* Timestamps */}
            <div className="pt-4 border-t border-slate-200 space-y-1.5 text-slate-500">
              <div className="flex justify-between">
                <span>Created At:</span>
                <span>{formatDateTime(selectedIntake.created_at)}</span>
              </div>
              {selectedIntake.received_at && (
                <div className="flex justify-between">
                  <span>Scale Verified At:</span>
                  <span>{formatDateTime(selectedIntake.received_at)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Manual Intake Creation Modal */}
      {showCreateModal && (
        <CreateIntakeModal
          warehouses={warehouses}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(payload) => createIntakeMutation.mutate(payload)}
          isSubmitting={createIntakeMutation.isPending}
        />
      )}

      {/* Edit Intake Modal */}
      {intakeToEdit && (
        <EditIntakeModal
          intake={intakeToEdit}
          onClose={() => setIntakeToEdit(null)}
          onSubmit={(payload) =>
            updateIntakeMutation.mutate({ id: intakeToEdit.id, payload })
          }
          isSubmitting={updateIntakeMutation.isPending}
        />
      )}

      {/* Delete Intake Modal */}
      {intakeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              Delete Warehouse Intake
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete intake{' '}
              <strong className="text-slate-900">{intakeToDelete.intake_code}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIntakeToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteIntakeMutation.mutate(intakeToDelete.id)}
                disabled={deleteIntakeMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deleteIntakeMutation.isPending ? 'Deleting...' : 'Delete Intake'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Subcomponent: Create Intake Modal
// ==========================================
interface CreateIntakeModalProps {
  warehouses: any[];
  onClose: () => void;
  onSubmit: (payload: WarehouseIntakeCreate) => void;
  isSubmitting: boolean;
}

const CreateIntakeModal: React.FC<CreateIntakeModalProps> = ({
  warehouses,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [warehouseId, setWarehouseId] = useState<number | ''>(warehouses[0]?.id || '');
  const [routeId, setRouteId] = useState<number | ''>('');
  const [driverId, setDriverId] = useState<number | ''>('');
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [expectedWeight, setExpectedWeight] = useState('25');
  const [notes, setNotes] = useState('');

  const { data: drivers = [] } = useQuery({
    queryKey: ['admin-drivers-options'],
    queryFn: () => fleetApi.listDrivers(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['admin-vehicles-options'],
    queryFn: () => fleetApi.listVehicles(),
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['admin-routes-options'],
    queryFn: () => routesApi.list(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId || !routeId || !driverId || !vehicleId) return;

    onSubmit({
      warehouse_id: Number(warehouseId),
      route_id: Number(routeId),
      driver_id: Number(driverId),
      vehicle_id: Number(vehicleId),
      expected_weight_kg: parseFloat(expectedWeight) || 0,
      notes: notes.trim() || null,
      status: 'PENDING',
    });
  };

  return (
    <Modal isOpen onClose={onClose} title="Manual Warehouse Intake Record" subtitle="Override Entry">
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Receiving Warehouse *</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(Number(e.target.value))}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            required
          >
            <option value="">-- Choose Warehouse --</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.city})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Route *</label>
            <select
              value={routeId}
              onChange={(e) => setRouteId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              required
            >
              <option value="">-- Route --</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.route_code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Driver *</label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              required
            >
              <option value="">-- Driver --</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  ID #{d.employee_id} ({d.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Vehicle *</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              required
            >
              <option value="">-- Vehicle --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration_number}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Expected Driver Weight (kg) *</label>
          <input
            type="number"
            step="any"
            value={expectedWeight}
            onChange={(e) => setExpectedWeight(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
            required
          />
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Intake Notes</label>
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
            disabled={isSubmitting || !warehouseId || !routeId || !driverId || !vehicleId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50"
          >
            {isSubmitting ? 'Registering...' : 'Create Intake'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ==========================================
// Subcomponent: Edit Intake Modal
// ==========================================
interface EditIntakeModalProps {
  intake: WarehouseIntakeResponse;
  onClose: () => void;
  onSubmit: (payload: WarehouseIntakeUpdate) => void;
  isSubmitting: boolean;
}

const EditIntakeModal: React.FC<EditIntakeModalProps> = ({
  intake,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [status, setStatus] = useState<WarehouseIntakeStatus>(intake.status);
  const [receivedWeight, setReceivedWeight] = useState(intake.received_weight_kg || '');
  const [discrepancyReason, setDiscrepancyReason] = useState(intake.discrepancy_reason || '');
  const [notes, setNotes] = useState(intake.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      status,
      received_weight_kg: receivedWeight ? parseFloat(receivedWeight.toString()) : null,
      discrepancy_reason: discrepancyReason.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Intake Status & Weights"
      subtitle={`Intake ${intake.intake_code}`}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
        <div>
          <label className="block text-slate-700 font-semibold mb-1">Intake Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as WarehouseIntakeStatus)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
          >
            <option value="PENDING">PENDING</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="DISCREPANCY">DISCREPANCY</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Scale Verified Weight (kg)</label>
          <input
            type="number"
            step="any"
            value={receivedWeight}
            onChange={(e) => setReceivedWeight(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Discrepancy Justification</label>
          <textarea
            rows={2}
            value={discrepancyReason}
            onChange={(e) => setDiscrepancyReason(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
          />
        </div>

        <div>
          <label className="block text-slate-700 font-semibold mb-1">Notes</label>
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
            {isSubmitting ? 'Saving...' : 'Update Intake'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default WarehouseIntakes;
