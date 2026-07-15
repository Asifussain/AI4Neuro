/** Admin/platform API — thin wrappers over the unified backend client. */

import { apiClient } from '@/lib/api/client';

export interface PlatformAnalytics {
  total_hospitals: number;
  active_hospitals: number;
  total_users: number;
  users_by_role: Record<string, number>;
}

export interface HospitalAnalytics {
  hospital_id: string;
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

export interface DoctorDirectoryEntry {
  id: string;
  hospital_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  account_status: string;
  specialization?: string | null;
  medical_license?: string | null;
  experience_years?: number | null;
  verification_status?: string | null;
  created_at?: string | null;
}

export interface PatientDirectoryEntry {
  id: string;
  hospital_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  account_status: string;
  patient_code?: string | null;
  verification_status?: string | null;
  created_at?: string | null;
}

export interface Assignment {
  id: string;
  doctor_id: string;
  doctor_name: string;
  patient_id: string;
  patient_name: string;
  hospital_id?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface VerificationResult {
  user_id: string;
  role: string;
  verification_status: string;
}

export interface HealthStatus {
  status: string;
  configured?: boolean;
}

export const adminApi = {
  platformAnalytics(): Promise<PlatformAnalytics> {
    return apiClient.get<PlatformAnalytics>('/api/v1/analytics/platform');
  },
  hospitalAnalytics(hospitalId: string): Promise<HospitalAnalytics> {
    return apiClient.get<HospitalAnalytics>(`/api/v1/analytics/hospital/${hospitalId}`);
  },
  hospitals(): Promise<Hospital[]> {
    return apiClient.get<Hospital[]>('/api/v1/hospitals');
  },
  users(role?: string): Promise<AdminUser[]> {
    const qs = role ? `?role=${encodeURIComponent(role)}` : '';
    return apiClient.get<AdminUser[]>(`/api/v1/users${qs}`);
  },
  doctors(): Promise<DoctorDirectoryEntry[]> {
    return apiClient.get<DoctorDirectoryEntry[]>('/api/v1/doctors');
  },
  patients(): Promise<PatientDirectoryEntry[]> {
    return apiClient.get<PatientDirectoryEntry[]>('/api/v1/patients');
  },
  assignments(): Promise<Assignment[]> {
    return apiClient.get<Assignment[]>('/api/v1/assignments');
  },
  assignDoctor(doctorId: string, patientId: string, notes?: string): Promise<Assignment> {
    return apiClient.post<Assignment>('/api/v1/patients/assign-doctor', {
      doctor_id: doctorId,
      patient_id: patientId,
      notes,
    });
  },
  suspendUser(userId: string): Promise<AdminUser> {
    return apiClient.post<AdminUser>(`/api/v1/users/${userId}/suspend`);
  },
  reactivateUser(userId: string): Promise<AdminUser> {
    return apiClient.post<AdminUser>(`/api/v1/users/${userId}/reactivate`);
  },
  verifyUser(userId: string): Promise<VerificationResult> {
    return apiClient.post<VerificationResult>(`/api/v1/users/${userId}/verify`);
  },
  rejectUser(userId: string): Promise<VerificationResult> {
    return apiClient.post<VerificationResult>(`/api/v1/users/${userId}/reject`);
  },
  health(): Promise<HealthStatus> {
    return apiClient.get<HealthStatus>('/api/v1/health');
  },
  healthDatabase(): Promise<HealthStatus> {
    return apiClient.get<HealthStatus>('/api/v1/health/database');
  },
  healthStorage(): Promise<HealthStatus> {
    return apiClient.get<HealthStatus>('/api/v1/health/storage');
  },
};
