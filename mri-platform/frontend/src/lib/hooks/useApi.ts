/**
 * Custom React Hooks for API Data Fetching
 * Provides caching, loading states, and error handling
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ApiResponse, PaginatedResponse, FilterOptions } from '@/lib/api';
import { patientsApi, type Patient, type PatientWithSessions } from '@/lib/api/patients';
import { doctorsApi, type Doctor, type DoctorWithPatients } from '@/lib/api/doctors';
import { sessionsApi, type MRISession } from '@/lib/api/sessions';
import { statsApi, type PatientStats, type DoctorStats, type RadiologistStats, type AdminStats } from '@/lib/api/stats';
import { usersApi, type User } from '@/lib/api/users';

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds
const API_TIMEOUT = 5000; // 5 second timeout for API calls (faster response)

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Helper to check if user is authenticated
async function waitForAuth(maxWait = 2000): Promise<boolean> {
  const supabase = createClient();
  const startTime = Date.now();

  // First quick check
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
  } catch {
    // Continue to retry
  }

  // Retry with shorter intervals
  while (Date.now() - startTime < maxWait) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return true;
    } catch {
      // Ignore errors and retry
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}

// Generic hook for API calls
interface UseApiState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
  mutate: (data: T) => void;
}

function useApiCall<T>(
  fetchFn: () => Promise<ApiResponse<T>>,
  cacheKey?: string,
  dependencies: any[] = []
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: cacheKey ? getCached<T>(cacheKey) : null,
    error: null,
    isLoading: !getCached<T>(cacheKey || ''),
  });

  const fetchRef = useRef(fetchFn);
  const mountedRef = useRef(true);
  fetchRef.current = fetchFn;

  const fetch = useCallback(async () => {
    if (!mountedRef.current) return;
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Wait for auth with timeout
      const isAuthenticated = await waitForAuth();
      if (!isAuthenticated) {
        if (mountedRef.current) {
          setState({ data: null, error: 'Not authenticated', isLoading: false });
        }
        return;
      }

      // Add timeout to API call
      const timeoutPromise = new Promise<ApiResponse<T>>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), API_TIMEOUT);
      });

      const result = await Promise.race([fetchRef.current(), timeoutPromise]);

      if (!mountedRef.current) return;

      if (result.error) {
        setState({ data: null, error: result.error, isLoading: false });
      } else {
        if (cacheKey) {
          setCache(cacheKey, result.data);
        }
        setState({ data: result.data, error: null, isLoading: false });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setState({
        data: null,
        error: err instanceof Error ? err.message : 'An error occurred',
        isLoading: false,
      });
    }
  }, [cacheKey]);

  useEffect(() => {
    mountedRef.current = true;

    // Only fetch if no cached data
    if (!getCached<T>(cacheKey || '')) {
      fetch();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [fetch, ...dependencies]);

  const mutate = useCallback((newData: T) => {
    if (cacheKey) {
      setCache(cacheKey, newData);
    }
    setState(prev => ({ ...prev, data: newData }));
  }, [cacheKey]);

  return {
    ...state,
    refetch: fetch,
    mutate,
  };
}

// ============================================================================
// PATIENT HOOKS
// ============================================================================

export function usePatients(options: FilterOptions = {}) {
  const cacheKey = `patients-${JSON.stringify(options)}`;
  return useApiCall<PaginatedResponse<Patient>>(
    () => patientsApi.getPatients(options),
    cacheKey,
    [JSON.stringify(options)]
  );
}

export function usePatient(id: string) {
  return useApiCall<PatientWithSessions>(
    () => patientsApi.getPatient(id),
    `patient-${id}`,
    [id]
  );
}

export function useCurrentPatient() {
  return useApiCall<PatientWithSessions>(
    () => patientsApi.getCurrentPatientProfile(),
    'current-patient'
  );
}

export function usePatientSessions(patientId: string, options: FilterOptions = {}) {
  const cacheKey = `patient-sessions-${patientId}-${JSON.stringify(options)}`;
  return useApiCall<PaginatedResponse<any>>(
    () => patientsApi.getPatientSessions(patientId, options),
    cacheKey,
    [patientId, JSON.stringify(options)]
  );
}

// ============================================================================
// DOCTOR HOOKS
// ============================================================================

export function useDoctors(options: FilterOptions = {}) {
  const cacheKey = `doctors-${JSON.stringify(options)}`;
  return useApiCall<PaginatedResponse<Doctor>>(
    () => doctorsApi.getDoctors(options),
    cacheKey,
    [JSON.stringify(options)]
  );
}

export function useDoctor(id: string) {
  return useApiCall<DoctorWithPatients>(
    () => doctorsApi.getDoctor(id),
    `doctor-${id}`,
    [id]
  );
}

export function useCurrentDoctor() {
  return useApiCall<DoctorWithPatients>(
    () => doctorsApi.getCurrentDoctorProfile(),
    'current-doctor'
  );
}

export function useDoctorPatients(doctorId: string, options: FilterOptions = {}) {
  const cacheKey = `doctor-patients-${doctorId}-${JSON.stringify(options)}`;
  return useApiCall<PaginatedResponse<any>>(
    () => doctorsApi.getDoctorPatients(doctorId, options),
    cacheKey,
    [doctorId, JSON.stringify(options)]
  );
}

export function useAllAssignments(options: FilterOptions = {}) {
  const cacheKey = `all-assignments-${JSON.stringify(options)}`;
  return useApiCall<PaginatedResponse<any>>(
    () => doctorsApi.getAllAssignments(options),
    cacheKey,
    [JSON.stringify(options)]
  );
}

// ============================================================================
// SESSION HOOKS
// ============================================================================

export function useSessions(options: FilterOptions = {}) {
  const cacheKey = `sessions-${JSON.stringify(options)}`;
  return useApiCall<PaginatedResponse<MRISession>>(
    () => sessionsApi.getSessions(options),
    cacheKey,
    [JSON.stringify(options)]
  );
}

export function useSession(id: string) {
  return useApiCall<MRISession>(
    () => sessionsApi.getSession(id),
    `session-${id}`,
    [id]
  );
}

export function useSessionByCode(sessionCode: string) {
  return useApiCall<MRISession>(
    () => sessionsApi.getSessionByCode(sessionCode),
    `session-code-${sessionCode}`,
    [sessionCode]
  );
}

export function useMySessions() {
  return useApiCall<PaginatedResponse<MRISession>>(
    () => sessionsApi.getMySession(),
    'my-sessions'
  );
}

// ============================================================================
// STATS HOOKS
// ============================================================================

export function usePatientStats(patientId?: string) {
  const cacheKey = patientId ? `patient-stats-${patientId}` : 'patient-stats-current';
  return useApiCall<PatientStats>(
    () => statsApi.getPatientStats(patientId),
    cacheKey,
    [patientId]
  );
}

export function useDoctorStats(doctorId?: string) {
  const cacheKey = doctorId ? `doctor-stats-${doctorId}` : 'doctor-stats-current';
  return useApiCall<DoctorStats>(
    () => statsApi.getDoctorStats(doctorId),
    cacheKey,
    [doctorId]
  );
}

export function useRadiologistStats(radiologistId?: string) {
  const cacheKey = radiologistId ? `radiologist-stats-${radiologistId}` : 'radiologist-stats-current';
  return useApiCall<RadiologistStats>(
    () => statsApi.getRadiologistStats(radiologistId),
    cacheKey,
    [radiologistId]
  );
}

export function useAdminStats() {
  return useApiCall<AdminStats>(
    () => statsApi.getAdminStats(),
    'admin-stats'
  );
}

// ============================================================================
// USER HOOKS
// ============================================================================

export function useUsers(options: FilterOptions = {}) {
  const cacheKey = `users-${JSON.stringify(options)}`;
  return useApiCall<PaginatedResponse<User>>(
    () => usersApi.getUsers(options),
    cacheKey,
    [JSON.stringify(options)]
  );
}

export function useUser(id: string) {
  return useApiCall<User>(
    () => usersApi.getUser(id),
    `user-${id}`,
    [id]
  );
}

export function useLookupData() {
  return useApiCall<{
    hospitals: { id: string; name: string; city: string }[];
    qualifications: { id: string; qualification_name: string }[];
    bloodGroups: { id: string; blood_group: string }[];
  }>(
    () => usersApi.getLookupData(),
    'lookup-data'
  );
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

export function useCreateSession() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = async (input: Parameters<typeof sessionsApi.createSession>[0]) => {
    setIsLoading(true);
    setError(null);

    const result = await sessionsApi.createSession(input);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      return null;
    }

    // Invalidate sessions cache
    cache.delete('my-sessions');

    return result.data;
  };

  return { createSession, isLoading, error };
}

export function useDeleteSession() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteSession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    const result = await sessionsApi.deleteSession(sessionId);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      return false;
    }

    // Invalidate sessions cache
    cache.delete('my-sessions');
    invalidateCache('sessions');

    return true;
  };

  return { deleteSession, isLoading, error };
}

export function useAssignPatient() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignPatient = async (doctorId: string, patientId: string) => {
    setIsLoading(true);
    setError(null);

    const result = await doctorsApi.assignPatient(doctorId, patientId);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      return null;
    }

    // Invalidate doctor cache
    cache.delete(`doctor-${doctorId}`);
    cache.delete('current-doctor');

    return result.data;
  };

  return { assignPatient, isLoading, error };
}

export function useUpdateUserStatus() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suspendUser = async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const result = await usersApi.suspendUser(userId);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      return null;
    }

    cache.delete(`user-${userId}`);
    return result.data;
  };

  const activateUser = async (userId: string) => {
    setIsLoading(true);
    setError(null);

    const result = await usersApi.activateUser(userId);

    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      return null;
    }

    cache.delete(`user-${userId}`);
    return result.data;
  };

  return { suspendUser, activateUser, isLoading, error };
}

// ============================================================================
// UTILITY
// ============================================================================

export function clearApiCache() {
  cache.clear();
}

export function invalidateCache(pattern: string) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}
