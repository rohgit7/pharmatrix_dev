import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  Clock,
  Truck,
  Scale,
  CreditCard,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Maximize2,
  X,
} from 'lucide-react';
import { PickupMonitoringDetailResponse } from '../../types/operations';
import { formatCurrency, formatDateTime, formatWeight, formatDuration } from '../../utils/formatters';
import { Modal } from '../common/Modal';

interface PickupDetailPanelsProps {
  detail: PickupMonitoringDetailResponse;
  className?: string;
}

export const PickupDetailPanels: React.FC<PickupDetailPanelsProps> = ({ detail, className = '' }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'COLLECTION' | 'FINANCIALS' | 'VERIFICATION'>('OVERVIEW');
  const [showProofModal, setShowProofModal] = useState<boolean>(false);

  const { customer, driver, collection, payment, otp, completion } = detail;

  // Weight variance calculation
  const hasVariance =
    collection.weight_discrepancy_kg !== null &&
    collection.weight_discrepancy_percent !== null &&
    Math.abs(collection.weight_discrepancy_percent) > 20;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[#EADFD0] gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'OVERVIEW'
              ? 'border-[#7B91EE] text-[#7B91EE]'
              : 'border-transparent text-[#201E1C]/60 hover:text-[#201E1C]'
          }`}
        >
          Customer & Dispatch
        </button>
        <button
          onClick={() => setActiveTab('COLLECTION')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'COLLECTION'
              ? 'border-[#7B91EE] text-[#7B91EE]'
              : 'border-transparent text-[#201E1C]/60 hover:text-[#201E1C]'
          }`}
        >
          Collection & Weight
          {hasVariance && (
            <span className="w-2 h-2 rounded-full bg-amber-500" title="Weight discrepancy alert" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('FINANCIALS')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'FINANCIALS'
              ? 'border-[#7B91EE] text-[#7B91EE]'
              : 'border-transparent text-[#201E1C]/60 hover:text-[#201E1C]'
          }`}
        >
          Billing & Payments
        </button>
        <button
          onClick={() => setActiveTab('VERIFICATION')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'VERIFICATION'
              ? 'border-[#7B91EE] text-[#7B91EE]'
              : 'border-transparent text-[#201E1C]/60 hover:text-[#201E1C]'
          }`}
        >
          OTP & Verification
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CUSTOMER & DISPATCH OVERVIEW */}
      {/* ========================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Section A: Customer Information */}
          <div className="bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EADFD0]/60">
              <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
                  Customer & Healthcare Facility
                </h4>
                <span className="text-[11px] text-[#201E1C]/50">Authorized Client Profile</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Facility Name</span>
                <span className="font-bold text-[#201E1C] text-sm">{customer.display_name}</span>
                {customer.legal_name && customer.legal_name !== customer.display_name && (
                  <span className="text-[11px] text-[#201E1C]/60 block font-normal">Legal: {customer.legal_name}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Facility Type</span>
                  <span className="font-semibold text-[#201E1C] uppercase">{customer.customer_type}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Contact Person</span>
                  <span className="font-semibold text-[#201E1C]">{customer.contact_name || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Phone</span>
                  <span className="font-semibold text-[#201E1C] flex items-center gap-1">
                    <Phone className="w-3 h-3 text-[#7B91EE]" />
                    {customer.phone || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Email</span>
                  <span className="text-[#201E1C]/80 truncate block">{customer.email || 'N/A'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#EADFD0]/40">
                <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Registered Pickup Address</span>
                <p className="text-xs text-[#201E1C] font-medium mt-0.5">{customer.address || 'Address unrecorded'}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-[#201E1C]/60">
                  <span>{customer.city || ''}</span>
                  {customer.state && <span>• {customer.state}</span>}
                  {customer.postal_code && <span>• PIN: {customer.postal_code}</span>}
                </div>
              </div>

              {customer.latitude && customer.longitude && (
                <div className="p-2.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]/60 text-[11px] text-[#201E1C]/70 flex items-center justify-between">
                  <span>
                    GPS: {customer.latitude.toFixed(5)}, {customer.longitude.toFixed(5)}
                  </span>
                  <a
                    href={`https://maps.google.com/?q=${customer.latitude},${customer.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#7B91EE] hover:underline font-semibold flex items-center gap-1 text-[10px]"
                  >
                    Open Map <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Section B & C: Request & Driver Information */}
          <div className="space-y-5">
            {/* Pickup Request Details */}
            <div className="bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EADFD0]/60">
                <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
                    Pickup Request Specifications
                  </h4>
                  <span className="text-[11px] text-[#201E1C]/50">Order & Planning Bounds</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Pickup Code</span>
                  <span className="font-mono font-bold text-[#201E1C]">{detail.pickup_code}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Priority Tier</span>
                  <span className={`font-bold ${detail.priority === 'URGENT' ? 'text-red-700' : 'text-[#201E1C]'}`}>
                    {detail.priority}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Requested Date</span>
                  <span className="text-[#201E1C]">{detail.requested_date ? formatDateTime(detail.requested_date) : 'ASAP'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Scheduled Window</span>
                  <span className="font-semibold text-[#201E1C]">
                    {detail.scheduled_date ? formatDateTime(detail.scheduled_date) : 'Unscheduled'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Est. Weight</span>
                  <span className="font-bold text-[#201E1C]">
                    {detail.collection.estimated_weight_kg ? formatWeight(detail.collection.estimated_weight_kg) : 'Unspecified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Created At</span>
                  <span className="text-[#201E1C]/70">{formatDateTime(detail.created_at)}</span>
                </div>
              </div>

              {detail.notes && (
                <div className="mt-3 pt-3 border-t border-[#EADFD0]/40 text-xs">
                  <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Customer Special Notes</span>
                  <p className="text-xs text-[#201E1C]/80 italic mt-0.5">"{detail.notes}"</p>
                </div>
              )}
            </div>

            {/* Assigned Driver & Fleet Details */}
            <div className="bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs">
              <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EADFD0]/60">
                <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
                    Fleet Driver Allocation
                  </h4>
                  <span className="text-[11px] text-[#201E1C]/50">Assigned Field Unit</span>
                </div>
              </div>

              {driver ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Driver Name</span>
                    <span className="font-bold text-[#201E1C]">{driver.name || driver.employee_id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Employee ID</span>
                    <span className="font-mono text-[#201E1C]">{driver.employee_id || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Driver Phone</span>
                    <span className="font-semibold text-[#201E1C] flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#7B91EE]" />
                      {driver.phone || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Assigned Vehicle</span>
                    <span className="font-semibold text-[#201E1C]">
                      {driver.vehicle?.registration_number || 'Unallocated Vehicle'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#FDFBF8] text-center border border-dashed border-[#EADFD0] text-xs text-[#201E1C]/60">
                  No driver has been assigned to this pickup route yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: COLLECTION & WEIGHT DETAILS */}
      {/* ========================================================= */}
      {activeTab === 'COLLECTION' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Weight & Discrepancy Card */}
          <div className="bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EADFD0]/60">
              <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
                  Biomedical Waste Measurement
                </h4>
                <span className="text-[11px] text-[#201E1C]/50">Certified On-Site Weights</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-4">
              <div className="p-3 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]">
                <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Estimated Weight</span>
                <span className="text-base font-extrabold text-[#201E1C]">
                  {collection.estimated_weight_kg ? formatWeight(collection.estimated_weight_kg) : '—'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#E5EBFF]/40 border border-[#7B91EE]/30">
                <span className="text-[10px] text-[#201E1C]/60 uppercase font-semibold block">Actual Collected</span>
                <span className="text-base font-extrabold text-[#201E1C]">
                  {collection.actual_collected_weight_kg ? formatWeight(collection.actual_collected_weight_kg) : 'Pending'}
                </span>
              </div>
            </div>

            {/* Discrepancy Panel */}
            {collection.weight_discrepancy_kg !== null && (
              <div
                className={`p-3.5 rounded-lg border text-xs mb-4 ${
                  hasVariance
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span>Weight Variance:</span>
                  <span>
                    {collection.weight_discrepancy_kg > 0 ? '+' : ''}
                    {collection.weight_discrepancy_kg.toFixed(2)} kg (
                    {collection.weight_discrepancy_percent?.toFixed(1)}%)
                  </span>
                </div>
                {hasVariance && (
                  <p className="text-[11px] text-amber-800 mt-1">
                    Warning: Measured weight deviates significantly from the customer's initial declaration.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2 text-xs border-t border-[#EADFD0]/40 pt-3">
              <div className="flex justify-between">
                <span className="text-[#201E1C]/60">Weighing Timestamp:</span>
                <span className="font-semibold text-[#201E1C]">
                  {collection.collection_completion_time
                    ? formatDateTime(collection.collection_completion_time)
                    : collection.actual_collected_weight_kg
                    ? 'Recorded'
                    : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#201E1C]/60">Facility QR Authentication:</span>
                <span className={`font-semibold ${collection.qr_verified ? 'text-emerald-700' : 'text-[#201E1C]/60'}`}>
                  {collection.qr_verified ? 'Verified on-site' : 'Unverified'}
                </span>
              </div>
            </div>
          </div>

          {/* Collection Proof Photo Card */}
          <div className="bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EADFD0]/60">
              <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
                  Collection Evidence & Proof
                </h4>
                <span className="text-[11px] text-[#201E1C]/50">Tamper-Proof Photographic Record</span>
              </div>
            </div>

            {collection.proof_url ? (
              <div className="space-y-3">
                <div
                  onClick={() => setShowProofModal(true)}
                  className="relative group rounded-lg overflow-hidden border border-[#EADFD0] bg-[#FDFBF8] aspect-video cursor-pointer"
                >
                  <img
                    src={collection.proof_url}
                    alt="Collection Proof"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2 text-xs font-bold">
                    <Maximize2 className="w-4 h-4" /> View Fullscreen
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-[#201E1C]/60">
                  <span>Uploaded: {collection.proof_uploaded_at ? formatDateTime(collection.proof_uploaded_at) : 'Yes'}</span>
                  <button
                    onClick={() => setShowProofModal(true)}
                    className="text-[#7B91EE] font-bold hover:underline"
                  >
                    Inspect Evidence
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-lg bg-[#FDFBF8] border border-dashed border-[#EADFD0] text-center text-xs text-[#201E1C]/50">
                <ImageIcon className="w-8 h-8 mx-auto text-[#201E1C]/30 mb-2" />
                No collection proof photograph uploaded yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: BILLING & FINANCIALS */}
      {/* ========================================================= */}
      {activeTab === 'FINANCIALS' && (
        <div className="bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EADFD0]/60">
            <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
                Billing, Invoicing & Gateway Settlement
              </h4>
              <span className="text-[11px] text-[#201E1C]/50">Backend-Calculated Accounting</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs mb-5">
            <div className="p-3.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]">
              <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Invoice Number</span>
              <span className="font-mono font-bold text-[#201E1C]">{payment.invoice_number || 'Pending'}</span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]">
              <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Total Amount</span>
              <span className="text-base font-black text-[#201E1C]">
                {payment.total_amount !== null ? formatCurrency(payment.total_amount) : '₹0.00'}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]">
              <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Payment Status</span>
              <span
                className={`font-bold uppercase ${
                  payment.payment_status === 'PAID'
                    ? 'text-emerald-700'
                    : payment.payment_status === 'FAILED'
                    ? 'text-red-700'
                    : 'text-amber-700'
                }`}
              >
                {payment.payment_status}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]">
              <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Amount Paid</span>
              <span className="font-bold text-emerald-800">
                {payment.amount_paid !== null ? formatCurrency(payment.amount_paid) : '₹0.00'}
              </span>
            </div>
          </div>

          {/* Line items table if available */}
          {payment.line_items.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-left text-xs border border-[#EADFD0] rounded-lg">
                <thead className="bg-[#FDFBF8] border-b border-[#EADFD0] text-[10px] uppercase font-bold text-[#201E1C]/60">
                  <tr>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5 text-right">Quantity</th>
                    <th className="p-2.5 text-right">Unit Rate</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EADFD0]">
                  {payment.line_items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-medium text-[#201E1C]">{item.description}</td>
                      <td className="p-2.5 text-[#201E1C]/60">{item.item_type}</td>
                      <td className="p-2.5 text-right">{item.quantity}</td>
                      <td className="p-2.5 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="p-2.5 text-right font-bold">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Razorpay Gateway Audit */}
          <div className="p-3.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0] text-xs space-y-2">
            <span className="text-[10px] text-[#201E1C]/50 uppercase font-bold block">Gateway Telemetry</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-[#201E1C]/60">Razorpay Order ID: </span>
                <span className="font-mono text-[#201E1C]">{payment.razorpay_order_id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[#201E1C]/60">Razorpay Payment ID: </span>
                <span className="font-mono text-[#201E1C]">{payment.razorpay_payment_id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[#201E1C]/60">Method: </span>
                <span className="font-semibold text-[#201E1C]">{payment.payment_method || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[#201E1C]/60">Completed At: </span>
                <span className="text-[#201E1C]">
                  {payment.payment_completed_at ? formatDateTime(payment.payment_completed_at) : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: OTP & VERIFICATION AUDIT */}
      {/* ========================================================= */}
      {activeTab === 'VERIFICATION' && (
        <div className="bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs">
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#EADFD0]/60">
            <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
                Security Handshake & OTP Verification
              </h4>
              <span className="text-[11px] text-[#201E1C]/50">Tamper-Evident Authorization Audit</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs mb-5">
            <div className="p-3.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]">
              <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">OTP Status</span>
              <span
                className={`font-bold uppercase text-sm ${
                  otp.verification_status === 'VERIFIED'
                    ? 'text-emerald-700'
                    : otp.verification_status === 'EXPIRED'
                    ? 'text-red-700'
                    : 'text-amber-700'
                }`}
              >
                {otp.verification_status}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]">
              <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Verification Time</span>
              <span className="font-semibold text-[#201E1C]">
                {otp.verification_timestamp ? formatDateTime(otp.verification_timestamp) : 'Pending Verification'}
              </span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#FDFBF8] border border-[#EADFD0]">
              <span className="text-[10px] text-[#201E1C]/50 uppercase font-semibold block">Attempts Recorded</span>
              <span className="font-bold text-[#201E1C]">{otp.attempts_count} / 5</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-[#E5EBFF]/30 border border-[#7B91EE]/30 text-xs text-[#201E1C]/80">
            <div className="flex items-center gap-2 font-bold text-[#201E1C] mb-1">
              <ShieldCheck className="w-4 h-4 text-[#7B91EE]" />
              Zero-Knowledge Security Policy
            </div>
            <p className="text-[11px] text-[#201E1C]/70">
              For regulatory non-repudiation and security, raw customer OTP codes are cryptographically salted and never
              transmitted or rendered in any administrator or operator screen.
            </p>
          </div>
        </div>
      )}

      {/* Proof Photo Inspection Modal */}
      {showProofModal && collection.proof_url && (
        <Modal
          isOpen={showProofModal}
          onClose={() => setShowProofModal(false)}
          title={`Collection Evidence – ${detail.pickup_code}`}
          maxWidth="2xl"
        >
          <div className="p-4 space-y-4">
            <div className="rounded-lg overflow-hidden border border-[#EADFD0] bg-black/5">
              <img src={collection.proof_url} alt="Proof" className="w-full max-h-[70vh] object-contain mx-auto" />
            </div>
            <div className="flex items-center justify-between text-xs text-[#201E1C]/70">
              <span>Customer: {customer.display_name}</span>
              <a
                href={collection.proof_url}
                target="_blank"
                rel="noreferrer"
                download
                className="text-[#7B91EE] font-bold hover:underline flex items-center gap-1"
              >
                Open in Full Tab <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
