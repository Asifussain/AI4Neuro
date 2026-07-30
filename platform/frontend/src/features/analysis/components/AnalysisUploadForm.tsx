'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Brain, CheckCircle2, FileUp, Stethoscope, User, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Swal from 'sweetalert2';

import { useAuth } from '@/components/providers/AuthProvider';
import { useDoctors, usePatients } from '@/features/admin/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DashboardPageHeader, SectionCard, ACCENT_STYLES } from '@/components/dashboards/shared/primitives';

import { analysisApi } from '../api';
import { ACCEPTED_EXTENSIONS, ANALYSIS_TYPES } from '../types';
import type { Modality } from '../types';
import { ApiError } from '@/lib/api/client';
import { getRoleMeta, type Role } from '@/lib/navigation';
import { cn } from '@/lib/utils';

// Mirrors the backend's default MAX_UPLOAD_MB (app/core/config.py) — checking
// client-side lets an oversized file get rejected instantly instead of after
// a long, progress-less upload only to fail on the server.
const MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024;

const NO_DOCTOR_VALUE = '__none__';
// Super-admin-only sentinels for an anonymous "outsider" analysis (no real
// patient/doctor record). The backend collapses these to NULL.
const ANONYMOUS_PATIENT_VALUE = '__anonymous__';
const ANONYMOUS_DOCTOR_VALUE = '__anonymous__';

interface PatientOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface DoctorOption {
  id: string;
  label: string;
  sublabel?: string;
}

function getInitialModality(): Modality {
  if (typeof window === 'undefined') return 'eeg';
  const requested = new URLSearchParams(window.location.search).get('modality');
  return requested === 'mri' ? 'mri' : 'eeg';
}

function getInitialAnalysisType(modality: Modality): string {
  if (typeof window !== 'undefined') {
    const raw = new URLSearchParams(window.location.search).get('analysis_type');
    const requested = raw === 'multi-disease' ? 'multiclass' : raw === 'ad-only' ? 'binary' : raw;
    const allowed = ANALYSIS_TYPES[modality].some((type) => type.value === requested);
    if (requested && allowed) return requested;
  }
  return ANALYSIS_TYPES[modality][0].value;
}

