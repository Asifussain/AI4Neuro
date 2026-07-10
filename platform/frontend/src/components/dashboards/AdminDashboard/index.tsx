'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminStats, useUsers, useDoctors, usePatients, useUpdateUserStatus, useAssignPatient, useAllAssignments } from '@/lib/hooks/useApi';
import type { User as ApiUser } from '@/lib/api/users';
import type { Doctor } from '@/lib/api/doctors';
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
  Edit,
  Loader2,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  Server,
  Database,
  HardDrive,
  Cpu,
} from 'lucide-react';
import {
  SpotlightCard,
  GradientText,
  AnimatedCounter,
  AuroraBackground,
  GridPattern,
} from '@/components/ui/animated';

// ============================================================================
// STAT CARD
// ============================================================================
function StatCard({
  title,
  value,
  icon: Icon,
  description,
  color = 'purple',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  color?: 'purple' | 'teal' | 'blue' | 'green' | 'orange' | 'red';
}) {
  const colorStyles: Record<string, string> = {
    purple: 'from-purple-500 to-violet-500',
    teal: 'from-teal-500 to-cyan-500',
    blue: 'from-blue-500 to-indigo-500',
    green: 'from-green-500 to-emerald-500',
    orange: 'from-orange-500 to-amber-500',
    red: 'from-red-500 to-rose-500',
  };
  const bgColorStyles: Record<string, string> = {
    purple: 'bg-purple-500/10',
    teal: 'bg-teal-500/10',
    blue: 'bg-blue-500/10',
    green: 'bg-green-500/10',
    orange: 'bg-orange-500/10',
    red: 'bg-red-500/10',
  };
  const iconColors: Record<string, string> = {
    purple: '#a855f7',
    teal: '#14b8a6',
    blue: '#3b82f6',
    green: '#22c55e',
    orange: '#f97316',
    red: '#ef4444',
  };

  return (
    <SpotlightCard className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-400">{title}</p>
          <span className={`text-2xl font-bold bg-gradient-to-r ${colorStyles[color]} bg-clip-text text-transparent`}>
            {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
          </span>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className={`p-3 rounded-xl ${bgColorStyles[color]}`}>
          <Icon className="h-5 w-5" style={{ color: iconColors[color] }} />
        </div>
      </div>
    </SpotlightCard>
  );
}

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
  color: 'purple' | 'teal' | 'blue' | 'green' | 'orange';
}) {
  const colorStyles: Record<string, string> = {
    purple: 'from-purple-500 to-violet-500',
    teal: 'from-teal-500 to-cyan-500',
    blue: 'from-blue-500 to-indigo-500',
    green: 'from-green-500 to-emerald-500',
    orange: 'from-orange-500 to-amber-500',
  };
  const bgColorStyles: Record<string, string> = {
    purple: 'bg-purple-500/10',
    teal: 'bg-teal-500/10',
    blue: 'bg-blue-500/10',
    green: 'bg-green-500/10',
    orange: 'bg-orange-500/10',
  };
  const iconColors: Record<string, string> = {
    purple: '#a855f7',
    teal: '#14b8a6',
    blue: '#3b82f6',
    green: '#22c55e',
    orange: '#f97316',
  };

  return (
    <SpotlightCard className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${bgColorStyles[color]}`}>
          <Icon className="h-5 w-5" style={{ color: iconColors[color] }} />
        </div>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className={`text-xl font-bold bg-gradient-to-r ${colorStyles[color]} bg-clip-text text-transparent`}>
            <AnimatedCounter value={value} />
          </p>
        </div>
      </div>
    </SpotlightCard>
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
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.05] w-fit">
      {sections.map(({ key, label, icon: Icon, badge }) => (
        <button
          key={key}
          onClick={() => onSectionChange(key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeSection === key
              ? 'bg-orange-500/20 text-orange-400'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
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
  user: ApiUser;
  onSuspend?: (id: string) => void;
  onActivate?: (id: string) => void;
}) {
  const roleIcons: Record<string, React.ElementType> = { admin: Crown, doctor: Stethoscope, radiologist: Brain, patient: User };
  const roleColors: Record<string, string> = { admin: 'bg-orange-500/10 text-orange-400', doctor: 'bg-green-500/10 text-green-400', radiologist: 'bg-teal-500/10 text-teal-400', patient: 'bg-blue-500/10 text-blue-400' };
  const statusColors: Record<string, string> = { active: 'bg-green-500/10 text-green-400', suspended: 'bg-red-500/10 text-red-400', pending: 'bg-yellow-500/10 text-yellow-400' };

  const role = user.role || 'patient';
  const RoleIcon = roleIcons[role] || User;
  const roleColor = roleColors[role] || roleColors.patient;
  const statusColor = statusColors[user.account_status] || statusColors.pending;

  return (
    <div className="group p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-orange-500/30 hover:bg-white/[0.04] transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className={`p-2 rounded-lg ${roleColor.split(' ')[0]}`}>
            <RoleIcon className={`h-5 w-5 ${roleColor.split(' ')[1]}`} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{user.full_name}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize hidden sm:block ${roleColor}`}>{role}</div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${statusColor}`}>{user.account_status}</div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {user.account_status === 'active' ? (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-500/10" onClick={() => onSuspend?.(user.id)}>
                <XCircle className="h-4 w-4 text-red-400" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-green-500/10" onClick={() => onActivate?.(user.id)}>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
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
  user: ApiUser;
  onSuspend?: (id: string) => void;
  onActivate?: (id: string) => void;
}) {
  const roleIcons: Record<string, React.ElementType> = { admin: Crown, doctor: Stethoscope, radiologist: Brain, patient: User };
  const roleBorderColors: Record<string, string> = { admin: 'border-orange-500/30', doctor: 'border-green-500/30', radiologist: 'border-teal-500/30', patient: 'border-blue-500/30' };
  const roleColors: Record<string, string> = { admin: 'bg-orange-500/10 text-orange-400', doctor: 'bg-green-500/10 text-green-400', radiologist: 'bg-teal-500/10 text-teal-400', patient: 'bg-blue-500/10 text-blue-400' };
  const statusColors: Record<string, string> = { active: 'bg-green-500/10 text-green-400', suspended: 'bg-red-500/10 text-red-400', pending: 'bg-yellow-500/10 text-yellow-400' };

  const role = user.role || 'patient';
  const RoleIcon = roleIcons[role] || User;
  const roleColor = roleColors[role] || roleColors.patient;
  const borderColor = roleBorderColors[role] || roleBorderColors.patient;
  const statusColor = statusColors[user.account_status] || statusColors.pending;

  return (
    <SpotlightCard className={`p-4 h-full flex flex-col ${borderColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${roleColor.split(' ')[0]}`}>
          <RoleIcon className={`h-4 w-4 ${roleColor.split(' ')[1]}`} />
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${roleColor}`}>{role}</span>
      </div>

      {/* Info */}
      <div className="space-y-1.5 mb-3 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{user.full_name}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        {user.created_at && (
          <p className="text-[10px] text-muted-foreground">
            Joined {new Date(user.created_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Status + Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColor}`}>{user.account_status}</span>
        {user.account_status === 'active' ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-red-500/10 text-red-400" onClick={() => onSuspend?.(user.id)}>
            <XCircle className="h-3 w-3" />Suspend
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-green-500/10 text-green-400" onClick={() => onActivate?.(user.id)}>
            <CheckCircle2 className="h-3 w-3" />Activate
          </Button>
        )}
      </div>
    </SpotlightCard>
  );
}

// ============================================================================
// VERIFICATION CARD
// ============================================================================
function VerificationCard({ doctor }: { doctor: Doctor }) {
  const doctorName = doctor.full_name || doctor.user_profile?.full_name || 'Unknown';

  return (
    <SpotlightCard className="p-5" spotlightColor="rgba(249, 115, 22, 0.15)">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-orange-500/10">
            <Stethoscope className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{doctorName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-xs">{doctor.specialization}</span>
              <span className="text-xs text-muted-foreground">License: <span className="font-mono">{doctor.license_number}</span></span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Experience: {doctor.experience_years || 0} years</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />Approve
          </Button>
          <Button size="sm" className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white border-0 gap-1">
            <XCircle className="h-3.5 w-3.5" />Reject
          </Button>
        </div>
      </div>
    </SpotlightCard>
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
      <span className="text-sm text-muted-foreground">Showing {from}-{to} of {totalItems}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="h-8 w-8 p-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`dots-${i}`} className="px-1 text-muted-foreground text-sm">...</span>
          ) : (
            <Button
              key={p}
              size="sm"
              variant={p === currentPage ? 'default' : 'ghost'}
              className={`h-8 w-8 p-0 text-xs ${p === currentPage ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
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
    <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.05] animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-slate-700 rounded" />
          <div className="h-7 w-14 bg-slate-600 rounded" />
          <div className="h-3 w-24 bg-slate-700 rounded" />
        </div>
        <div className="h-11 w-11 bg-slate-700 rounded-xl" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-9 w-9 bg-slate-700 rounded-lg" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-600 rounded" />
            <div className="h-3 w-24 bg-slate-700 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-slate-700 rounded-full" />
      </div>
    </div>
  );
}

function GridCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 bg-slate-700 rounded-lg" />
        <div className="h-4 w-16 bg-slate-600 rounded-full" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 w-28 bg-slate-700 rounded" />
        <div className="h-3 w-36 bg-slate-700 rounded" />
      </div>
      <div className="h-7 w-full bg-slate-700 rounded" />
    </div>
  );
}

// ============================================================================
// MAIN ADMIN DASHBOARD
// ============================================================================
export const AdminDashboard: React.FC = () => {
  // Dialog state
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', role: '', phone: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);

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

  // Data
  const { data: stats, isLoading: statsLoading, error: statsError } = useAdminStats();
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUsers({ pageSize: 50 });
  const { data: doctorsData, isLoading: doctorsLoading } = useDoctors({ pageSize: 50 });
  const { data: patientsData, isLoading: patientsLoading } = usePatients({ pageSize: 50 });
  const { data: assignmentsData, isLoading: assignmentsLoading, refetch: refetchAssignments } = useAllAssignments({ pageSize: 50 });
  const { suspendUser, activateUser } = useUpdateUserStatus();
  const { assignPatient, isLoading: assignLoading, error: assignError } = useAssignPatient();

  const users = usersData?.data || [];
  const doctors = doctorsData?.data || [];
  const patients = patientsData?.data || [];
  const assignments = assignmentsData?.data || [];

  // Role stats
  const roleStats = useMemo(() => [
    { label: 'Patients', value: stats?.totalPatients || 0, icon: Users, color: 'blue' as const },
    { label: 'Doctors', value: stats?.totalDoctors || 0, icon: Stethoscope, color: 'green' as const },
    { label: 'Radiologists', value: stats?.totalRadiologists || 0, icon: Brain, color: 'teal' as const },
    { label: 'Admins', value: stats?.totalAdmins || 0, icon: Crown, color: 'orange' as const },
  ], [stats]);

  // User status handlers
  const handleSuspendUser = async (userId: string) => {
    await suspendUser(userId);
    refetchUsers();
  };
  const handleActivateUser = async (userId: string) => {
    await activateUser(userId);
    refetchUsers();
  };

  // Create user handler
  const handleCreateUser = async () => {
    if (!createForm.full_name || !createForm.email || !createForm.role) {
      toast.error('Please fill in all required fields');
      return;
    }
    setCreateLoading(true);
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: createForm.full_name,
          email: createForm.email,
          role: createForm.role,
          phone: createForm.phone || undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setCreateResult({
        email: createForm.email,
        password: result.user.temporaryPassword,
        emailSent: result.emailSent ?? false,
      });
      setCreateForm({ full_name: '', email: '', role: '', phone: '' });
      setIsCreateUserOpen(false);
      refetchUsers();
      toast.success(result.emailSent
        ? 'User created! Credentials sent via email.'
        : 'User created! Please share credentials manually.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  // Assignment handler
  const handleAssignPatient = async () => {
    if (selectedDoctor && selectedPatient) {
      const result = await assignPatient(selectedDoctor, selectedPatient);
      if (result) {
        setSelectedDoctor('');
        setSelectedPatient('');
        refetchAssignments();
      }
    }
  };

  // Filter + sort + paginate pipeline (users)
  const PAGE_SIZE = 12;

  const filteredUsers = useMemo(() => {
    let result = [...users];

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
  }, [users, roleFilter, statusFilter, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const updateFilter = useCallback((setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  const activeFilterCount = [
    roleFilter !== 'all',
    statusFilter !== 'all',
    searchTerm !== '',
  ].filter(Boolean).length;

  const isLoading = statsLoading && usersLoading && !stats && users.length === 0;

  // System health
  const systemHealth = stats?.systemHealth || { database: 'healthy', storage: 'healthy', mlService: 'healthy' };
  const healthDot = (status: string) => {
    if (status === 'healthy') return 'bg-green-500';
    if (status === 'degraded') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="relative min-h-screen bg-background">
      <AuroraBackground />
      <GridPattern />

      <div className="relative z-10 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              <GradientText from="from-orange-400" via="via-amber-400" to="to-purple-400">
                System Administration
              </GradientText>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage users, permissions, and hospital operations
            </p>
          </div>
          <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
                <UserPlus className="h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Create New User</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Add a new user to the system. A temporary password will be generated and emailed to them.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="fullName" className="text-muted-foreground">Full Name <span className="text-red-400">*</span></Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={createForm.full_name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, full_name: e.target.value }))}
                    disabled={createLoading}
                    className="bg-white/[0.02] border-white/[0.08] text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="text-muted-foreground">Email <span className="text-red-400">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    disabled={createLoading}
                    className="bg-white/[0.02] border-white/[0.08] text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role" className="text-muted-foreground">Role <span className="text-red-400">*</span></Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(val) => setCreateForm(prev => ({ ...prev, role: val }))}
                    disabled={createLoading}
                  >
                    <SelectTrigger className="bg-white/[0.02] border-white/[0.08] text-foreground">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="patient">Patient</SelectItem>
                      <SelectItem value="doctor">Doctor</SelectItem>
                      <SelectItem value="radiologist">Radiologist</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone" className="text-muted-foreground">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+1 (555) 000-0000"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                    disabled={createLoading}
                    className="bg-white/[0.02] border-white/[0.08] text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setIsCreateUserOpen(false); setCreateForm({ full_name: '', email: '', role: '', phone: '' }); }}
                  disabled={createLoading}
                  className="border-border text-muted-foreground hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={createLoading || !createForm.full_name || !createForm.email || !createForm.role}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 gap-2"
                >
                  {createLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Creating...</>
                  ) : (
                    <><UserPlus className="h-4 w-4" />Create User</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Success Dialog — shows credentials after user creation */}
        <Dialog open={!!createResult} onOpenChange={(open) => { if (!open) setCreateResult(null); }}>
          <DialogContent className="sm:max-w-[480px] bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                User Created Successfully
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {createResult?.emailSent
                  ? 'Credentials have been sent to the user via email.'
                  : 'Email delivery failed. Please share these credentials manually.'}
              </DialogDescription>
            </DialogHeader>
            {createResult && (
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="text-sm font-mono font-medium text-foreground">{createResult.email}</span>
                  </div>
                  <div className="border-t border-white/[0.05]" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Temporary Password</span>
                    <span className="text-sm font-mono font-bold text-teal-400 tracking-wide">{createResult.password}</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-400 leading-relaxed">
                    <strong>Note:</strong> The user will be required to change their password upon first login.
                    {!createResult.emailSent && ' Since the email could not be delivered, please share these credentials securely.'}
                  </p>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => setCreateResult(null)}
                className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Error */}
        {statsError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            Failed to load stats: {statsError}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            <>{[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}</>
          ) : (
            <>
              <StatCard title="Total Users" value={stats?.totalUsers || 0} icon={Users} description="All roles combined" color="purple" />
              <StatCard title="Pending Actions" value={stats?.pendingVerifications || 0} icon={AlertCircle} description="Require attention" color="orange" />
              <StatCard title="Monthly Scans" value={stats?.scansThisMonth || 0} icon={Activity} description="Hospital-wide" color="teal" />
              <StatCard title="Active Users" value={stats?.activeUsers || 0} icon={Shield} description="Currently active" color="green" />
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
              pendingCount={stats?.pendingVerifications || 0}
            />

            {/* === USERS SECTION === */}
            {activeSection === 'users' && (
              <>
                {/* Toolbar */}
                <SpotlightCard className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* View toggle */}
                      <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-orange-500/20 text-orange-400' : 'text-muted-foreground hover:bg-white/5'}`}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-orange-500/20 text-orange-400' : 'text-muted-foreground hover:bg-white/5'}`}
                        >
                          <List className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Filters toggle */}
                      <Button
                        size="sm"
                        variant="outline"
                        className={`gap-1.5 ${showFilters || activeFilterCount > 0 ? 'border-orange-500/30 text-orange-400' : 'border-white/[0.08]'}`}
                        onClick={() => setShowFilters(!showFilters)}
                      >
                        <Filter className="h-3.5 w-3.5" />
                        Filters
                        {activeFilterCount > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">{activeFilterCount}</span>
                        )}
                      </Button>

                      {/* Search */}
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          className="pl-9 h-9 bg-white/[0.02] border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:border-orange-500/50"
                          value={searchTerm}
                          onChange={(e) => updateFilter(setSearchTerm, e.target.value)}
                        />
                        {searchTerm && (
                          <button onClick={() => updateFilter(setSearchTerm, '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Sort */}
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                          className="bg-transparent text-sm text-muted-foreground border-none outline-none cursor-pointer"
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
                      <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-white/[0.05]">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Role:</span>
                          <select
                            value={roleFilter}
                            onChange={(e) => updateFilter(setRoleFilter, e.target.value)}
                            className="bg-white/[0.03] border border-white/[0.08] rounded-md text-sm text-foreground px-2 py-1 outline-none focus:border-orange-500/50"
                          >
                            <option value="all">All</option>
                            <option value="patient">Patient</option>
                            <option value="doctor">Doctor</option>
                            <option value="radiologist">Radiologist</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Status:</span>
                          <select
                            value={statusFilter}
                            onChange={(e) => updateFilter(setStatusFilter, e.target.value)}
                            className="bg-white/[0.03] border border-white/[0.08] rounded-md text-sm text-foreground px-2 py-1 outline-none focus:border-orange-500/50"
                          >
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        </div>
                        {activeFilterCount > 0 && (
                          <button
                            onClick={() => { setRoleFilter('all'); setStatusFilter('all'); setSearchTerm(''); setCurrentPage(1); }}
                            className="text-xs text-red-400 hover:text-red-300 ml-auto"
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </SpotlightCard>

                {/* Filter chips */}
                {activeFilterCount > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {roleFilter !== 'all' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
                        Role: {roleFilter}
                        <button onClick={() => updateFilter(setRoleFilter, 'all')}><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {statusFilter !== 'all' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                        Status: {statusFilter}
                        <button onClick={() => updateFilter(setStatusFilter, 'all')}><X className="h-3 w-3" /></button>
                      </span>
                    )}
                    {searchTerm && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium">
                        Search: &quot;{searchTerm}&quot;
                        <button onClick={() => updateFilter(setSearchTerm, '')}><X className="h-3 w-3" /></button>
                      </span>
                    )}
                  </div>
                )}

                {/* Results count */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
                    {activeFilterCount > 0 && ` (filtered from ${users.length})`}
                  </span>
                </div>

                {/* Users Display */}
                {usersLoading && users.length === 0 ? (
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
                  <SpotlightCard className="p-12">
                    <div className="text-center">
                      <div className="p-4 rounded-full bg-orange-500/10 w-fit mx-auto mb-4">
                        <Users className="h-8 w-8 text-orange-400" />
                      </div>
                      <p className="text-foreground font-medium mb-1">No users found</p>
                      <p className="text-sm text-muted-foreground">
                        {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Create a new user to get started'}
                      </p>
                    </div>
                  </SpotlightCard>
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
              <SpotlightCard className="p-5" spotlightColor="rgba(249, 115, 22, 0.15)">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <AlertCircle className="h-5 w-5 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Pending Verifications</h3>
                  <span className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-medium">
                    {stats?.pendingVerifications || 0} pending
                  </span>
                </div>

                <div className="space-y-3">
                  {doctorsLoading ? (
                    <>{[1, 2].map((i) => <RowSkeleton key={i} />)}</>
                  ) : doctors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No pending verifications</div>
                  ) : (
                    doctors.slice(0, 10).map((doctor) => (
                      <VerificationCard key={doctor.id} doctor={doctor} />
                    ))
                  )}
                </div>
              </SpotlightCard>
            )}

            {/* === ASSIGNMENTS SECTION === */}
            {activeSection === 'assign' && (
              <SpotlightCard className="p-5" spotlightColor="rgba(59, 130, 246, 0.15)">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <UserPlus className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Assign Patients to Doctors</h3>
                </div>

                {assignError && (
                  <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{assignError}</div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Select Doctor</Label>
                    <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                      <SelectTrigger className="bg-white/[0.02] border-white/[0.08] text-foreground">
                        <SelectValue placeholder="Choose a doctor" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {doctorsLoading ? (
                          <SelectItem value="" disabled>Loading...</SelectItem>
                        ) : (
                          doctors.map((doctor) => (
                            <SelectItem key={doctor.id} value={doctor.id}>
                              {doctor.full_name || doctor.user_profile?.full_name} - {doctor.specialization}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Select Patient</Label>
                    <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                      <SelectTrigger className="bg-white/[0.02] border-white/[0.08] text-foreground">
                        <SelectValue placeholder="Choose a patient" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {patientsLoading ? (
                          <SelectItem value="" disabled>Loading...</SelectItem>
                        ) : (
                          patients.map((patient) => (
                            <SelectItem key={patient.id} value={patient.id}>
                              {patient.full_name || patient.user_profile?.full_name} - {patient.patient_code}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  className="mt-4 gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0"
                  onClick={handleAssignPatient}
                  disabled={!selectedDoctor || !selectedPatient || assignLoading}
                >
                  {assignLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Assign Patient
                </Button>

                {/* Current Assignments */}
                <div className="mt-6 pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-sm font-semibold text-foreground">Current Assignments</h4>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">{assignments.length} active</span>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {assignmentsLoading ? (
                      <>{[1, 2, 3].map((i) => <RowSkeleton key={i} />)}</>
                    ) : assignments.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">No assignments found</div>
                    ) : (
                      assignments.map((assignment: any) => (
                        <div key={assignment.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-blue-500/30 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="p-1.5 rounded-lg bg-green-500/10"><Stethoscope className="h-3.5 w-3.5 text-green-400" /></div>
                              <span className="text-sm text-foreground truncate">{assignment.doctor_name}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="p-1.5 rounded-lg bg-blue-500/10"><User className="h-3.5 w-3.5 text-blue-400" /></div>
                              <span className="text-sm text-foreground truncate">{assignment.patient_name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {assignment.assigned_date ? new Date(assignment.assigned_date).toLocaleDateString() : ''}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </SpotlightCard>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-4">
            {/* System Health */}
            <SpotlightCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Server className="h-4 w-4 text-orange-400" />
                System Health
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Database', status: systemHealth.database, icon: Database },
                  { label: 'Storage', status: systemHealth.storage, icon: HardDrive },
                  { label: 'ML Service', status: systemHealth.mlService, icon: Cpu },
                ].map(({ label, status, icon: SIcon }) => (
                  <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <SIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${healthDot(status)}`} />
                      <span className="text-xs text-foreground capitalize">{status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SpotlightCard>

            {/* Quick Stats */}
            <SpotlightCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-teal-400" />
                Quick Stats
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                  <span className="text-xs text-muted-foreground">Total Scans</span>
                  <span className="text-sm font-bold text-foreground">{stats?.totalScans || 0}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                  <span className="text-xs text-muted-foreground">This Month</span>
                  <span className="text-sm font-bold text-teal-400">{stats?.scansThisMonth || 0}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                  <span className="text-xs text-muted-foreground">Suspended</span>
                  <span className="text-sm font-bold text-red-400">{stats?.suspendedUsers || 0}</span>
                </div>
              </div>
            </SpotlightCard>

            {/* Generate Reports */}
            <SpotlightCard className="p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-purple-400" />
                Reports
              </h3>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-white/[0.08] text-muted-foreground hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/30">
                  <Activity className="h-3.5 w-3.5" />Usage Report
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-white/[0.08] text-muted-foreground hover:bg-teal-500/10 hover:text-teal-400 hover:border-teal-500/30">
                  <Users className="h-3.5 w-3.5" />User Statistics
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-white/[0.08] text-muted-foreground hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30">
                  <Shield className="h-3.5 w-3.5" />Audit Log
                </Button>
              </div>
            </SpotlightCard>
          </div>
        </div>
      </div>
    </div>
  );
};
