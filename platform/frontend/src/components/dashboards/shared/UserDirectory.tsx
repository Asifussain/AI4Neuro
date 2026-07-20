'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Swal from 'sweetalert2';
import { Search, Users, MoreHorizontal, Loader2, Plus } from 'lucide-react';
import { SectionCard, DashboardPageHeader, StatusBadge, ACCENT_STYLES, type Accent } from './primitives';
import { cn } from '@/lib/utils';
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
import { adminApi, type AdminUser, type Hospital } from '@/features/admin/api';

const ROLE_TITLES: Record<string, { title: string; description: string }> = {
  doctor: { title: 'Doctors', description: 'All doctors in this directory.' },
  radiologist: { title: 'Radiologists', description: 'All radiologists in this directory.' },
  patient: { title: 'Patients', description: 'All patients in this directory.' },
  admin: { title: 'Hospital Admins', description: 'All hospital administrators.' },
  super_admin: { title: 'Super Admins', description: 'Platform-level super administrators.' },
};

const ADD_USER_LABELS: Record<string, string> = {
  doctor: 'Add Doctor',
  radiologist: 'Add Radiologist',
  patient: 'Add Patient',
  admin: 'Add Hospital Admin',
  super_admin: 'Add Super Admin',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// EDIT DIALOG — full_name / phone / address (the fields UserUpdate accepts)
// ============================================================================
function EditUserDialog({
  user,
  onOpenChange,
  onSaved,
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: AdminUser) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhone(user.phone ?? '');
      setAddress('');
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateUser(user.id, {
        full_name: fullName || undefined,
        phone: phone || undefined,
        address: address || undefined,
      });
      onSaved(updated);
      onOpenChange(false);
      toast.success('User updated');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update {user?.full_name}&rsquo;s details.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-full-name">Full Name</Label>
            <Input id="edit-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={saving} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-address">Address</Label>
            <Input id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={saving} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !fullName}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DELETE CONFIRMATION — terminal, soft-delete
// ============================================================================
function DeleteUserDialog({
  user,
  onOpenChange,
  onDeleted,
}: {
  user: AdminUser | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(user.id);
      onDeleted(user.id);
      onOpenChange(false);
      Swal.fire({ icon: 'success', title: 'User deleted', timer: 2000, showConfirmButton: false });
    } catch (e) {
      toast.error((e as Error).message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(next) => !deleting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Delete {user?.full_name}?</DialogTitle>
          <DialogDescription>
            This permanently deactivates the account (terminal — distinct from suspend, and cannot be
            undone from this screen). The user will lose access immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ROW ACTIONS MENU
// ============================================================================
function RowActions({
  user,
  busy,
  onSuspend,
  onReactivate,
  onEdit,
  onDelete,
}: {
  user: AdminUser;
  busy: boolean;
  onSuspend: (u: AdminUser) => void;
  onReactivate: (u: AdminUser) => void;
  onEdit: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
}) {
  const isDeleted = user.account_status === 'deleted';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={busy || isDeleted}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {user.account_status === 'active' ? (
          <DropdownMenuItem onClick={() => onSuspend(user)}>Suspend</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onReactivate(user)}>Reactivate</DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onEdit(user)}>Edit</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(user)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserDirectoryInner({
  role,
  eyebrow,
  basePath,
  accent,
  fallbackDescription,
  onAddUser,
  hospitals,
  showHospitalColumn,
}: {
  role?: string;
  eyebrow: string;
  basePath: string;
  accent: Accent;
  fallbackDescription: string;
  onAddUser?: () => void;
  /** Only relevant when `showHospitalColumn` is set — used to resolve `hospital_id` -> name. */
  hospitals?: Hospital[];
  /** Cross-hospital views (Super Admin) need to show which hospital each row
   * belongs to so doctors/radiologists/patients/admins from different
   * hospitals aren't visually mixed together. Hospital Admin's own directory
   * is already scoped to a single hospital, so it stays off there. */
  showHospitalColumn?: boolean;
}) {
  const meta = role ? ROLE_TITLES[role] : undefined;
  const addUserLabel = role ? ADD_USER_LABELS[role] ?? 'Add User' : 'Add User';

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  const hospitalNameById = useMemo(
    () => Object.fromEntries((hospitals ?? []).map((h) => [h.id, h.name])),
    [hospitals]
  );

  const load = useCallback(() => {
    adminApi
      .users({ role, limit: 200 })
      .then((r) => setUsers(r.items))
      .catch((e) => setError((e as Error).message));
  }, [role]);

  useEffect(() => {
    setUsers(null);
    setError(null);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const all = users ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((u) => {
      if (hospitalFilter && u.hospital_id !== hospitalFilter) return false;
      if (!term) return true;
      return (
        u.full_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.unique_identifier.toLowerCase().includes(term)
      );
    });
  }, [users, q, hospitalFilter]);

  const loading = users === null && !error;

  const patchUser = (updated: AdminUser) => {
    setUsers((prev) => (prev ? prev.map((u) => (u.id === updated.id ? updated : u)) : prev));
  };
  const removeUser = (id: string) => {
    setUsers((prev) => (prev ? prev.filter((u) => u.id !== id) : prev));
  };

  const handleSuspend = async (u: AdminUser) => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: `Suspend ${u.full_name}?`,
      text: 'They will be signed out and blocked from logging in until reactivated.',
      showCancelButton: true,
      confirmButtonText: 'Suspend',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;

    setBusyId(u.id);
    try {
      const updated = await adminApi.suspendUser(u.id);
      patchUser(updated);
      Swal.fire({ icon: 'success', title: 'Account suspended', text: `${u.full_name} has been suspended.`, timer: 2500, showConfirmButton: false });
    } catch (e) {
      toast.error((e as Error).message || 'Failed to suspend user');
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (u: AdminUser) => {
    const confirm = await Swal.fire({
      icon: 'question',
      title: `Reactivate ${u.full_name}?`,
      text: 'They will regain access and be able to log in again.',
      showCancelButton: true,
      confirmButtonText: 'Reactivate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#16a34a',
    });
    if (!confirm.isConfirmed) return;

    setBusyId(u.id);
    try {
      const updated = await adminApi.reactivateUser(u.id);
      patchUser(updated);
      Swal.fire({ icon: 'success', title: 'Account reactivated', text: `${u.full_name} is active again.`, timer: 2500, showConfirmButton: false });
    } catch (e) {
      toast.error((e as Error).message || 'Failed to reactivate user');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <DashboardPageHeader
        eyebrow={eyebrow}
        title={meta?.title ?? 'All Users'}
        description={meta?.description ?? fallbackDescription}
        accent={accent}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load users: {error}
        </div>
      )}

      <SectionCard className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : `${filtered.length} user${filtered.length === 1 ? '' : 's'}`}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {showHospitalColumn && hospitals && hospitals.length > 0 && (
              <select
                value={hospitalFilter}
                onChange={(e) => setHospitalFilter(e.target.value)}
                className="py-2 pl-3 pr-8 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">All hospitals</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, email or ID…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            {onAddUser && (
              <Button className={cn('gap-2 text-white hover:brightness-95', ACCENT_STYLES[accent].solid)} onClick={onAddUser}>
                <Plus className="h-4 w-4" />
                {addUserLabel}
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Users className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <th className="py-2.5 pr-4 font-medium w-10">Sr No</th>
                  <th className="py-2.5 pr-4 font-medium">Name</th>
                  <th className="py-2.5 pr-4 font-medium hidden md:table-cell">Email</th>
                  {!role && <th className="py-2.5 pr-4 font-medium">Role</th>}
                  {showHospitalColumn && <th className="py-2.5 pr-4 font-medium">Hospital</th>}
                  <th className="py-2.5 pr-4 font-medium hidden lg:table-cell">Created</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, idx) => (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="py-3 pr-4 text-slate-500">{idx + 1}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                          {initials(u.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{u.full_name}</p>
                          <p className="text-xs text-slate-400 font-mono truncate md:hidden">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell text-slate-600 truncate">{u.email}</td>
                    {!role && (
                      <td className="py-3 pr-4 capitalize text-slate-600">{u.role.replace(/_/g, ' ')}</td>
                    )}
                    {showHospitalColumn && (
                      <td className="py-3 pr-4 text-slate-600 truncate max-w-[160px]">
                        {u.hospital_id ? hospitalNameById[u.hospital_id] ?? '—' : '—'}
                      </td>
                    )}
                    <td className="py-3 pr-4 hidden lg:table-cell text-slate-500 whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={u.account_status} />
                    </td>
                    <td className="py-3 pr-0 text-right">
                      <RowActions
                        user={u}
                        busy={busyId === u.id}
                        onSuspend={handleSuspend}
                        onReactivate={handleReactivate}
                        onEdit={setEditingUser}
                        onDelete={setDeletingUser}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <EditUserDialog user={editingUser} onOpenChange={(open) => !open && setEditingUser(null)} onSaved={patchUser} />
      <DeleteUserDialog
        user={deletingUser}
        onOpenChange={(open) => !open && setDeletingUser(null)}
        onDeleted={removeUser}
      />
    </>
  );
}

/**
 * Role-filterable user directory shared by Super Admin (platform-wide) and
 * Hospital Admin (auto-scoped to their own hospital by the backend) — the
 * same GET /hospital/users?role= call resolves differently server-side per
 * caller.
 *
 * Row actions: Suspend/Reactivate, Edit, Delete are wired against
 * `GET /hospital/users`'s actual `UserResponse` shape. Verify/Reject are
 * deliberately NOT included here — `UserResponse` has no
 * `verification_status` field (only `DoctorDirectoryEntry` /
 * `PatientDirectoryEntry` carry it), so this directory has no way to know
 * whether a given row needs verification without fabricating data. Verify/
 * Reject stay on HospitalAdminDashboard's dedicated Verifications tab, which
 * is backed by the richer `/hospital/doctors` directory instead.
 */
export function UserDirectory({
  eyebrow,
  basePath,
  accent,
  fallbackDescription = 'Complete user directory.',
  onAddUser,
  hospitals,
  showHospitalColumn,
}: {
  eyebrow: string;
  basePath: string;
  accent: Accent;
  fallbackDescription?: string;
  /** Renders an "Add {Role}" button beside the search bar when provided. */
  onAddUser?: () => void;
  hospitals?: Hospital[];
  showHospitalColumn?: boolean;
}) {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <UserDirectoryResolver
        eyebrow={eyebrow}
        basePath={basePath}
        accent={accent}
        fallbackDescription={fallbackDescription}
        onAddUser={onAddUser}
        hospitals={hospitals}
        showHospitalColumn={showHospitalColumn}
      />
    </Suspense>
  );
}

function UserDirectoryResolver(props: {
  eyebrow: string;
  basePath: string;
  accent: Accent;
  fallbackDescription: string;
  onAddUser?: () => void;
  hospitals?: Hospital[];
  showHospitalColumn?: boolean;
}) {
  const role = useSearchParams().get('role') || undefined;
  // Keying by role remounts the inner view on filter change, giving a clean
  // loading state without synchronously resetting state inside an effect.
  return <UserDirectoryInner key={role ?? 'all'} role={role} {...props} />;
}
