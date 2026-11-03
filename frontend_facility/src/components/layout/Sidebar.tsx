import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Scale,
  Flame,
  FileCheck,
  ShieldCheck,
  Factory,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { facility } = useAuth();

  const sections = [
    {
      group: 'FACILITY OPERATIONS',
      items: [
        { name: 'Dashboard', to: '/', icon: LayoutDashboard },
        { name: 'Incoming Shipments', to: '/shipments', icon: Truck },
        { name: 'Receive Shipment', to: '/receive', icon: Scale },
        { name: 'Disposal Management', to: '/disposal', icon: Flame },
        { name: 'Disposal Certificates', to: '/certificates', icon: FileCheck },
      ],
    },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-30 h-screen bg-charcoal-900 border-r border-charcoal-800 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-charcoal-800 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-periwinkle flex items-center justify-center flex-shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-charcoal-900 font-bold" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold text-white tracking-tight leading-none">
                Pharmatrix
              </span>
              <span className="text-[10px] font-semibold text-periwinkle uppercase tracking-widest mt-1">
                Disposal Facility Portal
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Active Facility Station Card */}
      {!isCollapsed && facility && (
        <div className="mx-3 mt-4 p-3 rounded-xl bg-charcoal-800/80 border border-charcoal-700/80">
          <div className="flex items-center gap-2 text-periwinkle text-[10px] font-bold uppercase tracking-wider">
            <Factory className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{facility.facility_code}</span>
          </div>
          <p className="text-xs font-semibold text-white mt-1 truncate" title={facility.legal_name}>
            {facility.legal_name}
          </p>
          <p className="text-[11px] text-charcoal-400 mt-0.5 truncate">
            {facility.city}, {facility.state} · Lic: {facility.license_number}
          </p>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {sections.map((section) => (
          <div key={section.group} className="space-y-1">
            {!isCollapsed && (
              <h4 className="px-3 text-[10px] font-bold text-charcoal-400 uppercase tracking-widest mb-1.5">
                {section.group}
              </h4>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-periwinkle text-charcoal-900 shadow-sm font-bold'
                      : 'text-charcoal-300 hover:text-white hover:bg-charcoal-800'
                  } ${isCollapsed ? 'justify-center' : ''}`
                }
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Collapse Toggle Footer */}
      <div className="p-3 border-t border-charcoal-800">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-charcoal-400 hover:text-white hover:bg-charcoal-800 transition-colors text-xs font-medium"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

