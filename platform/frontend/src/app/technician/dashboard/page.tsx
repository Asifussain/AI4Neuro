'use client';

import Link from 'next/link';

import { useAuth } from '@/components/providers/AuthProvider';
import { Navbar } from '@/components/shared/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { withAuth } from '@/lib/withAuth';

function TechnicianDashboardPage() {
  const { userProfile } = useAuth();

  return (
    <>
      <Navbar />
      <div className="bg-background min-h-screen px-4 pt-24">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Technician Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome{userProfile?.full_name ? `, ${userProfile.full_name}` : ''}.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Upload EEG</CardTitle>
              <CardDescription>
                Start a new EEG analysis for a patient.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/analysis/new">New analysis</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default withAuth(TechnicianDashboardPage, { allowedRoles: ['technician', 'admin'] });
