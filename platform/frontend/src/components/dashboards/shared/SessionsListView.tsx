'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { SectionCard, DashboardPageHeader, Pagination, ACCENT_STYLES, type Accent } from './primitives';
import { SessionsTable } from './SessionsTable';
import { analysisApi } from '@/features/analysis/api';
import { adminApi, type DoctorDirectoryEntry, type PatientDirectoryEntry } from '@/features/admin/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
] as const;

export type SessionsRole = 'admin' | 'doctor' | 'radiologist' | 'patient';

interface RoleConfig {
  eyebrow: string;
  title: string;
  description: string;
  accent: Accent;
  showPatientColumn: boolean;
  showDeleteAction: boolean;
  showPatientFilter: boolean;
  showDoctorFilter: boolean;
  emptyLabel: string;
}

const ROLE_CONFIG: Record<SessionsRole, RoleConfig> = {
  admin: {
    eyebrow: 'Hospital Admin',
    title: 'Scan Sessions',
    description: 'All EEG and MRI analysis sessions for your hospital.',
    accent: 'teal',
    showPatientColumn: true,
    showDeleteAction: true,
    showPatientFilter: true,
    showDoctorFilter: true,
    emptyLabel: 'No sessions found.',
  },
  doctor: {
    eyebrow: 'Doctor',
    title: 'All Analysis & Scan Sessions',
    description: 'Complete record of all EEG and MRI patient analysis sessions.',
    accent: 'blue',
    showPatientColumn: true,
    showDeleteAction: true,
    showPatientFilter: true,
    showDoctorFilter: false,
    emptyLabel: 'No sessions found.',
  },
  radiologist: {
    eyebrow: 'Radiologist',
    title: 'Scan Sessions',
    description: 'All EEG and MRI analysis sessions for your hospital.',
    accent: 'indigo',
    showPatientColumn: true,
    showDeleteAction: true,
    showPatientFilter: true,
    showDoctorFilter: true,
    emptyLabel: 'No sessions found.',
  },
  patient: {
    eyebrow: 'Patient',
    title: 'My Reports',
    description: 'All of your EEG and MRI analyses, with reports as they become available.',
    accent: 'green',
    showPatientColumn: false,
    showDeleteAction: false,
    showPatientFilter: false,
    showDoctorFilter: false,
    emptyLabel: 'Your reports will appear here once available.',
  },
};

/** Debounce a fast-changing value (the search box) so we don't fire a
 * network request on every keystroke. */
