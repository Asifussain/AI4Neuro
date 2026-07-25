/** React Query hooks over adminApi — cached by query key so navigating
 * between pages (or re-opening the New Analysis form) doesn't refetch the
 * same hospital directory data every time within the staleTime window. */

import { useQuery } from '@tanstack/react-query';
import { adminApi, type ListParams } from './api';

export function useDoctors(
  params: { hospitalId?: string } & ListParams = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: ['hospital-doctors', params.hospitalId, params.limit, params.offset],
    queryFn: () => adminApi.doctors(params),
    enabled: options.enabled ?? true,
  });
}

export function usePatients(
  params: { hospitalId?: string } & ListParams = {},
  options: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: ['hospital-patients', params.hospitalId, params.limit, params.offset],
    queryFn: () => adminApi.patients(params),
    enabled: options.enabled ?? true,
  });
}

export function useMyPatients(params: ListParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['my-patients', params.limit, params.offset],
    queryFn: () => adminApi.myPatients(params),
    enabled: options.enabled ?? true,
  });
}
