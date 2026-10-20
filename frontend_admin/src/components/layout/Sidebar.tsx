import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  MapPin,
  Warehouse,
  Factory,
  AlertOctagon,
  FileCheck,
  Users,
  CreditCard,
  Sliders,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const navSections = [
    {
      group: 'Operations',
      items: [
        { name: 'Overview', to: '/', icon: LayoutDashboard },
        { name: 'Pickups', to: '/pickups', icon: CalendarCheck },
        { name: 'Routes & Dispatch', to: '/routes', icon: MapPin },
        { name: 'Warehouses', to: '/warehouses', icon: Warehouse },
        { name: 'Treatment Facilities', to: '/facilities', icon: Factory },
        { name: 'Exceptions & Proofs', to: '/exceptions', icon: AlertOctagon },
      ],
    },
    {
      group: 'Compliance & Fleet',
      items: [
        { name: 'Customer Documents', to: '/documents', icon: FileCheck },
        { name: 'Fleet & Drivers', to: '/fleet', icon: Users },
        { name: 'Billing & Invoices', to: '/invoices', icon: CreditCard },
      ],
    },
    {
      group: 'Administration',
      items: [
        { name: 'Configuration & Audit', to: '/configuration', icon: Sliders },
        { name: 'WhatsApp Templates', to: '/whatsapp-templates', icon: MessageSquare },
        { name: 'System Settings', to: '/settings', icon: Settings },
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
                Admin Control Tower
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {!isCollapsed && (
              <h4 className="px-3 text-[11px] font-semibold text-charcoal-400 uppercase tracking-wider mb-2">
                {section.group}
              </h4>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-periwinkle text-charcoal-900 shadow-sm font-semibold'
                      : 'text-charcoal-300 hover:text-white hover:bg-charcoal-800'
                  } ${isCollapsed ? 'justify-center' : ''}`
                }
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
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
