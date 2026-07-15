'use client';

import { AnalysisUploadForm } from '@/features/analysis/components/AnalysisUploadForm';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import { withAuth } from '@/lib/withAuth';

function NewAnalysisPage() {
  return (
    <RoleShell>
      <div className="py-2">
        <AnalysisUploadForm />
      </div>
    </RoleShell>
  );
}

// Anyone who may create an analysis (backend enforces the modality/role matrix too).
export default withAuth(NewAnalysisPage, {
  allowedRoles: ['super_admin', 'hospital_admin', 'doctor', 'radiologist'],
});
