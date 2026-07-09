/** Analysis API — thin wrappers over the unified backend client. */

import { apiClient } from '@/lib/api/client';
import type {
  AnalysisResultResponse,
  CreateAnalysisResponse,
  ReportsResponse,
  RetryResponse,
  SessionStatusResponse,
} from './types';

export const analysisApi = {
  create(form: FormData): Promise<CreateAnalysisResponse> {
    return apiClient.post<CreateAnalysisResponse>('/api/v1/analysis', form);
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
