import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Search,
  Filter,
  MapPin,
  Phone,
  Mail,
  Edit,
  Trash2,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  ExternalLink,
  Store,
  Hospital,
  Cross,
  Truck,
} from 'lucide-react';
import { customersApi } from '../api/operations';
import {
  CustomerResponse,
  CustomerDetailResponse,
  CustomerCreate,
  CustomerUpdate,
  CustomerLocationResponse,
  CustomerLocationCreate,
  CustomerLocationUpdate,
  CustomerType,
} from '../types/operations';

export const Customers: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetailResponse | null>(null);

  // Modals state
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerResponse | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerResponse | null>(null);

  const [showCreateLocationModal, setShowCreateLocationModal] = useState(false);
  const [locationToEdit, setLocationToEdit] = useState<CustomerLocationResponse | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<CustomerLocationResponse | null>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Queries
  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: () => customersApi.list(),
  });

  // Query details when customer is selected
  const { data: customerDetails, refetch: refetchDetails } = useQuery({
    queryKey: ['admin-customer-details', selectedCustomer?.id],
    queryFn: () => (selectedCustomer ? customersApi.getById(selectedCustomer.id) : null),
    enabled: !!selectedCustomer?.id,
  });

  // Active details object
  const activeDetail = customerDetails || selectedCustomer;

  // Mutations
  const createCustomerMutation = useMutation({
    mutationFn: (payload: CustomerCreate) => customersApi.create(payload),
    onSuccess: (newCust) => {
      showNotification('success', `Customer "${newCust.display_name}" created successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setShowCreateCustomerModal(false);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to create customer');
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CustomerUpdate }) =>
      customersApi.update(id, payload),
    onSuccess: (updated) => {
      showNotification('success', `Customer "${updated.display_name}" updated`);
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      if (selectedCustomer?.id === updated.id) {
        refetchDetails();
      }
      setCustomerToEdit(null);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to update customer');
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: (id: number) => customersApi.delete(id),
    onSuccess: () => {
      showNotification('success', 'Customer deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      if (selectedCustomer?.id === customerToDelete?.id) {
        setSelectedCustomer(null);
      }
      setCustomerToDelete(null);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to delete customer');
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: ({ customerId, payload }: { customerId: number; payload: CustomerLocationCreate }) =>
      customersApi.createLocation(customerId, payload),
    onSuccess: () => {
      showNotification('success', 'Location added successfully');
      refetchDetails();
      setShowCreateLocationModal(false);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to add location');
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: ({ locationId, payload }: { locationId: number; payload: CustomerLocationUpdate }) =>
      customersApi.updateLocation(locationId, payload),
    onSuccess: () => {
      showNotification('success', 'Location updated successfully');
      refetchDetails();
      setLocationToEdit(null);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to update location');
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: (locationId: number) => customersApi.deleteLocation(locationId),
    onSuccess: () => {
      showNotification('success', 'Location removed successfully');
      refetchDetails();
      setLocationToDelete(null);
    },
    onError: (err: any) => {
      showNotification('error', err?.response?.data?.detail || 'Failed to delete location');
    },
  });

  // Filtered customers
  const filteredCustomers = customers.filter((cust) => {
    const matchesSearch =
      cust.legal_name.toLowerCase().includes(search.toLowerCase()) ||
      cust.display_name.toLowerCase().includes(search.toLowerCase()) ||
      cust.email.toLowerCase().includes(search.toLowerCase()) ||
      cust.phone.includes(search) ||
      (cust.gst_number && cust.gst_number.toLowerCase().includes(search.toLowerCase()));

    const matchesType = selectedType === 'ALL' || cust.customer_type === selectedType;
    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type: CustomerType) => {
    switch (type) {
      case 'HOSPITAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Hospital className="w-3 h-3" /> Hospital
          </span>
        );
      case 'PHARMACY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Store className="w-3 h-3" /> Pharmacy
          </span>
        );
      case 'CLINIC':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Cross className="w-3 h-3" /> Clinic
          </span>
        );
      case 'DISTRIBUTOR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Truck className="w-3 h-3" /> Distributor
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-charcoal-700 text-charcoal-300">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-charcoal-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Building2 className="w-7 h-7 text-periwinkle" />
            Customers & Locations
          </h1>
          <p className="text-xs text-charcoal-400 mt-1">
            Full admin control: Manage healthcare generators, pharmacies, distributors, and pickup branch locations.
          </p>
        </div>

        <button
          onClick={() => setShowCreateCustomerModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold text-xs rounded-xl shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Register New Customer
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
          <input
            type="text"
            placeholder="Search by legal name, display name, phone, email, or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-charcoal-900 border border-charcoal-800 rounded-xl text-xs text-white placeholder-charcoal-500 focus:outline-none focus:border-periwinkle/60 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-charcoal-400" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2.5 bg-charcoal-900 border border-charcoal-800 rounded-xl text-xs text-white focus:outline-none focus:border-periwinkle/60 transition-colors"
          >
            <option value="ALL">All Facility Types</option>
            <option value="PHARMACY">Pharmacies</option>
            <option value="HOSPITAL">Hospitals</option>
            <option value="CLINIC">Clinics</option>
            <option value="DISTRIBUTOR">Distributors</option>
          </select>
        </div>
      </div>

      {/* Main Content: Split List and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List Column */}
        <div className={`space-y-3 ${activeDetail ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-charcoal-800 flex items-center justify-between">
              <span className="text-xs font-bold text-charcoal-400 uppercase tracking-wider">
                Customers ({filteredCustomers.length})
              </span>
              <button
                onClick={() => refetch()}
                className="text-xs text-periwinkle hover:underline font-semibold"
              >
                Refresh
              </button>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-charcoal-400">Loading customers...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-xs text-charcoal-500">
                No customers found matching your criteria.
              </div>
            ) : (
              <div className="divide-y divide-charcoal-800">
                {filteredCustomers.map((cust) => {
                  const isSelected = activeDetail?.id === cust.id;
                  return (
                    <div
                      key={cust.id}
                      className={`p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-charcoal-800/50 cursor-pointer ${
                        isSelected ? 'bg-charcoal-800/80 border-l-4 border-l-periwinkle' : ''
                      }`}
                      onClick={() => {
                        setSelectedCustomer(cust as CustomerDetailResponse);
                        customersApi.getById(cust.id).then((res) => setSelectedCustomer(res));
                      }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{cust.display_name}</h3>
                          <span className="text-xs text-charcoal-400">({cust.legal_name})</span>
                          {getTypeBadge(cust.customer_type)}
                          {cust.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                              Inactive
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-charcoal-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-charcoal-500" />
                            {cust.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-charcoal-500" />
                            {cust.email}
                          </span>
                          {cust.gst_number && (
                            <span className="text-[11px] text-charcoal-500">GST: {cust.gst_number}</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div
                        className="flex items-center gap-2 self-end sm:self-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setCustomerToEdit(cust)}
                          title="Edit Customer"
                          className="p-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 hover:text-white transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCustomerToDelete(cust)}
                          title="Delete Customer"
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-charcoal-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Selected Customer Details & Locations Drawer */}
        {activeDetail && (
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl p-5 space-y-5 sticky top-20 shadow-lg">
              <div className="flex items-start justify-between border-b border-charcoal-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{activeDetail.display_name}</h2>
                    {getTypeBadge(activeDetail.customer_type)}
                  </div>
                  <p className="text-xs text-charcoal-400 mt-0.5">{activeDetail.legal_name}</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1 text-charcoal-500 hover:text-white rounded-lg hover:bg-charcoal-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Overview Details */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-charcoal-800/40 p-3 rounded-xl border border-charcoal-800">
                <div>
                  <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">
                    Phone
                  </span>
                  <span className="font-medium text-charcoal-200">{activeDetail.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">
                    Email
                  </span>
                  <span className="font-medium text-charcoal-200 truncate block">
                    {activeDetail.email}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">
                    GSTIN
                  </span>
                  <span className="font-medium text-charcoal-200">
                    {activeDetail.gst_number || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">
                    PAN
                  </span>
                  <span className="font-medium text-charcoal-200">
                    {activeDetail.pan_number || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Type-Specific Profile Section */}
              <div className="bg-charcoal-800/40 p-3.5 rounded-xl border border-charcoal-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-periwinkle uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-periwinkle" />
                    {activeDetail.customer_type} Profile
                  </h3>
                  {activeDetail.pharmacy_profile?.license_verified ||
                  activeDetail.distributor_profile?.license_verified ||
                  activeDetail.hospital_profile?.registration_verified ||
                  activeDetail.clinic_profile?.registration_verified ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <AlertCircle className="w-3 h-3" /> Pending Verification
                    </span>
                  )}
                </div>

                {activeDetail.customer_type === 'PHARMACY' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Pharmacy License</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.pharmacy_profile?.pharmacy_license_number || 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Pharmacist Name</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.pharmacy_profile?.pharmacist_name || 'Not provided'}
                      </span>
                    </div>
                  </div>
                )}

                {activeDetail.customer_type === 'DISTRIBUTOR' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Distribution License</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.distributor_profile?.distribution_license_number || 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Warehouse Count</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.distributor_profile?.warehouse_count ?? 1}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Coverage Area</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.distributor_profile?.coverage_area || 'Not provided'}
                      </span>
                    </div>
                  </div>
                )}

                {activeDetail.customer_type === 'HOSPITAL' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Registration Number</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.hospital_profile?.registration_number || 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Hospital Type</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.hospital_profile?.hospital_type || 'General'}
                      </span>
                    </div>
                    {activeDetail.hospital_profile?.department_count != null && (
                      <div>
                        <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Departments</span>
                        <span className="font-medium text-charcoal-200">
                          {activeDetail.hospital_profile?.department_count}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {activeDetail.customer_type === 'CLINIC' && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Registration Number</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.clinic_profile?.registration_number || 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Doctor Name</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.clinic_profile?.doctor_name || 'Not provided'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Clinic Type</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.clinic_profile?.clinic_type || 'Outpatient'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-charcoal-500 uppercase tracking-wider block">Speciality</span>
                      <span className="font-medium text-charcoal-200">
                        {activeDetail.clinic_profile?.speciality || 'General Medicine'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Locations Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-charcoal-300 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-periwinkle" />
                    Pickup Locations ({activeDetail.locations?.length || 0})
                  </h3>
                  <button
                    onClick={() => setShowCreateLocationModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-periwinkle hover:underline bg-periwinkle/10 px-2.5 py-1 rounded-lg border border-periwinkle/20"
                  >
                    <Plus className="w-3 h-3" /> Add Branch
                  </button>
                </div>

                {(!activeDetail.locations || activeDetail.locations.length === 0) ? (
                  <div className="text-center py-6 border border-dashed border-charcoal-800 rounded-xl text-xs text-charcoal-500">
                    No pickup locations registered yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {activeDetail.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="p-3 bg-charcoal-800/60 rounded-xl border border-charcoal-700/60 space-y-2 hover:border-charcoal-600 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{loc.name}</span>
                              {loc.is_primary && (
                                <span className="text-[9px] font-bold uppercase bg-periwinkle/20 text-periwinkle px-1.5 py-0.2 rounded border border-periwinkle/30">
                                  Primary
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-charcoal-300 mt-0.5">
                              {loc.address_line_1}
                              {loc.address_line_2 ? `, ${loc.address_line_2}` : ''}
                            </p>
                            <p className="text-[11px] text-charcoal-400">
                              {loc.city}, {loc.state} - {loc.postal_code}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setLocationToEdit(loc)}
                              className="p-1 hover:bg-charcoal-700 rounded text-charcoal-400 hover:text-white"
                              title="Edit Location"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setLocationToDelete(loc)}
                              className="p-1 hover:bg-rose-500/20 rounded text-rose-400 hover:text-rose-300"
                              title="Delete Location"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {(loc.contact_name || loc.contact_phone) && (
                          <div className="pt-2 border-t border-charcoal-700/50 flex items-center justify-between text-[11px] text-charcoal-400">
                            <span>Contact: {loc.contact_name || 'N/A'}</span>
                            <span>{loc.contact_phone}</span>
                          </div>
                        )}

                        <div className="text-[10px] text-charcoal-500 font-mono">
                          Coords: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* Create Customer Modal */}
      {/* ======================================================== */}
      {showCreateCustomerModal && (
        <CreateCustomerModal
          onClose={() => setShowCreateCustomerModal(false)}
          onSubmit={(payload) => createCustomerMutation.mutate(payload)}
          isSubmitting={createCustomerMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Edit Customer Modal */}
      {/* ======================================================== */}
      {customerToEdit && (
        <EditCustomerModal
          customer={customerToEdit}
          onClose={() => setCustomerToEdit(null)}
          onSubmit={(payload) =>
            updateCustomerMutation.mutate({ id: customerToEdit.id, payload })
          }
          isSubmitting={updateCustomerMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Delete Customer Confirmation */}
      {/* ======================================================== */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Customer</h3>
            </div>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to delete customer{' '}
              <strong className="text-white">"{customerToDelete.display_name}"</strong>? This will
              remove all associated locations and contracts.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCustomerMutation.mutate(customerToDelete.id)}
                disabled={deleteCustomerMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {deleteCustomerMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Add Location Modal */}
      {/* ======================================================== */}
      {showCreateLocationModal && activeDetail && (
        <LocationFormModal
          title={`Add Pickup Location for ${activeDetail.display_name}`}
          onClose={() => setShowCreateLocationModal(false)}
          onSubmit={(payload) =>
            createLocationMutation.mutate({ customerId: activeDetail.id, payload })
          }
          isSubmitting={createLocationMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Edit Location Modal */}
      {/* ======================================================== */}
      {locationToEdit && (
        <LocationFormModal
          title={`Edit Location: ${locationToEdit.name}`}
          initialData={locationToEdit}
          onClose={() => setLocationToEdit(null)}
          onSubmit={(payload) =>
            updateLocationMutation.mutate({ locationId: locationToEdit.id, payload })
          }
          isSubmitting={updateLocationMutation.isPending}
        />
      )}

      {/* ======================================================== */}
      {/* Delete Location Confirmation */}
      {/* ======================================================== */}
      {locationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Location</h3>
            </div>
            <p className="text-xs text-charcoal-300 leading-relaxed">
              Are you sure you want to remove the location{' '}
              <strong className="text-white">"{locationToDelete.name}"</strong>?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setLocationToDelete(null)}
                className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteLocationMutation.mutate(locationToDelete.id)}
                disabled={deleteLocationMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {deleteLocationMutation.isPending ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// Helper Component: Create Customer Modal
// ========================================================
interface CreateCustomerModalProps {
  onClose: () => void;
  onSubmit: (payload: CustomerCreate) => void;
  isSubmitting: boolean;
}

const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [customerType, setCustomerType] = useState<CustomerType>('PHARMACY');
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');

  // Profile specific fields
  const [pharmacyLicense, setPharmacyLicense] = useState('');
  const [pharmacistName, setPharmacistName] = useState('');
  const [distributorLicense, setDistributorLicense] = useState('');
  const [warehouseCount, setWarehouseCount] = useState('1');
  const [coverageArea, setCoverageArea] = useState('');
  const [hospitalRegNo, setHospitalRegNo] = useState('');
  const [hospitalType, setHospitalType] = useState('Multi-Speciality');
  const [departmentCount, setDepartmentCount] = useState('');
  const [clinicRegNo, setClinicRegNo] = useState('');
  const [clinicType, setClinicType] = useState('Speciality Clinic');
  const [doctorName, setDoctorName] = useState('');
  const [speciality, setSpeciality] = useState('General Medicine');

  // Primary Location fields
  const [locName, setLocName] = useState('Main Branch');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [state, setState] = useState('Karnataka');
  const [postalCode, setPostalCode] = useState('560001');
  const [latitude, setLatitude] = useState('12.9716');
  const [longitude, setLongitude] = useState('77.5946');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const profilePayload: Record<string, any> = {};
    if (customerType === 'PHARMACY') {
      if (pharmacyLicense) profilePayload.pharmacy_license_number = pharmacyLicense;
      if (pharmacistName) profilePayload.pharmacist_name = pharmacistName;
    } else if (customerType === 'DISTRIBUTOR') {
      if (distributorLicense) profilePayload.distribution_license_number = distributorLicense;
      if (warehouseCount) profilePayload.warehouse_count = parseInt(warehouseCount) || 1;
      if (coverageArea) profilePayload.coverage_area = coverageArea;
    } else if (customerType === 'HOSPITAL') {
      if (hospitalRegNo) profilePayload.registration_number = hospitalRegNo;
      if (hospitalType) profilePayload.hospital_type = hospitalType;
      if (departmentCount) profilePayload.department_count = parseInt(departmentCount) || undefined;
    } else if (customerType === 'CLINIC') {
      if (clinicRegNo) profilePayload.registration_number = clinicRegNo;
      if (clinicType) profilePayload.clinic_type = clinicType;
      if (doctorName) profilePayload.doctor_name = doctorName;
      if (speciality) profilePayload.speciality = speciality;
    }

    const payload: CustomerCreate = {
      customer_type: customerType,
      legal_name: legalName,
      display_name: displayName,
      phone,
      email,
      gst_number: gstNumber || null,
      pan_number: panNumber || null,
      is_active: true,
      profile: Object.keys(profilePayload).length > 0 ? profilePayload : null,
      location: addressLine1
        ? {
            name: locName,
            address_line_1: addressLine1,
            city,
            state,
            postal_code: postalCode,
            latitude: parseFloat(latitude) || 0.0,
            longitude: parseFloat(longitude) || 0.0,
            is_primary: true,
          }
        : null,
    };
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-periwinkle" />
            Register Customer Organization
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Organization Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-periwinkle uppercase tracking-wider">
              1. Organization Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-charcoal-400 mb-1">Customer Facility Type *</label>
                <select
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  required
                >
                  <option value="PHARMACY">Retail Pharmacy / Chemist</option>
                  <option value="HOSPITAL">Hospital / Nursing Home</option>
                  <option value="CLINIC">Diagnostic Clinic</option>
                  <option value="DISTRIBUTOR">Pharma Distributor</option>
                </select>
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">Display Name (Brand) *</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Health Pharmacy"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-charcoal-400 mb-1">Legal Registered Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Healthcare Private Limited"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  required
                />
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">Official Contact Phone *</label>
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  required
                />
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">Billing Email *</label>
                <input
                  type="email"
                  placeholder="admin@apexpharmacy.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  required
                />
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">GST Number (Optional)</label>
                <input
                  type="text"
                  placeholder="27AAAAA0000A1Z5"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white uppercase focus:outline-none focus:border-periwinkle"
                />
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">PAN Number (Optional)</label>
                <input
                  type="text"
                  placeholder="ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white uppercase focus:outline-none focus:border-periwinkle"
                />
              </div>
            </div>
          </div>

          {/* Customer Type Profile Details */}
          <div className="space-y-3 pt-3 border-t border-charcoal-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-periwinkle uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                2. {customerType} Profile Credentials (Optional)
              </h3>
              <span className="text-[10px] text-charcoal-500 italic">Auto-created if omitted</span>
            </div>

            {customerType === 'PHARMACY' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-charcoal-800/40 p-3 rounded-xl border border-charcoal-800">
                <div>
                  <label className="block text-charcoal-400 mb-1">Drug / Pharmacy License No.</label>
                  <input
                    type="text"
                    placeholder="e.g. MH-MZ2-123456"
                    value={pharmacyLicense}
                    onChange={(e) => setPharmacyLicense(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-400 mb-1">Registered Pharmacist Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar, B.Pharm"
                    value={pharmacistName}
                    onChange={(e) => setPharmacistName(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
              </div>
            )}

            {customerType === 'DISTRIBUTOR' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-charcoal-800/40 p-3 rounded-xl border border-charcoal-800">
                <div>
                  <label className="block text-charcoal-400 mb-1">Distribution License No.</label>
                  <input
                    type="text"
                    placeholder="e.g. DIST-2026-99"
                    value={distributorLicense}
                    onChange={(e) => setDistributorLicense(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-400 mb-1">Warehouse Count</label>
                  <input
                    type="number"
                    min="1"
                    value={warehouseCount}
                    onChange={(e) => setWarehouseCount(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-400 mb-1">Coverage Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Greater Mumbai"
                    value={coverageArea}
                    onChange={(e) => setCoverageArea(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
              </div>
            )}

            {customerType === 'HOSPITAL' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-charcoal-800/40 p-3 rounded-xl border border-charcoal-800">
                <div>
                  <label className="block text-charcoal-400 mb-1">Registration Number</label>
                  <input
                    type="text"
                    placeholder="e.g. HOSP-REG-001"
                    value={hospitalRegNo}
                    onChange={(e) => setHospitalRegNo(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-400 mb-1">Hospital Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Multi-Speciality"
                    value={hospitalType}
                    onChange={(e) => setHospitalType(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-400 mb-1">Department Count</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 12"
                    value={departmentCount}
                    onChange={(e) => setDepartmentCount(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
              </div>
            )}

            {customerType === 'CLINIC' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-charcoal-800/40 p-3 rounded-xl border border-charcoal-800">
                <div>
                  <label className="block text-charcoal-400 mb-1">Clinical Registration No.</label>
                  <input
                    type="text"
                    placeholder="e.g. CLINIC-MH-44"
                    value={clinicRegNo}
                    onChange={(e) => setClinicRegNo(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-400 mb-1">Attending Doctor Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. S. Mehta, MD"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-400 mb-1">Clinic Type</label>
                  <input
                    type="text"
                    placeholder="e.g. Day Clinic"
                    value={clinicType}
                    onChange={(e) => setClinicType(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
                <div>
                  <label className="block text-charcoal-400 mb-1">Primary Speciality</label>
                  <input
                    type="text"
                    placeholder="e.g. General Medicine"
                    value={speciality}
                    onChange={(e) => setSpeciality(e.target.value)}
                    className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Primary Branch Location */}
          <div className="space-y-3 pt-3 border-t border-charcoal-800">
            <h3 className="text-xs font-bold text-periwinkle uppercase tracking-wider">
              3. Primary Pickup Location (Branch)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-charcoal-400 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                />
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="101 MG Road, Fort"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                />
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">City</label>
                <input
                  type="text"
                  placeholder="Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                />
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">State & Postal Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Maharashtra"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-1/2 px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                  <input
                    type="text"
                    placeholder="400001"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-1/2 px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                  />
                </div>
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">GPS Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                />
              </div>

              <div>
                <label className="block text-charcoal-400 mb-1">GPS Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// Helper Component: Edit Customer Modal
// ========================================================
interface EditCustomerModalProps {
  customer: CustomerResponse;
  onClose: () => void;
  onSubmit: (payload: CustomerUpdate) => void;
  isSubmitting: boolean;
}

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  customer,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [customerType, setCustomerType] = useState<CustomerType>(customer.customer_type);
  const [legalName, setLegalName] = useState(customer.legal_name);
  const [displayName, setDisplayName] = useState(customer.display_name);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email);
  const [gstNumber, setGstNumber] = useState(customer.gst_number || '');
  const [panNumber, setPanNumber] = useState(customer.pan_number || '');
  const [isActive, setIsActive] = useState(customer.is_active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      customer_type: customerType,
      legal_name: legalName,
      display_name: displayName,
      phone,
      email,
      gst_number: gstNumber || null,
      pan_number: panNumber || null,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Edit className="w-5 h-5 text-periwinkle" />
            Edit Customer Details
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Facility Type</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as CustomerType)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
            >
              <option value="PHARMACY">Pharmacy</option>
              <option value="HOSPITAL">Hospital</option>
              <option value="CLINIC">Clinic</option>
              <option value="DISTRIBUTOR">Distributor</option>
            </select>
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Legal Name</label>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-400 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                required
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-400 mb-1">GSTIN</label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">PAN</label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-charcoal-800 border-charcoal-700 text-periwinkle focus:ring-0"
            />
            <label htmlFor="isActive" className="text-charcoal-300">
              Active account (eligible for pickups and billing)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ========================================================
// Helper Component: Location Form Modal (Create / Edit)
// ========================================================
interface LocationFormModalProps {
  title: string;
  initialData?: CustomerLocationResponse;
  onClose: () => void;
  onSubmit: (payload: CustomerLocationCreate) => void;
  isSubmitting: boolean;
}

const LocationFormModal: React.FC<LocationFormModalProps> = ({
  title,
  initialData,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [addressLine1, setAddressLine1] = useState(initialData?.address_line_1 || '');
  const [addressLine2, setAddressLine2] = useState(initialData?.address_line_2 || '');
  const [city, setCity] = useState(initialData?.city || 'Bengaluru');
  const [state, setState] = useState(initialData?.state || 'Karnataka');
  const [postalCode, setPostalCode] = useState(initialData?.postal_code || '560001');
  const [latitude, setLatitude] = useState(initialData?.latitude.toString() || '12.9716');
  const [longitude, setLongitude] = useState(initialData?.longitude.toString() || '77.5946');
  const [contactName, setContactName] = useState(initialData?.contact_name || '');
  const [contactPhone, setContactPhone] = useState(initialData?.contact_phone || '');
  const [isPrimary, setIsPrimary] = useState(initialData?.is_primary || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      address_line_1: addressLine1,
      address_line_2: addressLine2 || null,
      city,
      state,
      postal_code: postalCode,
      latitude: parseFloat(latitude) || 0.0,
      longitude: parseFloat(longitude) || 0.0,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      is_primary: isPrimary,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-charcoal-900 border border-charcoal-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-charcoal-800 pb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-periwinkle" />
            {title}
          </h2>
          <button onClick={onClose} className="p-1 text-charcoal-400 hover:text-white rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-charcoal-400 mb-1">Branch / Location Name *</label>
            <input
              type="text"
              placeholder="e.g. South Mumbai Chemist Depot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Address Line 1 *</label>
            <input
              type="text"
              placeholder="Shop 4, Grand Arcade, MG Road"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              required
            />
          </div>

          <div>
            <label className="block text-charcoal-400 mb-1">Address Line 2 (Optional)</label>
            <input
              type="text"
              placeholder="Near Metro Station"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-charcoal-400 mb-1">City *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                required
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">State *</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                required
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">PIN Code *</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-400 mb-1">Latitude *</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                required
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">Longitude *</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-charcoal-400 mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="Dr. Rajesh / Branch Mgr"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              />
            </div>
            <div>
              <label className="block text-charcoal-400 mb-1">Contact Phone</label>
              <input
                type="text"
                placeholder="+919876543210"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-xl text-white focus:outline-none focus:border-periwinkle"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded bg-charcoal-800 border-charcoal-700 text-periwinkle focus:ring-0"
            />
            <label htmlFor="isPrimary" className="text-charcoal-300">
              Set as primary branch location
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-charcoal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-periwinkle hover:bg-periwinkle/90 text-charcoal-900 font-bold rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Customers;
