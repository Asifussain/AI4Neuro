'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Search, Building2, Plus, MoreHorizontal, Loader2 } from 'lucide-react';
import { RoleShell } from '@/components/dashboards/shared/RoleShell';
import {
  SectionCard,
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboards/shared/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  adminApi,
  type Hospital,
  type HospitalCreatePayload,
  type HospitalUpdatePayload,
} from '@/features/admin/api';
import { withAuth } from '@/lib/withAuth';

const EMPTY_CREATE_FORM: HospitalCreatePayload = {
  hospital_code: '',
  name: '',
  address: '',
  phone: '',
  email: '',
  license_number: '',
  established_date: '',
};

// ============================================================================
// CREATE DIALOG
// ============================================================================
function CreateHospitalDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (h: Hospital) => void;
}) {
  const [form, setForm] = useState<HospitalCreatePayload>(EMPTY_CREATE_FORM);
  const [saving, setSaving] = useState(false);

  const canSubmit = !!form.hospital_code && !!form.name && !!form.address;

  const handleClose = (next: boolean) => {
    if (!saving) {
      onOpenChange(next);
      if (!next) setForm(EMPTY_CREATE_FORM);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Hospital code, name, and address are required');
      return;
    }
    setSaving(true);
    try {
      const created = await adminApi.createHospital({
        hospital_code: form.hospital_code,
        name: form.name,
        address: form.address,
        phone: form.phone || undefined,
        email: form.email || undefined,
        license_number: form.license_number || undefined,
        established_date: form.established_date || undefined,
      });
      onCreated(created);
      handleClose(false);
      Swal.fire({ icon: 'success', title: 'Hospital created', text: `${created.name} has been onboarded.`, timer: 2500, showConfirmButton: false });
    } catch (e) {
      toast.error((e as Error).message || 'Failed to create hospital');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Hospital</DialogTitle>
          <DialogDescription>Onboard a new hospital onto the platform.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="h-code">
              Hospital Code <span className="text-red-600">*</span>
            </Label>
            <Input
              id="h-code"
              value={form.hospital_code}
              onChange={(e) => setForm((p) => ({ ...p, hospital_code: e.target.value }))}
              disabled={saving}
              placeholder="e.g. HSP-001"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="h-name">
              Name <span className="text-red-600">*</span>
            </Label>
            <Input
              id="h-name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="h-address">
              Address <span className="text-red-600">*</span>
            </Label>
            <Input
              id="h-address"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              disabled={saving}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="h-phone">Phone</Label>
              <Input
                id="h-phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="h-email">Email</Label>
              <Input
                id="h-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="h-license">License Number</Label>
              <Input
                id="h-license"
                value={form.license_number}
                onChange={(e) => setForm((p) => ({ ...p, license_number: e.target.value }))}
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="h-established">Established Date</Label>
              <Input
                id="h-established"
                type="date"
                value={form.established_date}
                onChange={(e) => setForm((p) => ({ ...p, established_date: e.target.value }))}
                disabled={saving}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Hospital
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// EDIT DIALOG
// ============================================================================
function EditHospitalDialog({
  hospital,
  onOpenChange,
  onSaved,
}: {
  hospital: Hospital | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (h: Hospital) => void;
}) {
  const [form, setForm] = useState<HospitalUpdatePayload>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hospital) {
      setForm({
        name: hospital.name,
        address: hospital.address,
        phone: hospital.phone ?? '',
        email: hospital.email ?? '',
        license_number: hospital.license_number ?? '',
        established_date: hospital.established_date ?? '',
      });
    }
  }, [hospital]);

  const handleSave = async () => {
    if (!hospital) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateHospital(hospital.id, {
        name: form.name || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        license_number: form.license_number || undefined,
        established_date: form.established_date || undefined,
      });
      onSaved(updated);
      onOpenChange(false);
      toast.success('Hospital updated');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update hospital');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!hospital} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit {hospital?.name}</DialogTitle>
          <DialogDescription>Update this hospital&rsquo;s details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="eh-name">Name</Label>
            <Input id="eh-name" value={form.name ?? ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} disabled={saving} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eh-address">Address</Label>
            <Input id="eh-address" value={form.address ?? ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} disabled={saving} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="eh-phone">Phone</Label>
              <Input id="eh-phone" value={form.phone ?? ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} disabled={saving} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eh-email">Email</Label>
              <Input id="eh-email" type="email" value={form.email ?? ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} disabled={saving} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="eh-license">License Number</Label>
              <Input id="eh-license" value={form.license_number ?? ''} onChange={(e) => setForm((p) => ({ ...p, license_number: e.target.value }))} disabled={saving} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="eh-established">Established Date</Label>
              <Input id="eh-established" type="date" value={form.established_date ?? ''} onChange={(e) => setForm((p) => ({ ...p, established_date: e.target.value }))} disabled={saving} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ROW ACTIONS
// ============================================================================
function HospitalRowActions({
  hospital,
  busy,
  onEdit,
  onActivate,
  onDeactivate,
  onSuspend,
}: {
  hospital: Hospital;
  busy: boolean;
  onEdit: (h: Hospital) => void;
  onActivate: (h: Hospital) => void;
  onDeactivate: (h: Hospital) => void;
  onSuspend: (h: Hospital) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(hospital)}>Edit</DropdownMenuItem>
        {hospital.status !== 'active' && (
          <DropdownMenuItem onClick={() => onActivate(hospital)}>Activate</DropdownMenuItem>
        )}
        {hospital.status !== 'inactive' && (
          <DropdownMenuItem onClick={() => onDeactivate(hospital)}>Deactivate</DropdownMenuItem>
        )}
        {hospital.status !== 'suspended' && (
          <DropdownMenuItem variant="destructive" onClick={() => onSuspend(hospital)}>
            Suspend
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);

  const load = useCallback(() => {
    adminApi
      .hospitals({ limit: 200 })
      .then((r) => setHospitals(r.items))
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const all = hospitals ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (h) =>
        h.name.toLowerCase().includes(term) ||
        h.hospital_code.toLowerCase().includes(term) ||
        h.address.toLowerCase().includes(term)
    );
  }, [hospitals, q]);

  const loading = hospitals === null && !error;

  const patchHospital = (updated: Hospital) => {
    setHospitals((prev) => (prev ? prev.map((h) => (h.id === updated.id ? updated : h)) : prev));
  };

  const runStatusAction = async (h: Hospital, action: (id: string) => Promise<Hospital>, label: string) => {
    const isSuspend = label === 'suspended';
    const confirm = await Swal.fire({
      icon: isSuspend ? 'warning' : 'question',
      title: `${label === 'activated' ? 'Activate' : label === 'deactivated' ? 'Deactivate' : 'Suspend'} ${h.name}?`,
      text: isSuspend
        ? 'Every doctor, radiologist, and patient under this hospital will be blocked from logging in.'
        : `This will mark the hospital as ${label}.`,
      showCancelButton: true,
      confirmButtonText: label === 'activated' ? 'Activate' : label === 'deactivated' ? 'Deactivate' : 'Suspend',
      cancelButtonText: 'Cancel',
      confirmButtonColor: isSuspend ? '#dc2626' : '#4f46e5',
    });
    if (!confirm.isConfirmed) return;

    setBusyId(h.id);
    try {
      const updated = await action(h.id);
      patchHospital(updated);
      Swal.fire({ icon: 'success', title: `${h.name} ${label}`, timer: 2500, showConfirmButton: false });
    } catch (e) {
      toast.error((e as Error).message || `Failed to ${label} hospital`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <RoleShell>
      <DashboardPageHeader
        eyebrow="Super Admin"
        title="Hospitals"
        description="All hospitals onboarded on the platform, with their status and contact details."
        accent="indigo"
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load hospitals: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${filtered.length} hospital${filtered.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search hospitals…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Hospital
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Building2 className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No hospitals found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2.5 pr-4 font-medium">Hospital</th>
                  <th className="py-2.5 pr-4 font-medium">Code</th>
                  <th className="py-2.5 pr-4 font-medium hidden md:table-cell">Contact</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-50 shrink-0">
                          <Building2 className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{h.name}</p>
                          <p className="text-xs text-slate-500 truncate">{h.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">{h.hospital_code}</td>
                    <td className="py-3 pr-4 hidden md:table-cell text-slate-600">
                      <p className="truncate">{h.email || '—'}</p>
                      <p className="text-xs text-slate-400">{h.phone || ''}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={h.status} />
                    </td>
                    <td className="py-3 pr-0 text-right">
                      <HospitalRowActions
                        hospital={h}
                        busy={busyId === h.id}
                        onEdit={setEditingHospital}
                        onActivate={(hh) => runStatusAction(hh, adminApi.activateHospital, 'activated')}
                        onDeactivate={(hh) => runStatusAction(hh, adminApi.deactivateHospital, 'deactivated')}
                        onSuspend={(hh) => runStatusAction(hh, adminApi.suspendHospital, 'suspended')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <CreateHospitalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(h) => setHospitals((prev) => (prev ? [h, ...prev] : [h]))}
      />
      <EditHospitalDialog
        hospital={editingHospital}
        onOpenChange={(open) => !open && setEditingHospital(null)}
        onSaved={patchHospital}
      />
    </RoleShell>
  );
}

export default withAuth(HospitalsPage, { allowedRoles: ['super_admin'] });
