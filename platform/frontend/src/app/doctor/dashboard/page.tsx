'use client';

import { LayoutGrid, Upload, User, Settings } from 'lucide-react';
import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { withAuth } from '@/lib/withAuth';
import { DashboardShell, type NavItem } from '@/components/dashboards/shared/DashboardShell';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/doctor/dashboard', icon: LayoutGrid },
  { label: 'New Analysis', href: '/analysis/new', icon: Upload },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/profile', icon: Settings },
];

function DoctorDashboardPage() {
  return (
    <DashboardShell roleLabel="Doctor" accent="blue" navItems={NAV_ITEMS}>
      <UnifiedDashboard embedded />
    </DashboardShell>
  );
}

// Protect route - only doctors can access
export default withAuth(DoctorDashboardPage, { allowedRoles: ['doctor'] });
