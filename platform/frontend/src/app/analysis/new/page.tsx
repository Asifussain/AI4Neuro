'use client';

import { Navbar } from '@/components/shared/Navbar';
import { AnalysisUploadForm } from '@/features/analysis/components/AnalysisUploadForm';
import { withAuth } from '@/lib/withAuth';

function NewAnalysisPage() {
  return (
    <>
      <Navbar />
      <div className="bg-background min-h-screen px-4 pt-24">
        <AnalysisUploadForm />
      </div>
    </>
  );
}

// Anyone who may create an analysis (backend enforces the modality/role matrix too).
export default withAuth(NewAnalysisPage, {
  allowedRoles: ['admin', 'doctor', 'radiologist', 'technician'],
});
