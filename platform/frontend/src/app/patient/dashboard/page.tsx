'use client';

import { LayoutGrid, User, Settings } from 'lucide-react';
import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { withAuth } from '@/lib/withAuth';
import { DashboardShell, type NavItem } from '@/components/dashboards/shared/DashboardShell';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutGrid },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/profile', icon: Settings },
];

function PatientDashboardPage() {
  return (
    <DashboardShell roleLabel="Patient" accent="green" navItems={NAV_ITEMS}>
      <UnifiedDashboard embedded />
    </DashboardShell>
  );
}

// Protect route - only patients can access
export default withAuth(PatientDashboardPage, { allowedRoles: ['patient'] });
