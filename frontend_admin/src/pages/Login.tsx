import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { OperationsGraphic } from '../components/auth/OperationsGraphic';
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
  Route,
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

  // Check if session expired query parameter is present
  const isExpired = new URLSearchParams(location.search).get('expired') === 'true';

  // If already authenticated as admin, redirect to target or overview
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
      setError('Please provide both your administrator email and password.');
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

  const fillTestAdmin = () => {
    setEmail('admin@test.com');
    setPassword('TestAdmin123!');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex bg-[#0B0F19] text-charcoal-900 selection:bg-periwinkle-100 selection:text-charcoal-900">
      {/* ========================================================= */}
      {/* LEFT PANEL: Enterprise Brand & Operational Control Tower  */}
      {/* ========================================================= */}
      <section
        aria-label="Pharmatrix Platform Overview"
        className="hidden lg:flex lg:w-[56%] xl:w-[58%] relative flex-col justify-between p-10 xl:p-14 bg-[#0B0F19] text-white overflow-hidden border-r border-charcoal-800/80"
      >
        {/* Subtle architectural background gradients */}
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-periwinkle to-periwinkle-700 flex items-center justify-center shadow-lg shadow-periwinkle/20 border border-white/10">
              <ShieldCheck className="w-6 h-6 text-charcoal-950 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">
                Pharmatrix
              </span>
              <span className="text-[10px] font-semibold text-periwinkle-300 uppercase tracking-widest mt-1">
                Admin Control Tower
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-charcoal-900/80 border border-charcoal-800 text-charcoal-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Platform v2.4 · CDSCO Compliant</span>
          </div>
        </div>

        {/* Central Operations Hero & Graphic */}
        <div className="relative z-10 my-auto py-8 max-w-xl">
          <div className="space-y-3 mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-periwinkle/15 text-periwinkle-200 border border-periwinkle/30">
              <Route className="w-3.5 h-3.5 text-periwinkle" />
              <span>Pharmaceutical Waste & Reverse Logistics</span>
            </div>
            <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white leading-[1.2]">
              Every pickup accounted for.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-periwinkle to-ice-300">
                Every operation traceable.
              </span>
            </h1>
            <p className="text-sm xl:text-base text-charcoal-300 leading-relaxed font-normal">
              A unified control tower for pharmaceutical waste collection, route optimization,
              intake verification and CBMWTF regulatory compliance.
            </p>
          </div>

          {/* Interactive Flow Illustration Component */}
          <OperationsGraphic />
        </div>

        {/* Left Panel Trust Footer */}
        <div className="relative z-10 pt-6 border-t border-charcoal-800/80 flex items-center justify-between text-xs text-charcoal-400">
          <div className="flex items-center gap-2">
            <span className="font-medium text-charcoal-300">
              Secure Operations · Traceable Workflows · Compliance-Ready Records
            </span>
          </div>
          <span className="text-[11px] font-mono text-charcoal-500">ISO 14001 Protocol</span>
        </div>
      </section>

      {/* ========================================================= */}
      {/* RIGHT PANEL: Enterprise Authentication Interface          */}
      {/* ========================================================= */}
      <main className="w-full lg:w-[44%] xl:w-[42%] flex flex-col justify-between bg-white px-6 sm:px-12 md:px-16 lg:px-12 xl:px-16 py-10 sm:py-12 relative overflow-y-auto">
        {/* Mobile Header (displayed when left panel is collapsed) */}
        <div className="lg:hidden flex items-center justify-between pb-8 mb-4 border-b border-ivory-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-charcoal-900 flex items-center justify-center text-periwinkle shadow-sm">
              <ShieldCheck className="w-5 h-5 text-periwinkle" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold text-charcoal-900 leading-none">
                Pharmatrix
              </span>
              <span className="text-[10px] font-semibold text-charcoal-500 uppercase tracking-widest mt-1">
                Admin Control Tower
              </span>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            Secure Portal
          </span>
        </div>

        {/* Centered Authentication Surface */}
        <div className="my-auto max-w-md w-full mx-auto">
          {/* Welcome Header */}
          <div className="space-y-1.5 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-charcoal-900">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-charcoal-500">
              Sign in with your administrative credentials to access the operational control tower.
            </p>
          </div>

          {/* Session Expiration Notice */}
          {isExpired && (
            <div
              role="status"
              className="mb-6 p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 flex items-start gap-2.5 text-xs text-amber-900"
            >
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Session Expired:</span> Your previous session has timed
                out. Please re-authenticate to continue your workflow.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50/90 flex items-start gap-3 shadow-subtle animate-in fade-in-50 duration-150"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-rose-900 leading-relaxed font-medium">
                {error}
              </div>
            </div>
          )}

          {/* Main Authentication Form */}
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider mb-1.5"
              >
                Administrator Email
              </label>
              <div className="relative rounded-xl shadow-subtle">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pharmatrix.local"
                  disabled={isSubmitting}
                  className="block w-full h-12 pl-10 pr-3.5 text-sm bg-white border border-ivory-300 rounded-xl text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-periwinkle focus:border-periwinkle transition-all disabled:bg-ivory-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Password Field with Show/Hide toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider"
                >
                  Password
                </label>
              </div>
              <div className="relative rounded-xl shadow-subtle">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-charcoal-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  className="block w-full h-12 pl-10 pr-12 text-sm bg-white border border-ivory-300 rounded-xl text-charcoal-900 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-periwinkle focus:border-periwinkle transition-all disabled:bg-ivory-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  tabIndex={0}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="admin-password"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-charcoal-400 hover:text-charcoal-700 focus:outline-none focus-visible:text-periwinkle transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 flex justify-center items-center gap-2 px-5 rounded-xl font-semibold text-sm text-white bg-charcoal-900 hover:bg-charcoal-800 active:scale-[0.99] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-charcoal-900 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-periwinkle" aria-hidden="true" />
                    <span>Signing in to dashboard...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to dashboard</span>
                    <ArrowRight className="w-4 h-4 text-periwinkle" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security & Access Notice */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-charcoal-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Protected administrator access · Role verification enforced</span>
          </div>

          {/* Development-Only Autofill Helper (Completely omitted in production builds) */}
          {import.meta.env.DEV && (
            <div className="mt-8 pt-5 border-t border-ivory-200">
              <div className="flex items-center justify-between text-xs text-charcoal-500 bg-ivory-50 p-2.5 rounded-lg border border-ivory-300">
                <span className="font-medium text-[11px]">Developer Mode</span>
                <button
                  type="button"
                  onClick={fillTestAdmin}
                  className="text-[11px] font-semibold text-periwinkle-700 hover:text-periwinkle-900 underline focus:outline-none focus-visible:ring-1 focus-visible:ring-periwinkle rounded"
                >
                  Autofill test admin
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel Bottom Compliance Disclaimer */}
        <div className="pt-8 text-center text-[11px] text-charcoal-400">
          <p>
            Authorized personnel only. All access and actions are recorded in the CDSCO compliance
            audit ledger.
          </p>
        </div>
      </main>
    </div>
  );
};
