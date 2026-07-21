/** Analysis API — thin wrappers over the unified backend client. */

import { apiClient } from '@/lib/api/client';
import type {
  AnalysisResultResponse,
  CancelResponse,
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
  /** Backend returns a `{items, total, limit, offset}` envelope; unwrapped
   * here so every existing caller keeps working against a plain array. */
  async list(params: ListParams = {}): Promise<SessionStatusResponse[]> {
    const q = new URLSearchParams();
    if (params.modality) q.set('modality', params.modality);
    if (params.status) q.set('status', params.status);
    if (params.patient_id) q.set('patient_id', params.patient_id);
    if (params.mine) q.set('mine', 'true');
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    const page = await apiClient.get<{ items: SessionStatusResponse[] }>(
      `/api/v1/analysis${qs ? `?${qs}` : ''}`
    );
    return page.items;
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
  cancel(sessionId: string): Promise<CancelResponse> {
    return apiClient.post<CancelResponse>(`/api/v1/analysis/${sessionId}/cancel`);
  },
  async delete(sessionId: string): Promise<void> {
    try {
      await apiClient.delete<void>(`/api/v1/analysis/${sessionId}`);
    } catch {
      // Fallback via sessionsApi if backend endpoint is not active
      const { sessionsApi } = await import('@/lib/api/sessions');
      const res = await sessionsApi.deleteSession(sessionId);
      if (res.error) throw new Error(res.error);
    }
  },
};
