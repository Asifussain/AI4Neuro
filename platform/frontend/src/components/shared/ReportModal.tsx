'use client';

import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/dashboards/shared/primitives';
import { ReportViewer } from '@/components/shared/ReportViewer';
import type { MRISession } from '@/lib/api/sessions';

type ReportModalRole = 'doctor' | 'radiologist' | 'patient';

const ROLE_STYLES: Record<ReportModalRole, { iconBg: string; iconColor: string; titlePrefix: string }> = {
  doctor: { iconBg: 'bg-blue-50', iconColor: 'text-blue-600', titlePrefix: 'Reports' },
  radiologist: { iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', titlePrefix: 'Reports' },
  patient: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', titlePrefix: 'Report' },
};

interface ReportModalProps {
  session: MRISession | null;
  onClose: () => void;
  userRole: ReportModalRole;
}

export function ReportModal({ session, onClose, userRole }: ReportModalProps) {
  if (!session || !session.prediction) return null;

  const { iconBg, iconColor, titlePrefix } = ROLE_STYLES[userRole];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto">
        <SectionCard className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <FileText className={`h-5 w-5 ${iconColor}`} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                {titlePrefix} - {session.session_code}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-slate-100">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <ReportViewer
            sessionCode={session.session_code}
            status={session.status}
            reports={{
              patient: session.prediction.patient_pdf_url || undefined,
              clinician: session.prediction.clinician_pdf_url || undefined,
              technical: session.prediction.technical_pdf_url || undefined,
            }}
            userRole={userRole}
            prediction={session.prediction.prediction}
            confidence={session.prediction.confidence_score}
          />
        </SectionCard>
      </div>
    </div>
  );
}