function getInitialQueryValue(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One upload form for both modalities. The frontend only chooses `modality`;
 * the backend routes to the right pipeline (doc 8.2).
 */
export function AnalysisUploadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();

  const [modality, setModality] = useState<Modality>(() => getInitialModality());
  const [analysisType, setAnalysisType] = useState<string>(() => {
    const initialModality = getInitialModality();
    return getInitialAnalysisType(initialModality);
  });
  const [patientId, setPatientId] = useState(() => getInitialQueryValue('patient_id'));
  const [doctorId, setDoctorId] = useState(() => getInitialQueryValue('doctor_id'));
  const [channelIndex, setChannelIndex] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if URL query params change dynamically - intentional sync from
  // an external source (the URL), not derivable state.
  useEffect(() => {
    const requested = searchParams.get('modality');
    if (requested === 'mri' || requested === 'eeg') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setModality(requested);
      const allowed = ANALYSIS_TYPES[requested].some((type) => type.value === analysisType);
      if (!allowed) {
        setAnalysisType(ANALYSIS_TYPES[requested][0].value);
      }
    }
    const pid = searchParams.get('patient_id');
    if (pid !== null) setPatientId(pid);
    const did = searchParams.get('doctor_id');
    if (did !== null) setDoctorId(did);
  }, [searchParams, analysisType]);

  const analysisTypeOptions = useMemo(() => ANALYSIS_TYPES[modality], [modality]);
  const role = userProfile?.role;
  const isDoctor = role === 'doctor';
  // Only a Super Admin may analyse an outsider (anonymous patient / doctor).
  const isSuperAdmin = role === 'super_admin';
  const isAnonymousPatient = patientId === ANONYMOUS_PATIENT_VALUE;
  // Match the accent to the caller's dashboard so New Analysis looks like the
  // rest of their profile rather than a generic page.
  const accent = getRoleMeta((role ?? 'patient') as Role).accent;
  const accentStyles = ACCENT_STYLES[accent];
  const retryFrom = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('retry_from')
    : null;

  // Patient/doctor pickers are sourced from the backend (service-role, so it
  // works under the fail-closed RLS on the profile tables) rather than direct
  // Supabase reads from the browser. Cached via React Query so switching
  // modality or coming back to this page doesn't refetch every time.
  const { data: patientsPage, isLoading: patientsLoading, error: patientsErrorObj } = usePatients(
    { limit: 200 },
    { enabled: !!userProfile?.id }
  );
  const { data: doctorsPage, isLoading: doctorsLoading, error: doctorsErrorObj } = useDoctors(
    { limit: 200 },
    { enabled: !!userProfile?.id && !isDoctor }
  );
  const loadingAssociations = patientsLoading || (!isDoctor && doctorsLoading);
  const associationError =
    patientsErrorObj instanceof Error
      ? patientsErrorObj.message
      : doctorsErrorObj instanceof Error
      ? doctorsErrorObj.message
      : null;

  const patients: PatientOption[] = useMemo(
    () =>
      (patientsPage?.items ?? [])
        .filter((p) => p.account_status === 'active')
        .map((p) => ({
          id: p.id,
          label: p.full_name || p.patient_code || 'Patient',
          sublabel: [p.patient_code, p.email].filter(Boolean).join(' - '),
        })),
    [patientsPage]
  );

  const doctors: DoctorOption[] = useMemo(() => {
    if (isDoctor) {
      // The signed-in doctor is implicitly the ordering clinician.
      return userProfile
        ? [{ id: userProfile.id, label: userProfile.full_name || 'Current doctor' }]
        : [];
    }
    return (doctorsPage?.items ?? [])
      .filter((d) => d.account_status === 'active')
      .map((d) => ({
        id: d.id,
        label: d.full_name || d.medical_license || 'Doctor',
        sublabel: [d.medical_license, d.specialization].filter(Boolean).join(' - '),
      }));
  }, [doctorsPage, isDoctor, userProfile]);

  // A signed-in doctor is always their own referring doctor - intentional
  // sync from the async-loaded auth profile.
  useEffect(() => {
    if (isDoctor && userProfile?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
      setDoctorId(userProfile.id);
    }
  }, [isDoctor, userProfile?.id]);

  // Any details already entered for the current modality that would be lost
  // if the user switches lanes (EEG <-> MRI) without confirming first.
  const hasUnsavedDetails = Boolean(file || patientId.trim() || (!isDoctor && doctorId.trim()));

  const resetFormDetails = () => {
    setPatientId('');
    if (!isDoctor) setDoctorId('');
    setChannelIndex('0');
    setFile(null);
  };

  const switchModality = (next: Modality) => {
    setModality(next);
    setAnalysisType(ANALYSIS_TYPES[next][0].value);
    setFile(null);
  };

  const onModalityChange = (value: string) => {
    const next = value as Modality;
    if (next === modality) return;

    if (hasUnsavedDetails) {
      Swal.fire({
        icon: 'warning',
        title: 'Discard current analysis?',
        text: `You have unsaved details for this ${modality.toUpperCase()} analysis (patient, doctor, or file). Switching to ${next.toUpperCase()} will discard them and start a fresh analysis.`,
        showCancelButton: true,
        confirmButtonText: 'Discard & switch',
        cancelButtonText: 'Keep editing',
        confirmButtonColor: '#dc2626',
      }).then((result) => {
        if (result.isConfirmed) {
          resetFormDetails();
          switchModality(next);
        }
      });
      return;
    }

    switchModality(next);
  };

  const validateAndSetFile = (candidate: File | null) => {
    if (!candidate) {
      setFile(null);
      return;
    }
    const allowedExtensions = ACCEPTED_EXTENSIONS[modality].split(',').map((ext) => ext.trim().toLowerCase());
    const fileName = candidate.name.toLowerCase();
    if (!allowedExtensions.some((ext) => fileName.endsWith(ext))) {
      Swal.fire({
        icon: 'error',
        title: 'Wrong file type',
        text: `"${candidate.name}" doesn't look like a ${modality.toUpperCase()} file. Accepted for ${modality.toUpperCase()}: ${ACCEPTED_EXTENSIONS[modality]}`,
      });
      return;
    }
    if (candidate.size > MAX_FILE_SIZE_BYTES) {
      Swal.fire({
        icon: 'error',
        title: 'File too large',
        text: `"${candidate.name}" is ${formatBytes(candidate.size)}, which exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} upload limit.`,
      });
      return;
    }
    setFile(candidate);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    validateAndSetFile(e.dataTransfer.files?.[0] ?? null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a file to upload.');
      return;
    }

    // Defense-in-depth: the file picker's `accept` filter (and the dropzone's
    // own check) are advisory only, so re-check the extension actually
    // matches the selected modality before it can be submitted as the wrong
    // scan type (e.g. an EEG .npy file posted against the MRI pipeline).
    const allowedExtensions = ACCEPTED_EXTENSIONS[modality].split(',').map((ext) => ext.trim().toLowerCase());
    const fileName = file.name.toLowerCase();
    if (!allowedExtensions.some((ext) => fileName.endsWith(ext))) {
      Swal.fire({
        icon: 'error',
        title: 'Wrong file type',
        text: `"${file.name}" doesn't look like a ${modality.toUpperCase()} file. Accepted for ${modality.toUpperCase()}: ${ACCEPTED_EXTENSIONS[modality]}`,
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      Swal.fire({
        icon: 'error',
        title: 'File too large',
        text: `"${file.name}" is ${formatBytes(file.size)}, which exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} upload limit.`,
      });
      return;
    }

    if (!patientId.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Select a patient',
        text: 'Please select a patient before starting the analysis.',
      });
      return;
    }

    // Referring doctor is optional — a doctor running their own analysis is
    // auto-attributed below, and radiologists/admins may proceed without
    // naming a referring doctor. The backend accepts a null doctor_id.

    const form = new FormData();
    form.append('file', file);
    form.append('modality', modality);
    form.append('analysis_type', analysisType);
    // Anonymous outsider scans (super admin only) send no real patient — the
    // backend stores a NULL patient_id.
    if (!isAnonymousPatient) form.append('patient_id', patientId.trim());
    if (
      doctorId.trim() &&
      doctorId !== NO_DOCTOR_VALUE &&
      doctorId !== ANONYMOUS_DOCTOR_VALUE
    )
      form.append('doctor_id', doctorId.trim());
    if (userProfile?.id) {
      form.append('uploaded_by_role', userProfile.role);
      if (userProfile.role === 'radiologist') form.append('radiologist_id', userProfile.id);
      if (userProfile.role === 'doctor' && !doctorId.trim()) form.append('doctor_id', userProfile.id);
    }
    if (modality === 'eeg') form.append('channel_index', channelIndex || '0');

    setSubmitting(true);
    setUploadProgress(0);
    try {
      const res = await analysisApi.create(form, setUploadProgress);
      // The backend already queues this on a background worker and returns
      // immediately (202 Accepted) — no need to force-navigate to the status
      // page and make the user sit and watch it. Confirm it's queued and let
      // them keep browsing; the toast's action link takes them to the status
      // page only if they actually want to.
      toast.success('Analysis queued — it will keep running in the background.', {
        action: {
          label: 'View status',
          onClick: () => router.push(`/analysis/${res.session_id}`),
        },
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSubmitting(false);
      setUploadProgress(0);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Upload failed.';
      toast.error(message);
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const modalityDetails = {
    eeg: {
      title: 'EEG Alzheimer detection',
      shortTitle: 'EEG',
      description: 'Upload .npy EEG recordings for ADFormer analysis.',
      icon: <Activity className="h-5 w-5" />,
      checks: ['19-channel EEG support', 'Binary or multiclass AD analysis', 'PSD, similarity, and trial voting outputs'],
    },
    mri: {
      title: 'MRI neuroimaging analysis',
      shortTitle: 'MRI',
      description: 'Upload NIfTI MRI scans for imaging-based classification.',
      icon: <Brain className="h-5 w-5" />,
      checks: ['NIfTI scan support', 'CN/MCI/AD imaging workflow', 'Viewer slices, volume charts, and reports'],
    },
  } as const;

  const selectedPatient = patients.find((p) => p.id === patientId);
  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow={retryFrom ? 'Retry with changes' : 'New analysis'}
        title="Choose the clinical flow"
        description={
          retryFrom
            ? 'Adjust the file or analysis type, then start a fresh analysis session.'
            : 'AI4NEURO supports EEG and MRI as separate diagnostic lanes with one shared result and report experience.'
        }
        accent={accent}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px] items-start">
        {/* ================= MODALITY RAIL ================= */}
        <SectionCard className="p-4 space-y-3 xl:sticky xl:top-24">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Modality
          </p>
          {(['eeg', 'mri'] as const).map((item) => {
            const details = modalityDetails[item];
            const selected = modality === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onModalityChange(item)}
                className={cn(
                  'w-full rounded-xl border bg-white p-4 text-left shadow-sm transition',
                  selected ? cn('ring-2', accentStyles.ring, 'border-transparent') : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', accentStyles.soft, accentStyles.text)}>
                    {details.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold text-sm">{details.title}</h2>
                      {selected && <CheckCircle2 className={cn('h-4.5 w-4.5 shrink-0', accentStyles.text)} />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{details.description}</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                  {details.checks.map((check) => (
                    <li key={check}>- {check}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </SectionCard>

        {/* ================= FORM ================= */}
        <SectionCard className="p-6 md:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">{modalityDetails[modality].title}</h2>
            <p className="text-sm text-muted-foreground">{modalityDetails[modality].description}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="analysis-type">Analysis type</Label>
                {analysisTypeOptions.length > 1 ? (
                  <Select value={analysisType} onValueChange={setAnalysisType}>
                    <SelectTrigger id="analysis-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {analysisTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div
                    id="analysis-type"
                    className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
                  >
                    {analysisTypeOptions[0]?.label}
                  </div>
                )}
              </div>

              {modality === 'eeg' && (
                <div className="grid gap-2">
                  <Label htmlFor="channel-index">Similarity channel index</Label>
                  <Input
                    id="channel-index"
                    type="number"
                    min={0}
                    value={channelIndex}
                    onChange={(e) => setChannelIndex(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="patient-id">Patient <span className="text-destructive">*</span></Label>
                <Select value={patientId} onValueChange={setPatientId} disabled={loadingAssociations}>
                  <SelectTrigger id="patient-id">
                    <SelectValue placeholder={loadingAssociations ? 'Loading patients...' : 'Select patient'} />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && (
                      <SelectItem value={ANONYMOUS_PATIENT_VALUE}>
                        <span className="flex flex-col">
                          <span>Anonymous patient (outsider)</span>
                          <span className="text-xs text-muted-foreground">No patient record — Super Admin only</span>
                        </span>
                      </SelectItem>
                    )}
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        <span className="flex flex-col">
                          <span>{patient.label}</span>
                          {patient.sublabel && (
                            <span className="text-xs text-muted-foreground">{patient.sublabel}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="doctor-id">
                  Referring doctor <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Select
                  value={doctorId || NO_DOCTOR_VALUE}
                  onValueChange={(value) => setDoctorId(value === NO_DOCTOR_VALUE ? '' : value)}
                  disabled={loadingAssociations || isDoctor}
                >
                  <SelectTrigger id="doctor-id">
                    <SelectValue placeholder={loadingAssociations ? 'Loading doctors...' : 'Select doctor'} />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && (
                      <SelectItem value={ANONYMOUS_DOCTOR_VALUE}>
                        <span className="flex flex-col">
                          <span>Anonymous doctor (outsider)</span>
                          <span className="text-xs text-muted-foreground">No doctor record — Super Admin only</span>
                        </span>
                      </SelectItem>
                    )}
                    {!isDoctor && !isSuperAdmin && (
                      <SelectItem value={NO_DOCTOR_VALUE}>
                        <span className="text-muted-foreground">No referring doctor</span>
                      </SelectItem>
                    )}
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        <span className="flex flex-col">
                          <span>{doctor.label}</span>
                          {doctor.sublabel && (
                            <span className="text-xs text-muted-foreground">{doctor.sublabel}</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {associationError && <p className="text-sm text-destructive">{associationError}</p>}
            {!loadingAssociations && patients.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No associated patients were found for this account.
              </p>
            )}

            {/* ---------- Dropzone ---------- */}
            <div className="grid gap-2">
              <Label>Scan file</Label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors',
                  dragActive ? cn(accentStyles.soft, accentStyles.ring, 'border-transparent ring-2') : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                )}
              >
                <input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept={ACCEPTED_EXTENSIONS[modality]}
                  onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                {file ? (
                  <>
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-full', accentStyles.soft, accentStyles.text)}>
                      <FileUp className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-900">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <FileUp className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      Drag and drop your scan here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Accepted for {modality.toUpperCase()}: {ACCEPTED_EXTENSIONS[modality]}
                    </p>
                  </>
                )}
              </div>
            </div>

            {submitting && (
              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-200', accentStyles.solid)}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Processing…'}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className={cn('w-full text-white', accentStyles.solid, 'hover:brightness-95')}
            >
              {submitting ? 'Uploading...' : retryFrom ? 'Start corrected analysis' : 'Start analysis'}
            </Button>
          </form>
        </SectionCard>

        {/* ================= LIVE SUMMARY ================= */}
        <SectionCard className="p-5 space-y-4 xl:sticky xl:top-24">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Summary
          </p>

          <div className="flex items-center gap-3">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', accentStyles.soft, accentStyles.text)}>
              {modalityDetails[modality].icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{modalityDetails[modality].shortTitle}</p>
              <p className="text-xs text-muted-foreground">
                {analysisTypeOptions.find((o) => o.value === analysisType)?.label ?? analysisType}
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2.5">
              <User className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Patient</p>
                <p className="font-medium text-slate-900 truncate">
                  {isAnonymousPatient ? 'Anonymous (outsider)' : selectedPatient?.label ?? 'Not selected'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Stethoscope className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Referring doctor</p>
                <p className="font-medium text-slate-900 truncate">
                  {doctorId === ANONYMOUS_DOCTOR_VALUE
                    ? 'Anonymous (outsider)'
                    : selectedDoctor?.label ?? 'None'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <FileUp className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">File</p>
                <p className="font-medium text-slate-900 truncate">{file ? file.name : 'Not selected'}</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Once started, the analysis runs in the background — you can navigate away and check
            progress from your dashboard at any time.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
