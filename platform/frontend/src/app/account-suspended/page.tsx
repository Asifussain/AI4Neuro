'use client';

import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';

export default function AccountSuspendedPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
      <div className="max-w-md w-full text-center">
        {/* Warning Icon */}
        <div className="w-20 h-20 mx-auto mb-6 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
          <svg
            viewBox="0 0 24 24"
            className="w-10 h-10 text-red-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Account Suspended</h1>
        <p className="text-slate-400 mb-6">
          Your account has been suspended. This may be due to a policy violation or administrative action.
          Please contact your administrator or support team for assistance.
        </p>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-left text-sm text-amber-300">
              <p className="font-medium">Need help?</p>
              <p className="text-amber-400/80">Contact support at support@neuroxiva.com or speak with your hospital administrator.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={signOut}
            className="px-6 py-2.5 text-slate-300 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors"
          >
            Sign Out
          </button>
          <Link
            href="mailto:support@neuroxiva.com"
            className="px-6 py-2.5 text-white bg-gradient-to-r from-purple-600 to-teal-500 rounded-xl hover:from-purple-500 hover:to-teal-400 transition-all shadow-lg shadow-purple-500/25"
          >
            Contact Support
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12">
          <Link href="/landing" className="flex items-center justify-center gap-2 text-slate-500 hover:text-slate-400 transition-colors">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 via-violet-500 to-teal-400 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C9.243 2 7 4.243 7 7c0 .836.194 1.625.537 2.331C5.397 10.148 4 12.233 4 14.667c0 1.545.627 2.944 1.64 3.96C4.626 19.642 4 21.026 4 22.5c0 .828.672 1.5 1.5 1.5h13c.828 0 1.5-.672 1.5-1.5 0-1.474-.627-2.858-1.64-3.873 1.013-1.016 1.64-2.415 1.64-3.96 0-2.434-1.397-4.519-3.537-5.336A4.984 4.984 0 0017 7c0-2.757-2.243-5-5-5z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-sm font-medium">NeuroXiva</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
