'use client';

/**
 * Shared "create user" dialog, extracted from HospitalAdminDashboard (which
 * used to be the only place a create-user flow existed) so Super Admin can
 * reuse it too. Talks to the real backend (`adminApi.createUser`, which
 * dispatches to `POST /platform/users` or `POST /hospital/users` depending on
 * the chosen role) instead of the old `/api/admin/create-user` Next.js route.
 */

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminApi, type Hospital, type UserCreateResult } from '@/features/admin/api';
import { ROLE_META, type Role } from '@/lib/roles';

const ACCENT_CLASSES: Record<'teal' | 'indigo', string> = {
  teal: 'bg-teal-600 hover:bg-teal-700',
  indigo: 'bg-indigo-600 hover:bg-indigo-700',
};

/** Mirrors the unique_identifier codes the old Next.js route used to
 * auto-generate server-side (e.g. "DO482913") — generated client-side now
 * since the real backend requires the caller to supply one. */
function generateUniqueIdentifier(role: Role): string {
  const prefix = role.slice(0, 2).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Roles selectable in this context — e.g. doctor/radiologist/patient only
   * from HospitalAdminDashboard, or all 5 from Super Admin. */
  allowedRoles: Role[];
  /** Known fixed hospital ID (Hospital Admin's own) — hides the hospital
   * picker and is sent as `hospital_id` on the payload. */
  hospitalId?: string;
  /** Hide the hospital picker even without a known `hospitalId` — used by
   * HospitalAdminDashboard, where the backend forces the caller's own
   * hospital server-side regardless of what (if anything) is sent. */
  hideHospitalPicker?: boolean;
  /** Hospital options for the picker, when neither `hospitalId` nor
   * `hideHospitalPicker` suppress it (Super Admin context). */
  hospitals?: Hospital[];
  accent?: 'teal' | 'indigo';
  onCreated?: (result: UserCreateResult) => void;
}

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  qualification: '',
  role: '' as Role | '',
  hospital_id: '',
};

export function CreateUserDialog({
  open,
  onOpenChange,
  allowedRoles,
  hospitalId,
  hideHospitalPicker = false,
  hospitals = [],
  accent = 'teal',
  onCreated,
}: CreateUserDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UserCreateResult | null>(null);
  const btnClass = ACCENT_CLASSES[accent];

  const needsHospitalPicker =
    !hospitalId && !hideHospitalPicker && form.role !== 'super_admin' && form.role !== '';

  const canSubmit =
    !!form.full_name &&
    !!form.email &&
    !!form.role &&
    (hospitalId || hideHospitalPicker || form.role === 'super_admin' || !!form.hospital_id);

  const reset = () => setForm(EMPTY_FORM);

  const handleClose = (next: boolean) => {
    if (!loading) {
      onOpenChange(next);
      if (!next) reset();
    }
  };

  const handleSubmit = async () => {
    if (!form.role || !canSubmit) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const role = form.role as Role;
      const created = await adminApi.createUser({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        qualification: form.qualification || undefined,
        role,
        unique_identifier: generateUniqueIdentifier(role),
        hospital_id: role === 'super_admin' ? undefined : hospitalId || form.hospital_id || undefined,
      });
      setResult(created);
      reset();
      onOpenChange(false);
      onCreated?.(created);
      toast.success('User created successfully.');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = useMemo(
    () => allowedRoles.map((r) => ({ value: r, label: ROLE_META[r].label })),
    [allowedRoles]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. A temporary password will be generated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-red-600">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="John Doe"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-red-600">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">
                Role <span className="text-red-600">*</span>
              </Label>
              <Select
                value={form.role}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, role: val as Role, hospital_id: '' }))
                }
                disabled={loading}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsHospitalPicker && (
              <div className="grid gap-2">
                <Label htmlFor="hospital">
                  Hospital <span className="text-red-600">*</span>
                </Label>
                <Select
                  value={form.hospital_id}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, hospital_id: val }))}
                  disabled={loading}
                >
                  <SelectTrigger id="hospital">
                    <SelectValue placeholder="Select hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    {hospitals.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+1 (555) 000-0000"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                disabled={loading}
              />
            </div>
            {(form.role === 'doctor' || form.role === 'radiologist') && (
              <div className="grid gap-2">
                <Label htmlFor="qualification">Qualification (Optional)</Label>
                <Input
                  id="qualification"
                  placeholder="e.g. MBBS, MD, DNB (Radiology)"
                  value={form.qualification}
                  onChange={(e) => setForm((prev) => ({ ...prev, qualification: e.target.value }))}
                  disabled={loading}
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !canSubmit} className={`${btnClass} gap-2`}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Create User
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success dialog — shows the one-time temporary password. Never
          console.logged; shown once and discarded from state on close. */}
      <Dialog open={!!result} onOpenChange={(next) => { if (!next) setResult(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              User Created Successfully
            </DialogTitle>
            <DialogDescription>
              Share these credentials with the user securely. This password will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {result && (
            <div className="py-4 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Email</span>
                  <span className="text-sm font-mono font-medium text-slate-900">{result.email}</span>
                </div>
                <div className="border-t border-slate-200" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-500 shrink-0">Temporary Password</span>
                  <span className="text-sm font-mono font-bold text-teal-700 tracking-wide truncate">
                    {result.temporary_password ?? '—'}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Note:</strong> The user should change their password on first login. Share this
                  securely — it will not be retrievable after you close this dialog.
                </p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {result?.temporary_password && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard
                    .writeText(result.temporary_password ?? '')
                    .then(() => toast.success('Password copied to clipboard'))
                    .catch(() => toast.error('Could not copy password'));
                }}
              >
                Copy Password
              </Button>
            )}
            <Button onClick={() => setResult(null)} className={btnClass}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
