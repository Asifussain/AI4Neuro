'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, Stethoscope, UserRound, Building2 } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { SectionCard, DashboardPageHeader, StatusBadge } from '@/components/dashboards/shared/primitives';
import { SessionsTable } from '@/components/dashboards/shared/SessionsTable';
import { useAuth } from '@/components/providers/AuthProvider';
import { analysisApi } from '@/features/analysis/api';
import { adminApi, type DoctorDirectoryEntry, type PatientDirectoryEntry, type Hospital } from '@/features/admin/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import type { Role } from '@/lib/roles';
import { withAuth } from '@/lib/withAuth';

/** super_admin has drill-down detail pages for every entity; a doctor only
 * has one for their own patients; every other role has no per-id page today
 * (confirmed against the app's route list) — those rows render as plain text
 * instead of a link that would 404. */
function patientHref(role: Role, id: string): string | null {
  if (role === 'super_admin') return `/super-admin/patients/${id}`;
  if (role === 'doctor') return `/doctor/patient/${id}`;
  return null;
}
function doctorHref(role: Role, id: string): string | null {
  return role === 'super_admin' ? `/super-admin/doctors/${id}` : null;
}

function SearchInner() {
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') || '').trim();
  const { userProfile } = useAuth();
  const role = (userProfile?.role ?? 'patient') as Role;
  const canBrowseDirectories = role !== 'patient';
  const isSuperAdmin = role === 'super_admin';

  const [sessions, setSessions] = useState<SessionStatusResponse[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientDirectoryEntry[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorDirectoryEntry[] | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[] | null>(null);
  const [patientNameById, setPatientNameById] = useState<Record<string, string>>({});

  // Name lookup for the SessionsTable — unfiltered (not scoped to `q`) so a
  // session matched by id/modality/status still shows its patient's real
  // name even when that patient's own name doesn't contain the search term.
  useEffect(() => {
    if (role === 'patient') return;
    let cancelled = false;
    const fetchPatients =
      role === 'doctor' ? adminApi.myPatients({ limit: 200 }) : adminApi.patients({ limit: 200 });
    fetchPatients
      .then((r) => {
        if (cancelled) return;
        setPatientNameById(Object.fromEntries(r.items.map((p) => [p.id, p.full_name])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (!q) {
      setSessions(null);
      setSessionsError(null);
      setPatients(null);
      setDoctors(null);
      setHospitals(null);
      return;
    }
    let cancelled = false;

    analysisApi
      .list({ q, limit: 200 })
      .then((rows) => !cancelled && setSessions(rows))
      .catch((e) => !cancelled && setSessionsError((e as Error).message));

    if (canBrowseDirectories) {
      const fetchPatients =
        role === 'doctor' ? adminApi.myPatients({ q, limit: 50 }) : adminApi.patients({ q, limit: 50 });
      fetchPatients
        .then((r) => !cancelled && setPatients(r.items))
        .catch(() => !cancelled && setPatients([]));
      adminApi
        .doctors({ q, limit: 50 })
        .then((r) => !cancelled && setDoctors(r.items))
        .catch(() => !cancelled && setDoctors([]));
    }
    if (isSuperAdmin) {
      adminApi
        .hospitals({ q, limit: 50 })
        .then((r) => !cancelled && setHospitals(r.items))
        .catch(() => !cancelled && setHospitals([]));
    }

    return () => {
      cancelled = true;
    };
  }, [q, role, canBrowseDirectories, isSuperAdmin]);

  const sessionsLoading = sessions === null && !sessionsError;
  const patientsLoading = patients === null;
  const doctorsLoading = doctors === null;
  const hospitalsLoading = hospitals === null;

  return (
    <>
      <DashboardPageHeader
        eyebrow="Search"
        title={q ? `Results for “${q}”` : 'Search'}
        description="Find analyses, patients, doctors, and hospitals across everything you have access to."
        accent="indigo"
      />

      {!q ? (
        <SectionCard className="p-10 text-center text-slate-500">
          <SearchIcon className="h-8 w-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">Type a search term in the sidebar search box to get started.</p>
        </SectionCard>
      ) : (
        <>
          {sessionsError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              Search failed: {sessionsError}
            </div>
          )}

          <SectionCard className="p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Analyses</h3>
            <p className="text-xs text-slate-500 mb-4">
              {sessionsLoading ? 'Searching…' : `${(sessions ?? []).length} result${(sessions ?? []).length === 1 ? '' : 's'}`}
            </p>

            {sessionsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : (
              <SessionsTable
                sessions={sessions ?? []}
                accent="indigo"
                patientNameById={patientNameById}
                showPatientColumn={role !== 'patient'}
                showDeleteAction={role !== 'patient'}
                emptyLabel="No analyses match your search."
              />
            )}
          </SectionCard>

          {canBrowseDirectories && (
            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Patients</h3>
              <p className="text-xs text-slate-500 mb-4">
                {patientsLoading ? 'Searching…' : `${(patients ?? []).length} result${(patients ?? []).length === 1 ? '' : 's'}`}
              </p>
              {patientsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
                </div>
              ) : (patients ?? []).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <UserRound className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No patients match your search.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(patients ?? []).map((p) => {
                    const href = patientHref(role, p.id);
                    const row = (
                      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{p.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">{p.email}{p.patient_code ? ` • ${p.patient_code}` : ''}</p>
                        </div>
                        <StatusBadge status={p.account_status} />
                      </div>
                    );
                    return href ? (
                      <Link key={p.id} href={href} className="block hover:opacity-80 transition-opacity">
                        {row}
                      </Link>
                    ) : (
                      <div key={p.id}>{row}</div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {canBrowseDirectories && (
            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Doctors</h3>
              <p className="text-xs text-slate-500 mb-4">
                {doctorsLoading ? 'Searching…' : `${(doctors ?? []).length} result${(doctors ?? []).length === 1 ? '' : 's'}`}
              </p>
              {doctorsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
                </div>
              ) : (doctors ?? []).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Stethoscope className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No doctors match your search.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(doctors ?? []).map((d) => {
                    const href = doctorHref(role, d.id);
                    const row = (
                      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{d.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">{d.email}{d.specialization ? ` • ${d.specialization}` : ''}</p>
                        </div>
                        <StatusBadge status={d.account_status} />
                      </div>
                    );
                    return href ? (
                      <Link key={d.id} href={href} className="block hover:opacity-80 transition-opacity">
                        {row}
                      </Link>
                    ) : (
                      <div key={d.id}>{row}</div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {isSuperAdmin && (
            <SectionCard className="p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Hospitals</h3>
              <p className="text-xs text-slate-500 mb-4">
                {hospitalsLoading ? 'Searching…' : `${(hospitals ?? []).length} result${(hospitals ?? []).length === 1 ? '' : 's'}`}
              </p>
              {hospitalsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
                </div>
              ) : (hospitals ?? []).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Building2 className="h-6 w-6 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No hospitals match your search.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(hospitals ?? []).map((h) => (
                    <Link
                      key={h.id}
                      href={`/super-admin/hospitals/${h.id}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:opacity-80 transition-opacity"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{h.name}</p>
                        <p className="text-xs text-slate-500 truncate">{h.hospital_code}</p>
                      </div>
                      <StatusBadge status={h.status} />
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </>
      )}
    </>
  );
}

function SearchPage() {
  return (
    <RoleShell>
      <Suspense fallback={<div className="h-40" />}>
        <SearchInner />
      </Suspense>
    </RoleShell>
  );
}

export default withAuth(SearchPage);
