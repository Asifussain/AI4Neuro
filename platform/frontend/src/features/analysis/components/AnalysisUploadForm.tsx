'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Brain, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';
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

const NO_DOCTOR_VALUE = '__none__';

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

interface ProfileLite {
  full_name?: string | null;
  email?: string | null;
  account_status?: string | null;
}

interface PatientRow {
  user_id: string;
  patient_id: string | null;
  user_profile?: ProfileLite | ProfileLite[] | null;
}

interface LoadedPatient {
  user_id: string;
  patient_id: string | null;
  user_profile: ProfileLite | null;
}

interface DoctorRow {
  user_id: string;
  medical_license: string | null;
  specialization?: string | null;
  user_profile?: ProfileLite | ProfileLite[] | null;
}

interface AssignmentRow {
  patient?: PatientRow | PatientRow[] | null;
}

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function normalizePatient(patient: PatientRow | null): LoadedPatient | null {
  if (!patient) return null;
  const user = firstRelation(patient.user_profile);
  if (user?.account_status && user.account_status !== 'active') return null;
  return {
    user_id: patient.user_id,
    patient_id: patient.patient_id,
    user_profile: user,
  };
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
  const retryFrom = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('retry_from')
    : null;

  useEffect(() => {
    if (!userProfile?.id || !role) return;

    const fetchAssociations = async () => {
      const supabase = createClient();
      setLoadingAssociations(true);
      setAssociationError(null);

      try {
        let currentDoctorId = '';
        let patientRows: LoadedPatient[] = [];

        if (isDoctor) {
          const { data: doctorProfile, error: doctorError } = await supabase
            .from('doctor_profiles')
            .select('user_id, medical_license, specialization')
            .eq('user_id', userProfile.id)
            .single();

          if (doctorError) throw doctorError;

          currentDoctorId = doctorProfile?.user_id ?? '';

          const { data: assignmentRows, error: assignmentError } = await supabase
            .from('doctor_patient_relationships')
            .select(`
              patient:patient_profiles(
                user_id,
                patient_id,
                user_profile:user_profiles!patient_profiles_user_id_fkey(full_name, email, account_status)
              )
            `)
            .eq('doctor_id', currentDoctorId)
            .eq('relationship_status', 'active')
            .order('assigned_at', { ascending: false });

          if (assignmentError) throw assignmentError;

          patientRows = ((assignmentRows ?? []) as AssignmentRow[])
            .map((row) => {
              const patient = firstRelation(row.patient);
              return normalizePatient(patient);
            })
            .filter((patient): patient is LoadedPatient => Boolean(patient));

          setDoctorId(currentDoctorId);
          setDoctors([
            {
              id: currentDoctorId,
              label: userProfile.full_name || 'Current doctor',
              sublabel: doctorProfile?.medical_license,
            },
          ]);
        } else {
          const { data: patientProfiles, error: patientsError } = await supabase
            .from('patient_profiles')
            .select(`
              user_id,
              patient_id,
              user_profile:user_profiles!patient_profiles_user_id_fkey(full_name, email, account_status)
            `)
            .order('created_at', { ascending: false })
            .limit(100);

          if (patientsError) throw patientsError;

          patientRows = ((patientProfiles ?? []) as PatientRow[])
            .map((patient) => normalizePatient(patient))
            .filter((patient): patient is LoadedPatient => Boolean(patient));

          const { data: doctorProfiles, error: doctorsError } = await supabase
            .from('doctor_profiles')
            .select(`
              user_id,
              medical_license,
              specialization,
              user_profile:user_profiles!doctor_profiles_user_id_fkey(full_name, email, account_status)
            `)
            .order('created_at', { ascending: false })
            .limit(100);

          if (doctorsError) throw doctorsError;

          setDoctors(
            ((doctorProfiles ?? []) as DoctorRow[])
              .map((doctor) => {
                const user = firstRelation(doctor.user_profile);
                if (user?.account_status && user.account_status !== 'active') return null;
                const option: DoctorOption = {
                  id: doctor.user_id,
                  label: user?.full_name || doctor.medical_license || 'Doctor',
                  sublabel: [doctor.medical_license, doctor.specialization].filter(Boolean).join(' - '),
                };
                return option;
              })
              .filter((doctor): doctor is DoctorOption => Boolean(doctor))
          );
        }

        setPatients(
          patientRows.map((patient) => ({
            id: patient.user_id,
            label: patient.user_profile?.full_name || patient.patient_id || 'Patient',
            sublabel: [patient.patient_id, patient.user_profile?.email].filter(Boolean).join(' - '),
          }))
        );
      } catch (error) {
        console.error('Failed to load associated users:', error);
        setAssociationError('Could not load patient and doctor lists.');
      } finally {
        setLoadingAssociations(false);
      }
    };

    fetchAssociations();
  }, [isDoctor, role, userProfile?.full_name, userProfile?.id]);

  const onModalityChange = (value: string) => {
    const next = value as Modality;
    setModality(next);
    setAnalysisType(ANALYSIS_TYPES[next][0].value);
    setFile(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a file to upload.');
      return;
    }
    if (!patientId.trim()) {
      toast.error('Please select a patient.');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('modality', modality);
    form.append('analysis_type', analysisType);
    form.append('patient_id', patientId.trim());
    if (doctorId.trim() && doctorId !== NO_DOCTOR_VALUE) form.append('doctor_id', doctorId.trim());
    if (userProfile?.id) {
      form.append('uploaded_by_role', userProfile.role);
      if (userProfile.role === 'technician') form.append('technician_id', userProfile.id);
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
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
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
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${
                  selected ? 'border-primary ring-2 ring-primary/15' : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {details.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-semibold">{details.title}</h2>
                      {selected && <CheckCircle2 className="h-5 w-5 text-primary" />}
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

      <Card className="ai4-card">
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
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="patient-id">Patient</Label>
              <Select value={patientId} onValueChange={setPatientId} disabled={loadingAssociations}>
                <SelectTrigger id="patient-id">
                  <SelectValue placeholder={loadingAssociations ? 'Loading patients...' : 'Select patient'} />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="doctor-id">Referring doctor</Label>
              <Select
                value={doctorId || NO_DOCTOR_VALUE}
                onValueChange={(value) => setDoctorId(value === NO_DOCTOR_VALUE ? '' : value)}
                disabled={loadingAssociations || isDoctor}
              >
                <SelectTrigger id="doctor-id">
                  <SelectValue placeholder={loadingAssociations ? 'Loading doctors...' : 'Select doctor'} />
                </SelectTrigger>
                <SelectContent>
                  {!isDoctor && <SelectItem value={NO_DOCTOR_VALUE}>No referring doctor</SelectItem>}
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

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Uploading...' : retryFrom ? 'Start corrected analysis' : 'Start analysis'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
