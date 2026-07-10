'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Root page with smart redirects:
 * - Not authenticated → /landing (public landing page)
 * - Authenticated with active account → /{role}/dashboard
 * - Authenticated but suspended → /account-suspended
 */
export default function RootPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth state to load
    if (loading) return;

    // Not authenticated - go to public landing page
    if (!user) {
      router.replace('/landing');
      return;
    }

    // Authenticated - check account status and redirect to appropriate dashboard
    if (userProfile) {
      if (userProfile.account_status !== 'active') {
        router.replace('/account-suspended');
        return;
      }

      // Redirect to role-specific dashboard
      if (userProfile.role) {
        router.replace(`/${userProfile.role}/dashboard`);
        return;
      }
    }

    // User exists but no profile yet - might still be loading
    // Wait a bit then redirect to landing if still no profile
    const timeout = setTimeout(() => {
      if (!userProfile) {
        router.replace('/landing');
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [user, userProfile, loading, router]);

  // Full-screen loading state while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/15 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Brain icon with pulse animation */}
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-violet-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <svg
              viewBox="0 0 24 24"
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M12 2C9.243 2 7 4.243 7 7c0 .836.194 1.625.537 2.331C5.397 10.148 4 12.233 4 14.667c0 1.545.627 2.944 1.64 3.96C4.626 19.642 4 21.026 4 22.5c0 .828.672 1.5 1.5 1.5h13c.828 0 1.5-.672 1.5-1.5 0-1.474-.627-2.858-1.64-3.873 1.013-1.016 1.64-2.415 1.64-3.96 0-2.434-1.397-4.519-3.537-5.336A4.984 4.984 0 0017 7c0-2.757-2.243-5-5-5z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          {/* Animated rings */}
          <div className="absolute inset-0 -m-4 flex items-center justify-center">
            <div className="w-28 h-28 rounded-2xl border-2 border-purple-500/30 animate-ping"></div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xl font-semibold text-white mb-2">NeuroXiva</p>
          <div className="flex items-center gap-2 text-slate-400">
            <div className="relative w-5 h-5">
              <div className="w-5 h-5 border-2 border-purple-500/20 rounded-full"></div>
              <div className="absolute inset-0 w-5 h-5 border-2 border-transparent border-t-purple-500 rounded-full animate-spin"></div>
            </div>
            <span className="text-sm">Loading your dashboard...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
