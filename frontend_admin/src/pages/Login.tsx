import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { ShieldCheck, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated as admin, redirect to overview
  const from = (location.state as any)?.from?.pathname || '/';

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please provide both administrator email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
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
  };

  return (
    <div className="min-h-screen bg-ivory-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-charcoal-900 flex items-center justify-center border-2 border-periwinkle shadow-card">
            <ShieldCheck className="w-8 h-8 text-periwinkle" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-charcoal-900">
          Pharmatrix Admin Portal
        </h2>
        <p className="mt-1 text-center text-xs text-charcoal-500 uppercase tracking-wider font-semibold">
          Pharmaceutical Waste Operations & Compliance Tower
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-elevation rounded-2xl border border-ivory-300 sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 leading-relaxed font-medium">{error}</div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider">
                Administrator Email
              </label>
              <div className="mt-1.5 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@pharmatrix.local"
                  className="block w-full pl-9 pr-3 py-2 sm:text-sm bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-periwinkle focus:border-periwinkle transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal-700 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1.5 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-charcoal-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 sm:text-sm bg-ivory-50 border border-ivory-300 rounded-lg text-charcoal placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-periwinkle focus:border-periwinkle transition-colors"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-charcoal-900 bg-periwinkle hover:bg-periwinkle-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-periwinkle transition-colors disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-charcoal-900" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Access Dashboard</span>
                )}
              </button>
            </div>
          </form>

          {/* Development Quick Fill Helper */}
          <div className="mt-6 pt-5 border-t border-ivory-200">
            <div className="flex items-center justify-between text-xs text-charcoal-500">
              <span>Testing credentials?</span>
              <button
                type="button"
                onClick={fillTestAdmin}
                className="font-semibold text-periwinkle-700 hover:text-periwinkle-900 hover:underline"
              >
                Autofill test admin
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-charcoal-400">
          Authorized operations personnel only. All access is auditable under CDSCO compliance rules.
        </p>
      </div>
    </div>
  );
};
