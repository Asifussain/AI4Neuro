'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Building2 } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  SectionCard,
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { adminApi, type Hospital } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminApi
      .hospitals()
      .then((h) => !cancelled && setHospitals(h))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const all = hospitals ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (h) =>
        h.name.toLowerCase().includes(term) ||
        h.hospital_code.toLowerCase().includes(term) ||
        h.address.toLowerCase().includes(term)
    );
  }, [hospitals, q]);

  const loading = hospitals === null && !error;

  return (
    <RoleShell>
      <DashboardPageHeader
        eyebrow="Super Admin"
        title="Hospitals"
        description="All hospitals onboarded on the platform, with their status and contact details."
        routeChip="/super-admin/hospitals"
        accent="indigo"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load hospitals: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${filtered.length} hospital${filtered.length === 1 ? '' : 's'}`}
          </p>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search hospitals…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Building2 className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No hospitals found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2.5 pr-4 font-medium">Hospital</th>
                  <th className="py-2.5 pr-4 font-medium">Code</th>
                  <th className="py-2.5 pr-4 font-medium hidden md:table-cell">Contact</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-50 shrink-0">
                          <Building2 className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{h.name}</p>
                          <p className="text-xs text-slate-500 truncate">{h.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">{h.hospital_code}</td>
                    <td className="py-3 pr-4 hidden md:table-cell text-slate-600">
                      <p className="truncate">{h.email || '—'}</p>
                      <p className="text-xs text-slate-400">{h.phone || ''}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={h.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </RoleShell>
  );
}

export default withAuth(HospitalsPage, { allowedRoles: ['super_admin'] });
