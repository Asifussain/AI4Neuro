'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useAuth } from '@/components/providers/AuthProvider';
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

/**
 * One upload form for both modalities. The frontend only chooses `modality`;
 * the backend routes to the right pipeline (doc 8.2).
 */
export function AnalysisUploadForm() {
  const router = useRouter();
  const { userProfile } = useAuth();

  const [modality, setModality] = useState<Modality>('eeg');
  const [analysisType, setAnalysisType] = useState<string>(ANALYSIS_TYPES.eeg[0].value);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [channelIndex, setChannelIndex] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const analysisTypeOptions = useMemo(() => ANALYSIS_TYPES[modality], [modality]);

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
      toast.error('Patient ID is required.');
      return;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('modality', modality);
    form.append('analysis_type', analysisType);
    form.append('patient_id', patientId.trim());
    if (doctorId.trim()) form.append('doctor_id', doctorId.trim());
    if (userProfile?.id) form.append('uploaded_by_role', userProfile.role);
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

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>New Analysis</CardTitle>
        <CardDescription>Upload an EEG or MRI scan for AI analysis.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
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

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="patient-id">Patient ID</Label>
              <Input
                id="patient-id"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="patient_profiles.user_id"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="doctor-id">Doctor ID (optional)</Label>
              <Input
                id="doctor-id"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                placeholder="user_profiles.id"
              />
            </div>
          </div>

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
              Accepted: {ACCEPTED_EXTENSIONS[modality]}
            </p>
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Uploading…' : 'Start analysis'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
