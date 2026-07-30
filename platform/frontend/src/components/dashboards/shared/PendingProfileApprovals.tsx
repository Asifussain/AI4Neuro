'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, BellRing, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/dashboards/shared/primitives';
import { adminApi, type AdminUser } from '@/features/admin/api';

const ROLE_LABEL: Record<string, string> = {
  doctor: 'Doctor',
  radiologist: 'Radiologist',
  patient: 'Patient',
};

/**
 * Hospital-admin-facing panel: doctor/radiologist/patient profiles a
 * super_admin created into this hospital, awaiting approval before they can
 * log in. Renders nothing when there are none pending, so it only shows up
 * when there is something to act on.
 */
export function PendingProfileApprovals() {
  const [pending, setPending] = useState<AdminUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi
      .pendingApprovals()
      .then((r) => setPending(r.items))
      .catch(() => setPending([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (user: AdminUser, approve: boolean) => {
    setBusyId(user.id);
    try {
      if (approve) await adminApi.approveProfile(user.id);
      else await adminApi.rejectProfile(user.id);
      setPending((prev) => (prev ? prev.filter((u) => u.id !== user.id) : prev));
      toast.success(approve ? 'Profile approved.' : 'Profile rejected and removed.');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update profile');
    } finally {
      setBusyId(null);
    }
  };

  if (!pending || pending.length === 0) return null;

  return (
    <SectionCard className="p-5 border border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2 mb-3">
        <BellRing className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-900">
          Pending profile approvals
          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            {pending.length} pending
          </span>
        </h3>
      </div>
      <div className="space-y-2">
        {pending.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-slate-200"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.full_name}</p>
              <p className="text-xs text-slate-500">
                {ROLE_LABEL[user.role] || user.role} • created by Super Admin, awaiting your approval
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={busyId === user.id}
                onClick={() => decide(user, false)}
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                disabled={busyId === user.id}
                onClick={() => decide(user, true)}
              >
                {busyId === user.id ? (
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
