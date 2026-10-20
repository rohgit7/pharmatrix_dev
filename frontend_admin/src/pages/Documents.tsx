import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerDocumentsApi } from '../api/operations';
import { CustomerDocumentResponse } from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDate, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import { FileCheck, Download, CheckCircle2, XCircle, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';

export const Documents: React.FC = () => {
  const queryClient = useQueryClient();
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['adminCustomerDocuments'],
    queryFn: customerDocumentsApi.list,
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, verified }: { id: number; verified: boolean }) =>
      customerDocumentsApi.setVerification(id, verified),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomerDocuments'] });
      setAlert({
        type: 'success',
        message: `Document #${data.id} verification status set to ${data.is_verified ? 'VERIFIED' : 'UNVERIFIED'}.`,
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const handleDownload = async (docId: number) => {
    try {
      const res = await customerDocumentsApi.getDownloadUrl(docId);
      window.open(res.download_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    }
  };

  const columns: Column<CustomerDocumentResponse>[] = [
    {
      key: 'id',
      header: 'Doc ID',
      sortable: true,
      render: (d) => <span className="font-mono font-bold text-charcoal-900">DOC-#{d.id}</span>,
    },
    {
      key: 'customer_id',
      header: 'Customer',
      sortable: true,
      render: (d) => <span className="font-mono font-semibold text-charcoal-900">CUST-#{d.customer_id}</span>,
    },
    {
      key: 'document_type',
      header: 'Document Type',
      sortable: true,
      render: (d) => <span className="font-semibold text-xs text-charcoal-800">{d.document_type}</span>,
    },
    {
      key: 'document_number',
      header: 'License / Reg Number',
      render: (d) => <span className="font-mono text-xs text-charcoal-700">{d.document_number || '—'}</span>,
    },
    {
      key: 'is_verified',
      header: 'Verification',
      sortable: true,
      render: (d) => <StatusBadge status={d.is_verified} />,
    },
    {
      key: 'created_at',
      header: 'Uploaded Date',
      sortable: true,
      render: (d) => <span>{formatDate(d.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (d) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => handleDownload(d.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-ivory-100 text-charcoal-800 hover:bg-ivory-200 transition-colors border border-ivory-300"
            title="Secure Download Link (Expires in 5 min)"
          >
            <Download className="w-3.5 h-3.5 text-charcoal-500" />
            <span>Download</span>
          </button>
          {!d.is_verified ? (
            <button
              onClick={() => verifyMutation.mutate({ id: d.id, verified: true })}
              disabled={verifyMutation.isPending}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors disabled:opacity-50"
            >
              Verify
            </button>
          ) : (
            <button
              onClick={() => verifyMutation.mutate({ id: d.id, verified: false })}
              disabled={verifyMutation.isPending}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 transition-colors disabled:opacity-50"
            >
              Revoke
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
          <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">Customer Document Verification</h2>
          <p className="text-xs text-charcoal-500 mt-0.5">
            Audit pharmacy drug licenses, wholesale permits, and CPCB environmental consents.
          </p>
        </div>
      </div>

      {/* Notice box */}
      <div className="bg-periwinkle-50/70 p-4 rounded-xl border border-periwinkle-200 text-xs text-charcoal-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-periwinkle-800 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-periwinkle-950">Secure Zero-Knowledge Document Retrieval</p>
          <p className="text-charcoal-700 leading-relaxed">
            All document downloads are generated as short-lived (5-minute) signed Supabase storage tokens. Secret keys and storage credentials are never exposed to browser memory.
          </p>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={documents}
        isLoading={isLoading}
        searchPlaceholder="Filter documents by number, customer, type..."
        searchFilter={(row, q) =>
          (row.document_number || '').toLowerCase().includes(q) ||
          row.document_type.toLowerCase().includes(q) ||
          String(row.customer_id).includes(q)
        }
      />
    </div>
  );
};
