/**
 * Single source of truth for per-role dashboard navigation.
 *
 * Previously each dashboard defined its own flat NAV_ITEMS where most links
 * pointed back at the dashboard itself (dead links). This centralizes the nav
 * so every shell — dashboards and drill-down pages alike — renders the same,
 * real destinations for a given role.
 */

import {
  LayoutGrid,
  Upload,
  Settings,
  Building2,
  Stethoscope,
  Brain,
  Users,
  FileText,
  Landmark,
  ScanLine,
  History,
} from 'lucide-react';
import type { NavItem } from '@/components/dashboards/shared/DashboardShell';
import type { Accent } from '@/components/dashboards/shared/primitives';
import { ROLES, ROLE_META as BASE_ROLE_META, type Role } from '@/lib/roles';

// Re-exported for the many existing call sites that do
// `import { type Role } from '@/lib/navigation'` — `@/lib/roles` is the
// canonical source, this just avoids touching every import line.
export type { Role };

interface RoleMeta {
  label: string;
  accent: Accent;
  dashboard: string;
}

const ROLE_META: Record<Role, RoleMeta> = Object.fromEntries(
  ROLES.map((role) => [
    role,
    {
      label: BASE_ROLE_META[role].label,
      accent: BASE_ROLE_META[role].accent,
      dashboard: `/${BASE_ROLE_META[role].routeSegment}/dashboard`,
    },
  ])
) as Record<Role, RoleMeta>;

export function getRoleMeta(role: Role): RoleMeta {
  return ROLE_META[role] ?? ROLE_META.patient;
}

/** Nav items per role — every href resolves to a real, existing route. */
const NAV_ITEMS: Record<Role, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutGrid },
    { label: 'Hospitals', href: '/super-admin/hospitals', icon: Building2 },
    { label: 'Hospital Admins', href: '/super-admin/users?role=admin', icon: Landmark },
    { label: 'Doctors', href: '/super-admin/users?role=doctor', icon: Stethoscope },
    { label: 'Radiologists', href: '/super-admin/users?role=radiologist', icon: Brain },
    { label: 'Patients', href: '/super-admin/users?role=patient', icon: Users },
    { label: 'Audit Log', href: '/super-admin/audit-log', icon: History },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutGrid },
    { label: 'Doctors', href: '/admin/users?role=doctor', icon: Stethoscope },
    { label: 'Radiologists', href: '/admin/users?role=radiologist', icon: Brain },
    { label: 'Patients', href: '/admin/users?role=patient', icon: Users },
    { label: 'Scan Sessions', href: '/admin/sessions', icon: ScanLine },
    { label: 'New Analysis', href: '/analysis/new', icon: Upload },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
  radiologist: [
    { label: 'Dashboard', href: '/radiologist/dashboard', icon: LayoutGrid },
    { label: 'Scan Sessions', href: '/radiologist/sessions', icon: ScanLine },
    { label: 'New Analysis', href: '/analysis/new', icon: Upload },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
  doctor: [
    { label: 'Dashboard', href: '/doctor/dashboard', icon: LayoutGrid },
    { label: 'My Patients', href: '/doctor/patients', icon: Users },
    { label: 'All Analysis', href: '/doctor/sessions', icon: ScanLine },
    { label: 'New Analysis', href: '/analysis/new', icon: Upload },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
  patient: [
    { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutGrid },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
};

export function getNavItems(role: Role): NavItem[] {
  return NAV_ITEMS[role] ?? NAV_ITEMS.patient;
}
