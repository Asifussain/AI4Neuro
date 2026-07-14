/** Admin/platform API — thin wrappers over the unified backend client. */

import { apiClient } from '@/lib/api/client';

export interface PlatformAnalytics {
  total_hospitals: number;
  active_hospitals: number;
  total_users: number;
  users_by_role: Record<string, number>;
}

export interface Hospital {
  id: string;
  hospital_code: string;
  name: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  license_number?: string | null;
  established_date?: string | null;
  status: string;
  created_at?: string | null;
}

export interface AdminUser {
  id: string;
  hospital_id?: string | null;
  unique_identifier: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  account_status: string;
  created_at?: string | null;
}

export const adminApi = {
  platformAnalytics(): Promise<PlatformAnalytics> {
    return apiClient.get<PlatformAnalytics>('/api/v1/admin/analytics/platform');
  },
  hospitals(): Promise<Hospital[]> {
    return apiClient.get<Hospital[]>('/api/v1/hospitals');
  },
  users(role?: string): Promise<AdminUser[]> {
    const qs = role ? `?role=${encodeURIComponent(role)}` : '';
    return apiClient.get<AdminUser[]>(`/api/v1/admin/users${qs}`);
  },
};
