import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/operations';
import { User, Shield, Server, Database, CheckCircle2, Lock } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();

  const { data: health } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: dashboardApi.getHealth,
  });

  const { data: dbHealth } = useQuery({
    queryKey: ['dbHealth'],
    queryFn: dashboardApi.getDbHealth,
  });

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-charcoal-900 tracking-tight">Administrator Settings</h2>
        <p className="text-xs text-charcoal-500 mt-0.5">
          Admin account credentials, cryptographic authorization tokens, and platform runtime status.
        </p>
      </div>

      {/* Admin Profile Card */}
      <div className="bg-white p-6 rounded-2xl border border-ivory-300 shadow-subtle space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-periwinkle-100 flex items-center justify-center text-periwinkle-800 border border-periwinkle-200">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-charcoal-900">Administrator Profile</h3>
            <p className="text-xs text-charcoal-500">Authenticated via Supabase Auth & PostgreSQL RBAC</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
          <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200">
            <span className="text-charcoal-400 block font-medium">Display Name</span>
            <span className="text-sm font-bold text-charcoal-900 mt-0.5 block">{user?.name}</span>
          </div>

          <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200">
            <span className="text-charcoal-400 block font-medium">Email Address</span>
            <span className="text-sm font-bold text-charcoal-900 mt-0.5 block">{user?.email}</span>
          </div>

          <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200">
            <span className="text-charcoal-400 block font-medium">System Role</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full text-xs font-semibold bg-periwinkle-50 text-periwinkle-800 border border-periwinkle-200">
              <Shield className="w-3 h-3 text-periwinkle-600" />
              {user?.role}
            </span>
          </div>

          <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200">
            <span className="text-charcoal-400 block font-medium">Account Status</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {user?.is_active ? 'Active & Authorized' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Backend Infrastructure Card */}
      <div className="bg-white p-6 rounded-2xl border border-ivory-300 shadow-subtle space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-charcoal-100 flex items-center justify-center text-charcoal-800 border border-ivory-300">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-charcoal-900">Backend Infrastructure</h3>
            <p className="text-xs text-charcoal-500">FastAPI backend runtime and Supabase PostgreSQL</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
          <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200 flex items-center justify-between">
            <div>
              <span className="text-charcoal-400 block font-medium">FastAPI Service</span>
              <span className="font-semibold text-charcoal-900 mt-0.5 block">
                {health?.service || 'pharmatrix-backend'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
              {health?.status === 'ok' ? 'ONLINE' : 'CHECKING'}
            </span>
          </div>

          <div className="p-3 bg-ivory-50 rounded-xl border border-ivory-200 flex items-center justify-between">
            <div>
              <span className="text-charcoal-400 block font-medium">PostgreSQL Database</span>
              <span className="font-semibold text-charcoal-900 mt-0.5 block">
                Supabase Managed Pool
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
              {dbHealth?.database === 'connected' ? 'CONNECTED' : 'CHECKING'}
            </span>
          </div>
        </div>
      </div>

      {/* Security Compliance Banner */}
      <div className="p-5 rounded-2xl bg-charcoal-900 text-white border border-charcoal-800 flex items-start gap-3.5">
        <Lock className="w-5 h-5 text-periwinkle flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-bold text-white tracking-tight">Security & RBAC Integrity</h4>
          <p className="text-charcoal-300 leading-relaxed">
            All administrative actions are authenticated server-side using cryptographic Bearer tokens. Administrative permissions are enforced via FastAPI dependency injection at the HTTP route boundary. No sensitive server credentials or database passwords are held in browser storage.
          </p>
        </div>
      </div>
    </div>
  );
};
