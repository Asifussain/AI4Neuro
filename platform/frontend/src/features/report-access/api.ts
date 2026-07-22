/** Report-access request/approve flow — patient asks their assigned doctor for
 * permission to view their analysis reports; the doctor approves/denies. */

import { apiClient } from '@/lib/api/client';

export interface ReportAccess {
  id?: string | null;
  patient_id: string;
  patient_name?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  hospital_id?: string | null;
  status: 'none' | 'pending' | 'approved' | 'denied';
  created_at?: string | null;
  decided_at?: string | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export const reportAccessApi = {
  /** Patient: request access from their assigned doctor. */
  request(): Promise<ReportAccess> {
    return apiClient.post<ReportAccess>('/api/v1/hospital/report-access/request');
  },
  /** Patient: their current access state. */
  me(): Promise<ReportAccess> {
    return apiClient.get<ReportAccess>('/api/v1/hospital/report-access/me');
  },
  /** Doctor/admin: pending requests awaiting a decision. */
  pending(): Promise<Paginated<ReportAccess>> {
    return apiClient.get<Paginated<ReportAccess>>('/api/v1/hospital/report-access/pending');
  },
  approve(id: string): Promise<ReportAccess> {
    return apiClient.post<ReportAccess>(`/api/v1/hospital/report-access/${id}/approve`);
  },
  deny(id: string): Promise<ReportAccess> {
    return apiClient.post<ReportAccess>(`/api/v1/hospital/report-access/${id}/deny`);
  },
};
