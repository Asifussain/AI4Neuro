'use client';

/**
 * Shared "create user" dialog, extracted from HospitalAdminDashboard (which
 * used to be the only place a create-user flow existed) so Super Admin can
 * reuse it too. Talks to the real backend (`adminApi.createUser`, which
 * dispatches to `POST /platform/users` or `POST /hospital/users` depending on
 * the chosen role) instead of the old `/api/admin/create-user` Next.js route.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { apiClient } from '@/lib/api/client';
import { adminApi, type Hospital, type UserCreateResult } from '@/features/admin/api';
import { ROLE_META, type Role } from '@/lib/roles';

interface BloodGroup {
  id: number;
  blood_type: string;
}

interface Qualification {
  id: number;
  qualification_name: string;
}

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
  role: '' as Role | '',
  hospital_id: '',
  license_number: '',
  qualification_id: '',
  specialization: '',
  experience_years: '',
  imaging_expertise: '',
  certifications: '',
  employee_id: '',
  department: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  blood_group_id: '',
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
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [bloodGroups, setBloodGroups] = useState<BloodGroup[]>([]);
  const btnClass = ACCENT_CLASSES[accent];

  const isDoctorOrRadiologist = form.role === 'doctor' || form.role === 'radiologist';
  const isPatient = form.role === 'patient';
  const isHospitalAdmin = form.role === 'admin';

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiClient
      .get<Qualification[]>('/api/v1/users/qualifications')
      .then((rows) => !cancelled && setQualifications(rows))
      .catch(() => {});
    apiClient
      .get<BloodGroup[]>('/api/v1/users/blood-groups')
      .then((rows) => !cancelled && setBloodGroups(rows))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const needsHospitalPicker =
    !hospitalId && !hideHospitalPicker && form.role !== 'super_admin' && form.role !== '';

  const canSubmit =
    !!form.full_name &&
    !!form.email &&
    !!form.role &&
    (hospitalId || hideHospitalPicker || form.role === 'super_admin' || !!form.hospital_id) &&
    // License number is mandatory for doctors only; optional for radiologists.
    (form.role !== 'doctor' || !!form.license_number);

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
        role,
        unique_identifier: generateUniqueIdentifier(role),
        hospital_id: role === 'super_admin' ? undefined : hospitalId || form.hospital_id || undefined,
        license_number: isDoctorOrRadiologist ? form.license_number || undefined : undefined,
        qualification_id: isDoctorOrRadiologist && form.qualification_id ? parseInt(form.qualification_id, 10) : undefined,
        specialization: role === 'doctor' ? form.specialization || undefined : undefined,
        experience_years: isDoctorOrRadiologist && form.experience_years ? parseInt(form.experience_years, 10) : undefined,
        imaging_expertise: role === 'radiologist' ? form.imaging_expertise || undefined : undefined,
        certifications: role === 'radiologist' ? form.certifications || undefined : undefined,
        employee_id: isHospitalAdmin ? form.employee_id || undefined : undefined,
        department: isHospitalAdmin ? form.department || undefined : undefined,
        emergency_contact_name: isPatient ? form.emergency_contact_name || undefined : undefined,
        emergency_contact_phone: isPatient ? form.emergency_contact_phone || undefined : undefined,
        blood_group_id: isPatient && form.blood_group_id ? parseInt(form.blood_group_id, 10) : undefined,
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
            {isDoctorOrRadiologist && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="license_number">
                    License Number{' '}
                    {form.role === 'doctor' ? (
                      <span className="text-red-600">*</span>
                    ) : (
                      <span className="text-muted-foreground">(Optional)</span>
                    )}
                  </Label>
                  <Input
                    id="license_number"
                    placeholder={form.role === 'radiologist' ? 'e.g. RL-2024-0001' : 'e.g. ML-2024-0001'}
                    value={form.license_number}
                    onChange={(e) => setForm((prev) => ({ ...prev, license_number: e.target.value }))}
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="qualification">Qualification (Optional)</Label>
                  <Select
                    value={form.qualification_id}
                    onValueChange={(val) => setForm((prev) => ({ ...prev, qualification_id: val }))}
                    disabled={loading}
                  >
                    <SelectTrigger id="qualification">
                      <SelectValue placeholder="Select qualification" />
                    </SelectTrigger>
                    <SelectContent>
                      {qualifications.map((q) => (
                        <SelectItem key={q.id} value={String(q.id)}>
                          {q.qualification_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="experience_years">Experience (Years, Optional)</Label>
                  <Input
                    id="experience_years"
                    type="number"
                    min={0}
                    value={form.experience_years}
                    onChange={(e) => setForm((prev) => ({ ...prev, experience_years: e.target.value }))}
                    disabled={loading}
                  />
                </div>
              </>
            )}
            {form.role === 'doctor' && (
              <div className="grid gap-2">
                <Label htmlFor="specialization">Specialization (Optional)</Label>
                <Input
                  id="specialization"
                  placeholder="e.g. Neurology"
                  value={form.specialization}
                  onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
                  disabled={loading}
                />
              </div>
            )}
            {form.role === 'radiologist' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="imaging_expertise">
                    Imaging Expertise{' '}
                    <span className="text-muted-foreground">(Optional)</span>
                  </Label>
                  <Input
                    id="imaging_expertise"
                    placeholder="e.g. MRI, CT, EEG"
                    value={form.imaging_expertise}
                    onChange={(e) => setForm((prev) => ({ ...prev, imaging_expertise: e.target.value }))}
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="certifications">Certifications (Optional)</Label>
                  <Input
                    id="certifications"
                    value={form.certifications}
                    onChange={(e) => setForm((prev) => ({ ...prev, certifications: e.target.value }))}
                    disabled={loading}
                  />
                </div>
              </>
            )}
            {isHospitalAdmin && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="employee_id">Employee ID (Optional)</Label>
                  <Input
                    id="employee_id"
                    value={form.employee_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, employee_id: e.target.value }))}
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department">Department (Optional)</Label>
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                    disabled={loading}
                  />
                </div>
              </>
            )}
            {isPatient && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="emergency_contact_name">Emergency Contact Name (Optional)</Label>
                  <Input
                    id="emergency_contact_name"
                    value={form.emergency_contact_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_name: e.target.value }))}
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="emergency_contact_phone">Emergency Contact Phone (Optional)</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={form.emergency_contact_phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, emergency_contact_phone: e.target.value }))}
                    disabled={loading}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="blood_group">Blood Group (Optional)</Label>
                  <Select
                    value={form.blood_group_id}
                    onValueChange={(val) => setForm((prev) => ({ ...prev, blood_group_id: val }))}
                    disabled={loading}
                  >
                    <SelectTrigger id="blood_group">
                      <SelectValue placeholder="Select blood group" />
                    </SelectTrigger>
                    <SelectContent>
                      {bloodGroups.map((bg) => (
                        <SelectItem key={bg.id} value={String(bg.id)}>
                          {bg.blood_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
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