function useDebounced<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function SessionsListView({ role }: { role: SessionsRole }) {
  const config = ROLE_CONFIG[role];
  const statusParam = useSearchParams().get('status') || undefined;

  const [sessions, setSessions] = useState<SessionStatusResponse[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string | undefined>(statusParam);
  const [modalityFilter, setModalityFilter] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [showFilters, setShowFilters] = useState(false);

  const [patientOptions, setPatientOptions] = useState<PatientDirectoryEntry[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorDirectoryEntry[]>([]);

  // Options for the Patient/Doctor filter dropdowns — also doubles as the
  // name-lookup map the table needs to display a patient's name (one fetch,
  // two uses, instead of a second separate name-lookup round-trip).
  useEffect(() => {
    if (!config.showPatientFilter) return;
    let cancelled = false;
    const fetchPatients = role === 'doctor' ? adminApi.myPatients({ limit: 200 }) : adminApi.patients({ limit: 200 });
    fetchPatients.then((r) => !cancelled && setPatientOptions(r.items)).catch(() => !cancelled && setPatientOptions([]));
    return () => {
      cancelled = true;
    };
  }, [role, config.showPatientFilter]);

  useEffect(() => {
    if (!config.showDoctorFilter) return;
    let cancelled = false;
    adminApi
      .doctors({ limit: 200 })
      .then((r) => !cancelled && setDoctorOptions(r.items))
      .catch(() => !cancelled && setDoctorOptions([]));
    return () => {
      cancelled = true;
    };
  }, [config.showDoctorFilter]);

  const patientNameById = useMemo(
    () => Object.fromEntries(patientOptions.map((p) => [p.id, p.full_name])),
    [patientOptions]
  );

  const load = useCallback(() => {
    analysisApi
      .listPaginated({
        status: statusFilter,
        modality: modalityFilter || undefined,
        patient_id: patientFilter || undefined,
        doctor_id: doctorFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        q: debouncedSearch || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })
      .then((r) => {
        setSessions(r.items);
        setTotal(r.total);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [statusFilter, modalityFilter, patientFilter, doctorFilter, dateFrom, dateTo, debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Any filter change invalidates the current page's offset — jump back to
  // page 1 instead of showing a stale/out-of-range page.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, modalityFilter, patientFilter, doctorFilter, dateFrom, dateTo, debouncedSearch]);

  const handleSessionDeleted = (deletedId: string) => {
    setSessions((prev) => (prev ? prev.filter((s) => s.id !== deletedId) : prev));
    setTotal((t) => Math.max(0, t - 1));
  };

  const loading = sessions === null && !error;
  const rows = sessions ?? [];
  const isReportsView = role === 'admin' && statusParam === 'completed';
  const activeFilterCount = [modalityFilter, patientFilter, doctorFilter, dateFrom, dateTo, search].filter(Boolean).length;
  const styles = ACCENT_STYLES[config.accent];

  const clearFilters = () => {
    setModalityFilter('');
    setPatientFilter('');
    setDoctorFilter('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  return (
    <>
      <DashboardPageHeader
        eyebrow={config.eyebrow}
        title={isReportsView ? 'Reports' : config.title}
        description={
          isReportsView ? 'Completed EEG and MRI analyses with generated reports.' : config.description
        }
        accent={config.accent}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load sessions: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="space-y-3 mb-4">
          {/* Search + status + filters toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by patient, doctor, session ID…"
                className={cn(
                  'w-full pl-9 pr-9 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700',
                  'placeholder:text-slate-400 focus:outline-none focus:ring-2',
                  styles.ring
                )}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-50 border border-slate-200 w-fit">
              {STATUS_FILTERS.map(({ value, label }) => (
                <button
                  key={label}
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    statusFilter === value ? cn(styles.soft, styles.text) : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                showFilters || activeFilterCount > 0
                  ? cn(styles.soft, styles.text, 'border-transparent')
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className={cn('ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white', styles.solid)}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter dropdowns */}
          {showFilters && (
            <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-slate-100">
              <select
                value={modalityFilter}
                onChange={(e) => setModalityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 px-2.5 py-1.5 outline-none focus:border-slate-400"
              >
                <option value="">All modalities</option>
                <option value="mri">MRI</option>
                <option value="eeg">EEG</option>
              </select>

              {config.showPatientFilter && (
                <select
                  value={patientFilter}
                  onChange={(e) => setPatientFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 px-2.5 py-1.5 outline-none focus:border-slate-400 max-w-[200px]"
                >
                  <option value="">All patients</option>
                  {patientOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                    </option>
                  ))}
                </select>
              )}

              {config.showDoctorFilter && (
                <select
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 px-2.5 py-1.5 outline-none focus:border-slate-400 max-w-[200px]"
                >
                  <option value="">All doctors</option>
                  {doctorOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 px-2 py-1.5 outline-none focus:border-slate-400"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 px-2 py-1.5 outline-none focus:border-slate-400"
                />
              </div>

              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-700 ml-auto">
                  Clear all filters
                </button>
              )}
            </div>
          )}

          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${total} session${total === 1 ? '' : 's'}`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <SessionsTable
              sessions={rows}
              accent={config.accent}
              patientNameById={patientNameById}
              showPatientColumn={config.showPatientColumn}
              showDeleteAction={config.showDeleteAction}
              emptyLabel={config.emptyLabel}
              onSessionDeleted={handleSessionDeleted}
            />
            <Pagination
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </SectionCard>
    </>
  );
}
