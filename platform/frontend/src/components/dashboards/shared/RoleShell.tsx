'use client';

import React from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { DashboardShell } from './DashboardShell';
import { getNavItems, getRoleMeta, type Role } from '@/lib/navigation';

/**
 * Role-aware wrapper around DashboardShell. Drill-down pages (new analysis,
 * viewers, profile, etc.) render inside this so the persistent sidebar/topbar
 * stays constant and the theme matches the role's dashboard — instead of each
 * page reimplementing its own top navbar.
 */
export function RoleShell({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const role = (userProfile?.role ?? 'patient') as Role;
  const meta = getRoleMeta(role);

  return (
    <DashboardShell roleLabel={meta.label} accent={meta.accent} navItems={getNavItems(role)}>
      {children}
    </DashboardShell>
  );
}
