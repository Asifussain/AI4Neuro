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
  doctor_id?: string;
  mine?: boolean;
  q?: string;
  /** YYYY-MM-DD, inclusive on both ends. */
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  /** super_admin only — cross-hospital filter (see analysis.py's list_analyses). */
  hospital_id?: string;
}

export interface PaginatedSessions {
  items: SessionStatusResponse[];
  total: number;
  limit: number;
  offset: number;
}

function buildQuery(params: ListParams): string {
  const q = new URLSearchParams();
  if (params.modality) q.set('modality', params.modality);
  if (params.status) q.set('status', params.status);
  if (params.patient_id) q.set('patient_id', params.patient_id);
  if (params.doctor_id) q.set('doctor_id', params.doctor_id);
  if (params.mine) q.set('mine', 'true');
  if (params.q) q.set('q', params.q);
  if (params.date_from) q.set('date_from', params.date_from);
  if (params.date_to) q.set('date_to', params.date_to);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  if (params.hospital_id) q.set('hospital_id', params.hospital_id);
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

export const analysisApi = {
  create(form: FormData, onProgress?: (percent: number) => void): Promise<CreateAnalysisResponse> {
    if (onProgress) {
      return apiClient.postFormWithProgress<CreateAnalysisResponse>('/api/v1/analysis', form, onProgress);
    }
    return apiClient.post<CreateAnalysisResponse>('/api/v1/analysis', form);
  },
  /** Backend returns a `{items, total, limit, offset}` envelope; unwrapped
   * here so every existing caller keeps working against a plain array. */
  async list(params: ListParams = {}): Promise<SessionStatusResponse[]> {
    const page = await apiClient.get<PaginatedSessions>(`/api/v1/analysis${buildQuery(params)}`);
    return page.items;
  },
  /** Same endpoint, full envelope — for callers that need `total` to drive
   * real pagination UI instead of discarding it. */
  listPaginated(params: ListParams = {}): Promise<PaginatedSessions> {
    return apiClient.get<PaginatedSessions>(`/api/v1/analysis${buildQuery(params)}`);
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
