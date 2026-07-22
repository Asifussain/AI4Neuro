'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Brain, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Swal from 'sweetalert2';

import { useAuth } from '@/components/providers/AuthProvider';
import { adminApi } from '@/features/admin/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { analysisApi } from '../api';
import { ACCEPTED_EXTENSIONS, ANALYSIS_TYPES } from '../types';
import type { Modality } from '../types';
import { ApiError } from '@/lib/api/client';
import { ACCENT_STYLES } from '@/components/dashboards/shared/primitives';
import { getRoleMeta, type Role } from '@/lib/navigation';
import { cn } from '@/lib/utils';

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

/**
 * One upload form for both modalities. The frontend only chooses `modality`;
 * the backend routes to the right pipeline (doc 8.2).
 */
export function AnalysisUploadForm() {
  const router = useRouter();
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
  const [submitting, setSubmitting] = useState(false);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loadingAssociations, setLoadingAssociations] = useState(true);
  const [associationError, setAssociationError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!userProfile?.id || !role) return;

    let cancelled = false;

    // Patient/doctor pickers are sourced from the backend (service-role, so it
    // works under the fail-closed RLS on the profile tables) rather than direct
    // Supabase reads from the browser.
    const fetchAssociations = async () => {
      setLoadingAssociations(true);
      setAssociationError(null);

      try {
        const patientRows = (await adminApi.patients({ limit: 200 })).items;
        if (cancelled) return;

        setPatients(
          patientRows
            .filter((p) => p.account_status === 'active')
            .map((p) => ({
              id: p.id,
              label: p.full_name || p.patient_code || 'Patient',
              sublabel: [p.patient_code, p.email].filter(Boolean).join(' - '),
            }))
        );

        if (isDoctor) {
          // The signed-in doctor is implicitly the ordering clinician.
          setDoctorId(userProfile.id);
          setDoctors([{ id: userProfile.id, label: userProfile.full_name || 'Current doctor' }]);
        } else {
          const doctorRows = (await adminApi.doctors({ limit: 200 })).items;
          if (cancelled) return;
          setDoctors(
            doctorRows
              .filter((d) => d.account_status === 'active')
              .map((d) => ({
                id: d.id,
                label: d.full_name || d.medical_license || 'Doctor',
                sublabel: [d.medical_license, d.specialization].filter(Boolean).join(' - '),
              }))
          );
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof ApiError
            ? error.message
            : 'Could not load patient and doctor lists.';
        setAssociationError(message);
      } finally {
        if (!cancelled) setLoadingAssociations(false);
      }
    };

    fetchAssociations();
    return () => {
      cancelled = true;
    };
  }, [isDoctor, role, userProfile?.full_name, userProfile?.id]);

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a file to upload.');
      return;
    }

    // Defense-in-depth: the file picker's `accept` filter is advisory only,
    // so re-check the extension actually matches the selected modality
    // before it can be submitted as the wrong scan type (e.g. an EEG .npy
    // file posted against the MRI pipeline).
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
    try {
      const res = await analysisApi.create(form);
      toast.success('Analysis queued.');
      router.push(`/analysis/${res.session_id}`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Upload failed.';
      toast.error(message);
      setSubmitting(false);
    }
  };

  const modalityDetails = {
    eeg: {
      title: 'EEG Alzheimer detection',
      description: 'Upload .npy EEG recordings for ADFormer analysis.',
      icon: <Activity className="h-5 w-5" />,
      checks: ['19-channel EEG support', 'Binary or multiclass AD analysis', 'PSD, similarity, and trial voting outputs'],
    },
    mri: {
      title: 'MRI neuroimaging analysis',
      description: 'Upload NIfTI MRI scans for imaging-based classification.',
      icon: <Brain className="h-5 w-5" />,
      checks: ['NIfTI scan support', 'CN/MCI/AD imaging workflow', 'Viewer slices, volume charts, and reports'],
    },
  } as const;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <div>
          <p className={cn('text-sm font-semibold uppercase tracking-wide', accentStyles.text)}>
            {retryFrom ? 'Retry with changes' : 'New analysis'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Choose the clinical flow</h1>
          <p className="mt-3 text-muted-foreground">
            {retryFrom
              ? 'Adjust the file or analysis type, then start a fresh analysis session.'
              : 'AI4NEURO supports EEG and MRI as separate diagnostic lanes with one shared result and report experience.'}
          </p>
        </div>

        <div className="grid gap-3">
          {(['eeg', 'mri'] as const).map((item) => {
            const details = modalityDetails[item];
            const selected = modality === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => onModalityChange(item)}
                className={cn(
                  'rounded-xl border bg-white p-4 text-left shadow-sm transition',
                  selected ? cn('ring-2', accentStyles.ring, 'border-transparent') : 'border-border hover:border-slate-300'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', accentStyles.soft, accentStyles.text)}>
                    {details.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-semibold">{details.title}</h2>
                      {selected && <CheckCircle2 className={cn('h-5 w-5', accentStyles.text)} />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{details.description}</p>
                    <ul className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      {details.checks.map((check) => (
                        <li key={check}>- {check}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Card className="rounded-2xl border-slate-200/80 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <CardHeader>
          <CardTitle>{modalityDetails[modality].title}</CardTitle>
          <CardDescription>{modalityDetails[modality].description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="modality">Modality</Label>
                <Select value={modality} onValueChange={onModalityChange}>
                  <SelectTrigger id="modality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="eeg">EEG</SelectItem>
                    <SelectItem value="mri">MRI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
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

            {modality === 'eeg' && (
              <div className="grid gap-2 sm:w-1/2">
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

            <div className="grid gap-2">
              <Label htmlFor="file">Scan file</Label>
              <Input
                id="file"
                type="file"
                accept={ACCEPTED_EXTENSIONS[modality]}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-xs">
                Accepted for {modality.toUpperCase()}: {ACCEPTED_EXTENSIONS[modality]}
              </p>
            </div>

            <Button type="submit" disabled={submitting} className={cn('w-full text-white', accentStyles.solid, 'hover:brightness-95')}>
              {submitting ? 'Uploading...' : retryFrom ? 'Start corrected analysis' : 'Start analysis'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
