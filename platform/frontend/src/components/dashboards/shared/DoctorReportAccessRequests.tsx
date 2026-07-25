'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, BellRing, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/dashboards/shared/primitives';
import { reportAccessApi, type ReportAccess } from '@/features/report-access/api';

/**
 * Doctor-facing panel: the pending report-access requests from their patients,
 * each with Approve / Deny. Renders nothing when there are none pending, so it
 * only shows up when there is something to act on.
 */
export function DoctorReportAccessRequests() {
  const [requests, setRequests] = useState<ReportAccess[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    reportAccessApi
      .pending()
      .then((r) => setRequests(r.items))
      .catch(() => setRequests([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (req: ReportAccess, approve: boolean) => {
    if (!req.id) return;
    setBusyId(req.id);
    try {
      if (approve) await reportAccessApi.approve(req.id);
      else await reportAccessApi.deny(req.id);
      setRequests((prev) => (prev ? prev.filter((r) => r.id !== req.id) : prev));
      toast.success(approve ? 'Report access approved.' : 'Request denied.');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update request');
    } finally {
      setBusyId(null);
    }
  };

  // Nothing pending → render nothing (keeps the dashboard clean).
  if (!requests || requests.length === 0) return null;

  return (
    <SectionCard className="p-5 border border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2 mb-3">
        <BellRing className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          Report access requests
          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            {requests.length} pending
          </span>
        </h3>
      </div>
      <div className="space-y-2">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {req.patient_name || 'A patient'}
              </p>
              <p className="text-xs text-slate-500">is requesting access to their reports</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busyId === req.id}
                onClick={() => decide(req, false)}
              >
                <X className="h-3.5 w-3.5" />
                Deny
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                disabled={busyId === req.id}
                onClick={() => decide(req, true)}
              >
                {busyId === req.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
