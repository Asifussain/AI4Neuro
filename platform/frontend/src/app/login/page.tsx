'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Navbar } from '@/components/shared/Navbar';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
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
            window.location.href = '/change-password';
            return;
          }
          const role = session.user.user_metadata?.role;
          if (role) {
            window.location.href = `/${role}/dashboard`;
            return;
          }
        }
      } catch (e) {
        console.log('Auth check error:', e);
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [supabase]);

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
          window.location.href = '/change-password';
          return;
        }

        toast.success('Login successful!');
        const role = data.user.user_metadata?.role || 'patient';
        // Direct redirect - don't rely on AuthProvider
        window.location.href = `/${role}/dashboard`;
      }
    } catch (error: any) {
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
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-teal-500/15 rounded-full blur-[100px] translate-x-1/4 translate-y-1/4" />
      </div>

      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col relative z-10 pt-8">

        {/* Form */}
        <div className="flex-1 flex items-center justify-center px-8 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back</h1>
              <p className="text-muted-foreground">Sign in to access your dashboard</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
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
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? '🙈' : '👁️'}
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
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
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
        <div className="text-center">
          <div className="w-48 h-48 mx-auto mb-8 bg-gradient-to-br from-purple-500/20 to-teal-500/20 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-24 h-24 text-primary">
              <path d="M50 15c-10 0-18 8-18 18 0 3 1 5 2 7-5 3-9 8-9 14 0 5 3 10 6 13-3 3-4 7-4 11 0 8 6 14 14 14h18c8 0 14-6 14-14 0-4-2-8-4-11 4-3 6-8 6-13 0-6-4-11-9-14 1-2 2-5 2-7 0-10-8-18-18-18z" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">AI-Powered Analysis</h2>
          <p className="text-muted-foreground max-w-sm">
            Advanced deep learning for early detection of neurodegenerative diseases.
          </p>
          <div className="flex justify-center gap-6 mt-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">94%</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">&lt;2m</div>
              <div className="text-xs text-muted-foreground">Analysis</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
