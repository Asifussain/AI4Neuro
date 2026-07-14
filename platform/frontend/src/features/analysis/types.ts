/**
 * Analysis wire types — mirror the backend DTOs in
 * platform/backend/app/schemas/analysis.py. Both modalities share the same outer
 * shape; modality specifics live inside the jsonb sub-objects.
 */

export type Modality = 'eeg' | 'mri';

export type SessionStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'preprocessing'
  | 'running_model'
  | 'generating_visualizations'
  | 'generating_reports'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const ACTIVE_STATUSES: readonly SessionStatus[] = [
  'queued',
  'uploading',
  'processing',
  'preprocessing',
  'running_model',
  'generating_visualizations',
  'generating_reports',
];

export const TERMINAL_STATUSES: readonly SessionStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

export function isActive(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

export interface CreateAnalysisResponse {
  session_id: string;
  status: string;
  modality: string;
  analysis_type: string;
}

export interface SessionStatusResponse {
  id: string;
  modality: Modality;
  analysis_type: string;
  patient_id: string | null;
  doctor_id: string | null;
  status: SessionStatus;
  current_stage: string | null;
  progress_percent: number;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ReportUrls {
  patient?: string | null;
  clinician?: string | null;
  technical?: string | null;
}

export interface AnalysisResultResponse {
  session_id: string;
  modality: Modality;
  analysis_type: string;
  prediction: string;
  confidence: number | null;
  probabilities: Record<string, number>;
  metrics: Record<string, unknown>;
  similarity: Record<string, unknown>;
  consistency: Record<string, unknown>;
  visualizations: Record<string, unknown>;
  model_version: string | null;
  report_urls: ReportUrls;
}

export interface ReportsResponse {
  session_id: string;
  report_urls: ReportUrls;
  asset_urls: Record<string, unknown>;
}

export interface RetryResponse {
  session_id: string;
  status: string;
  retry_count: number;
}

/** Options offered per modality on the upload form. */
export const ANALYSIS_TYPES: Record<Modality, { value: string; label: string }[]> = {
  eeg: [
    { value: 'binary', label: 'Binary (Normal vs Alzheimer’s)' },
    { value: 'multiclass', label: 'Multiclass (CN / MCI / AD)' },
  ],
  // MRI is multiclass-only: the ConViT checkpoint is trained multiclass-only.
  mri: [
    { value: 'multiclass', label: 'Multiclass (CN / MCI / AD)' },
  ],
};

export const ACCEPTED_EXTENSIONS: Record<Modality, string> = {
  eeg: '.npy',
  mri: '.nii,.nii.gz,.gz',
};
