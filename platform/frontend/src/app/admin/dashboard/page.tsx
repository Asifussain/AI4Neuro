'use client';

import dynamic from 'next/dynamic';
import { Navbar } from '@/components/shared/Navbar';
import { withAuth } from '@/lib/withAuth';
import { DashboardLoader } from '@/components/ui/LoadingScreen';

// Dynamic import for code splitting
const AdminDashboard = dynamic(
  () => import('@/components/dashboards/AdminDashboard').then(mod => mod.AdminDashboard),
  {
    loading: () => <DashboardLoader role="admin dashboard" />,
    ssr: false,
  }
);

function AdminDashboardPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-24">
        <AdminDashboard />
      </div>
    </>
  );
}

// Protect route - only admins can access
export default withAuth(AdminDashboardPage, { allowedRoles: ['admin'] });
