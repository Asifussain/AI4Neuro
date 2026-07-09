/** Analysis API — thin wrappers over the unified backend client. */

import { apiClient } from '@/lib/api/client';
import type {
  AnalysisResultResponse,
  CreateAnalysisResponse,
  ReportsResponse,
  RetryResponse,
  SessionStatusResponse,
} from './types';

export interface ListParams {
  modality?: string;
  status?: string;
  patient_id?: string;
  mine?: boolean;
  limit?: number;
}

export const analysisApi = {
  create(form: FormData): Promise<CreateAnalysisResponse> {
    return apiClient.post<CreateAnalysisResponse>('/api/v1/analysis', form);
  },
  list(params: ListParams = {}): Promise<SessionStatusResponse[]> {
    const q = new URLSearchParams();
    if (params.modality) q.set('modality', params.modality);
    if (params.status) q.set('status', params.status);
    if (params.patient_id) q.set('patient_id', params.patient_id);
    if (params.mine) q.set('mine', 'true');
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiClient.get<SessionStatusResponse[]>(`/api/v1/analysis${qs ? `?${qs}` : ''}`);
  },
  status(sessionId: string): Promise<SessionStatusResponse> {
    return apiClient.get<SessionStatusResponse>(`/api/v1/analysis/${sessionId}`);
  },
  result(sessionId: string): Promise<AnalysisResultResponse> {
    return apiClient.get<AnalysisResultResponse>(`/api/v1/analysis/${sessionId}/result`);
  },
  reports(sessionId: string): Promise<ReportsResponse> {
    return apiClient.get<ReportsResponse>(`/api/v1/analysis/${sessionId}/reports`);
  },
  retry(sessionId: string): Promise<RetryResponse> {
    return apiClient.post<RetryResponse>(`/api/v1/analysis/${sessionId}/retry`);
  },
};
