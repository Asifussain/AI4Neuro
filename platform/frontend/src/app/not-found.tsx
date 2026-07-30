'use client';

import Link from 'next/link';
import { Brain, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7fafc] p-4">
      <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-3xl shadow-sm p-8">
        <div className="w-20 h-20 mx-auto mb-6 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-200">
          <Compass className="w-10 h-10 text-indigo-500" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-3">Page Not Found</h1>
        <p className="text-slate-500 mb-8">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-2.5 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-all"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/landing"
            className="px-6 py-2.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Back to Home
          </Link>
        </div>

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
