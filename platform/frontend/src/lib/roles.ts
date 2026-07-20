/**
 * Single source of truth for the platform's role union.
 *
 * Previously this union was redefined independently in ~10 places
 * (withAuth.tsx, AuthProvider.tsx, navigation.ts, lib/api/users.ts, several
 * page files, ReportViewer.tsx, ...). This consolidates it — every other
 * module should import `Role`/`ROLES`/`ROLE_META` from here instead of
 * re-declaring the union.
 *
 * NOTE on `admin`: this is the wire/DB value for a hospital-scoped admin
 * (the backend's `Role.hospital_admin` — see
 * platform/backend/app/schemas/users.py). It is not the same as
 * `super_admin`, which is platform-wide and hospital-less.
 */

export const ROLES = ['super_admin', 'admin', 'doctor', 'radiologist', 'patient'] as const;

export type Role = (typeof ROLES)[number];

/** One accent per role, used consistently across a dashboard (see
 * `components/dashboards/shared/primitives.tsx` `Accent`). */
export type RoleAccent = 'green' | 'indigo' | 'blue' | 'teal';

export interface RoleMetaEntry {
  /** Human-readable display label (unchanged copy from the prior per-file duplicates). */
  label: string;
  /** URL segment this role's routes live under, e.g. `/super-admin/dashboard`. */
  routeSegment: string;
  accent: RoleAccent;
}

export const ROLE_META: Record<Role, RoleMetaEntry> = {
  super_admin: { label: 'Super Admin', routeSegment: 'super-admin', accent: 'indigo' },
  admin: { label: 'Hospital Admin', routeSegment: 'admin', accent: 'teal' },
  radiologist: { label: 'Radiologist', routeSegment: 'radiologist', accent: 'indigo' },
  doctor: { label: 'Doctor', routeSegment: 'doctor', accent: 'blue' },
  patient: { label: 'Patient', routeSegment: 'patient', accent: 'green' },
};

export function isRole(value: string | null | undefined): value is Role {
  return !!value && (ROLES as readonly string[]).includes(value);
}
