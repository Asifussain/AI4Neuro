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
  User,
  Settings,
  Building2,
  Stethoscope,
  Brain,
  Users,
  FileText,
  Landmark,
} from 'lucide-react';
import type { NavItem } from '@/components/dashboards/shared/DashboardShell';
import type { Accent } from '@/components/dashboards/shared/primitives';

export type Role =
  | 'patient'
  | 'doctor'
  | 'radiologist'
  | 'hospital_admin'
  | 'super_admin';

interface RoleMeta {
  label: string;
  accent: Accent;
  dashboard: string;
}

const ROLE_META: Record<Role, RoleMeta> = {
  super_admin: { label: 'Super Admin', accent: 'indigo', dashboard: '/super-admin/dashboard' },
  hospital_admin: { label: 'Hospital Admin', accent: 'teal', dashboard: '/hospital-admin/dashboard' },
  radiologist: { label: 'Radiologist', accent: 'indigo', dashboard: '/radiologist/dashboard' },
  doctor: { label: 'Doctor', accent: 'blue', dashboard: '/doctor/dashboard' },
  patient: { label: 'Patient', accent: 'green', dashboard: '/patient/dashboard' },
};

export function getRoleMeta(role: Role): RoleMeta {
  return ROLE_META[role] ?? ROLE_META.patient;
}

/** Nav items per role — every href resolves to a real, existing route. */
const NAV_ITEMS: Record<Role, NavItem[]> = {
  super_admin: [
    { label: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutGrid },
    { label: 'Hospitals', href: '/super-admin/hospitals', icon: Building2 },
    { label: 'Hospital Admins', href: '/super-admin/users?role=hospital_admin', icon: Landmark },
    { label: 'Doctors', href: '/super-admin/users?role=doctor', icon: Stethoscope },
    { label: 'Radiologists', href: '/super-admin/users?role=radiologist', icon: Brain },
    { label: 'Patients', href: '/super-admin/users?role=patient', icon: Users },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
  hospital_admin: [
    { label: 'Dashboard', href: '/hospital-admin/dashboard', icon: LayoutGrid },
    { label: 'New Analysis', href: '/analysis/new', icon: Upload },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
  radiologist: [
    { label: 'Dashboard', href: '/radiologist/dashboard', icon: LayoutGrid },
    { label: 'New Analysis', href: '/analysis/new', icon: Upload },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
  doctor: [
    { label: 'Dashboard', href: '/doctor/dashboard', icon: LayoutGrid },
    { label: 'New Analysis', href: '/analysis/new', icon: Upload },
    { label: 'Reports', href: '/analysis/new', icon: FileText },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
  patient: [
    { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutGrid },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/profile', icon: Settings },
  ],
};

export function getNavItems(role: Role): NavItem[] {
  return NAV_ITEMS[role] ?? NAV_ITEMS.patient;
}
