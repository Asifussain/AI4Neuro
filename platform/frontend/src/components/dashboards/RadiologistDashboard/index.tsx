'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRadiologistStats, useMySessions, useDeleteSession } from '@/lib/hooks/useApi';
import { toast } from 'sonner';
import { ReportModal } from '@/components/shared/ReportModal';
import type { MRISession } from '@/lib/api/sessions';
import {
  Upload,
  Activity,
  Clock,
  CheckCircle2,
  Eye,
  Download,
  Search,
  Brain,
  FileText,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  CalendarDays,
  Settings,
  ScanLine,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { DashboardShell, type NavItem } from '@/components/dashboards/shared/DashboardShell';
import {
  SectionCard,
  StatCard as SharedStatCard,
  QuickActionsList,
  DashboardPageHeader,
} from '@/components/dashboards/shared/primitives';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/radiologist/dashboard', icon: LayoutGrid },
  { label: 'Upload Scans', href: '/radiologist/upload', icon: Upload },
  { label: 'Reports', href: '/radiologist/dashboard', icon: FileText },
  { label: 'Processed Cases', href: '/radiologist/dashboard', icon: ScanLine },
  { label: 'Patients', href: '/radiologist/dashboard', icon: Users },
  { label: 'Settings', href: '/profile', icon: Settings },
];

