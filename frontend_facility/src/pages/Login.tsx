import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import {
  ShieldCheck,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  Clock,
  Factory,
  Scale,
  Flame,
  FileCheck,
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isExpired = new URLSearchParams(location.search).get('expired') === 'true';
  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please enter both your facility operator email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(cleanEmail, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-charcoal-900 text-charcoal-900 selection:bg-periwinkle-100 selection:text-charcoal-900">
      {/* Left Panel: Brand & Facility Workflow Overview */}
      <section
        aria-label="Pharmatrix Disposal Facility Portal Overview"
        className="hidden lg:flex lg:w-[54%] xl:w-[56%] relative flex-col justify-between p-10 xl:p-14 bg-charcoal-900 text-white overflow-hidden border-r border-charcoal-800"
      >
        <div
          className="absolute -top-32 -left-32 w-96 h-96 bg-periwinkle/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-periwinkle flex items-center justify-center shadow-lg shadow-periwinkle/20">
              <ShieldCheck className="w-6 h-6 text-charcoal-900 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">
                Pharmatrix
              </span>
              <span className="text-[10px] font-semibold text-periwinkle uppercase tracking-widest mt-1">
                Disposal Facility Portal
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-charcoal-800 border border-charcoal-700 text-charcoal-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>CBMWTF Regulatory Compliance</span>
          </div>
        </div>

        {/* Center Operational Overview */}
        <div className="relative z-10 my-auto py-8 max-w-xl space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-periwinkle/15 text-periwinkle-200 border border-periwinkle/30">
              <Factory className="w-3.5 h-3.5 text-periwinkle" />
              <span>Authorized Treatment &amp; Disposal Terminal</span>
            </div>
            <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-[1.2]">
              Verified waste intake.{' '}
              <span className="text-periwinkle">Auditable destruction proof.</span>
            </h1>
            <p className="text-sm text-charcoal-300 leading-relaxed">
              Receive inbound pharmaceutical waste consignments from Pharmatrix warehouses, verify
              weights by waste stream, report discrepancies, manage treatment completion, and issue
              certified disposal certificates.
            </p>
          </div>

          {/* 3-Step Facility Workflow Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-charcoal-800/90 border border-charcoal-700/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-periwinkle/20 text-periwinkle flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">1. Weigh &amp; Receive</h3>
              <p className="text-[11px] text-charcoal-400 leading-relaxed">
                Confirm consignment arrival and record actual received mass by waste category.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-charcoal-800/90 border border-charcoal-700/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber/20 text-amber flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">2. Treat &amp; Dispose</h3>
              <p className="text-[11px] text-charcoal-400 leading-relaxed">
                Log final disposed quantities, treatment method, and operational remarks.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-charcoal-800/90 border border-charcoal-700/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white">3. Issue Certificate</h3>
              <p className="text-[11px] text-charcoal-400 leading-relaxed">
                Upload official destruction certificates linked to the shipment chain of custody.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-6 border-t border-charcoal-800 flex items-center justify-between text-xs text-charcoal-400">
          <span>Restricted to Authorized CBMWTF Facility Personnel</span>
          <span className="text-[11px] font-mono text-charcoal-500">CDSCO · BMWM Rules</span>
        </div>
      </section>

      {/* Right Panel: Facility Authentication Form */}
      <main className="w-full lg:w-[46%] xl:w-[44%] flex flex-col justify-between bg-ivory-50 px-6 sm:px-12 md:px-16 lg:px-12 xl:px-16 py-10 sm:py-12 relative overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between pb-6 mb-4 border-b border-ivory-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-charcoal-900 flex items-center justify-center text-periwinkle shadow-sm">
              <ShieldCheck className="w-5 h-5 text-periwinkle" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-charcoal-900 leading-none">Pharmatrix</span>
              <span className="text-[10px] font-semibold text-charcoal-500 uppercase tracking-widest mt-1">
                Disposal Facility Portal
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            FACILITY Role
          </span>
        </div>

        <div className="my-auto max-w-md w-full mx-auto bg-white p-8 rounded-2xl border border-ivory-300 shadow-card">
          <div className="space-y-1.5 mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-charcoal-900">
              Facility Sign In
            </h2>
            <p className="text-xs sm:text-sm text-charcoal-500">
              Authenticate with your authorized disposal facility credentials.
            </p>
          </div>

          {isExpired && (
            <div
              role="status"
              className="mb-5 p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 flex items-start gap-2.5 text-xs text-amber-900"
            >
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Session Expired:</span> Your session has timed out.
                Please sign in again to continue.
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-5 p-4 rounded-xl border border-rose-200 bg-rose-50/90 flex items-start gap-3 shadow-subtle"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-rose-900 leading-relaxed font-medium">
                {error}
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="facility-email"
                className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5"
              >
                Facility Operator Email
              </label>
              <div className="relative rounded-xl shadow-subtle">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="facility-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@facility.local"
                  disabled={isSubmitting}
                  className="block w-full h-11 pl-10 pr-3.5 text-sm bg-white border border-ivory-300 rounded-xl text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-periwinkle focus:border-periwinkle transition-all disabled:bg-ivory-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="facility-password"
                className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-subtle">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="facility-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  className="block w-full h-11 pl-10 pr-12 text-sm bg-white border border-ivory-300 rounded-xl text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-periwinkle focus:border-periwinkle transition-all disabled:bg-ivory-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-charcoal-400 hover:text-charcoal-700 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 flex justify-center items-center gap-2 px-5 rounded-xl font-semibold text-sm text-white bg-charcoal-900 hover:bg-charcoal-800 active:scale-[0.99] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-charcoal-900 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-periwinkle" />
                    <span>Signing in to Facility Portal...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to Facility Portal</span>
                    <ArrowRight className="w-4 h-4 text-periwinkle" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-ivory-200 flex items-center justify-center gap-2 text-[11px] text-charcoal-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>FACILITY role verification enforced by backend</span>
          </div>
        </div>

        <div className="pt-6 text-center text-[11px] text-charcoal-400">
          <p>
            Authorized disposal facility personnel only. All consignment receipts and certificates
            are recorded in the compliance ledger.
          </p>
        </div>
      </main>
    </div>
  );
};

