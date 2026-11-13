import React, { useState } from 'react';
import {
  History,
  User,
  ShieldAlert,
  ShieldCheck,
  Truck,
  CheckCircle2,
  Clock,
  Filter,
  Code,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PickupEventItem } from '../../types/operations';
import { formatDateTime } from '../../utils/formatters';

interface PickupActivityLogProps {
  events: PickupEventItem[];
  className?: string;
}

export const PickupActivityLog: React.FC<PickupActivityLogProps> = ({ events, className = '' }) => {
  const [filterActor, setFilterActor] = useState<string>('ALL');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const filteredEvents = events.filter((ev) => {
    if (filterActor === 'ALL') return true;
    return ev.actor_type.toUpperCase() === filterActor.toUpperCase();
  });

  const getActorBadge = (actorType: string) => {
    switch (actorType.toUpperCase()) {
      case 'DRIVER':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'CUSTOMER':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'ADMIN':
        return 'bg-amber-50 text-amber-900 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-[#EADFD0] p-5 shadow-xs ${className}`}>
      {/* Activity Log Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-[#EADFD0]/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E5EBFF] flex items-center justify-center text-[#7B91EE]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#201E1C]">
              Immutable Audit & Event History
            </h4>
            <span className="text-[11px] text-[#201E1C]/50">
              Chronological log of every system transition and field actor
            </span>
          </div>
        </div>

        {/* Filter by Actor */}
        <div className="flex items-center gap-1 bg-[#FDFBF8] p-1 rounded-lg border border-[#EADFD0] text-xs">
          {['ALL', 'CUSTOMER', 'DRIVER', 'ADMIN', 'SYSTEM'].map((actor) => (
            <button
              key={actor}
              onClick={() => setFilterActor(actor)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                filterActor === actor
                  ? 'bg-white shadow-xs text-[#201E1C] border border-[#EADFD0]'
                  : 'text-[#201E1C]/60 hover:text-[#201E1C]'
              }`}
            >
              {actor}
            </button>
          ))}
        </div>
      </div>

      {/* Events Timeline List */}
      {filteredEvents.length > 0 ? (
        <div className="space-y-4">
          {filteredEvents.map((event, idx) => {
            const isExpanded = expandedEventId === event.id;
            const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

            return (
              <div key={event.id || idx} className="flex items-start gap-3 text-xs">
                {/* Visual Bullet */}
                <div className="w-6 h-6 rounded-full bg-[#E5EBFF] text-[#7B91EE] flex items-center justify-center shrink-0 mt-0.5 border border-[#7B91EE]/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0 bg-[#FDFBF8] border border-[#EADFD0]/80 rounded-lg p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#201E1C] text-xs">{event.title}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getActorBadge(
                          event.actor_type
                        )}`}
                      >
                        {event.actor_name || event.actor_type}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#201E1C]/50 font-mono">
                      {formatDateTime(event.created_at)}
                    </span>
                  </div>

                  {event.description && (
                    <p className="text-xs text-[#201E1C]/80 mt-1">{event.description}</p>
                  )}

                  {/* Metadata Dropdown */}
                  {hasMetadata && (
                    <div className="mt-2 pt-2 border-t border-[#EADFD0]/40">
                      <button
                        onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                        className="text-[10px] text-[#7B91EE] font-bold flex items-center gap-1 hover:underline"
                      >
                        <Code className="w-3 h-3" />
                        {isExpanded ? 'Hide Event Metadata' : 'Inspect Technical Payload'}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-2 rounded bg-[#201E1C] text-emerald-400 font-mono text-[10px] overflow-x-auto leading-relaxed max-h-48">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-[#201E1C]/50 border border-dashed border-[#EADFD0] rounded-lg">
          No audit events recorded under this filter.
        </div>
      )}
    </div>
  );
};

