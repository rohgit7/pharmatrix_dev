import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, Truck, AlertTriangle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { fleetApi } from '../../api/operations';
import { DriverResponse, VehicleResponse } from '../../types/operations';

interface ReassignDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  pickupCode: string;
  currentDriverName?: string | null;
  onConfirm: (driverId: number, vehicleId: number | null, reason: string) => Promise<void>;
  isLoading?: boolean;
}

export const ReassignDriverModal: React.FC<ReassignDriverModalProps> = ({
  isOpen,
  onClose,
  pickupCode,
  currentDriverName,
  onConfirm,
  isLoading = false,
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<number | ''>('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | ''>('');
  const [reason, setReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queries for active drivers and available vehicles
  const { data: drivers = [] } = useQuery({
    queryKey: ['adminDriversList'],
    queryFn: () => fleetApi.listDrivers(0, 100),
    enabled: isOpen,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['adminVehiclesList'],
    queryFn: () => fleetApi.listVehicles(0, 100),
    enabled: isOpen,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId) {
      setErrorMsg('Please select a replacement driver.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Please provide an operational reason for this reassignment.');
      return;
    }

    try {
      setErrorMsg(null);
      await onConfirm(
        Number(selectedDriverId),
        selectedVehicleId ? Number(selectedVehicleId) : null,
        reason.trim()
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to reassign driver.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reassign Driver – ${pickupCode}`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
        {currentDriverName && (
          <div className="p-3 rounded-lg bg-[#FDFBF8] border border-[#EADFD0] flex items-center justify-between">
            <span className="text-[#201E1C]/60">Current Assigned Driver:</span>
            <span className="font-bold text-[#201E1C]">{currentDriverName}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#201E1C]/60 mb-1.5">
            New Driver *
          </label>
          <select
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value ? Number(e.target.value) : '')}
            required
            className="w-full px-3 py-2 rounded-lg border border-[#EADFD0] bg-white text-xs focus:outline-hidden focus:ring-2 focus:ring-[#7B91EE]"
          >
            <option value="">Select an active driver...</option>
            {drivers
              .filter((d) => d.status === 'ACTIVE')
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.employee_id} – {d.phone}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#201E1C]/60 mb-1.5">
            Vehicle (Optional)
          </label>
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 rounded-lg border border-[#EADFD0] bg-white text-xs focus:outline-hidden focus:ring-2 focus:ring-[#7B91EE]"
          >
            <option value="">Retain current vehicle or assign new...</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration_number} ({v.vehicle_type}) – Capacity: {v.capacity_kg} kg
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#201E1C]/60 mb-1.5">
            Operational Reason *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Primary driver vehicle breakdown, route load balancing, or urgent reassignment."
            required
            className="w-full px-3 py-2 rounded-lg border border-[#EADFD0] bg-white text-xs focus:outline-hidden focus:ring-2 focus:ring-[#7B91EE]"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#EADFD0]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-[#EADFD0] text-[#201E1C] hover:bg-gray-50 font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 rounded-lg bg-[#201E1C] text-white hover:bg-black font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4 text-[#7B91EE]" />
            {isLoading ? 'Reassigning...' : 'Confirm Reassignment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
