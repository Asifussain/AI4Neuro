/** Admin/platform API — thin wrappers over the unified backend client.
 *
 * Route split mirrors the backend (platform_admin.py / hospital_admin.py):
 *  - `/api/v1/platform/*`  — super_admin only, unscoped across every hospital.
 *  - `/api/v1/hospital/*`  — admin + super_admin, hospital-scoped for `admin`
 *    callers (the backend pins the scope server-side).
 */

import { apiClient } from '@/lib/api/client';
import type { Role } from '@/lib/roles';

/** Uniform pagination envelope returned by every list endpoint. */
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListParams {
  limit?: number;
  offset?: number;
}

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
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface HospitalCreatePayload {
  hospital_code: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  license_number?: string;
  established_date?: string;
}

export interface HospitalUpdatePayload {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  license_number?: string;
  established_date?: string;
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
  updated_at?: string | null;
  profile?: Record<string, unknown> | null;
}

export interface UserUpdatePayload {
  full_name?: string;
  phone?: string;
  address?: string;
}

/** Body for both `POST /platform/users` and `POST /hospital/users` — caller
 * picks the target route based on `role` (see `adminApi.createUser`). */
export interface UserCreatePayload {
  full_name: string;
  email: string;
  phone: string;
  role: Role;
  unique_identifier: string;
  hospital_id?: string | null;
  date_of_birth?: string;
  address?: string;
}

/** `UserCreateResult` — same shape as `AdminUser` plus a one-time temporary
 * password. Must never be logged; show it to the admin exactly once. */
