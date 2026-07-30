'use client';

import Link from 'next/link';
import { Brain, Clock, ShieldAlert, Ban } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import type { AccountStatus } from '@/lib/roles';

const STATUS_COPY: Record<
  AccountStatus,
  { icon: typeof Clock; iconClass: string; title: string; body: string; tone: 'amber' | 'red' }
> = {
  pending: {
    icon: Clock,
    iconClass: 'text-amber-500',
    title: 'Awaiting Approval',
    body: "Your account has been created and is waiting for your hospital administrator's approval. You'll be able to sign in as soon as it's approved — no action is needed from you right now.",
    tone: 'amber',
  },
  suspended: {
    icon: ShieldAlert,
    iconClass: 'text-red-500',
    title: 'Account Suspended',
    body: 'Your account has been suspended. This may be due to a policy violation or administrative action. Please contact your administrator or support team for assistance.',
    tone: 'red',
  },
  inactive: {
    icon: ShieldAlert,
    iconClass: 'text-red-500',
    title: 'Account Inactive',
    body: 'Your account is currently inactive. Please contact your administrator or support team to reactivate it.',
    tone: 'red',
  },
  deleted: {
    icon: Ban,
    iconClass: 'text-red-500',
    title: 'Account No Longer Exists',
    body: 'This account has been removed and no longer has access to the platform. If you believe this is a mistake, please contact support.',
    tone: 'red',
  },
  // Should never route here, but keeps the lookup total.
  active: {
    icon: ShieldAlert,
    iconClass: 'text-red-500',
    title: 'Account Unavailable',
    body: 'Your account cannot access the platform right now. Please contact your administrator or support team for assistance.',
    tone: 'red',
  },
};

export default function AccountSuspendedPage() {
  const { signOut, userProfile } = useAuth();
  const copy = STATUS_COPY[userProfile?.account_status ?? 'suspended'];
  const Icon = copy.icon;
  const isPending = userProfile?.account_status === 'pending';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7fafc] p-4">
      <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
        {/* Status icon */}
        <div
          className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border ${
            copy.tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <Icon className={`w-10 h-10 ${copy.iconClass}`} />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">{copy.title}</h1>
        <p className="text-slate-500 mb-6">{copy.body}</p>

        {!isPending && (
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
        )}

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
