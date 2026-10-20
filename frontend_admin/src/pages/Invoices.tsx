import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api/operations';
import {
  InvoiceResponse,
  PaymentCreate,
  PaymentMethod,
  PaymentResponse,
} from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { Modal } from '../components/common/Modal';
import { formatDate, formatCurrency, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { CreditCard, Plus, Eye, CheckCircle2, AlertCircle, Receipt } from 'lucide-react';

export const Invoices: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceResponse | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<PaymentResponse[]>([]);

  // Payment Recording Modal
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceResponse | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['adminInvoices'],
    queryFn: () => invoicesApi.list({ limit: 50 }),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: PaymentCreate) => {
      const idempotencyKey = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      return invoicesApi.recordPayment(payload, idempotencyKey);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminInvoices'] });
      setAlert({
        type: 'success',
        message: `Payment of ${formatCurrency(data.amount, paymentInvoice?.currency)} recorded successfully.`,
      });
      setPaymentInvoice(null);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const handleInspectInvoice = async (invoice: InvoiceResponse) => {
    setSelectedInvoice(invoice);
    setInvoicePayments([]);
    try {
      const payments = await invoicesApi.getPayments(invoice.public_id);
      setInvoicePayments(payments);
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    }
  };

  const columns: Column<InvoiceResponse>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice #',
      sortable: true,
      render: (i) => <span className="font-mono font-bold text-charcoal-900">{i.invoice_number}</span>,
    },
    {
      key: 'customer_id',
      header: 'Customer',
      sortable: true,
      render: (i) => <span className="font-mono text-xs">CUST-#{i.customer_id}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: 'total_amount',
      header: 'Total Amount',
      sortable: true,
      render: (i) => <span className="font-semibold text-charcoal-900">{formatCurrency(i.total_amount, i.currency)}</span>,
    },
    {
      key: 'amount_paid',
      header: 'Paid Amount',
      render: (i) => (
        <span className={Number(i.amount_paid) >= Number(i.total_amount) ? 'text-emerald-700 font-semibold' : 'text-charcoal-600'}>
          {formatCurrency(i.amount_paid, i.currency)}
        </span>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (i) => <span>{formatDate(i.due_date)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (i) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleInspectInvoice(i)}
            className="p-1.5 rounded-lg text-charcoal-500 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors"
            title="Inspect Invoice"
          >
            <Eye className="w-4 h-4" />
          </button>
          {Number(i.outstanding_amount) > 0 && (
            <button
              onClick={() => {
                setPaymentInvoice(i);
                setPaymentAmount(Number(i.outstanding_amount));
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-periwinkle-100 text-periwinkle-800 hover:bg-periwinkle-200 transition-colors"
            >
              Record Payment
            </button>
          )}
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
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">Billing & Invoices</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Audit collection tariffs, disposal compliance fees, and offline payment receipts.
          </p>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={invoices}
        isLoading={isLoading}
        searchPlaceholder="Filter invoices by number, customer..."
        searchFilter={(row, q) =>
          row.invoice_number.toLowerCase().includes(q) ||
          String(row.customer_id).includes(q) ||
          row.status.toLowerCase().includes(q)
        }
        onRowClick={(i) => handleInspectInvoice(i)}
      />

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice?.invoice_number || 'Invoice Details'}
        subtitle={`Public ID: ${selectedInvoice?.public_id}`}
      >
        {selectedInvoice && (
          <div className="space-y-6 text-xs">
            {/* Summary */}
            <div className="bg-ivory-100 p-4 rounded-xl border border-ivory-300 flex items-center justify-between">
              <div>
                <span className="text-charcoal-500 block">Total Due</span>
                <span className="text-lg font-bold text-charcoal-900">
                  {formatCurrency(selectedInvoice.total_amount, selectedInvoice.currency)}
                </span>
              </div>
              <StatusBadge status={selectedInvoice.status} size="md" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-charcoal-500 block">Invoice ID / Customer</span><span>#{selectedInvoice.id} / #{selectedInvoice.customer_id}</span></div>
              <div><span className="text-charcoal-500 block">Customer UUID</span><span className="font-mono break-all">{selectedInvoice.customer_public_id}</span></div>
              <div><span className="text-charcoal-500 block">Pickup / Pricing Plan</span><span>#{selectedInvoice.pickup_id} / #{selectedInvoice.pricing_plan_id}</span></div>
              <div><span className="text-charcoal-500 block">Plan Version / Currency</span><span>#{selectedInvoice.pricing_plan_version_id} / {selectedInvoice.currency}</span></div>
              <div><span className="text-charcoal-500 block">Subtotal</span>{formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</div>
              <div><span className="text-charcoal-500 block">Tax</span>{formatCurrency(selectedInvoice.tax_amount, selectedInvoice.currency)}</div>
              <div><span className="text-charcoal-500 block">Paid / Outstanding</span>{formatCurrency(selectedInvoice.amount_paid, selectedInvoice.currency)} / {formatCurrency(selectedInvoice.outstanding_amount, selectedInvoice.currency)}</div>
              <div><span className="text-charcoal-500 block">Issued / Due / Paid</span>{formatDate(selectedInvoice.issued_at)} / {formatDate(selectedInvoice.due_date)} / {formatDate(selectedInvoice.paid_at)}</div>
              <div><span className="text-charcoal-500 block">Created / Updated</span>{formatDateTime(selectedInvoice.created_at)} / {formatDateTime(selectedInvoice.updated_at)}</div>
            </div>
            {selectedInvoice.notes && <p className="text-charcoal-700">Notes: {selectedInvoice.notes}</p>}
            <div className="rounded-lg border border-ivory-300 bg-white p-3">
              <span className="font-semibold text-charcoal-700 block mb-1">Pricing Snapshot</span>
              <pre className="whitespace-pre-wrap break-all text-[11px] text-charcoal-600">
                {JSON.stringify(selectedInvoice.pricing_snapshot, null, 2)}
              </pre>
            </div>

            {/* Line items if present */}
            {selectedInvoice.line_items && selectedInvoice.line_items.length > 0 && (
              <div>
                <h4 className="font-bold text-charcoal-900 uppercase tracking-wider mb-2">Line Items</h4>
                <div className="border border-ivory-300 rounded-lg overflow-hidden divide-y divide-ivory-200">
                  {selectedInvoice.line_items.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-charcoal-900 block">{item.description}</span>
                        <span className="text-[11px] text-charcoal-500">
                          {item.item_type} · Qty: {item.quantity} × {formatCurrency(item.unit_price, selectedInvoice.currency)} · ID #{item.id}
                        </span>
                        <span className="text-[11px] text-charcoal-500 block">
                          Metadata: {JSON.stringify(item.metadata_json)} · Created {formatDateTime(item.created_at)}
                        </span>
                      </div>
                      <span className="font-bold text-charcoal-900">{formatCurrency(item.amount, selectedInvoice.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recorded Payments */}
            <div>
              <h4 className="font-bold text-charcoal-900 uppercase tracking-wider mb-2">Payment History</h4>
              {invoicePayments.length === 0 ? (
                <p className="text-charcoal-400">No payments recorded for this invoice yet.</p>
              ) : (
                <div className="space-y-2">
                  {invoicePayments.map((p) => (
                    <div key={p.id} className="p-3 bg-white rounded-lg border border-ivory-300 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-charcoal-900 block">{formatCurrency(p.amount, selectedInvoice.currency)}</span>
                        <span className="text-[11px] text-charcoal-500 font-mono">
                          Payment #{p.id} · {p.payment_method} · {p.status}
                          {p.payment_reference ? ` • Ref: ${p.payment_reference}` : ''}
                        </span>
                        <span className="text-[11px] text-charcoal-500 block">
                          Invoice UUID: {p.invoice_id} · {p.notes || 'No notes'} · Idempotency key: {p.idempotency_key || '—'}
                        </span>
                      </div>
                      <span className="text-[11px] text-charcoal-400">
                        Paid {formatDateTime(p.paid_at)} · Created {formatDateTime(p.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Record Payment Modal */}
      <Modal
        isOpen={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        title="Record Offline Payment"
        subtitle={`Invoice: ${paymentInvoice?.invoice_number}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (paymentInvoice && paymentAmount && paymentMethod) {
              recordPaymentMutation.mutate({
                invoice_id: paymentInvoice.public_id,
                amount: Number(paymentAmount),
                payment_method: paymentMethod,
                payment_reference: paymentReference.trim() || null,
                notes: paymentNotes || undefined,
              });
            }
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Payment Amount ({paymentInvoice?.currency ?? '—'})
            </label>
            <input
              required
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                Payment Channel
              </label>
              <select
                required
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod | '')
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              >
                <option value="">Select payment method...</option>
                <option value="BANK_TRANSFER">Bank Wire / NEFT</option>
                <option value="UPI">UPI Payment</option>
                <option value="CASH">Cash Remittance</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
                UTR / Cheque Ref
              </label>
              <input
                type="text"
                maxLength={100}
                placeholder="UTR-2026-991823"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 uppercase tracking-wider mb-1">
              Audit Notes
            </label>
            <input
              type="text"
              maxLength={2000}
              placeholder="Verified via bank statement..."
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal focus:ring-2 focus:ring-periwinkle"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setPaymentInvoice(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPaymentMutation.isPending}
              className="px-4 py-2 font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {recordPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
