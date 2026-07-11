'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Navbar } from '@/components/shared/Navbar';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
            router.replace(`/${role}/dashboard`);
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
        router.replace(`/${role}/dashboard`);
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-muted-foreground text-sm">Checking session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai4-page min-h-screen bg-background flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col relative z-10 pt-8">

        {/* Form */}
        <div className="flex-1 flex items-center justify-center px-8 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">AI4NEURO</p>
              <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back</h1>
              <p className="text-muted-foreground">Sign in to access EEG and MRI analysis workflows.</p>
            </div>

            <div className="ai4-card bg-card border border-border rounded-2xl p-6">
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                    placeholder="name@hospital.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      className="w-full px-4 py-3 pr-12 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Need access? Contact your administrator.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Visual (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12">
        <div className="max-w-md rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Unified clinical workspace</p>
          <h2 className="mt-3 text-2xl font-bold text-foreground">One login for two diagnostic lanes</h2>
          <p className="mt-3 text-muted-foreground">
            Route EEG recordings and MRI scans through the same secure platform while preserving modality-specific reports.
          </p>
          <div className="grid gap-3 mt-8">
            <div className="rounded-xl bg-secondary p-4">
              <div className="font-semibold">EEG flow</div>
              <div className="text-sm text-muted-foreground">ADFormer analysis for .npy brainwave recordings.</div>
            </div>
            <div className="rounded-xl bg-secondary p-4">
              <div className="font-semibold">MRI flow</div>
              <div className="text-sm text-muted-foreground">NIfTI imaging analysis with viewer-ready outputs.</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
