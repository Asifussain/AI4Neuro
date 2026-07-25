'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Users, User } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  SectionCard,
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { adminApi, type PatientDirectoryEntry } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function MyPatientsPage() {
  const [patients, setPatients] = useState<PatientDirectoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminApi
      .myPatients()
      .then((p) => !cancelled && setPatients(p.items))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const all = patients ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (p) =>
        p.full_name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term) ||
        (p.patient_code || '').toLowerCase().includes(term)
    );
  }, [patients, q]);

  const loading = patients === null && !error;

  return (
    <RoleShell>
      <DashboardPageHeader
        eyebrow="Doctor"
        title="My Patients"
        description="Patients currently assigned to you."
        accent="blue"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load patients: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${filtered.length} patient${filtered.length === 1 ? '' : 's'}`}
          </p>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email or patient ID…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Users className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">
              {patients && patients.length === 0
                ? 'No patients are assigned to you yet.'
                : 'No patients match your search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/analysis/new?patient_id=${p.id}`}
                className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                    {initials(p.full_name) || <User className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {[p.patient_code, p.email].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
                <StatusBadge status={p.account_status} />
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </RoleShell>
  );
}

export default withAuth(MyPatientsPage, { allowedRoles: ['doctor'] });
