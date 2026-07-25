'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Lock, ShieldCheck, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/dashboards/shared/primitives';
import { reportAccessApi, type ReportAccess } from '@/features/report-access/api';

/**
 * Patient-facing card: shows the current report-access state and lets the
 * patient request access from their assigned doctor. Reports only open once the
 * doctor approves (enforced by the backend too).
 */
export function PatientReportAccessCard() {
  const [access, setAccess] = useState<ReportAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    reportAccessApi
      .me()
      .then((a) => !cancelled && setAccess(a))
      .catch(() => !cancelled && setAccess({ patient_id: '', status: 'none' }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRequest = async () => {
    setBusy(true);
    try {
      const updated = await reportAccessApi.request();
      setAccess(updated);
      toast.success('Access request sent to your doctor.');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to request access');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />;
  }

  const status = access?.status ?? 'none';
  const doctorName = access?.doctor_name ? (String(access.doctor_name).startsWith('Dr.') ? access.doctor_name : `Dr. ${access.doctor_name}`) : 'your assigned doctor';

  const config = {
    approved: {
      icon: <ShieldCheck className="h-5 w-5 text-emerald-600" />,
      title: 'Report access approved',
      text: `${doctorName} has approved your access. Your reports open normally.`,
      tone: 'bg-emerald-50 border-emerald-200',
    },
    pending: {
      icon: <Clock className="h-5 w-5 text-amber-600" />,
      title: 'Request pending',
      text: `Waiting for ${doctorName} to approve your report access.`,
      tone: 'bg-amber-50 border-amber-200',
    },
    denied: {
      icon: <ShieldAlert className="h-5 w-5 text-red-600" />,
      title: 'Request denied',
      text: `${doctorName} denied your last request. You can request again.`,
      tone: 'bg-red-50 border-red-200',
    },
    none: {
      icon: <Lock className="h-5 w-5 text-slate-500" />,
      title: 'Report access required',
      text: 'Request access from your assigned doctor to open your analysis reports.',
      tone: 'bg-slate-50 border-slate-200',
    },
  }[status];

  return (
    <SectionCard className={`p-4 border ${config.tone}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0">{config.icon}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{config.title}</p>
            <p className="text-xs text-slate-600">{config.text}</p>
          </div>
        </div>
        {status !== 'approved' && (
          <Button
            onClick={handleRequest}
            disabled={busy || status === 'pending'}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 shrink-0"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {status === 'pending' ? 'Awaiting approval' : 'Request report access'}
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