export interface UserCreateResult extends AdminUser {
  temporary_password: string | null;
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

export interface AuditLogEntry {
  id: string;
  actor_id?: string | null;
  actor_role?: string | null;
  hospital_id?: string | null;
  action: string;
  target_table?: string | null;
  target_id?: string | null;
  metadata: Record<string, unknown>;
  created_at?: string | null;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

/** Admin/super_admin account roles route through `/platform/users`; every
 * other role routes through `/hospital/users`. Mirrors the backend split. */
function isPlatformRole(role: Role): boolean {
  return role === 'admin' || role === 'super_admin';
}

export const adminApi = {
  // -- Analytics ---------------------------------------------------------- //
  platformAnalytics(): Promise<PlatformAnalytics> {
    return apiClient.get<PlatformAnalytics>('/api/v1/platform/analytics');
  },
  hospitalAnalytics(hospitalId?: string): Promise<HospitalAnalytics> {
    return apiClient.get<HospitalAnalytics>(
      `/api/v1/hospital/analytics${qs({ hospital_id: hospitalId })}`
    );
  },

  // -- Hospitals (super_admin only) ---------------------------------------- //
  hospitals(params: ListParams = {}): Promise<Paginated<Hospital>> {
    return apiClient.get<Paginated<Hospital>>(
      `/api/v1/platform/hospitals${qs({ limit: params.limit, offset: params.offset })}`
    );
  },
  hospital(id: string): Promise<Hospital> {
    return apiClient.get<Hospital>(`/api/v1/platform/hospitals/${id}`);
  },
  createHospital(payload: HospitalCreatePayload): Promise<Hospital> {
    return apiClient.post<Hospital>('/api/v1/platform/hospitals', payload);
  },
  updateHospital(id: string, payload: HospitalUpdatePayload): Promise<Hospital> {
    return apiClient.patch<Hospital>(`/api/v1/platform/hospitals/${id}`, payload);
  },
  activateHospital(id: string): Promise<Hospital> {
    return apiClient.post<Hospital>(`/api/v1/platform/hospitals/${id}/activate`);
  },
  deactivateHospital(id: string): Promise<Hospital> {
    return apiClient.post<Hospital>(`/api/v1/platform/hospitals/${id}/deactivate`);
  },
  suspendHospital(id: string): Promise<Hospital> {
    return apiClient.post<Hospital>(`/api/v1/platform/hospitals/${id}/suspend`);
  },

  // -- Users ---------------------------------------------------------------- //
  // `/hospital/users` is reachable by both `admin` (auto-scoped server-side
  // to their own hospital) and `super_admin` (optionally cross-scoped via
  // `hospitalId`) — this is the one UserDirectory and both role dashboards use.
  users(params: { role?: string; hospitalId?: string } & ListParams = {}): Promise<Paginated<AdminUser>> {
    return apiClient.get<Paginated<AdminUser>>(
      `/api/v1/hospital/users${qs({
        role: params.role,
        hospital_id: params.hospitalId,
        limit: params.limit,
        offset: params.offset,
      })}`
    );
  },
  /** Unscoped, cross-hospital user search — super_admin only. */
  platformUsers(
    params: { role?: string; hospitalId?: string } & ListParams = {}
  ): Promise<Paginated<AdminUser>> {
    return apiClient.get<Paginated<AdminUser>>(
      `/api/v1/platform/users${qs({
        role: params.role,
        hospital_id: params.hospitalId,
        limit: params.limit,
        offset: params.offset,
      })}`
    );
  },
  /** Read-only trail of hospital/user management actions — super_admin only. */
  auditLog(params: { hospitalId?: string } & ListParams = {}): Promise<Paginated<AuditLogEntry>> {
    return apiClient.get<Paginated<AuditLogEntry>>(
      `/api/v1/platform/audit-log${qs({
        hospital_id: params.hospitalId,
        limit: params.limit,
        offset: params.offset,
      })}`
    );
  },
  user(id: string): Promise<AdminUser> {
    return apiClient.get<AdminUser>(`/api/v1/hospital/users/${id}`);
  },
  /** Creates admin/super_admin accounts via `/platform/users`; every other
   * role via `/hospital/users` — mirrors the backend's two-route split. */
  createUser(payload: UserCreatePayload): Promise<UserCreateResult> {
    const path = isPlatformRole(payload.role) ? '/api/v1/platform/users' : '/api/v1/hospital/users';
    return apiClient.post<UserCreateResult>(path, { ...payload });
  },
  updateUser(id: string, payload: UserUpdatePayload): Promise<AdminUser> {
    return apiClient.patch<AdminUser>(`/api/v1/hospital/users/${id}`, payload);
  },
  deleteUser(id: string): Promise<AdminUser> {
    return apiClient.delete<AdminUser>(`/api/v1/hospital/users/${id}`);
  },
  suspendUser(userId: string): Promise<AdminUser> {
    return apiClient.post<AdminUser>(`/api/v1/hospital/users/${userId}/suspend`);
  },
  reactivateUser(userId: string): Promise<AdminUser> {
    return apiClient.post<AdminUser>(`/api/v1/hospital/users/${userId}/reactivate`);
  },
  verifyUser(userId: string): Promise<VerificationResult> {
    return apiClient.post<VerificationResult>(`/api/v1/hospital/users/${userId}/verify`);
  },
  rejectUser(userId: string): Promise<VerificationResult> {
    return apiClient.post<VerificationResult>(`/api/v1/hospital/users/${userId}/reject`);
  },

  // -- Clinical directories -------------------------------------------------- //
  doctors(params: { hospitalId?: string } & ListParams = {}): Promise<Paginated<DoctorDirectoryEntry>> {
    return apiClient.get<Paginated<DoctorDirectoryEntry>>(
      `/api/v1/hospital/doctors${qs({
        hospital_id: params.hospitalId,
        limit: params.limit,
        offset: params.offset,
      })}`
    );
  },
  patients(params: { hospitalId?: string } & ListParams = {}): Promise<Paginated<PatientDirectoryEntry>> {
    return apiClient.get<Paginated<PatientDirectoryEntry>>(
      `/api/v1/hospital/patients${qs({
        hospital_id: params.hospitalId,
        limit: params.limit,
        offset: params.offset,
      })}`
    );
  },
  myPatients(params: ListParams = {}): Promise<Paginated<PatientDirectoryEntry>> {
    return apiClient.get<Paginated<PatientDirectoryEntry>>(
      `/api/v1/hospital/patients/mine${qs({ limit: params.limit, offset: params.offset })}`
    );
  },

  // -- Doctor <-> patient assignments ---------------------------------------- //
  assignments(params: { hospitalId?: string } & ListParams = {}): Promise<Paginated<Assignment>> {
    return apiClient.get<Paginated<Assignment>>(
      `/api/v1/hospital/assignments${qs({
        hospital_id: params.hospitalId,
        limit: params.limit,
        offset: params.offset,
      })}`
    );
  },
  assignDoctor(doctorId: string, patientId: string, notes?: string): Promise<Assignment> {
    return apiClient.post<Assignment>('/api/v1/hospital/assignments', {
      doctor_id: doctorId,
      patient_id: patientId,
      notes,
    });
  },
  unassignDoctor(assignmentId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/hospital/assignments/${assignmentId}`);
  },

  // -- Health ----------------------------------------------------------------- //
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
