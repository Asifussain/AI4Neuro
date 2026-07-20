'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  adminApi,
  type AdminUser,
  type DoctorDirectoryEntry,
  type PatientDirectoryEntry,
  type Assignment,
} from '@/features/admin/api';
import { CreateUserDialog } from '@/components/dashboards/shared/CreateUserDialog';
import { analysisApi } from '@/features/analysis/api';
import type { SessionStatusResponse } from '@/features/analysis/types';
import {
  Users,
  UserPlus,
  Activity,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  FileText,
  ChevronRight,
  ChevronLeft,
  User,
  Stethoscope,
  Brain,
  Crown,
  X,
  Loader2,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  Server,
  Database,
  HardDrive,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboards/shared/DashboardShell';
import {
  SectionCard,
  StatCard as SharedStatCard,
  QuickActionsList,
  DashboardPageHeader,
} from '@/components/dashboards/shared/primitives';
import { getNavItems } from '@/lib/navigation';

const NAV_ITEMS = getNavItems('admin');

// ============================================================================
// ROLE CARD
// ============================================================================
function RoleCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'cyan' | 'violet';
}) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-50',
    green: 'bg-emerald-50',
    cyan: 'bg-cyan-50',
    violet: 'bg-violet-50',
  };
  const text: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    cyan: 'text-cyan-600',
    violet: 'text-violet-600',
  };

  return (
    <SectionCard className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${bg[color]}`}>
          <Icon className={`h-5 w-5 ${text[color]}`} />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// SECTION TOGGLE
// ============================================================================
function SectionToggle({
  activeSection,
  onSectionChange,
  pendingCount,
}: {
  activeSection: 'users' | 'verify' | 'assign';
  onSectionChange: (section: 'users' | 'verify' | 'assign') => void;
  pendingCount: number;
}) {
  const sections: { key: 'users' | 'verify' | 'assign'; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'verify', label: 'Verifications', icon: AlertCircle, badge: pendingCount },
    { key: 'assign', label: 'Assign', icon: UserPlus },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-slate-200 w-fit">
      {sections.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key}
          onClick={() => onSectionChange(key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeSection === key
              ? 'bg-teal-50 text-teal-700'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
              {badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// USER ROW (List View)
// ============================================================================
function UserRow({
  user,
  onSuspend,
  onActivate,
}: {
  user: AdminUser;
  onSuspend?: (id: string) => void;
  onActivate?: (id: string) => void;
}) {
  const roleIcons: Record<string, React.ElementType> = { admin: Crown, doctor: Stethoscope, radiologist: Brain, patient: User };
  const roleColors: Record<string, string> = { admin: 'bg-violet-50 text-violet-700', doctor: 'bg-emerald-50 text-emerald-700', radiologist: 'bg-cyan-50 text-cyan-700', patient: 'bg-blue-50 text-blue-700' };
  const statusColors: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', suspended: 'bg-red-50 text-red-700', pending: 'bg-amber-50 text-amber-700' };

  const role = user.role || 'patient';
  const RoleIcon = roleIcons[role] || User;
  const roleColor = roleColors[role] || roleColors.patient;
  const statusColor = statusColors[user.account_status] || statusColors.pending;

  return (
    <div className="group p-4 rounded-xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className={`p-2 rounded-lg ${roleColor.split(' ')[0]}`}>
            <RoleIcon className={`h-5 w-5 ${roleColor.split(' ')[1]}`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{user.full_name}</p>
            <p className="text-sm text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize hidden sm:block ${roleColor}`}>{role}</div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColor}`}>{user.account_status}</div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {user.account_status === 'active' ? (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-50" onClick={() => onSuspend?.(user.id)}>
                <XCircle className="h-4 w-4 text-red-600" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-emerald-50" onClick={() => onActivate?.(user.id)}>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// USER GRID CARD (Grid View)
// ============================================================================
function UserGridCard({
  user,
  onSuspend,
  onActivate,
}: {
  user: AdminUser;
  onSuspend?: (id: string) => void;
  onActivate?: (id: string) => void;
}) {
  const roleIcons: Record<string, React.ElementType> = { admin: Crown, doctor: Stethoscope, radiologist: Brain, patient: User };
  const roleBorderColors: Record<string, string> = { admin: 'border-violet-200', doctor: 'border-emerald-200', radiologist: 'border-cyan-200', patient: 'border-blue-200' };
  const roleColors: Record<string, string> = { admin: 'bg-violet-50 text-violet-700', doctor: 'bg-emerald-50 text-emerald-700', radiologist: 'bg-cyan-50 text-cyan-700', patient: 'bg-blue-50 text-blue-700' };
  const statusColors: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', suspended: 'bg-red-50 text-red-700', pending: 'bg-amber-50 text-amber-700' };

  const role = user.role || 'patient';
  const RoleIcon = roleIcons[role] || User;
  const roleColor = roleColors[role] || roleColors.patient;
  const borderColor = roleBorderColors[role] || roleBorderColors.patient;
  const statusColor = statusColors[user.account_status] || statusColors.pending;

  return (
    <SectionCard className={`p-4 h-full flex flex-col ${borderColor}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${roleColor.split(' ')[0]}`}>
          <RoleIcon className={`h-4 w-4 ${roleColor.split(' ')[1]}`} />
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${roleColor}`}>{role}</span>
      </div>

      <div className="space-y-1.5 mb-3 flex-1">
        <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
        <p className="text-xs text-slate-500 truncate">{user.email}</p>
        {user.created_at && (
          <p className="text-[10px] text-slate-400">
            Joined {new Date(user.created_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColor}`}>{user.account_status}</span>
        {user.account_status === 'active' ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-red-50 text-red-600" onClick={() => onSuspend?.(user.id)}>
            <XCircle className="h-3 w-3" />Suspend
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-emerald-50 text-emerald-600" onClick={() => onActivate?.(user.id)}>
            <CheckCircle2 className="h-3 w-3" />Activate
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// VERIFICATION CARD
// ============================================================================
function VerificationCard({
  doctor,
  onApprove,
  onReject,
  isBusy,
}: {
  doctor: DoctorDirectoryEntry;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isBusy: boolean;
}) {
  const decided = doctor.verification_status === 'verified' || doctor.verification_status === 'rejected';

  return (
    <SectionCard className="p-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-teal-50">
            <Stethoscope className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{doctor.full_name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {doctor.specialization && (
                <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs">{doctor.specialization}</span>
              )}
              {doctor.medical_license && (
                <span className="text-xs text-slate-500">License: <span className="font-mono">{doctor.medical_license}</span></span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Experience: {doctor.experience_years || 0} years</p>
          </div>
        </div>
        {decided ? (
          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${doctor.verification_status === 'verified' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {doctor.verification_status}
          </span>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1" disabled={isBusy} onClick={() => onApprove(doctor.id)}>
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Approve
            </Button>
            <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 gap-1" disabled={isBusy} onClick={() => onReject(doctor.id)}>
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}Reject
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// PAGINATION
// ============================================================================
function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  const pages: (number | string)[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-sm text-slate-500">Showing {from}-{to} of {totalItems}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="h-8 w-8 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`dots-${i}`} className="px-1 text-slate-400 text-sm">...</span>
          ) : (
            <Button
              key={p}
              size="sm"
              variant={p === currentPage ? 'default' : 'ghost'}
              className={`h-8 w-8 p-0 text-xs ${p === currentPage ? 'bg-teal-600 hover:bg-teal-700' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button size="sm" variant="ghost" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} className="h-8 w-8 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// LOADING SKELETONS
// ============================================================================
function StatCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 animate-pulse">
      <div className="h-11 w-11 bg-slate-100 rounded-xl mb-4" />
      <div className="h-4 w-20 bg-slate-100 rounded mb-2" />
      <div className="h-7 w-14 bg-slate-200 rounded" />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 bg-slate-100 rounded-lg" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-slate-100 rounded-full" />
      </div>
    </div>
  );
}

function GridCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 bg-slate-100 rounded-lg" />
        <div className="h-4 w-16 bg-slate-200 rounded-full" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 w-28 bg-slate-100 rounded" />
        <div className="h-3 w-36 bg-slate-100 rounded" />
      </div>
      <div className="h-7 w-full bg-slate-100 rounded" />
    </div>
  );
}

