'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ScanLine, Brain, Activity } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  SectionCard,
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { adminApi, type ScanRow, type Hospital } from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function ScansPage() {
  const [scans, setScans] = useState<ScanRow[] | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [modality, setModality] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminApi
      .scans({ limit: 200 })
      .then((r) => !cancelled && setScans(r.items))
      .catch((e) => !cancelled && setError((e as Error).message));
    adminApi
      .hospitals({ limit: 200 })
      .then((r) => !cancelled && setHospitals(r.items))
      .catch(() => !cancelled && setHospitals([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const all = scans ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((s) => {
      if (modality && s.modality !== modality) return false;
      if (hospitalFilter && s.hospital_id !== hospitalFilter) return false;
      if (!term) return true;
      return (
        (s.patient_name ?? '').toLowerCase().includes(term) ||
        (s.doctor_name ?? '').toLowerCase().includes(term) ||
        (s.hospital_name ?? '').toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term)
      );
    });
  }, [scans, q, modality, hospitalFilter]);

  const loading = scans === null && !error;

  return (
    <RoleShell>
      <DashboardPageHeader
        eyebrow="Super Admin"
        title="View Scans"
        description="Every MRI and EEG analysis performed across all hospitals on the platform."
        accent="indigo"
        timelineSteps={[
          { label: 'Super Admin', href: '/super-admin/dashboard' },
          { label: 'View Scans', active: true }
        ]}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load scans: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${filtered.length} scan${filtered.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              className="py-2 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All modalities</option>
              <option value="mri">MRI</option>
              <option value="eeg">EEG</option>
            </select>
            {hospitals.length > 0 && (
              <select
                value={hospitalFilter}
                onChange={(e) => setHospitalFilter(e.target.value)}
                className="py-2 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">All hospitals</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search patient, doctor, hospital…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <ScanLine className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No scans found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2.5 pr-4 font-medium">Modality</th>
                  <th className="py-2.5 pr-4 font-medium">Patient</th>
                  <th className="py-2.5 pr-4 font-medium hidden md:table-cell">Doctor</th>
                  <th className="py-2.5 pr-4 font-medium">Hospital</th>
                  <th className="py-2.5 pr-4 font-medium hidden lg:table-cell">Date</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-indigo-50 shrink-0">
                          {s.modality === 'eeg' ? (
                            <Activity className="h-4 w-4 text-indigo-600" />
                          ) : (
                            <Brain className="h-4 w-4 text-indigo-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 uppercase">{s.modality}</p>
                          <p className="text-xs text-slate-400 truncate">{s.analysis_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {s.patient_id ? (
                        <Link
                          href={`/super-admin/patients/${s.patient_id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          {s.patient_name || 'Unknown'}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Anonymous</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell text-slate-700">
                      {s.doctor_id ? (
                        <Link
                          href={`/super-admin/doctors/${s.doctor_id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          {s.doctor_name || 'Unknown'}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 truncate max-w-[180px]">
                      {s.hospital_id ? (
                        <Link
                          href={`/super-admin/hospitals/${s.hospital_id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          {s.hospital_name || '—'}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 pr-4 hidden lg:table-cell text-slate-500 whitespace-nowrap">
                      {formatDate(s.created_at)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="py-3 pr-0 text-right">
                      <Link
                        href={`/analysis/${s.id}`}
                        className="text-xs font-medium text-indigo-700 hover:underline whitespace-nowrap"
                      >
                        View
                      </Link>
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

export default withAuth(ScansPage, { allowedRoles: ['super_admin'] });
