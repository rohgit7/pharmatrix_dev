import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  LogOut,
  User as UserIcon,
  Activity,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, dashboardApi } from '../../api/operations';
import { formatDateTime } from '../../utils/formatters';

export const Topbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);

  // Live backend health check
  const { data: dbHealth } = useQuery({
    queryKey: ['dbHealth'],
    queryFn: dashboardApi.getDbHealth,
    refetchInterval: 30000,
    retry: 1,
  });

  // Admin in-app notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 15000,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // Breadcrumbs generator
  const pathnames = location.pathname.split('/').filter((x) => x);
  const getPageTitle = () => {
    if (pathnames.length === 0) return 'Operations Overview';
    const first = pathnames[0];
    switch (first) {
      case 'pickups':
        return 'Pickup Operations';
      case 'routes':
        return 'Route Planning & Dispatch';
      case 'warehouses':
        return 'Warehouse & Intake Management';
      case 'facilities':
        return 'Disposal Facilities & Shipments';
      case 'exceptions':
        return 'Operational Exceptions & Proofs';
      case 'documents':
        return 'Customer Document Verification';
      case 'fleet':
        return 'Fleet & Driver Roster';
      case 'invoices':
        return 'Billing & Invoices';
      case 'configuration':
        return 'System Configuration & Audit';
      case 'whatsapp-templates':
        return 'WhatsApp Messaging Templates';
      case 'settings':
        return 'Administrator Settings';
      default:
        return first.charAt(0).toUpperCase() + first.slice(1);
    }
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-ivory-300 px-6 flex items-center justify-between">
      {/* Title & Breadcrumbs */}
      <div>
        <h1 className="text-lg font-bold text-charcoal-900 tracking-tight leading-tight">
          {getPageTitle()}
        </h1>
        <div className="flex items-center gap-1.5 text-xs text-charcoal-400 mt-0.5">
          <Link to="/" className="hover:text-periwinkle-700 transition-colors">
            Pharmatrix
          </Link>
          {pathnames.map((name, index) => {
            const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
            const isLast = index === pathnames.length - 1;
            return (
              <React.Fragment key={routeTo}>
                <span>/</span>
                {isLast ? (
                  <span className="text-charcoal-700 font-medium capitalize">{name}</span>
                ) : (
                  <Link to={routeTo} className="hover:text-periwinkle-700 transition-colors capitalize">
                    {name}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Backend & DB Health Indicator */}
        <div
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            dbHealth?.database === 'connected'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
          title="FastAPI + Supabase PostgreSQL Status"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              dbHealth?.database === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span>DB {dbHealth?.database === 'connected' ? 'Connected' : 'Connecting...'}</span>
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationMenu((prev) => !prev)}
            className="relative p-2 rounded-xl text-charcoal-600 hover:text-charcoal-900 hover:bg-ivory-100 transition-colors border border-transparent hover:border-ivory-300"
            title="System Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber text-charcoal-900 text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotificationMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-elevation border border-ivory-300 overflow-hidden z-30">
              <div className="px-4 py-3 bg-ivory-50 border-b border-ivory-200 flex items-center justify-between">
                <span className="text-xs font-bold text-charcoal-800 uppercase tracking-wider">
                  Notifications ({unreadCount} unread)
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-ivory-200">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-charcoal-400">
                    No recent notifications
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.read_at && markReadMutation.mutate(n.id)}
                      className={`p-3 text-xs transition-colors cursor-pointer ${
                        n.read_at ? 'bg-white hover:bg-ivory-50' : 'bg-periwinkle-50/50 hover:bg-periwinkle-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-charcoal-900">{n.title}</span>
                        {!n.read_at && (
                          <span className="w-2 h-2 rounded-full bg-periwinkle flex-shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="mt-1 text-charcoal-600 line-clamp-2 leading-relaxed">{n.body}</p>
                      <span className="mt-1.5 block text-[10px] text-charcoal-400">
                        {formatDateTime(n.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Admin Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="flex items-center gap-2.5 p-1.5 pl-2.5 rounded-xl border border-ivory-300 hover:border-ivory-400 bg-ivory-50 hover:bg-ivory-100/70 transition-all text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-charcoal-800 text-white flex items-center justify-center font-bold text-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden sm:block text-left">
              <span className="block text-xs font-semibold text-charcoal-900 leading-tight">
                {user?.name || 'Administrator'}
              </span>
              <span className="block text-[10px] font-medium text-periwinkle-700 leading-none mt-0.5">
                {user?.role || 'ADMIN'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-charcoal-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-elevation border border-ivory-300 overflow-hidden z-30">
              <div className="p-3 bg-ivory-50 border-b border-ivory-200">
                <p className="text-xs font-bold text-charcoal-900 truncate">{user?.name}</p>
                <p className="text-[11px] text-charcoal-500 truncate">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <Link
                  to="/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-charcoal-700 hover:bg-ivory-100 transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-charcoal-400" />
                  Account Settings
                </Link>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