type HealthState = 'ok' | 'not_configured' | 'unreachable' | 'checking';

// ============================================================================
// MAIN HOSPITAL ADMIN DASHBOARD
// ============================================================================
export const HospitalAdminDashboard: React.FC = () => {
  // Dialog state
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  // Section state
  const [activeSection, setActiveSection] = useState<'users' | 'verify' | 'assign'>('users');

  // View + filter state (users section)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'date-desc' | 'status'>('name');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Assignment state
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  // Data (backend-backed — see features/admin/api.ts)
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorDirectoryEntry[] | null>(null);
  const [patients, setPatients] = useState<PatientDirectoryEntry[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [scans, setScans] = useState<SessionStatusResponse[] | null>(null);
  const [health, setHealth] = useState<{ api: HealthState; database: HealthState; storage: HealthState }>({
    api: 'checking',
    database: 'checking',
    storage: 'checking',
  });

  const loadUsers = useCallback(() => {
    adminApi
      .users({ limit: 200 })
      .then((r) => setUsers(r.items))
      .catch((e) => setUsersError((e as Error).message));
  }, []);
  const loadDoctors = useCallback(() => {
    adminApi.doctors({ limit: 200 }).then((r) => setDoctors(r.items)).catch(() => setDoctors([]));
  }, []);
  const loadPatients = useCallback(() => {
    adminApi.patients({ limit: 200 }).then((r) => setPatients(r.items)).catch(() => setPatients([]));
  }, []);
  const loadAssignments = useCallback(() => {
    adminApi.assignments({ limit: 200 }).then((r) => setAssignments(r.items)).catch(() => setAssignments([]));
  }, []);

  useEffect(() => {
    loadUsers();
    loadDoctors();
    loadPatients();
    loadAssignments();
    analysisApi.list({ limit: 200 }).then(setScans).catch(() => setScans([]));

    adminApi.health().then((r) => setHealth((h) => ({ ...h, api: r.status === 'ok' ? 'ok' : 'unreachable' }))).catch(() => setHealth((h) => ({ ...h, api: 'unreachable' })));
    adminApi.healthDatabase().then((r) => setHealth((h) => ({ ...h, database: r.status === 'ok' ? 'ok' : 'not_configured' }))).catch(() => setHealth((h) => ({ ...h, database: 'unreachable' })));
    adminApi.healthStorage().then((r) => setHealth((h) => ({ ...h, storage: r.status === 'ok' ? 'ok' : 'not_configured' }))).catch(() => setHealth((h) => ({ ...h, storage: 'unreachable' })));
  }, [loadUsers, loadDoctors, loadPatients, loadAssignments]);

  const usersLoading = users === null && !usersError;
  const doctorsLoading = doctors === null;
  const patientsLoading = patients === null;
  const assignmentsLoading = assignments === null;

  const usersList = useMemo(() => users || [], [users]);
  const doctorsList = useMemo(() => doctors || [], [doctors]);
  const patientsList = useMemo(() => patients || [], [patients]);
  const assignmentsList = useMemo(() => assignments || [], [assignments]);
  const scansList = useMemo(() => scans || [], [scans]);

  // Derived stats — computed from real data instead of a broken aggregate endpoint.
  const stats = useMemo(() => {
    const activeUsers = usersList.filter((u) => u.account_status === 'active').length;
    const suspendedUsers = usersList.filter((u) => u.account_status === 'suspended').length;
    const pendingVerifications =
      doctorsList.filter((d) => (d.verification_status ?? 'pending') === 'pending').length +
      patientsList.filter((p) => (p.verification_status ?? 'pending') === 'pending').length;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const scansThisMonth = scansList.filter(
      (s) => s.created_at && new Date(s.created_at) >= startOfMonth
    ).length;

    return {
      totalUsers: usersList.length,
      activeUsers,
      suspendedUsers,
      pendingVerifications,
      totalScans: scansList.length,
      scansThisMonth,
    };
  }, [usersList, doctorsList, patientsList, scansList]);

  // Role stats
  const roleStats = useMemo(() => [
    { label: 'Patients', value: patientsList.length, icon: Users, color: 'blue' as const },
    { label: 'Doctors', value: doctorsList.length, icon: Stethoscope, color: 'green' as const },
    { label: 'Radiologists', value: usersList.filter((u) => u.role === 'radiologist').length, icon: Brain, color: 'cyan' as const },
    { label: 'Hospital Admins', value: usersList.filter((u) => u.role === 'admin').length, icon: Crown, color: 'violet' as const },
  ], [usersList, doctorsList, patientsList]);

  // User status handlers
  const handleSuspendUser = async (userId: string) => {
    try {
      await adminApi.suspendUser(userId);
      loadUsers();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to suspend user');
    }
  };
  const handleActivateUser = async (userId: string) => {
    try {
      await adminApi.reactivateUser(userId);
      loadUsers();
    } catch (e) {
      toast.error((e as Error).message || 'Failed to activate user');
    }
  };

  // Verification handlers
  const handleApproveDoctor = async (doctorId: string) => {
    setVerifyingId(doctorId);
    try {
      await adminApi.verifyUser(doctorId);
      loadDoctors();
      toast.success('Doctor verified');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to verify doctor');
    } finally {
      setVerifyingId(null);
    }
  };
  const handleRejectDoctor = async (doctorId: string) => {
    setVerifyingId(doctorId);
    try {
      await adminApi.rejectUser(doctorId);
      loadDoctors();
      toast.success('Doctor rejected');
    } catch (e) {
      toast.error((e as Error).message || 'Failed to reject doctor');
    } finally {
      setVerifyingId(null);
    }
  };

  // Assignment handler
  const handleAssignPatient = async () => {
    if (!selectedDoctor || !selectedPatient) return;
    setAssignLoading(true);
    setAssignError(null);
    try {
      await adminApi.assignDoctor(selectedDoctor, selectedPatient);
      setSelectedDoctor('');
      setSelectedPatient('');
      loadAssignments();
    } catch (e) {
      setAssignError((e as Error).message || 'Failed to assign patient');
    } finally {
      setAssignLoading(false);
    }
  };

  // Filter + sort + paginate pipeline (users)
  const PAGE_SIZE = 12;

  const filteredUsers = useMemo(() => {
    let result = [...usersList];

    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter((u) => u.account_status === statusFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((u) =>
        u.full_name.toLowerCase().includes(term) ||
        (u.email && u.email.toLowerCase().includes(term))
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.full_name.localeCompare(b.full_name);
        case 'role': return (a.role || '').localeCompare(b.role || '');
        case 'date-desc': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'status': return (a.account_status || '').localeCompare(b.account_status || '');
        default: return 0;
      }
    });

    return result;
  }, [usersList, roleFilter, statusFilter, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const updateFilter = useCallback(<T,>(setter: (v: T) => void, value: T) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  const activeFilterCount = [
    roleFilter !== 'all',
    statusFilter !== 'all',
    searchTerm !== '',
  ].filter(Boolean).length;

  const isLoading = usersLoading && users === null;

  const healthDot = (state: HealthState) => {
    if (state === 'ok') return 'bg-emerald-500';
    if (state === 'checking') return 'bg-slate-300 animate-pulse';
    if (state === 'not_configured') return 'bg-amber-500';
    return 'bg-red-500';
  };
  const healthLabel = (state: HealthState) => {
    if (state === 'ok') return 'Healthy';
    if (state === 'checking') return 'Checking…';
    if (state === 'not_configured') return 'Not configured';
    return 'Unreachable';
  };

  return (
    <DashboardShell roleLabel="Hospital Admin" accent="teal" navItems={NAV_ITEMS}>
      <DashboardPageHeader
        eyebrow="Hospital Admin"
        title="Hospital Admin Dashboard"
        description="Complete hospital ecosystem management for AI4Neuro services."
        accent="teal"
      />

      <div className="flex justify-end">
        <Button className="gap-2 bg-teal-600 hover:bg-teal-700" onClick={() => setIsCreateUserOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      <CreateUserDialog
        open={isCreateUserOpen}
        onOpenChange={setIsCreateUserOpen}
        allowedRoles={['doctor', 'radiologist', 'patient']}
        hideHospitalPicker
        accent="teal"
        onCreated={() => {
          loadUsers();
          loadDoctors();
          loadPatients();
        }}
      />

      {usersError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load users: {usersError}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>{[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}</>
        ) : (
          <>
            <SharedStatCard label="Total Users" value={stats.totalUsers} icon={Users} sublabel="All roles combined" accent="teal" />
            <SharedStatCard label="Pending Actions" value={stats.pendingVerifications} icon={AlertCircle} sublabel="Require attention" accent="teal" />
            <SharedStatCard label="Monthly Scans" value={stats.scansThisMonth} icon={Activity} sublabel="Hospital-wide" accent="teal" />
            <SharedStatCard label="Active Users" value={stats.activeUsers} icon={Shield} sublabel="Currently active" accent="teal" />
          </>
        )}
      </div>

      {/* Role Distribution */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {roleStats.map((stat, idx) => (
          <RoleCard key={idx} {...stat} />
        ))}
      </div>

      {/* Main + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main */}
        <div className="xl:col-span-3 space-y-4">
          {/* Section Toggle */}
          <SectionToggle
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            pendingCount={stats.pendingVerifications}
          />

          {/* === USERS SECTION === */}
          {activeSection === 'users' && (
            <>
              {/* Toolbar */}
              <SectionCard className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* View toggle */}
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-teal-50 text-teal-700' : 'text-slate-400 hover:bg-slate-50'}`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-teal-50 text-teal-700' : 'text-slate-400 hover:bg-slate-50'}`}
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Filters toggle */}
                    <Button
                      size="sm"
                      variant="outline"
                      className={`gap-1.5 ${showFilters || activeFilterCount > 0 ? 'border-teal-200 text-teal-700' : 'border-slate-200'}`}
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-3.5 w-3.5" />
                      Filters
                      {activeFilterCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-teal-600 text-white text-[10px] font-bold">{activeFilterCount}</span>
                      )}
                    </Button>

                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search users..."
                        className="pl-9 h-9 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-teal-400"
                        value={searchTerm}
                        onChange={(e) => updateFilter(setSearchTerm, e.target.value)}
                      />
                      {searchTerm && (
                        <button onClick={() => updateFilter(setSearchTerm, '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Sort */}
                    <div className="flex items-center gap-1.5">
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="bg-transparent text-sm text-slate-500 border-none outline-none cursor-pointer"
                      >
                        <option value="name">Name</option>
                        <option value="role">Role</option>
                        <option value="date-desc">Newest</option>
                        <option value="status">Status</option>
                      </select>
                    </div>
                  </div>

                  {/* Filter dropdowns */}
                  {showFilters && (
                    <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Role:</span>
                        <select
                          value={roleFilter}
                          onChange={(e) => updateFilter(setRoleFilter, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 px-2 py-1 outline-none focus:border-teal-400"
                        >
                          <option value="all">All</option>
                          <option value="patient">Patient</option>
                          <option value="doctor">Doctor</option>
                          <option value="radiologist">Radiologist</option>
                          <option value="admin">Hospital Admin</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Status:</span>
                        <select
                          value={statusFilter}
                          onChange={(e) => updateFilter(setStatusFilter, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 px-2 py-1 outline-none focus:border-teal-400"
                        >
                          <option value="all">All</option>
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => { setRoleFilter('all'); setStatusFilter('all'); setSearchTerm(''); setCurrentPage(1); }}
                          className="text-xs text-red-600 hover:text-red-700 ml-auto"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Filter chips */}
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {roleFilter !== 'all' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
                      Role: {roleFilter}
                      <button onClick={() => updateFilter(setRoleFilter, 'all')}><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {statusFilter !== 'all' && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                      Status: {statusFilter}
                      <button onClick={() => updateFilter(setStatusFilter, 'all')}><X className="h-3 w-3" /></button>
                    </span>
                  )}
                  {searchTerm && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-medium">
                      Search: &quot;{searchTerm}&quot;
                      <button onClick={() => updateFilter(setSearchTerm, '')}><X className="h-3 w-3" /></button>
                    </span>
                  )}
                </div>
              )}

              {/* Results count */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
                  {activeFilterCount > 0 && ` (filtered from ${usersList.length})`}
                </span>
              </div>

              {/* Users Display */}
              {usersLoading && usersList.length === 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => <GridCardSkeleton key={i} />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <RowSkeleton key={i} />)}
                  </div>
                )
              ) : paginatedUsers.length === 0 ? (
                <SectionCard className="p-12">
                  <div className="text-center">
                    <div className="p-4 rounded-full bg-teal-50 w-fit mx-auto mb-4">
                      <Users className="h-8 w-8 text-teal-600" />
                    </div>
                    <p className="text-slate-900 font-medium mb-1">No users found</p>
                    <p className="text-sm text-slate-500">
                      {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Create a new user to get started'}
                    </p>
                  </div>
                </SectionCard>
              ) : viewMode === 'grid' ? (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {paginatedUsers.map((user) => (
                    <UserGridCard key={user.id} user={user} onSuspend={handleSuspendUser} onActivate={handleActivateUser} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedUsers.map((user) => (
                    <UserRow key={user.id} user={user} onSuspend={handleSuspendUser} onActivate={handleActivateUser} />
                  ))}
                </div>
              )}

              <Pagination currentPage={safePage} totalPages={totalPages} totalItems={filteredUsers.length} pageSize={PAGE_SIZE} onPageChange={setCurrentPage} />
            </>
          )}

          {/* === VERIFICATIONS SECTION === */}
          {activeSection === 'verify' && (
            <SectionCard className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-teal-50">
                  <AlertCircle className="h-5 w-5 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Doctor Verifications</h3>
                <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-medium">
                  {stats.pendingVerifications} pending
                </span>
              </div>

              <div className="space-y-3">
                {doctorsLoading ? (
                  <>{[1, 2].map((i) => <RowSkeleton key={i} />)}</>
                ) : doctorsList.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No doctors on file yet</div>
                ) : (
                  doctorsList.map((doctor) => (
                    <VerificationCard
                      key={doctor.id}
                      doctor={doctor}
                      onApprove={handleApproveDoctor}
                      onReject={handleRejectDoctor}
                      isBusy={verifyingId === doctor.id}
                    />
                  ))
                )}
              </div>
            </SectionCard>
          )}

          {/* === ASSIGNMENTS SECTION === */}
          {activeSection === 'assign' && (
            <SectionCard className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-50">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Assign Patients to Doctors</h3>
              </div>

              {assignError && (
                <div className="p-3 mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{assignError}</div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Select Doctor</Label>
                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctorsLoading ? (
                        <SelectItem value="" disabled>Loading...</SelectItem>
                      ) : (
                        doctorsList.map((doctor) => (
                          <SelectItem key={doctor.id} value={doctor.id}>
                            {doctor.full_name}{doctor.specialization ? ` - ${doctor.specialization}` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Patient</Label>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a patient" />
                    </SelectTrigger>
                    <SelectContent>
                      {patientsLoading ? (
                        <SelectItem value="" disabled>Loading...</SelectItem>
                      ) : (
                        patientsList.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.full_name}{patient.patient_code ? ` - ${patient.patient_code}` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="mt-4 gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={handleAssignPatient}
                disabled={!selectedDoctor || !selectedPatient || assignLoading}
              >
                {assignLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Assign Patient
              </Button>

              {/* Current Assignments */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <h4 className="text-sm font-semibold text-slate-900">Current Assignments</h4>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">{assignmentsList.length} active</span>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {assignmentsLoading ? (
                    <>{[1, 2, 3].map((i) => <RowSkeleton key={i} />)}</>
                  ) : assignmentsList.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">No assignments found</div>
                  ) : (
                    assignmentsList.map((assignment) => (
                      <div key={assignment.id} className="p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="p-1.5 rounded-lg bg-emerald-50"><Stethoscope className="h-3.5 w-3.5 text-emerald-600" /></div>
                            <span className="text-sm text-slate-900 truncate">{assignment.doctor_name}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="p-1.5 rounded-lg bg-blue-50"><User className="h-3.5 w-3.5 text-blue-600" /></div>
                            <span className="text-sm text-slate-900 truncate">{assignment.patient_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {assignment.created_at ? new Date(assignment.created_at).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* System Health */}
          <SectionCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Server className="h-4 w-4 text-teal-600" />
              System Health
            </h3>
            <div className="space-y-2.5">
              {[
                { label: 'API', status: health.api, icon: Server },
                { label: 'Database', status: health.database, icon: Database },
                { label: 'Storage', status: health.storage, icon: HardDrive },
              ].map(({ label, status: hStatus, icon: SIcon }) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2">
                    <SIcon className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${healthDot(hStatus)}`} />
                    <span className="text-xs text-slate-800">{healthLabel(hStatus)}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Quick Stats */}
          <SectionCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-teal-600" />
              Quick Stats
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500">Total Scans</span>
                <span className="text-sm font-bold text-slate-900">{stats.totalScans}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500">This Month</span>
                <span className="text-sm font-bold text-teal-700">{stats.scansThisMonth}</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                <span className="text-xs text-slate-500">Suspended</span>
                <span className="text-sm font-bold text-red-600">{stats.suspendedUsers}</span>
              </div>
            </div>
          </SectionCard>

          {/* Quick actions */}
          <QuickActionsList
            accent="teal"
            actions={[
              { label: 'Add Doctor', onClick: () => setIsCreateUserOpen(true) },
              { label: 'Add Radiologist', onClick: () => setIsCreateUserOpen(true) },
              { label: 'Add Patient', onClick: () => setIsCreateUserOpen(true) },
              { label: 'View Scan Sessions', href: '/admin/sessions' },
            ]}
          />

          {/* Reports */}
          <SectionCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-violet-600" />
              Reports
            </h3>
            <div className="space-y-2">
              <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2 border-slate-200 text-slate-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200">
                <a href="/admin/sessions?status=completed"><Activity className="h-3.5 w-3.5" />Completed Reports</a>
              </Button>
              <Button variant="outline" size="sm" asChild className="w-full justify-start gap-2 border-slate-200 text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200">
                <a href="/admin/users"><Users className="h-3.5 w-3.5" />User Statistics</a>
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </DashboardShell>
  );
};
