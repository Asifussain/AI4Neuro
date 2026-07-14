'use client';

import { LayoutGrid, Upload, User, Settings } from 'lucide-react';
import { UnifiedDashboard } from '@/features/analysis/components/UnifiedDashboard';
import { withAuth } from '@/lib/withAuth';
import { DashboardShell, type NavItem } from '@/components/dashboards/shared/DashboardShell';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutGrid },
  { label: 'New Analysis', href: '/analysis/new', icon: Upload },
  { label: 'Profile', href: '/profile', icon: User },
  { label: 'Settings', href: '/profile', icon: Settings },
];

function AdminDashboardPage() {
  return (
    <DashboardShell roleLabel="Hospital Admin" accent="teal" navItems={NAV_ITEMS}>
      <UnifiedDashboard embedded />
    </DashboardShell>
  );
}

// Protect route - only admins can access
export default withAuth(AdminDashboardPage, { allowedRoles: ['admin'] });
