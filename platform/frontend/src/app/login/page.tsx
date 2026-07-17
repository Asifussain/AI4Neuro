'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Brain, Waves, ScanLine, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Check if already logged in and redirect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // If we just logged out, force-clear any stale session and skip redirect
        const params = new URLSearchParams(window.location.search);
        if (params.get('logged_out')) {
          await supabase.auth.signOut();
          window.history.replaceState({}, '', '/login');
          setCheckingAuth(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // First login — force password change
          if (session.user.user_metadata?.first_login === true) {
            router.replace('/change-password');
            return;
          }
          const role = session.user.user_metadata?.role;
          if (role) {
            router.replace(`/${role.replace(/_/g, '-')}/dashboard`);
            return;
          }
        }
      } catch (e) {
        console.log('Auth check error:', e);
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [router, supabase]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        toast.error(authError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // First login — force password change before accessing dashboard
        if (data.user.user_metadata?.first_login === true) {
          toast.info('Please set a new password for your account');
          router.replace('/change-password');
          return;
        }

        toast.success('Login successful!');
        const role = data.user.user_metadata?.role || 'patient';
        router.replace(`/${role.replace(/_/g, '-')}/dashboard`);
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      toast.error('An error occurred during login');
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-slate-500 text-sm">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7fafc] flex flex-col">
      {/* Minimal header */}
      <header className="px-6 py-5 flex items-center justify-between gap-4">
        <Link href="/landing" className="inline-flex items-center">
          <BrandLogo markHeight={36} textHeight={18} />
        </Link>
        <Link
          href="/landing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </header>

      <div className="flex-1 flex items-center">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center px-6 py-8">
          {/* Left Panel - Login Form */}
          <div className="w-full max-w-md mx-auto lg:mx-0">
            <div className="mb-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-700">AI4Neuro</p>
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome back</h1>
              <p className="text-slate-500">Sign in to access EEG, MRI, and PET analysis workflows.</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 disabled:opacity-50"
                    placeholder="name@hospital.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 disabled:opacity-50"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/40"
                    />
                    Remember Me
                  </label>
                  <span className="text-blue-700 font-medium cursor-not-allowed" title="Contact your administrator to reset your password">
                    Forgot Password?
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              Need access? Contact your administrator.
            </p>
          </div>

          {/* Right Panel - Visual (hidden on mobile) */}
          <div className="hidden lg:block">
            <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Unified clinical workspace</p>
              <h2 className="mt-3 text-2xl font-extrabold text-slate-900">One login for every diagnostic lane</h2>
              <p className="mt-3 text-slate-500 leading-relaxed">
                Route EEG recordings, MRI scans, and PET biomarkers through the same secure platform
                while preserving modality-specific reports.
              </p>
              <div className="grid gap-3 mt-8">
                <div className="rounded-xl bg-white p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Waves className="h-4.5 w-4.5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">EEG flow</div>
                    <div className="text-xs text-slate-500">ADFormer analysis for .npy brainwave recordings.</div>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                    <ScanLine className="h-4.5 w-4.5 text-teal-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">MRI flow</div>
                    <div className="text-xs text-slate-500">NIfTI imaging analysis with viewer-ready outputs.</div>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-4 flex items-center gap-3 shadow-sm opacity-60">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <Brain className="h-4.5 w-4.5 text-violet-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">PET flow</div>
                    <div className="text-xs text-slate-500">Locked / Coming soon.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
