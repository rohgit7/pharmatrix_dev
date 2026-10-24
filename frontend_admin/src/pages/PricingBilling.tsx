import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, pricingApi, customersApi, pickupsApi } from '../api/operations';
import {
  InvoiceResponse,
  InvoiceCreate,
  InvoiceUpdate,
  PaymentCreate,
  PaymentMethod,
  PaymentResponse,
  PricingPlanResponse,
  PricingPlanCreate,
  PricingPlanUpdate,
  PricingPlanVersionCreate,
  CustomerPricingAssignmentResponse,
  CustomerPricingAssignmentCreate,
  CustomerResponse,
  PickupAdminResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDate, formatCurrency, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  CreditCard,
  Plus,
  Eye,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Scale,
  ShieldCheck,
  FileText,
  DollarSign,
  Info,
  Layers,
  Users,
  Edit,
  Trash2,
  Calendar,
  X,
  Archive,
  Check,
} from 'lucide-react';

export const PricingBilling: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'PLANS' | 'ASSIGNMENTS'>('INVOICES');

  // Invoices State
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceResponse | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<PaymentResponse[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE' | 'FAILED'>('ALL');
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<InvoiceResponse | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceResponse | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentResponse | null>(null);

  // Payment Recording Modal
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceResponse | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Pricing Plans State
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<PricingPlanResponse | null>(null);
  const [planToDelete, setPlanToDelete] = useState<PricingPlanResponse | null>(null);
  const [planForNewVersion, setPlanForNewVersion] = useState<PricingPlanResponse | null>(null);

  // Pricing Assignments State
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<CustomerPricingAssignmentResponse | null>(null);

  // Toast / Alert
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  // Queries
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['adminInvoices', invoiceStatusFilter],
    queryFn: () => invoicesApi.list({ limit: 100, status: invoiceStatusFilter === 'ALL' ? undefined : invoiceStatusFilter }),
    enabled: activeTab === 'INVOICES',
  });

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery({
    queryKey: ['adminPricingPlans'],
    queryFn: () => pricingApi.listPlans(true),
    enabled: activeTab === 'PLANS',
  });

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['adminPricingAssignments'],
    queryFn: () => pricingApi.listAssignments(),
    enabled: activeTab === 'ASSIGNMENTS',
  });

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: (payload: InvoiceCreate) => invoicesApi.create(payload),
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      showAlert('success', `Invoice ${inv.invoice_number} created successfully.`);
      setShowCreateInvoiceModal(false);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InvoiceUpdate }) =>
      invoicesApi.update(id, payload),
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      showAlert('success', `Invoice ${inv.invoice_number} updated.`);
      setInvoiceToEdit(null);
      if (selectedInvoice?.public_id === inv.public_id) setSelectedInvoice(inv);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      showAlert('success', 'Invoice deleted successfully.');
      setInvoiceToDelete(null);
      if (selectedInvoice?.public_id === invoiceToDelete?.public_id) setSelectedInvoice(null);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: PaymentCreate) => {
      const idempotencyKey = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      return invoicesApi.recordPayment(payload, idempotencyKey);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      showAlert('success', `Payment of ${formatCurrency(data.amount, paymentInvoice?.currency)} recorded.`);
      setPaymentInvoice(null);
      if (selectedInvoice) {
        handleInspectInvoice(selectedInvoice);
      }
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: number) => invoicesApi.deletePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      showAlert('success', 'Payment reversed/deleted.');
      setPaymentToDelete(null);
      if (selectedInvoice) {
        handleInspectInvoice(selectedInvoice);
      }
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const createPlanMutation = useMutation({
    mutationFn: (payload: PricingPlanCreate) => pricingApi.createPlan(payload),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['adminPricingPlans'] });
      showAlert('success', `Pricing plan "${p.name}" created.`);
      setShowCreatePlanModal(false);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PricingPlanUpdate }) =>
      pricingApi.updatePlan(id, payload),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['adminPricingPlans'] });
      showAlert('success', `Pricing plan "${p.name}" updated.`);
      setPlanToEdit(null);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: number) => pricingApi.deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPricingPlans'] });
      showAlert('success', 'Pricing plan deleted.');
      setPlanToDelete(null);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const createVersionMutation = useMutation({
    mutationFn: ({ planId, payload }: { planId: number; payload: PricingPlanVersionCreate }) =>
      pricingApi.createVersion(planId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPricingPlans'] });
      showAlert('success', 'New tariff version created.');
      setPlanForNewVersion(null);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const updateVersionStatusMutation = useMutation({
    mutationFn: ({ versionId, status }: { versionId: number; status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' }) =>
      pricingApi.updateVersionStatus(versionId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPricingPlans'] });
      showAlert('success', 'Tariff version status updated.');
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const createAssignmentMutation = useMutation({
    mutationFn: (payload: CustomerPricingAssignmentCreate) => pricingApi.createAssignment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPricingAssignments'] });
      showAlert('success', 'Customer successfully assigned to plan.');
      setShowCreateAssignmentModal(false);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (id: number) => pricingApi.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPricingAssignments'] });
      showAlert('success', 'Contract assignment removed.');
      setAssignmentToDelete(null);
    },
    onError: (err) => showAlert('error', getErrorMessage(err)),
  });

  const handleInspectInvoice = async (invoice: InvoiceResponse) => {
    setSelectedInvoice(invoice);
    setInvoicePayments([]);
    try {
      const payments = await invoicesApi.getPayments(invoice.public_id);
      setInvoicePayments(payments);
    } catch (err) {
      showAlert('error', getErrorMessage(err));
    }
  };

  const invoiceColumns: Column<InvoiceResponse>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice Code',
      sortable: true,
      render: (inv) => (
        <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5 text-periwinkle" />
          {inv.invoice_number}
        </span>
      ),
    },
    {
      key: 'customer_id',
      header: 'Customer',
      sortable: true,
      render: (inv) => (
        <div className="text-xs">
          <span className="font-semibold text-charcoal-200">Customer #{inv.customer_id}</span>
        </div>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total Amount',
      sortable: true,
      render: (inv) => (
        <span className="font-bold text-white text-xs">
          {formatCurrency(inv.total_amount, inv.currency)}
        </span>
      ),
    },
    {
      key: 'amount_paid',
      header: 'Paid / Due',
      render: (inv) => {
        const isPaid = Number(inv.outstanding_amount) <= 0;
        return (
          <div className="text-xs">
            <span className="text-emerald-400 font-semibold">{formatCurrency(inv.amount_paid, inv.currency)}</span>
            {!isPaid && (
              <span className="text-rose-400 font-semibold block text-[11px]">
                Due: {formatCurrency(inv.outstanding_amount, inv.currency)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (inv) => <StatusBadge status={inv.status} size="sm" />,
    },
    {
      key: 'issued_at',
      header: 'Issued Date',
      sortable: true,
      render: (inv) => <span className="text-xs text-charcoal-400">{formatDate(inv.issued_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (inv) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {Number(inv.outstanding_amount) > 0 && (
            <button
              onClick={() => {
                setPaymentInvoice(inv);
                setPaymentAmount(Number(inv.outstanding_amount));
                setPaymentMethod('');
                setPaymentReference('');
                setPaymentNotes('');
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold text-[11px] border border-emerald-500/20 transition-colors"
              title="Record Payment"
            >
              + Payment
            </button>
          )}

          <button
            onClick={() => setInvoiceToEdit(inv)}
            className="p-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 hover:text-white transition-colors"
            title="Edit Invoice"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setInvoiceToDelete(inv)}
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
            title="Delete Invoice"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => handleInspectInvoice(inv)}
            className="p-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 hover:text-white transition-colors"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {alert && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span>{alert.message}</span>
          <button onClick={() => setAlert(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-charcoal-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-periwinkle" />
            Pricing & Billing Engine
          </h1>
          <p className="text-xs text-charcoal-400 mt-1">
            Administer customer invoices, tariff schedules, per-kg rates, and automated contract billing assignments.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-charcoal-900 border border-charcoal-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('INVOICES')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'INVOICES'
                ? 'bg-periwinkle text-charcoal-900 shadow-sm'
                : 'text-charcoal-400 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            Invoices & Payments
          </button>
          <button
            onClick={() => setActiveTab('PLANS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'PLANS'
                ? 'bg-periwinkle text-charcoal-900 shadow-sm'
                : 'text-charcoal-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Pricing Plans & Tariffs
          </button>
          <button
            onClick={() => setActiveTab('ASSIGNMENTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'ASSIGNMENTS'
                ? 'bg-periwinkle text-charcoal-900 shadow-sm'
                : 'text-charcoal-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Customer Contracts
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: INVOICES & PAYMENTS */}
      {/* ======================================================== */}
      {activeTab === 'INVOICES' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-charcoal-400 uppercase tracking-wider">
                Status Filter:
              </span>
              {(['ALL', 'PENDING', 'PAID', 'OVERDUE'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setInvoiceStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    invoiceStatusFilter === st
                      ? 'bg-periwinkle text-charcoal-900 border-periwinkle font-bold'
                      : 'bg-charcoal-900 text-charcoal-400 border-charcoal-800 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCreateInvoiceModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold text-xs rounded-xl shadow-md transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Generate Manual Invoice
            </button>
          </div>

          <DataTable
            data={invoices}
            columns={invoiceColumns}
            isLoading={isLoadingInvoices}
            emptyTitle="No invoices found matching current filter."
          />

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PRICING PLANS & TARIFFS */}
      {/* ======================================================== */}
      {activeTab === 'PLANS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-charcoal-300 uppercase tracking-wider">
              Standard Tariff Plans ({plans.length})
            </h2>
            <button
              onClick={() => setShowCreatePlanModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Pricing Plan
            </button>
          </div>

          {isLoadingPlans ? (
            <div className="py-12 text-center text-xs text-charcoal-400">Loading pricing plans...</div>
          ) : plans.length === 0 ? (
            <div className="py-12 text-center text-xs text-charcoal-500 bg-charcoal-900 rounded-2xl border border-charcoal-800">
              No pricing plans configured yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((p) => {
                const activeVersion = p.versions?.find((v) => v.status === 'ACTIVE');
                return (
                  <div
                    key={p.id}
                    className="p-5 bg-charcoal-900 border border-charcoal-800 rounded-2xl space-y-4 hover:border-charcoal-700 transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-charcoal-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{p.name}</h3>
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-charcoal-800 text-periwinkle border border-charcoal-700">
                            {p.code}
                          </span>
                        </div>
                        {p.description && (
                          <p className="text-xs text-charcoal-400 mt-1">{p.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPlanToEdit(p)}
                          className="p-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 hover:text-white"
                          title="Edit Plan"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPlanToDelete(p)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Active Tariff Rates */}
                    {activeVersion ? (
                      <div className="grid grid-cols-3 gap-2 bg-charcoal-800/40 p-3 rounded-xl text-xs border border-charcoal-800">
                        <div>
                          <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">
                            Rate / kg
                          </span>
                          <span className="font-bold text-white text-sm">
                            ₹{activeVersion.per_kg_rate}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">
                            Pickup Fee
                          </span>
                          <span className="font-bold text-white text-sm">
                            ₹{activeVersion.pickup_fee}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">
                            Min Charge
                          </span>
                          <span className="font-bold text-white text-sm">
                            ₹{activeVersion.minimum_pickup_charge}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                        No ACTIVE tariff version assigned.
                      </div>
                    )}

                    {/* Plan Versions List */}
                    <div className="space-y-2 pt-2 border-t border-charcoal-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-charcoal-400 uppercase tracking-wider">
                          Tariff Versions ({p.versions?.length || 0})
                        </span>
                        <button
                          onClick={() => setPlanForNewVersion(p)}
                          className="text-[11px] font-bold text-periwinkle hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> New Version
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {p.versions?.map((ver) => (
                          <div
                            key={ver.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-charcoal-800/70 text-xs border border-charcoal-700/60"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">v{ver.version}</span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  ver.status === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : ver.status === 'DRAFT'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-charcoal-700 text-charcoal-400'
                                }`}
                              >
                                {ver.status}
                              </span>
                              <span className="text-charcoal-400 text-[11px]">
                                ₹{ver.per_kg_rate}/kg | Fee: ₹{ver.pickup_fee}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {ver.status !== 'ACTIVE' && (
                                <button
                                  onClick={() =>
                                    updateVersionStatusMutation.mutate({
                                      versionId: ver.id,
                                      status: 'ACTIVE',
                                    })
                                  }
                                  className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                                >
                                  Activate
                                </button>
                              )}
                              {ver.status === 'ACTIVE' && (
                                <button
                                  onClick={() =>
                                    updateVersionStatusMutation.mutate({
                                      versionId: ver.id,
                                      status: 'ARCHIVED',
                                    })
                                  }
                                  className="px-2 py-0.5 text-[10px] font-semibold bg-charcoal-700 hover:bg-charcoal-600 text-charcoal-300 rounded"
                                >
                                  Archive
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CUSTOMER CONTRACTS / ASSIGNMENTS */}
      {/* ======================================================== */}
      {activeTab === 'ASSIGNMENTS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-charcoal-300 uppercase tracking-wider">
              Customer Tariff Contracts ({assignments.length})
            </h2>
            <button
              onClick={() => setShowCreateAssignmentModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold text-xs rounded-xl shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Assign Plan to Customer
            </button>
          </div>

          {isLoadingAssignments ? (
            <div className="py-12 text-center text-xs text-charcoal-400">Loading assignments...</div>
          ) : assignments.length === 0 ? (
            <div className="py-12 text-center text-xs text-charcoal-500 bg-charcoal-900 rounded-2xl border border-charcoal-800">
              No active customer tariff assignments configured.
            </div>
          ) : (
            <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-charcoal-800 bg-charcoal-800/40 text-[11px] font-bold text-charcoal-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Assigned Plan</th>
                    <th className="py-3 px-4">Effective Dates</th>
                    <th className="py-3 px-4">Contract Reference</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800/60">
                  {assignments.map((as) => (
                    <tr key={as.id} className="hover:bg-charcoal-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-white text-sm">{as.customer_name}</span>
                        <span className="text-[11px] text-charcoal-400 block font-mono">
                          ID: #{as.customer_id}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-periwinkle/10 text-periwinkle border border-periwinkle/20">
                          {as.pricing_plan_name} ({as.pricing_plan_code})
                        </span>
                      </td>

                      <td className="py-3 px-4 text-charcoal-300">
                        <div>From: {formatDate(as.effective_from)}</div>
                        {as.effective_until && (
                          <div className="text-charcoal-500 text-[11px]">
                            Until: {formatDate(as.effective_until)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-charcoal-400">
                        {as.reason || <span className="text-charcoal-600">Standard contract</span>}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setAssignmentToDelete(as)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                          title="Revoke Assignment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* Invoice Details Drawer */}
      {/* ======================================================== */}
      <DetailDrawer
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Consignment Invoice"
        subtitle={selectedInvoice ? `Invoice ${selectedInvoice.invoice_number}` : ''}
      >
        {selectedInvoice && (
          <div className="space-y-5 text-xs">
            <div className="p-4 bg-charcoal-800/50 rounded-xl border border-charcoal-700 space-y-3">
              <div className="flex justify-between items-center border-b border-charcoal-700 pb-2">
                <span className="text-charcoal-400 uppercase font-bold text-[10px]">Total Amount</span>
                <span className="font-bold text-white text-base">
                  {formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center text-charcoal-300">
                <span>Amount Paid:</span>
                <span className="text-emerald-400 font-semibold">
                  {formatCurrency(selectedInvoice.amount_paid, selectedInvoice.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center text-charcoal-300">
                <span>Outstanding Balance:</span>
                <span className="text-rose-400 font-semibold">
                  {formatCurrency(selectedInvoice.outstanding_amount, selectedInvoice.currency)}
                </span>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <h4 className="font-bold text-charcoal-400 uppercase tracking-wider text-[11px]">
                Line Items
              </h4>
              <div className="space-y-1.5">
                {selectedInvoice.line_items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-2.5 bg-charcoal-800/30 rounded-lg border border-charcoal-800"
                  >
                    <div>
                      <div className="font-semibold text-white">{item.description}</div>
                      <div className="text-[10px] text-charcoal-400">
                        {item.quantity} × {formatCurrency(item.unit_price, selectedInvoice.currency)}
                      </div>
                    </div>
                    <span className="font-bold text-white">
                      {formatCurrency(item.amount, selectedInvoice.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Transactions */}
            <div className="space-y-2">
              <h4 className="font-bold text-charcoal-400 uppercase tracking-wider text-[11px]">
                Payments Recorded ({invoicePayments.length})
              </h4>
              {invoicePayments.length === 0 ? (
                <div className="text-center py-4 bg-charcoal-800/20 rounded-lg text-charcoal-500">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {invoicePayments.map((pay) => (
                    <div
                      key={pay.id}
                      className="flex justify-between items-center p-2.5 bg-emerald-950/20 border border-emerald-500/20 rounded-lg"
                    >
                      <div>
                        <div className="font-bold text-emerald-300">
                          {formatCurrency(pay.amount, selectedInvoice.currency)} via {pay.payment_method}
                        </div>
                        <div className="text-[10px] text-charcoal-400">
                          Ref: {pay.payment_reference || 'N/A'} • {formatDate(pay.paid_at)}
                        </div>
                      </div>
                      <button
                        onClick={() => setPaymentToDelete(pay)}
                        className="p-1 hover:bg-rose-500/20 text-rose-400 rounded"
                        title="Delete Payment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* ======================================================== */}
      {/* Record Payment Modal */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        title="Record Payment"
        subtitle={paymentInvoice ? `Invoice ${paymentInvoice.invoice_number}` : ''}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!paymentInvoice || !paymentAmount || !paymentMethod) return;
            recordPaymentMutation.mutate({
              invoice_id: paymentInvoice.public_id,
              amount: Number(paymentAmount),
              payment_method: paymentMethod as PaymentMethod,
              payment_reference: paymentReference.trim() || undefined,
              notes: paymentNotes.trim() || undefined,
            });
          }}
          className="space-y-3.5 text-xs"
        >
          <div>
            <label className="block text-charcoal-400 mb-1">Amount to Collect (₹) *</label>
            <input
              type="number"
              step="any"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            >
              <option value="">-- Choose Method --</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Transaction Reference</label>
            <input
              type="text"
              placeholder="UTR number or UPI Transaction ID"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Notes</label>
            <textarea
              rows={2}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={() => setPaymentInvoice(null)}
              className="px-4 py-2 bg-charcoal-800 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPaymentMutation.isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl disabled:opacity-50"
            >
              {recordPaymentMutation.isPending ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* Create Manual Invoice Modal */}
      {/* ======================================================== */}
      {showCreateInvoiceModal && (
        <CreateInvoiceModal
          onClose={() => setShowCreateInvoiceModal(false)}
          onSubmit={(payload) => createInvoiceMutation.mutate(payload)}
          isSubmitting={createInvoiceMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Edit Invoice Modal */}
      {/* ======================================================== */}
      {invoiceToEdit && (
        <EditInvoiceModal
          invoice={invoiceToEdit}
          onClose={() => setInvoiceToEdit(null)}
          onSubmit={(payload) =>
            updateInvoiceMutation.mutate({ id: invoiceToEdit.public_id, payload })
          }
          isSubmitting={updateInvoiceMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Delete Invoice Modal */}
      {/* ======================================================== */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              Delete Invoice
            </h3>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to permanently delete invoice{' '}
              <strong className="text-white">{invoiceToDelete.invoice_number}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 text-charcoal-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteInvoiceMutation.mutate(invoiceToDelete.public_id)}
                disabled={deleteInvoiceMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deleteInvoiceMutation.isPending ? 'Deleting...' : 'Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Delete Payment Modal */}
      {/* ======================================================== */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              Delete Payment Transaction
            </h3>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to reverse payment of ₹{paymentToDelete.amount}?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPaymentToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 text-charcoal-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePaymentMutation.mutate(paymentToDelete.id)}
                disabled={deletePaymentMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deletePaymentMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Create Pricing Plan Modal */}
      {/* ======================================================== */}
      {showCreatePlanModal && (
        <CreatePlanModal
          onClose={() => setShowCreatePlanModal(false)}
          onSubmit={(payload) => createPlanMutation.mutate(payload)}
          isSubmitting={createPlanMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Edit Pricing Plan Modal */}
      {/* ======================================================== */}
      {planToEdit && (
        <EditPlanModal
          plan={planToEdit}
          onClose={() => setPlanToEdit(null)}
          onSubmit={(payload) => updatePlanMutation.mutate({ id: planToEdit.id, payload })}
          isSubmitting={updatePlanMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Delete Pricing Plan Modal */}
      {/* ======================================================== */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              Delete Pricing Plan
            </h3>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to delete plan{' '}
              <strong className="text-white">"{planToDelete.name}"</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPlanToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 text-charcoal-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePlanMutation.mutate(planToDelete.id)}
                disabled={deletePlanMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deletePlanMutation.isPending ? 'Deleting...' : 'Delete Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Create New Plan Version Modal */}
      {/* ======================================================== */}
      {planForNewVersion && (
        <CreatePlanVersionModal
          plan={planForNewVersion}
          onClose={() => setPlanForNewVersion(null)}
          onSubmit={(payload) =>
            createVersionMutation.mutate({ planId: planForNewVersion.id, payload })
          }
          isSubmitting={createVersionMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Create Pricing Assignment Modal */}
      {/* ======================================================== */}
      {showCreateAssignmentModal && (
        <CreateAssignmentModal
          onClose={() => setShowCreateAssignmentModal(false)}
          onSubmit={(payload) => createAssignmentMutation.mutate(payload)}
          isSubmitting={createAssignmentMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Delete Assignment Modal */}
      {/* ======================================================== */}
      {assignmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              Revoke Contract Assignment
            </h3>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to revoke the plan{' '}
              <strong className="text-white">"{assignmentToDelete.pricing_plan_name}"</strong> from
              customer <strong className="text-white">"{assignmentToDelete.customer_name}"</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAssignmentToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 text-charcoal-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAssignmentMutation.mutate(assignmentToDelete.id)}
                disabled={deleteAssignmentMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {deleteAssignmentMutation.isPending ? 'Revoking...' : 'Revoke Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// Subcomponent: Create Invoice Modal
// ==========================================
interface CreateInvoiceModalProps {
  onClose: () => void;
  onSubmit: (payload: InvoiceCreate) => void;
  isSubmitting: boolean;
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ onClose, onSubmit, isSubmitting }) => {
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [pickupId, setPickupId] = useState<number | ''>('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [feeItemName, setFeeItemName] = useState('Waste Collection & Disposal Fee');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('500');

  const { data: customers = [] } = useQuery({
    queryKey: ['admin-customers-options'],
    queryFn: () => customersApi.list(),
  });

  const { data: pickups = [] } = useQuery({
    queryKey: ['admin-pickups-options'],
    queryFn: () => pickupsApi.list(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !pickupId) return;

    onSubmit({
      customer_id: Number(customerId),
      pickup_id: Number(pickupId),
      tax_amount: parseFloat(taxAmount) || 0,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      notes: notes || null,
      line_items: [
        {
          item_type: 'COLLECTION_FEE',
          description: feeItemName,
          quantity: parseFloat(quantity) || 1,
          unit_price: parseFloat(unitPrice) || 0,
        },
      ],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-periwinkle" />
            Generate Consignment Invoice
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Customer *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.legal_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Pickup Consignment *</label>
            <select
              value={pickupId}
              onChange={(e) => setPickupId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            >
              <option value="">-- Select Pickup --</option>
              {pickups.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.pickup_code} - Status: {p.status}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-400 mb-1">Tax Amount (₹)</label>
              <input
                type="number"
                step="any"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="p-3 bg-charcoal-800/40 border border-charcoal-700/60 rounded-xl space-y-2">
            <span className="font-bold text-periwinkle uppercase text-[10px] block">
              Default Line Item
            </span>
            <div>
              <label className="block text-charcoal-400 mb-1">Description</label>
              <input
                type="text"
                value={feeItemName}
                onChange={(e) => setFeeItemName(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-charcoal-400 mb-1">Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-charcoal-400 mb-1">Unit Price (₹)</label>
                <input
                  type="number"
                  step="any"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Notes / Terms</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !customerId || !pickupId}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 font-bold text-charcoal-900 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Subcomponent: Edit Invoice Modal
// ==========================================
interface EditInvoiceModalProps {
  invoice: InvoiceResponse;
  onClose: () => void;
  onSubmit: (payload: InvoiceUpdate) => void;
  isSubmitting: boolean;
}

const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({ invoice, onClose, onSubmit, isSubmitting }) => {
  const [status, setStatus] = useState(invoice.status);
  const [dueDate, setDueDate] = useState(
    invoice.due_date ? new Date(invoice.due_date).toISOString().slice(0, 10) : ''
  );
  const [notes, setNotes] = useState(invoice.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      status,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      notes: notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Edit className="w-5 h-5 text-periwinkle" />
            Edit Invoice: {invoice.invoice_number}
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ISSUED">ISSUED</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 font-bold text-charcoal-900 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Subcomponent: Create Plan Modal
// ==========================================
interface CreatePlanModalProps {
  onClose: () => void;
  onSubmit: (payload: PricingPlanCreate) => void;
  isSubmitting: boolean;
}

const CreatePlanModal: React.FC<CreatePlanModalProps> = ({ onClose, onSubmit, isSubmitting }) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      is_active: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-periwinkle" />
            Create Pricing Plan
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Plan Code *</label>
            <input
              type="text"
              placeholder="e.g. COMM-STD-2026"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white uppercase font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Plan Name *</label>
            <input
              type="text"
              placeholder="e.g. Standard Commercial Hospital Plan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Summary of fee rules and applicable generator categories..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 font-bold text-charcoal-900 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Subcomponent: Edit Plan Modal
// ==========================================
interface EditPlanModalProps {
  plan: PricingPlanResponse;
  onClose: () => void;
  onSubmit: (payload: PricingPlanUpdate) => void;
  isSubmitting: boolean;
}

const EditPlanModal: React.FC<EditPlanModalProps> = ({ plan, onClose, onSubmit, isSubmitting }) => {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description || '');
  const [isActive, setIsActive] = useState(plan.is_active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Edit className="w-5 h-5 text-periwinkle" />
            Edit Plan: {plan.code}
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Plan Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="planActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-charcoal-800 border-charcoal-700 text-periwinkle"
            />
            <label htmlFor="planActive" className="text-charcoal-300">
              Active plan available for assignment
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 font-bold text-charcoal-900 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Subcomponent: Create Plan Version Modal
// ==========================================
interface CreatePlanVersionModalProps {
  plan: PricingPlanResponse;
  onClose: () => void;
  onSubmit: (payload: PricingPlanVersionCreate) => void;
  isSubmitting: boolean;
}

const CreatePlanVersionModal: React.FC<CreatePlanVersionModalProps> = ({
  plan,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const nextVer = (plan.versions?.length || 0) + 1;
  const [version, setVersion] = useState(nextVer.toString());
  const [perKgRate, setPerKgRate] = useState('25');
  const [pickupFee, setPickupFee] = useState('100');
  const [subscriptionFee, setSubscriptionFee] = useState('0');
  const [minCharge, setMinCharge] = useState('150');
  const [includedWeight, setIncludedWeight] = useState('5');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      version: parseInt(version) || nextVer,
      status: 'ACTIVE',
      currency: 'INR',
      per_kg_rate: parseFloat(perKgRate) || 0,
      pickup_fee: parseFloat(pickupFee) || 0,
      subscription_fee: parseFloat(subscriptionFee) || 0,
      minimum_pickup_charge: parseFloat(minCharge) || 0,
      included_weight_kg: parseFloat(includedWeight) || 0,
      fee_rules: {},
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-periwinkle" />
            Add Tariff Version for {plan.code}
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-400 mb-1">Version Number *</label>
              <input
                type="number"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
                required
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">Per-Kg Rate (₹) *</label>
              <input
                type="number"
                step="any"
                value={perKgRate}
                onChange={(e) => setPerKgRate(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-400 mb-1">Pickup Fee (₹) *</label>
              <input
                type="number"
                step="any"
                value={pickupFee}
                onChange={(e) => setPickupFee(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
                required
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">Min Pickup Charge (₹) *</label>
              <input
                type="number"
                step="any"
                value={minCharge}
                onChange={(e) => setMinCharge(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-400 mb-1">Included Weight (kg)</label>
              <input
                type="number"
                step="any"
                value={includedWeight}
                onChange={(e) => setIncludedWeight(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">Monthly Subscription Fee (₹)</label>
              <input
                type="number"
                step="any"
                value={subscriptionFee}
                onChange={(e) => setSubscriptionFee(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 font-bold text-charcoal-900 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create & Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// Subcomponent: Create Assignment Modal
// ==========================================
interface CreateAssignmentModalProps {
  onClose: () => void;
  onSubmit: (payload: CustomerPricingAssignmentCreate) => void;
  isSubmitting: boolean;
}

const CreateAssignmentModal: React.FC<CreateAssignmentModalProps> = ({
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [planId, setPlanId] = useState<number | ''>('');
  const [reason, setReason] = useState('Standard annual contract');

  const { data: customers = [] } = useQuery({
    queryKey: ['admin-customers-options'],
    queryFn: () => customersApi.list(),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['admin-plans-options'],
    queryFn: () => pricingApi.listPlans(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !planId) return;
    onSubmit({
      customer_id: Number(customerId),
      pricing_plan_id: Number(planId),
      reason: reason || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-periwinkle" />
            Assign Tariff Plan to Customer
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Customer Organization *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.customer_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Pricing Plan *</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
              required
            >
              <option value="">-- Choose Tariff Plan --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Contract Reference / Notes</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !customerId || !planId}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 font-bold text-charcoal-900 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Assigning...' : 'Assign Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PricingBilling;
