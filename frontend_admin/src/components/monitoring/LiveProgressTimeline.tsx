import React from 'react';
import {
  FileText,
  CalendarCheck,
  UserCheck,
  Truck,
  MapPin,
  QrCode,
  Scale,
  HandMetal,
  CreditCard,
  KeyRound,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { PickupTimelineStage } from '../../types/operations';
import { formatDateTime } from '../../utils/formatters';

interface LiveProgressTimelineProps {
  stages: PickupTimelineStage[];
  progressPercent: number;
  currentStageName: string;
  isDelayed?: boolean;
  delayReasons?: string[];
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

function getStageIcon(stageId: string, state: string) {
  if (state === 'FAILED' || state === 'CANCELLED') {
    return XCircle;
  }
  switch (stageId) {
    case 'REQUESTED':
      return FileText;
    case 'SCHEDULED':
      return CalendarCheck;
    case 'DRIVER_ASSIGNED':
      return UserCheck;
    case 'DRIVER_EN_ROUTE':
      return Truck;
    case 'DRIVER_ARRIVED':
      return MapPin;
    case 'COLLECTION_STARTED':
      return QrCode;
    case 'WEIGHT_RECORDED':
      return Scale;
    case 'CUSTOMER_HANDOVER':
      return HandMetal;
    case 'PAYMENT_COMPLETED':
      return CreditCard;
    case 'OTP_VERIFIED':
      return KeyRound;
    case 'PICKUP_COMPLETED':
      return CheckCircle2;
    default:
      return Clock;
  }
}

export const LiveProgressTimeline: React.FC<LiveProgressTimelineProps> = ({
  stages,
  progressPercent,
  currentStageName,
  isDelayed = false,
  delayReasons = [],
  className = '',
  orientation = 'horizontal',
}) => {
  const isCancelled = stages.some((s) => s.state === 'CANCELLED');
  const isFailed = stages.some((s) => s.state === 'FAILED');

  return (
    <div className={`bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs ${className}`}>
      {/* Timeline Header & Progress Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#EADFD0]/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#201E1C]">
              Live Progress Lifecycle
            </h3>
            {isCancelled ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                Cancelled
              </span>
            ) : isFailed ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                Failed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E5EBFF] text-[#201E1C] border border-[#7B91EE]/30">
                <span className="w-2 h-2 rounded-full bg-[#7B91EE] animate-pulse" />
                {currentStageName}
              </span>
            )}

            {isDelayed && !isCancelled && !isFailed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                Attention Required
              </span>
            )}
          </div>
          <p className="text-xs text-[#201E1C]/60 mt-1">
            Real-time milestone tracking verified against immutable system audit logs.
          </p>
        </div>

        {/* Progress Percentage Display */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-[#201E1C]/60 font-medium">Completion</span>
            <div className="text-lg font-black text-[#201E1C]">
              {isCancelled || isFailed ? '0%' : `${progressPercent}%`}
            </div>
          </div>
          <div className="w-24 bg-[#EADFD0]/40 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${
                isCancelled || isFailed
                  ? 'bg-red-500'
                  : progressPercent === 100
                  ? 'bg-emerald-600'
                  : 'bg-[#7B91EE]'
              }`}
              style={{ width: `${isCancelled || isFailed ? 100 : progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Delay Reasons Banner if applicable */}
      {delayReasons.length > 0 && (
        <div className="mb-5 p-3 rounded-lg bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold block">Operational Alert:</span>
            {delayReasons.map((reason, idx) => (
              <div key={idx} className="text-amber-800">
                • {reason}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Horizontal Stepper View (Desktop & Tablet) */}
      <div className="hidden lg:block overflow-x-auto pb-4">
        <div className="min-w-[900px] flex items-start justify-between relative px-2">
          {/* Connecting Line */}
          <div className="absolute top-5 left-8 right-8 h-0.5 bg-[#EADFD0] -z-0" />

          {stages.map((stage, idx) => {
            const Icon = getStageIcon(stage.stage_id, stage.state);
            const isCompleted = stage.state === 'COMPLETED';
            const isCurrent = stage.state === 'CURRENT';
            const isUpcoming = stage.state === 'UPCOMING';
            const isExceptional = stage.state === 'CANCELLED' || stage.state === 'FAILED';

            return (
              <div
                key={stage.stage_id}
                className="flex flex-col items-center relative z-10 text-center max-w-[95px]"
              >
                {/* Node Icon */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-50'
                      : isCurrent
                      ? 'bg-[#7B91EE] text-white shadow-md ring-4 ring-[#E5EBFF] animate-pulse'
                      : isExceptional
                      ? 'bg-red-600 text-white shadow-sm ring-4 ring-red-100'
                      : 'bg-[#FDFBF8] text-[#201E1C]/40 border-2 border-[#EADFD0]'
                  }`}
                  title={stage.description}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Stage Label */}
                <span
                  className={`mt-2.5 text-xs font-bold leading-tight ${
                    isCompleted
                      ? 'text-[#201E1C]'
                      : isCurrent
                      ? 'text-[#7B91EE] font-extrabold'
                      : isExceptional
                      ? 'text-red-700'
                      : 'text-[#201E1C]/50'
                  }`}
                >
                  {stage.name}
                </span>

                {/* Timestamp or Pending */}
                <span className="mt-1 text-[10px] text-[#201E1C]/60 whitespace-nowrap">
                  {stage.timestamp ? (
                    formatDateTime(stage.timestamp)
                  ) : isCurrent ? (
                    <span className="text-[#7B91EE] font-semibold">In Progress</span>
                  ) : (
                    'Pending'
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vertical Stepper View (Mobile / Responsive & Fallback) */}
      <div className="lg:hidden space-y-3">
        {stages.map((stage, idx) => {
          const Icon = getStageIcon(stage.stage_id, stage.state);
          const isCompleted = stage.state === 'COMPLETED';
          const isCurrent = stage.state === 'CURRENT';
          const isUpcoming = stage.state === 'UPCOMING';
          const isExceptional = stage.state === 'CANCELLED' || stage.state === 'FAILED';

          return (
            <div key={stage.stage_id} className="flex items-start gap-3 relative pb-4 last:pb-0">
              {idx < stages.length - 1 && (
                <div
                  className={`absolute top-8 left-4 w-0.5 h-[calc(100%-20px)] ${
                    isCompleted ? 'bg-emerald-500' : 'bg-[#EADFD0]'
                  }`}
                />
              )}

              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  isCompleted
                    ? 'bg-emerald-600 text-white'
                    : isCurrent
                    ? 'bg-[#7B91EE] text-white ring-4 ring-[#E5EBFF] animate-pulse'
                    : isExceptional
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-[#EADFD0] text-[#201E1C]/40'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-bold ${
                      isCompleted
                        ? 'text-[#201E1C]'
                        : isCurrent
                        ? 'text-[#7B91EE]'
                        : isExceptional
                        ? 'text-red-700'
                        : 'text-[#201E1C]/60'
                    }`}
                  >
                    {stage.name}
                  </span>
                  <span className="text-[10px] text-[#201E1C]/50">
                    {stage.timestamp ? formatDateTime(stage.timestamp) : isCurrent ? 'Active Now' : 'Pending'}
                  </span>
                </div>
                <p className="text-[11px] text-[#201E1C]/70 mt-0.5">{stage.description}</p>
                {stage.actor && (
                  <span className="text-[10px] text-[#201E1C]/50 mt-0.5 block">
                    Actor: <span className="font-medium text-[#201E1C]/70">{stage.actor}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