// ============================================================================
// SESSION ROW (List View)
// ============================================================================
function SessionRow({
  session,
  onViewReport,
  onDelete,
}: {
  session: MRISession;
  onViewReport: (session: MRISession) => void;
  onDelete?: (sessionId: string) => void;
}) {
  const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; animate?: boolean }> = {
    completed: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    reviewed: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    processing: { icon: Loader2, color: 'text-amber-600', bg: 'bg-amber-50', animate: true },
    uploaded: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  };

  const status = statusConfig[session.status] || statusConfig.processing;
  const StatusIcon = status.icon;
  const patientName = session.patient?.user_profile?.full_name || 'Unknown';
  const prediction = session.prediction?.prediction;

  return (
    <div className="group p-4 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-indigo-50 shrink-0">
            <Brain className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{session.session_code}</p>
            <p className="text-sm text-slate-500 truncate">
              {patientName} <span className="hidden sm:inline">| {new Date(session.scan_date).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {prediction && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium hidden sm:block ${
              prediction === 'CN' ? 'bg-emerald-50 text-emerald-700'
                : prediction === 'MCI' ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {prediction}
            </div>
          )}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${status.bg}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
            <span className={`text-xs font-medium capitalize ${status.color} hidden sm:inline`}>{session.status}</span>
          </div>
          <div className="flex gap-1">
            {(session.status === 'completed' || session.status === 'reviewed') && (
              <>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-indigo-50" asChild>
                  <Link href={`/radiologist/viewer/${session.id}`}><Eye className="h-4 w-4 text-indigo-600" /></Link>
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-violet-50" onClick={() => onViewReport(session)}>
                  <Download className="h-4 w-4 text-violet-600" />
                </Button>
              </>
            )}
            {onDelete && (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-red-50" onClick={() => onDelete(session.id)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCAN GRID CARD (Grid View)
// ============================================================================
function ScanGridCard({
  session,
  onViewReport,
  onDelete,
}: {
  session: MRISession;
  onViewReport: (session: MRISession) => void;
  onDelete?: (sessionId: string) => void;
}) {
  const prediction = session.prediction?.prediction;
  const confidence = session.prediction?.confidence_score;
  const patientName = session.patient?.user_profile?.full_name || 'Unknown';
  const isCompleted = session.status === 'completed' || session.status === 'reviewed';

  const predictionColors: Record<string, { border: string; bg: string; text: string }> = {
    CN: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    MCI: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
    AD: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700' },
  };
  const pColor = prediction ? predictionColors[prediction] : null;

  const statusColors: Record<string, string> = {
    completed: 'text-emerald-600',
    reviewed: 'text-blue-600',
    processing: 'text-amber-600',
    uploaded: 'text-orange-600',
    failed: 'text-red-600',
  };

  return (
    <SectionCard className={`p-4 h-full flex flex-col ${pColor ? pColor.border : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-900 truncate">{session.session_code}</span>
        </div>
        {prediction && pColor && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${pColor.bg} ${pColor.text}`}>
            {prediction}
          </span>
        )}
      </div>

      <div className="space-y-1.5 mb-3 flex-1">
        <p className="text-sm text-slate-900 truncate">{patientName}</p>
        <p className="text-xs text-slate-500">{new Date(session.scan_date).toLocaleDateString()}</p>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium capitalize ${statusColors[session.status] || 'text-slate-400'}`}>
            {session.status}
          </span>
          {session.status === 'processing' && <Loader2 className="h-3 w-3 text-amber-600 animate-spin" />}
        </div>
      </div>

      {confidence != null && confidence > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Confidence</span>
            <span className="text-slate-800 font-medium">{(confidence * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                prediction === 'CN' ? 'bg-emerald-500' : prediction === 'MCI' ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-1.5 pt-2 border-t border-slate-100">
        {isCompleted && (
          <>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50" asChild>
              <Link href={`/radiologist/viewer/${session.id}`}><Eye className="h-3 w-3" />View</Link>
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => onViewReport(session)}>
              <FileText className="h-3 w-3" />Reports
            </Button>
          </>
        )}
        {!isCompleted && (
          <span className="flex-1 text-xs text-slate-500 text-center py-1">
            {session.status === 'processing' ? 'Analyzing...' : session.status}
          </span>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-red-50" onClick={() => onDelete(session.id)}>
            <Trash2 className="h-3 w-3 text-red-600" />
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// MINI CALENDAR (No External Deps)
// ============================================================================
function MiniCalendar({
  selectedDate,
  onSelectDate,
  scanDates,
}: {
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  scanDates: Set<string>;
}) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const toKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isSelected = (d: number) => {
    if (!selectedDate) return false;
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === d;
  };
  const isToday = (d: number) => {
    const now = new Date();
    return now.getFullYear() === year && now.getMonth() === month && now.getDate() === d;
  };

  return (
    <SectionCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-indigo-600" />
          {monthName}
        </h3>
        <div className="flex gap-1">
          <button onClick={() => setViewMonth(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setViewMonth(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-[10px] text-slate-400 font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const hasScan = scanDates.has(toKey(day));
          const sel = isSelected(day);
          const today = isToday(day);

          return (
            <button
              key={day}
              onClick={() => onSelectDate(sel ? null : new Date(year, month, day))}
              className={`relative text-xs py-1.5 rounded transition-all ${
                sel
                  ? 'bg-indigo-600 text-white font-bold'
                  : today
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {day}
              {hasScan && !sel && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <button
          onClick={() => onSelectDate(null)}
          className="mt-2 w-full text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Clear date filter
        </button>
      )}
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
      <span className="text-sm text-slate-500">
        Showing {from}-{to} of {totalItems}
      </span>
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
              className={`h-8 w-8 p-0 text-xs ${p === currentPage ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
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

function GridCardSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-4 bg-slate-100 rounded" />
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 w-32 bg-slate-100 rounded" />
        <div className="h-3 w-20 bg-slate-100 rounded" />
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full mb-3" />
      <div className="h-7 w-full bg-slate-100 rounded" />
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
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-3 w-20 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="h-6 w-16 bg-slate-100 rounded-full" />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN RADIOLOGIST DASHBOARD
// ============================================================================
export const RadiologistDashboard: React.FC = () => {
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'patient' | 'status'>('date-desc');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [predictionFilter, setPredictionFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [selectedSession, setSelectedSession] = useState<MRISession | null>(null);

  // Data
  const { data: stats, isLoading: statsLoading, error: statsError } = useRadiologistStats();
  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = useMySessions();
  const { deleteSession } = useDeleteSession();

  const allSessions = sessionsData?.data || [];

  const handleDelete = useCallback(async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    const success = await deleteSession(sessionId);
    if (success) {
      toast.success('Session deleted');
      refetchSessions();
    } else {
      toast.error('Failed to delete session');
    }
  }, [deleteSession, refetchSessions]);

  // Scan dates for calendar
  const scanDates = useMemo(() => {
    const dates = new Set<string>();
    allSessions.forEach((s) => {
      const d = new Date(s.scan_date);
      dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    });
    return dates;
  }, [allSessions]);

  // Filtering + sorting + pagination pipeline
  const PAGE_SIZE = 12;

  const filteredSessions = useMemo(() => {
    let result = [...allSessions];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Prediction filter
    if (predictionFilter !== 'all') {
      result = result.filter((s) => s.prediction?.prediction === predictionFilter);
    }

    // Date filter
    if (selectedDate) {
      result = result.filter((s) => {
        const d = new Date(s.scan_date);
        return d.getFullYear() === selectedDate.getFullYear() &&
          d.getMonth() === selectedDate.getMonth() &&
          d.getDate() === selectedDate.getDate();
      });
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((s) =>
        s.session_code.toLowerCase().includes(term) ||
        s.patient?.user_profile?.full_name?.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime();
        case 'date-asc': return new Date(a.scan_date).getTime() - new Date(b.scan_date).getTime();
        case 'patient': return (a.patient?.user_profile?.full_name || '').localeCompare(b.patient?.user_profile?.full_name || '');
        case 'status': return a.status.localeCompare(b.status);
        default: return 0;
      }
    });

    return result;
  }, [allSessions, statusFilter, predictionFilter, selectedDate, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSessions = filteredSessions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  const updateFilter = useCallback((setter: (v: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  // Active filters count
  const activeFilterCount = [
    statusFilter !== 'all',
    predictionFilter !== 'all',
    selectedDate !== null,
    searchTerm !== '',
  ].filter(Boolean).length;

  // Prediction distribution
  const predictionCounts = useMemo(() => {
    const counts = { CN: 0, MCI: 0, AD: 0 };
    allSessions.forEach((s) => {
      const p = s.prediction?.prediction;
      if (p && p in counts) counts[p as keyof typeof counts]++;
    });
    return counts;
  }, [allSessions]);

  // Recent activity
  const recentActivity = useMemo(() => {
    return [...allSessions]
      .sort((a, b) => new Date(b.scan_date).getTime() - new Date(a.scan_date).getTime())
      .slice(0, 5);
  }, [allSessions]);

  const isLoading = statsLoading && sessionsLoading && allSessions.length === 0;

  return (
    <DashboardShell roleLabel="Radiologist" accent="indigo" navItems={NAV_ITEMS}>
      <DashboardPageHeader
        eyebrow="Radiologist"
        title="Radiologist Dashboard"
        description="Scan upload, imaging review, AI output validation, and technical reporting."
        routeChip="/radiologist-dashboard"
        accent="indigo"
      />

      {statsError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          Failed to load stats: {statsError}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <>{[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}</>
        ) : (
          <>
            <SharedStatCard label="Total Scans" value={stats?.totalScans || allSessions.length} icon={Activity} sublabel="All-time processed" accent="indigo" />
            <SharedStatCard label="Processing" value={stats?.processingScans || allSessions.filter((s) => s.status === 'processing').length} icon={Clock} sublabel="Currently in queue" accent="indigo" />
            <SharedStatCard label="Completed Today" value={stats?.completedToday || 0} icon={CheckCircle2} sublabel="Finished today" accent="indigo" />
            <SharedStatCard label="This Week" value={stats?.completedThisWeek || 0} icon={CalendarDays} sublabel="Completed this week" accent="indigo" />
          </>
        )}
      </div>

      {/* Quick actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard className="p-5 lg:col-span-2 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Quick Actions</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">Upload scans and review AI results</p>
          </div>
          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700" asChild>
            <Link href="/radiologist/upload">
              <Upload className="h-4 w-4" />
              Upload Scans
            </Link>
          </Button>
        </SectionCard>
        <QuickActionsList
          accent="indigo"
          actions={[
            { label: 'Upload MRI Scan', href: '/radiologist/upload' },
            { label: 'View Processed Cases', onClick: () => paginatedSessions[0] && setSelectedSession(paginatedSessions[0]) },
          ]}
        />
      </div>

      {/* Main Content + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="xl:col-span-3 space-y-4">
          {/* Toolbar */}
          <SectionCard className="p-4">
            <div className="flex flex-col gap-3">
              {/* Top row: View toggle, filters button, search, sort */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* View mode toggle */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:bg-slate-50'}`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:bg-slate-50'}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>

                {/* Filter toggle */}
                <Button
                  size="sm"
                  variant="outline"
                  className={`gap-1.5 ${showFilters || activeFilterCount > 0 ? 'border-indigo-200 text-indigo-700' : 'border-slate-200'}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>

                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by session or patient..."
                    className="pl-9 h-9 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400"
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
                    <option value="date-desc">Newest</option>
                    <option value="date-asc">Oldest</option>
                    <option value="patient">Patient</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>

              {/* Filter dropdowns (collapsible) */}
              {showFilters && (
                <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Status:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => updateFilter(setStatusFilter, e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 px-2 py-1 outline-none focus:border-indigo-400"
                    >
                      <option value="all">All</option>
                      <option value="completed">Completed</option>
                      <option value="processing">Processing</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="uploaded">Uploaded</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Prediction:</span>
                    <select
                      value={predictionFilter}
                      onChange={(e) => updateFilter(setPredictionFilter, e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 px-2 py-1 outline-none focus:border-indigo-400"
                    >
                      <option value="all">All</option>
                      <option value="CN">CN - Normal</option>
                      <option value="MCI">MCI - Mild Impairment</option>
                      <option value="AD">AD - Alzheimer&apos;s</option>
                    </select>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setStatusFilter('all');
                        setPredictionFilter('all');
                        setSelectedDate(null);
                        setSearchTerm('');
                        setCurrentPage(1);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 ml-auto"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {statusFilter !== 'all' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                  Status: {statusFilter}
                  <button onClick={() => updateFilter(setStatusFilter, 'all')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {predictionFilter !== 'all' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-medium">
                  Prediction: {predictionFilter}
                  <button onClick={() => updateFilter(setPredictionFilter, 'all')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {selectedDate && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                  Date: {selectedDate.toLocaleDateString()}
                  <button onClick={() => updateFilter(setSelectedDate, null)}><X className="h-3 w-3" /></button>
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
              {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}
              {activeFilterCount > 0 && ` (filtered from ${allSessions.length})`}
            </span>
          </div>

          {/* Sessions Display */}
          {sessionsLoading && allSessions.length === 0 ? (
            viewMode === 'grid' ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => <GridCardSkeleton key={i} />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <RowSkeleton key={i} />)}
              </div>
            )
          ) : paginatedSessions.length === 0 ? (
            <SectionCard className="p-12">
              <div className="text-center">
                <div className="p-4 rounded-full bg-indigo-50 w-fit mx-auto mb-4">
                  <Brain className="h-8 w-8 text-indigo-600" />
                </div>
                <p className="text-slate-900 font-medium mb-1">No sessions found</p>
                <p className="text-sm text-slate-500">
                  {activeFilterCount > 0
                    ? 'Try adjusting your filters'
                    : 'Upload a new MRI scan to get started'}
                </p>
                {activeFilterCount === 0 && (
                  <Button className="mt-4 gap-2" variant="outline" asChild>
                    <Link href="/radiologist/upload"><Upload className="h-4 w-4" />Upload Scan</Link>
                  </Button>
                )}
              </div>
            </SectionCard>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {paginatedSessions.map((session) => (
                <ScanGridCard
                  key={session.id}
                  session={session}
                  onViewReport={setSelectedSession}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedSessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  onViewReport={setSelectedSession}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={filteredSessions.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Mini Calendar */}
          <MiniCalendar
            selectedDate={selectedDate}
            onSelectDate={(d) => updateFilter(setSelectedDate, d)}
            scanDates={scanDates}
          />

          {/* Recent Activity */}
          <SectionCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-indigo-600" />
              Recent Activity
            </h3>
            <div className="space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-500">No recent activity</p>
              ) : (
                recentActivity.map((s) => {
                  const statusIcons: Record<string, { icon: React.ElementType; color: string }> = {
                    completed: { icon: CheckCircle, color: 'text-emerald-600' },
                    reviewed: { icon: CheckCircle, color: 'text-blue-600' },
                    processing: { icon: Loader2, color: 'text-amber-600' },
                    failed: { icon: AlertCircle, color: 'text-red-600' },
                    uploaded: { icon: Clock, color: 'text-orange-600' },
                  };
                  const si = statusIcons[s.status] || statusIcons.uploaded;
                  const SIcon = si.icon;
                  return (
                    <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <SIcon className={`h-3.5 w-3.5 shrink-0 ${si.color} ${s.status === 'processing' ? 'animate-spin' : ''}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-900 truncate">{s.session_code}</p>
                        <p className="text-[10px] text-slate-500">{new Date(s.scan_date).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[10px] capitalize ${si.color}`}>{s.status}</span>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          {/* Prediction Distribution */}
          <SectionCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-violet-600" />
              Prediction Distribution
            </h3>
            <div className="space-y-2">
              {(['CN', 'MCI', 'AD'] as const).map((cls) => {
                const total = predictionCounts.CN + predictionCounts.MCI + predictionCounts.AD;
                const pct = total > 0 ? (predictionCounts[cls] / total) * 100 : 0;
                const colors = { CN: 'bg-emerald-500', MCI: 'bg-amber-500', AD: 'bg-red-500' };
                const labels = { CN: 'Normal', MCI: 'MCI', AD: "Alzheimer's" };
                return (
                  <div key={cls}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{labels[cls]}</span>
                      <span className="text-slate-800 font-medium">{predictionCounts[cls]}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[cls]} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>

      <ReportModal session={selectedSession} onClose={() => setSelectedSession(null)} userRole="radiologist" />
    </DashboardShell>
  );
};
