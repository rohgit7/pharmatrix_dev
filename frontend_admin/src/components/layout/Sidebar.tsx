import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Route,
  MapPin,
  Users,
  Building2,
  Navigation,
  CreditCard,
  FileCheck,
  ShieldCheck,
  Sliders,
  History,
  Warehouse,
  Factory,
  AlertOctagon,
  MessageSquare,
  Settings,
  Scale,
  Flame,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const [showUtilities, setShowUtilities] = useState(false);

  const mainSections = [
    {
      group: 'OPERATIONS',
      items: [
        { name: 'Overview', to: '/', icon: LayoutDashboard },
        { name: '1. Pickup Planning', to: '/pickups', icon: CalendarCheck },
        { name: '2. Route Optimization', to: '/route-optimization', icon: Route },
        { name: '3. Fleet Assignment', to: '/fleet', icon: Users },
        { name: '4. Dispatch & Monitoring', to: '/dispatch', icon: Navigation },
        { name: '5. Warehouse Intakes', to: '/warehouse-intakes', icon: Scale },
        { name: '6. CBMWTF Consignments', to: '/disposal-shipments', icon: Flame },
        { name: 'Pickup History Archive', to: '/pickup-history', icon: History },
      ],
    },

    {
      group: 'BUSINESS',
      items: [
        { name: 'Customers & Locations', to: '/customers', icon: Building2 },
        { name: 'Pricing & Billing', to: '/billing', icon: CreditCard },
        { name: 'Disposal Certificates', to: '/certificates', icon: FileCheck },
      ],
    },
    {
      group: 'ADMINISTRATION',
      items: [
        { name: 'User Management', to: '/users', icon: Users },
        { name: 'Audit Logs', to: '/audit-logs', icon: History },
        { name: 'Configuration', to: '/configuration', icon: Sliders },
      ],
    },
  ];

  const utilityItems = [
    { name: 'Warehouses', to: '/warehouses', icon: Warehouse },
    { name: 'Treatment Facilities', to: '/facilities', icon: Factory },
    { name: 'Customer Documents', to: '/documents', icon: FileCheck },
    { name: 'Operational Exceptions', to: '/exceptions', icon: AlertOctagon },
    { name: 'WhatsApp Templates', to: '/whatsapp-templates', icon: MessageSquare },
    { name: 'System Settings', to: '/settings', icon: Settings },
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
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {mainSections.map((section) => (
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
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
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

        {/* Collapsible Logistics & Utilities Section */}
        <div className="pt-2 border-t border-charcoal-800">
          {!isCollapsed ? (
            <button
              onClick={() => setShowUtilities((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-charcoal-400 uppercase tracking-widest hover:text-white transition-colors"
            >
              <span>Logistics & System</span>
              {showUtilities ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          ) : null}

          {(!isCollapsed ? showUtilities : true) && (
            <div className="space-y-1 mt-1">
              {utilityItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-charcoal-800 text-periwinkle font-semibold'
                        : 'text-charcoal-400 hover:text-white hover:bg-charcoal-800'
                    } ${isCollapsed ? 'justify-center' : ''}`
                  }
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </NavLink>
              ))}
            </div>
          )}
        </div>
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

export default Sidebar;
