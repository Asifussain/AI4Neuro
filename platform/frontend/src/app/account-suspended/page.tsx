'use client';

import Link from 'next/link';
import { Brain } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

export default function AccountSuspendedPage() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7fafc] p-4">
      <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
        {/* Warning Icon */}
        <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-2xl flex items-center justify-center border border-red-200">
          <svg
            viewBox="0 0 24 24"
            className="w-10 h-10 text-red-500"
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

        <h1 className="text-2xl font-bold text-slate-900 mb-3">Account Suspended</h1>
        <p className="text-slate-500 mb-6">
          Your account has been suspended. This may be due to a policy violation or administrative action.
          Please contact your administrator or support team for assistance.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
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
            <div className="text-left text-sm text-amber-800">
              <p className="font-medium">Need help?</p>
              <p className="text-amber-700/80">Contact support at support@ai4neuro.com or speak with your hospital administrator.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={signOut}
            className="px-6 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Sign Out
          </button>
          <Link
            href="mailto:support@ai4neuro.com"
            className="px-6 py-2.5 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all"
          >
            Contact Support
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12">
          <Link href="/landing" className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
            <div className="w-6 h-6 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium">AI4Neuro</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
