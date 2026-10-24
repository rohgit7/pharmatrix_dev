import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerDocumentsApi, customersApi } from '../api/operations';
import { CustomerDocumentResponse, CustomerDocumentType, CustomerDocumentCreate } from '../types/operations';
import { DataTable, Column } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { formatDate, formatDateTime } from '../utils/formatters';
import { getErrorMessage } from '../api/client';
import {
  FileCheck2,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Search,
  ExternalLink,
  Building,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';

export const CustomerDocuments: React.FC = () => {
  const queryClient = useQueryClient();

  const [filterVerified, setFilterVerified] = useState<'ALL' | 'VERIFIED' | 'PENDING'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // CRUD Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<CustomerDocumentResponse | null>(null);

  const [createForm, setCreateForm] = useState<{
    customer_id: string;
    document_type: CustomerDocumentType;
    document_number: string;
    file_path: string;
    is_verified: boolean;
    file: File | null;
  }>({
    customer_id: '',
    document_type: 'DRUG_LICENSE',
    document_number: '',
    file_path: '',
    is_verified: true,
    file: null,
  });

  const {
    data: documents = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['adminCustomerDocuments'],
    queryFn: () => customerDocumentsApi.list(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['adminCustomersDropdown'],
    queryFn: () => customersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CustomerDocumentCreate & { file?: File }) =>
      customerDocumentsApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomerDocuments'] });
      setAlert({
        type: 'success',
        message: `Customer compliance document #${data.id} registered successfully.`,
      });
      setShowCreateModal(false);
      setCreateForm({
        customer_id: '',
        document_type: 'DRUG_LICENSE',
        document_number: '',
        file_path: '',
        is_verified: true,
        file: null,
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => customerDocumentsApi.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomerDocuments'] });
      setAlert({
        type: 'success',
        message: 'Compliance document removed successfully.',
      });
      setDocumentToDelete(null);
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ docId, verified }: { docId: number; verified: boolean }) =>
      customerDocumentsApi.setVerification(docId, verified),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminCustomerDocuments'] });
      setAlert({
        type: 'success',
        message: `Document #${data.id} verification status updated to: ${data.is_verified ? 'Verified' : 'Pending'}.`,
      });
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (docId: number) => customerDocumentsApi.getDownloadUrl(docId),
    onSuccess: (data) => {
      if (data.download_url) {
        window.open(data.download_url, '_blank', 'noopener,noreferrer');
      } else {
        setAlert({ type: 'error', message: 'Download URL could not be generated.' });
      }
    },
    onError: (err) => {
      setAlert({ type: 'error', message: getErrorMessage(err) });
    },
  });

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    if (filterVerified === 'VERIFIED' && !doc.is_verified) return false;
    if (filterVerified === 'PENDING' && doc.is_verified) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchNumber = doc.document_number?.toLowerCase().includes(term);
      const matchType = doc.document_type?.toLowerCase().includes(term);
      const matchCustomer = String(doc.customer_id).includes(term);
      return matchNumber || matchType || matchCustomer;
    }
    return true;
  });

  const totalCount = documents.length;
  const verifiedCount = documents.filter((d) => d.is_verified).length;
  const pendingCount = documents.filter((d) => !d.is_verified).length;

  const columns: Column<CustomerDocumentResponse>[] = [
    {
      key: 'id',
      header: 'Document ID',
      render: (row) => (
        <span className="font-mono font-bold text-xs text-blue-600">
          DOC-{row.id.toString().padStart(5, '0')}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Building className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-800">
            Customer #{row.customer_id}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'document_type',
      header: 'Document Type',
      render: (row) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
          {String(row.document_type).replace(/_/g, ' ')}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'document_number',
      header: 'Document / License #',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">
          {row.document_number || '—'}
        </span>
      ),
    },
    {
      key: 'is_verified',
      header: 'Verification Status',
      render: (row) =>
        row.is_verified ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Verified</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            <span>Pending Review</span>
          </span>
        ),
      sortable: true,
    },
    {
      key: 'created_at',
      header: 'Uploaded Date',
      render: (row) => (
        <span className="text-xs text-slate-500">{formatDate(row.created_at)}</span>
      ),
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadMutation.mutate(row.id)}
            disabled={downloadMutation.isPending}
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
            title="Download Document"
          >
            <Download className="w-4 h-4" />
          </button>

          {row.is_verified ? (
            <button
              onClick={() => verifyMutation.mutate({ docId: row.id, verified: false })}
              disabled={verifyMutation.isPending}
              className="px-2 py-0.5 text-[11px] font-bold rounded text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200"
              title="Revoke Verification"
            >
              Revoke
            </button>
          ) : (
            <button
              onClick={() => verifyMutation.mutate({ docId: row.id, verified: true })}
              disabled={verifyMutation.isPending}
              className="px-2 py-0.5 text-[11px] font-bold rounded text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs"
              title="Verify Document"
            >
              Verify
            </button>
          )}

          <button
            onClick={() => setDocumentToDelete(row)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            title="Delete Document"
          >
            <Trash2 className="w-4 h-4" />
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
            <FileCheck2 className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Customer Compliance Documents
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review, verify, and download State PCB authorizations, pharmacy licenses, and legal compliance permits.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Register Document
        </button>
      </div>

      {/* Alert banner */}
      {alert && (
        <div
          className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
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

      {/* 2. KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Total Documents</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{totalCount}</span>
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Verified Licenses</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-emerald-600">{verifiedCount}</span>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Pending Review</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-amber-600">{pendingCount}</span>
            <ShieldAlert className="w-5 h-5 text-amber-500" />
          </div>
        </div>
      </div>

      {/* 3. Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          {(['ALL', 'PENDING', 'VERIFIED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterVerified(filter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                filterVerified === filter
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {filter === 'ALL' ? 'All Documents' : filter === 'PENDING' ? 'Pending Review' : 'Verified'}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search license or doc #…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredDocuments}
          isLoading={isLoading}
          emptyTitle="No compliance documents found"
          emptyDescription="No compliance documents match your criteria."
        />
      </div>

      {/* Register Customer Document Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Register Customer Compliance Document"
        subtitle="Upload or record a customer regulatory certificate, drug license, or PCB permit"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              customer_id: Number(createForm.customer_id),
              document_type: createForm.document_type,
              document_number: createForm.document_number.trim() || undefined,
              file_path: createForm.file_path.trim() || undefined,
              is_verified: createForm.is_verified,
              file: createForm.file || undefined,
            });
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Customer *</label>
            {customers.length > 0 ? (
              <select
                required
                value={createForm.customer_id}
                onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="">Select a registered customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} · {c.display_name || c.legal_name} ({c.customer_type})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                required
                min="1"
                step="1"
                value={createForm.customer_id}
                onChange={(e) => setCreateForm({ ...createForm, customer_id: e.target.value })}
                placeholder="Enter Customer ID"
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Document Type *</label>
              <select
                value={createForm.document_type}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    document_type: e.target.value as CustomerDocumentType,
                  })
                }
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              >
                <option value="DRUG_LICENSE">Drug License</option>
                <option value="GST_CERTIFICATE">GST Certificate</option>
                <option value="BUSINESS_REGISTRATION">Business Registration</option>
                <option value="AADHAAR">Aadhaar Card</option>
                <option value="OTHER">Other Compliance Document</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-charcoal-700 mb-1">Document / License #</label>
              <input
                type="text"
                placeholder="e.g. DL-MH-2024-9981"
                value={createForm.document_number}
                onChange={(e) => setCreateForm({ ...createForm, document_number: e.target.value })}
                className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Upload File (PDF / Image)</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setCreateForm({ ...createForm, file: e.target.files[0] });
                }
              }}
              className="w-full text-xs text-charcoal-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          <div>
            <label className="block font-semibold text-charcoal-700 mb-1">Storage Path / External Reference URL (Optional)</label>
            <input
              type="text"
              placeholder="e.g. s3://pharmatrix/documents/cust_10/license.pdf"
              value={createForm.file_path}
              onChange={(e) => setCreateForm({ ...createForm, file_path: e.target.value })}
              className="w-full px-3 py-2 bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is_verified"
              checked={createForm.is_verified}
              onChange={(e) => setCreateForm({ ...createForm, is_verified: e.target.checked })}
              className="rounded border-ivory-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_verified" className="text-charcoal-700 font-medium">
              Mark as officially verified upon registration
            </label>
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
              disabled={createMutation.isPending || !createForm.customer_id}
              className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Registering...' : 'Register Document'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!documentToDelete}
        onClose={() => setDocumentToDelete(null)}
        title="Delete Compliance Document"
        subtitle={`Confirm deletion of DOC-${documentToDelete?.id.toString().padStart(5, '0')}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-charcoal-700">
            Are you sure you want to delete compliance document <strong className="font-mono text-charcoal-900">DOC-{documentToDelete?.id.toString().padStart(5, '0')}</strong> for Customer #{documentToDelete?.customer_id}?
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <strong>Warning:</strong> Deleting a regulatory document removes customer compliance proof. This action cannot be undone.
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-ivory-200">
            <button
              type="button"
              onClick={() => setDocumentToDelete(null)}
              className="px-4 py-2 font-semibold text-charcoal-700 bg-white border border-ivory-300 rounded-lg hover:bg-ivory-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (documentToDelete) {
                  deleteMutation.mutate(documentToDelete.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Document'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerDocuments;
